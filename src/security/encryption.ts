import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { getDatabase } from '../database/connection';
import pino from 'pino';

const logger = pino({
  name: 'encryption',
  level: process.env.LOG_LEVEL || 'info'
});

export interface EncryptionConfig {
  algorithm?: string;
  keyDerivationRounds?: number;
  saltRounds?: number;
}

export interface EncryptedData {
  algorithm: string;
  iv: string;
  authTag: string;
  encrypted: string;
}

export interface KeyInfo {
  id: string;
  name: string;
  createdAt: Date;
  rotatedAt?: Date;
  active: boolean;
}

/**
 * Credential encryption service
 */
export class EncryptionService {
  private config: Required<EncryptionConfig>;
  private db = getDatabase();
  private masterKey?: Buffer;
  private keyCache: Map<string, Buffer> = new Map();

  constructor(config: EncryptionConfig = {}) {
    this.config = {
      algorithm: config.algorithm || 'aes-256-gcm',
      keyDerivationRounds: config.keyDerivationRounds || 100000,
      saltRounds: config.saltRounds || 12
    };

    // Initialize master key from environment
    this.initializeMasterKey();
  }

  /**
   * Initialize master key from environment
   */
  private initializeMasterKey(): void {
    const masterKeyBase64 = process.env.ENCRYPTION_MASTER_KEY;
    
    if (!masterKeyBase64) {
      logger.warn('No master key found, generating new one');
      this.masterKey = crypto.randomBytes(32);
      logger.info(`Generated master key: ${this.masterKey.toString('base64')}`);
      logger.warn('Please set ENCRYPTION_MASTER_KEY environment variable');
    } else {
      try {
        this.masterKey = Buffer.from(masterKeyBase64, 'base64');
        if (this.masterKey.length !== 32) {
          throw new Error('Master key must be 32 bytes');
        }
        logger.info('Master key loaded from environment');
      } catch (error) {
        logger.error({ error }, 'Invalid master key format');
        throw new Error('Invalid ENCRYPTION_MASTER_KEY');
      }
    }
  }

