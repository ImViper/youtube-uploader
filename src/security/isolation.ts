import { BitBrowserManager } from '../bitbrowser/manager';
import { getDatabase } from '../database/connection';
import { getEncryptionService } from './encryption';
import pino from 'pino';
import { createHash } from 'crypto';

const logger = pino({
  name: 'security-isolation',
  level: process.env.LOG_LEVEL || 'info'
});

export interface ProxyConfig {
  type: 'http' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface BrowserProfileSecurity {
  profileId: string;
  accountId: string;
  proxy?: ProxyConfig;
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
  timezone?: string;
  locale?: string;
  webrtcIp?: string;
  canvasFingerprint?: string;
  audioFingerprint?: string;
  fonts?: string[];
}

export interface AccessControl {
  resource: string;
  action: string;
  principal: string;
  allowed: boolean;
  conditions?: Record<string, any>;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  action: string;
  resource: string;
  principal: string;
  result: 'success' | 'failure';
  metadata?: Record<string, any>;
}

/**
 * Security isolation manager
 */
export class SecurityIsolationManager {
  private db = getDatabase();
  private encryptionService = getEncryptionService();
  private accessControlRules: Map<string, AccessControl[]> = new Map();

  constructor(private browserManager: BitBrowserManager) {
    this.loadAccessControlRules();
  }

  /**
   * Configure browser profile security
   */
  async configureBrowserProfile(
    profileId: string,
    accountId: string,
    config?: Partial<BrowserProfileSecurity>
  ): Promise<void> {
    logger.info({ profileId, accountId }, 'Configuring browser profile security');

    try {
      // Generate profile-specific settings
      const profileSecurity: BrowserProfileSecurity = {
        profileId,
        accountId,
        proxy: config?.proxy,
        userAgent: config?.userAgent || this.generateUserAgent(),
        viewport: config?.viewport || this.generateViewport(),
        timezone: config?.timezone || this.generateTimezone(),
        locale: config?.locale || this.generateLocale(),
        webrtcIp: config?.webrtcIp || this.generateWebRTCIP(),
        canvasFingerprint: config?.canvasFingerprint || this.generateCanvasFingerprint(),
        audioFingerprint: config?.audioFingerprint || this.generateAudioFingerprint(),
        fonts: config?.fonts || this.generateFontList()
      };

      // Store encrypted proxy credentials if present
      if (profileSecurity.proxy?.password) {
        const encryptedProxy = await this.encryptionService.encrypt(
          JSON.stringify(profileSecurity.proxy)
        );
        profileSecurity.proxy = encryptedProxy as any;
      }

      // Store profile security settings
      await this.db.query(
        `INSERT INTO browser_profile_security (
          profile_id, account_id, proxy_config, user_agent,
          viewport, timezone, locale, webrtc_ip,
          canvas_fingerprint, audio_fingerprint, fonts
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (profile_id) DO UPDATE SET
          account_id = $2,
          proxy_config = $3,
          user_agent = $4,
          viewport = $5,
          timezone = $6,
          locale = $7,
          webrtc_ip = $8,
          canvas_fingerprint = $9,
          audio_fingerprint = $10,
          fonts = $11,
          updated_at = CURRENT_TIMESTAMP`,
        [
          profileId,
          accountId,
          profileSecurity.proxy ? JSON.stringify(profileSecurity.proxy) : null,
          profileSecurity.userAgent,
          JSON.stringify(profileSecurity.viewport),
          profileSecurity.timezone,
          profileSecurity.locale,
          profileSecurity.webrtcIp,
          profileSecurity.canvasFingerprint,
          profileSecurity.audioFingerprint,
          JSON.stringify(profileSecurity.fonts)
        ]
      );

      // Apply to BitBrowser if profile exists
      await this.applySecurityToBrowser(profileId, profileSecurity);

      logger.info({ profileId }, 'Browser profile security configured');

    } catch (error) {
      logger.error({ profileId, error }, 'Failed to configure browser profile security');
      throw error;
    }
  }