  /**
   * Encrypt sensitive data
   */
  async encrypt(plaintext: string, keyId?: string): Promise<EncryptedData> {
    try {
      // Get encryption key
      const key = await this.getEncryptionKey(keyId);
      
      // Generate IV
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.config.algorithm, key, iv);
      
      // Encrypt data
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ]);
      
      // Get auth tag for GCM mode
      const authTag = cipher.getAuthTag();
      
      return {
        algorithm: this.config.algorithm,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        encrypted: encrypted.toString('base64')
      };
      
    } catch (error) {
      logger.error({ error }, 'Encryption failed');
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decrypt(encryptedData: EncryptedData, keyId?: string): Promise<string> {
    try {
      // Get decryption key
      const key = await this.getEncryptionKey(keyId);
      
      // Parse encrypted data
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const authTag = Buffer.from(encryptedData.authTag, 'base64');
      const encrypted = Buffer.from(encryptedData.encrypted, 'base64');
      
      // Create decipher
      const decipher = crypto.createDecipheriv(encryptedData.algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return decrypted.toString('utf8');
      
    } catch (error) {
      logger.error({ error }, 'Decryption failed');
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.saltRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Get or derive encryption key
   */
  private async getEncryptionKey(keyId?: string): Promise<Buffer> {
    // Use default key if no keyId specified
    if (!keyId) {
      keyId = 'default';
    }

    // Check cache
    const cached = this.keyCache.get(keyId);
    if (cached) {
      return cached;
    }

    // Derive key from master key
    const key = await this.deriveKey(keyId);
    
    // Cache the key
    this.keyCache.set(keyId, key);
    
    return key;
  }

  /**
   * Derive key from master key
   */
  private async deriveKey(keyId: string): Promise<Buffer> {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        this.masterKey!,
        keyId,
        this.config.keyDerivationRounds,
        32,
        'sha256',
        (err, derivedKey) => {
          if (err) {
            reject(err);
          } else {
            resolve(derivedKey);
          }
        }
      );
    });
  }

  /**
   * Encrypt credentials for storage
   */
  async encryptCredentials(email: string, password: string, recoveryEmail?: string): Promise<string> {
    const credentials = {
      email,
      password,
      recoveryEmail,
      timestamp: new Date().toISOString()
    };

    const plaintext = JSON.stringify(credentials);
    const encrypted = await this.encrypt(plaintext);
    
    return JSON.stringify(encrypted);
  }

  /**
   * Decrypt stored credentials
   */
  async decryptCredentials(encryptedCredentials: string): Promise<{
    email: string;
    password: string;
    recoveryEmail?: string;
  }> {
    try {
      const encrypted = JSON.parse(encryptedCredentials) as EncryptedData;
      const plaintext = await this.decrypt(encrypted);
      const credentials = JSON.parse(plaintext);
      
      return {
        email: credentials.email,
        password: credentials.password,
        recoveryEmail: credentials.recoveryEmail
      };
      
    } catch (error) {
      logger.error({ error }, 'Failed to decrypt credentials');
      throw new Error('Invalid encrypted credentials');
    }
  }

  /**
   * Generate new encryption key
   */
  async generateKey(name: string): Promise<KeyInfo> {
    const keyId = `key-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    
    try {
      // Store key metadata in database
      const result = await this.db.query(
        `INSERT INTO encryption_keys (id, name, active, created_at)
         VALUES ($1, $2, true, CURRENT_TIMESTAMP)
         RETURNING *`,
        [keyId, name]
      );

      const keyInfo: KeyInfo = {
        id: result.rows[0].id,
        name: result.rows[0].name,
        createdAt: result.rows[0].created_at,
        active: result.rows[0].active
      };

      logger.info({ keyId, name }, 'Generated new encryption key');
      
      return keyInfo;

    } catch (error) {
      logger.error({ error }, 'Failed to generate key');
      throw error;
    }
  }

  /**
   * Rotate encryption keys
   */
  async rotateKeys(): Promise<void> {
    logger.info('Starting key rotation');

    try {
      // Generate new key
      const newKey = await this.generateKey('rotated-key');

      // Get all encrypted data that needs re-encryption
      const accounts = await this.db.query(
        'SELECT id, encrypted_credentials FROM accounts'
      );

      // Re-encrypt with new key
      for (const account of accounts.rows) {
        try {
          // Decrypt with old key
          const credentials = await this.decryptCredentials(account.encrypted_credentials);
          
          // Encrypt with new key
          const newEncrypted = await this.encryptCredentials(
            credentials.email,
            credentials.password,
            credentials.recoveryEmail
          );

          // Update database
          await this.db.query(
            'UPDATE accounts SET encrypted_credentials = $1 WHERE id = $2',
            [newEncrypted, account.id]
          );

        } catch (error) {
          logger.error({ accountId: account.id, error }, 'Failed to rotate key for account');
        }
      }

      // Mark old keys as inactive
      await this.db.query(
        `UPDATE encryption_keys 
         SET active = false, rotated_at = CURRENT_TIMESTAMP 
         WHERE active = true AND id != $1`,
        [newKey.id]
      );

      logger.info({ newKeyId: newKey.id }, 'Key rotation completed');

    } catch (error) {
      logger.error({ error }, 'Key rotation failed');
      throw error;
    }
  }

  /**
   * Validate credential format
   */
  validateCredentials(email: string, password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    }

    // Password validation
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate secure random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  /**
   * Clear key cache
   */
  clearCache(): void {
    this.keyCache.clear();
    logger.info('Encryption key cache cleared');
  }
}

/**
 * Create singleton encryption service
 */
let encryptionService: EncryptionService | null = null;

export function getEncryptionService(config?: EncryptionConfig): EncryptionService {
  if (!encryptionService) {
    encryptionService = new EncryptionService(config);
  }
  return encryptionService;
}