  /**
   * Apply security settings to browser
   */
  private async applySecurityToBrowser(
    profileId: string,
    security: BrowserProfileSecurity
  ): Promise<void> {
    try {
      // This would integrate with BitBrowser API to apply settings
      // For now, we'll store them for when the browser is launched
      logger.debug({ profileId }, 'Security settings ready for browser launch');
    } catch (error) {
      logger.error({ profileId, error }, 'Failed to apply security to browser');
    }
  }

  /**
   * Verify data isolation between profiles
   */
  async verifyDataIsolation(profileId1: string, profileId2: string): Promise<boolean> {
    logger.info({ profileId1, profileId2 }, 'Verifying data isolation');

    try {
      // Check for any shared resources
      const sharedResources = await this.db.query(
        `SELECT COUNT(*) as shared_count
         FROM (
           SELECT resource_id FROM browser_profile_resources WHERE profile_id = $1
           INTERSECT
           SELECT resource_id FROM browser_profile_resources WHERE profile_id = $2
         ) as shared`,
        [profileId1, profileId2]
      );

      const isIsolated = sharedResources.rows[0].shared_count === '0';

      if (!isIsolated) {
        logger.warn({ profileId1, profileId2 }, 'Data isolation violation detected');
      }

      // Audit the check
      await this.auditAction({
        action: 'verify_isolation',
        resource: `profiles:${profileId1}:${profileId2}`,
        principal: 'system',
        result: isIsolated ? 'success' : 'failure',
        metadata: { shared_count: sharedResources.rows[0].shared_count }
      });

      return isIsolated;

    } catch (error) {
      logger.error({ profileId1, profileId2, error }, 'Failed to verify data isolation');
      return false;
    }
  }

  /**
   * Check access control
   */
  async checkAccess(
    principal: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    // Get rules for resource
    const rules = this.accessControlRules.get(resource) || [];
    
    // Check specific rules first
    for (const rule of rules) {
      if (rule.principal === principal && rule.action === action) {
        // Evaluate conditions if any
        if (rule.conditions) {
          const conditionsMet = await this.evaluateConditions(rule.conditions);
          if (!conditionsMet) continue;
        }
        
        // Audit the access check
        await this.auditAction({
          action: `access_check:${action}`,
          resource,
          principal,
          result: rule.allowed ? 'success' : 'failure'
        });
        
        return rule.allowed;
      }
    }

    // Default deny
    await this.auditAction({
      action: `access_check:${action}`,
      resource,
      principal,
      result: 'failure',
      metadata: { reason: 'no_matching_rule' }
    });

    return false;
  }

  /**
   * Evaluate access conditions
   */
  private async evaluateConditions(conditions: Record<string, any>): Promise<boolean> {
    // Implement condition evaluation logic
    // For now, return true
    return true;
  }

  /**
   * Audit security action
   */
  async auditAction(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO security_audit_log (
          action, resource, principal, result, metadata
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          log.action,
          log.resource,
          log.principal,
          log.result,
          JSON.stringify(log.metadata || {})
        ]
      );
    } catch (error) {
      logger.error({ log, error }, 'Failed to audit action');
    }
  }

  /**
   * Get proxy configuration for account
   */
  async getProxyForAccount(accountId: string): Promise<ProxyConfig | null> {
    try {
      const result = await this.db.query(
        `SELECT proxy_config 
         FROM browser_profile_security bps
         JOIN accounts a ON a.browser_profile_id = bps.profile_id
         WHERE a.id = $1`,
        [accountId]
      );

      if (result.rows.length === 0 || !result.rows[0].proxy_config) {
        return null;
      }

      const encryptedProxy = result.rows[0].proxy_config;
      
      // Decrypt if encrypted
      if (encryptedProxy.encrypted) {
        const decrypted = await this.encryptionService.decrypt(encryptedProxy);
        return JSON.parse(decrypted);
      }

      return encryptedProxy;

    } catch (error) {
      logger.error({ accountId, error }, 'Failed to get proxy configuration');
      return null;
    }
  }

  /**
   * Add access control rule
   */
  addAccessRule(rule: AccessControl): void {
    const rules = this.accessControlRules.get(rule.resource) || [];
    rules.push(rule);
    this.accessControlRules.set(rule.resource, rules);
    
    logger.info({ rule }, 'Access control rule added');
  }

  /**
   * Load access control rules from database
   */
  private async loadAccessControlRules(): Promise<void> {
    try {
      const result = await this.db.query(
        'SELECT * FROM access_control_rules WHERE active = true'
      );

      for (const row of result.rows) {
        this.addAccessRule({
          resource: row.resource,
          action: row.action,
          principal: row.principal,
          allowed: row.allowed,
          conditions: row.conditions
        });
      }

      logger.info({ count: result.rows.length }, 'Access control rules loaded');

    } catch (error) {
      logger.error({ error }, 'Failed to load access control rules');
    }
  }

  /**
   * Generate random user agent
   */
  private generateUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * Generate random viewport
   */
  private generateViewport(): { width: number; height: number } {
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1536, height: 864 }
    ];
    return viewports[Math.floor(Math.random() * viewports.length)];
  }

  /**
   * Generate random timezone
   */
  private generateTimezone(): string {
    const timezones = [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris'
    ];
    return timezones[Math.floor(Math.random() * timezones.length)];
  }

  /**
   * Generate random locale
   */
  private generateLocale(): string {
    const locales = ['en-US', 'en-GB', 'en-CA', 'en-AU'];
    return locales[Math.floor(Math.random() * locales.length)];
  }

  /**
   * Generate WebRTC IP
   */
  private generateWebRTCIP(): string {
    // Generate random local IP
    return `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  /**
   * Generate canvas fingerprint
   */
  private generateCanvasFingerprint(): string {
    // Generate deterministic but unique fingerprint
    const data = `canvas-${Date.now()}-${Math.random()}`;
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Generate audio fingerprint
   */
  private generateAudioFingerprint(): string {
    // Generate deterministic but unique fingerprint
    const data = `audio-${Date.now()}-${Math.random()}`;
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Generate font list
   */
  private generateFontList(): string[] {
    const fontSets = [
      ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana'],
      ['Arial', 'Courier New', 'Georgia', 'Tahoma', 'Trebuchet MS'],
      ['Helvetica', 'Arial', 'Verdana', 'Geneva', 'Optima']
    ];
    return fontSets[Math.floor(Math.random() * fontSets.length)];
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(
    filters?: {
      action?: string;
      resource?: string;
      principal?: string;
      startDate?: Date;
      endDate?: Date;
      result?: 'success' | 'failure';
    }
  ): Promise<AuditLog[]> {
    let query = 'SELECT * FROM security_audit_log WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.action) {
      query += ` AND action = $${paramIndex++}`;
      params.push(filters.action);
    }

    if (filters?.resource) {
      query += ` AND resource = $${paramIndex++}`;
      params.push(filters.resource);
    }

    if (filters?.principal) {
      query += ` AND principal = $${paramIndex++}`;
      params.push(filters.principal);
    }

    if (filters?.result) {
      query += ` AND result = $${paramIndex++}`;
      params.push(filters.result);
    }

    if (filters?.startDate) {
      query += ` AND timestamp >= $${paramIndex++}`;
      params.push(filters.startDate);
    }

    if (filters?.endDate) {
      query += ` AND timestamp <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    query += ' ORDER BY timestamp DESC LIMIT 1000';

    try {
      const result = await this.db.query(query, params);
      return result.rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        action: row.action,
        resource: row.resource,
        principal: row.principal,
        result: row.result,
        metadata: row.metadata
      }));
    } catch (error) {
      logger.error({ filters, error }, 'Failed to get audit logs');
      return [];
    }
  }
}