import { readFileSync, existsSync, watchFile } from 'fs';
import { join } from 'path';
import pino from 'pino';
import { z } from 'zod';

const logger = pino({
  name: 'config',
  level: process.env.LOG_LEVEL || 'info'
});

// Configuration schema using Zod for validation
const ConfigSchema = z.object({
  // BitBrowser configuration
  bitBrowser: z.object({
    apiUrl: z.string().url().default('http://localhost:54345'),
    timeout: z.number().min(1000).default(30000),
    retryAttempts: z.number().min(0).default(3),
    retryDelay: z.number().min(100).default(1000)
  }),

  // Database configuration
  database: z.object({
    connectionString: z.string().optional(),
    host: z.string().default('localhost'),
    port: z.number().default(5432),
    database: z.string().default('youtube_uploader'),
    user: z.string().default('postgres'),
    password: z.string().optional(),
    poolSize: z.number().min(1).default(10),
    idleTimeout: z.number().default(30000),
    connectionTimeout: z.number().default(5000)
  }),

  // Redis configuration
  redis: z.object({
    url: z.string().optional(),
    host: z.string().default('localhost'),
    port: z.number().default(6379),
    password: z.string().optional(),
    db: z.number().default(0),
    keyPrefix: z.string().default('youtube:'),
    enableOfflineQueue: z.boolean().default(true),
    maxRetriesPerRequest: z.number().default(3)
  }),

  // Browser pool configuration
  browserPool: z.object({
    minInstances: z.number().min(0).default(2),
    maxInstances: z.number().min(1).default(10),
    idleTimeout: z.number().default(300000), // 5 minutes
    healthCheckInterval: z.number().default(30000), // 30 seconds
    acquireTimeout: z.number().default(30000) // 30 seconds
  }),

  // Queue configuration
  queue: z.object({
    concurrency: z.number().min(1).default(5),
    defaultPriority: z.number().default(0),
    maxRetries: z.number().min(0).default(3),
    retryDelay: z.number().default(60000), // 1 minute
    rateLimit: z.object({
      max: z.number().min(1).default(100),
      duration: z.number().min(1000).default(3600000) // 1 hour
    }).optional()
  }),

  // Account management configuration
  accounts: z.object({
    dailyUploadLimit: z.number().min(1).default(10),
    minHealthScore: z.number().min(0).max(100).default(50),
    healthScoreDecrement: z.number().min(1).default(10),
    healthScoreIncrement: z.number().min(1).default(2),
    selectionStrategy: z.enum(['health-score', 'round-robin', 'least-used']).default('health-score'),
    reservationTimeout: z.number().default(300000) // 5 minutes
  }),

  // Monitoring configuration
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metricsInterval: z.number().default(60000), // 1 minute
    healthCheckInterval: z.number().default(60000), // 1 minute
    alertThresholds: z.object({
      errorRate: z.number().default(10), // errors per minute
      criticalErrors: z.number().default(3),
      consecutiveErrors: z.number().default(5),
      lowHealthAccounts: z.number().default(0.5) // 50% threshold
    })
  }),

  // Security configuration
  security: z.object({
    encryptionAlgorithm: z.string().default('aes-256-gcm'),
    keyDerivationRounds: z.number().default(100000),
    bcryptRounds: z.number().default(12),
    tokenLength: z.number().default(32),
    sessionTimeout: z.number().default(86400000), // 24 hours
    enableApiAuth: z.boolean().default(true)
  }),

  // API configuration
  api: z.object({
    enabled: z.boolean().default(true),
    port: z.number().default(3000),
    host: z.string().default('0.0.0.0'),
    cors: z.object({
      enabled: z.boolean().default(true),
      origin: z.union([z.string(), z.array(z.string())]).default('*'),
      credentials: z.boolean().default(true)
    }),
    rateLimit: z.object({
      enabled: z.boolean().default(true),
      windowMs: z.number().default(900000), // 15 minutes
      max: z.number().default(100)
    })
  }),

  // Logging configuration
  logging: z.object({
    level: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    pretty: z.boolean().default(false),
    timestamp: z.boolean().default(true),
    redact: z.array(z.string()).default(['password', 'token', 'secret'])
  }),

  // Feature flags
  features: z.object({
    matrixMode: z.boolean().default(true),
    autoRecovery: z.boolean().default(true),
    circuitBreaker: z.boolean().default(true),
    rateLimiting: z.boolean().default(true),
    healthMonitoring: z.boolean().default(true),
    keyRotation: z.boolean().default(false)
  })
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Configuration manager with hot-reloading support
 */
export class ConfigManager {
  private config: Config;
  private configPath?: string;
  private watchers: Map<string, () => void> = new Map();
  private reloadCallbacks: Array<(config: Config) => void> = [];

  constructor(configPath?: string) {
    this.configPath = configPath;
    this.config = this.loadConfig();
    
    if (this.configPath && existsSync(this.configPath)) {
      this.enableHotReload();
    }
  }

  /**
   * Load configuration from various sources
   */
  private loadConfig(): Config {
    let config: any = {};

    // 1. Load defaults (already in schema)
    
    // 2. Load from config file if exists
    if (this.configPath && existsSync(this.configPath)) {
      try {
        const fileContent = readFileSync(this.configPath, 'utf8');
        const fileConfig = JSON.parse(fileContent);
        config = this.deepMerge(config, fileConfig);
        logger.info({ path: this.configPath }, 'Loaded configuration from file');
      } catch (error) {
        logger.error({ path: this.configPath, error }, 'Failed to load config file');
      }
    }

    // 3. Load from environment variables
    config = this.loadFromEnv(config);

    // 4. Validate configuration
    try {
      const validated = ConfigSchema.parse(config);
      logger.info('Configuration validated successfully');
      return validated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error({ errors: error.issues }, 'Configuration validation failed');
        throw new Error(`Invalid configuration: ${error.issues.map((e: any) => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnv(config: any): any {
    // BitBrowser
    if (process.env.BITBROWSER_API_URL) {
      config.bitBrowser = config.bitBrowser || {};
      config.bitBrowser.apiUrl = process.env.BITBROWSER_API_URL;
    }

    // Database
    if (process.env.DATABASE_URL) {
      config.database = config.database || {};
      config.database.connectionString = process.env.DATABASE_URL;
    } else {
      config.database = config.database || {};
      if (process.env.DB_HOST) config.database.host = process.env.DB_HOST;
      if (process.env.DB_PORT) config.database.port = parseInt(process.env.DB_PORT);
      if (process.env.DB_NAME) config.database.database = process.env.DB_NAME;
      if (process.env.DB_USER) config.database.user = process.env.DB_USER;
      if (process.env.DB_PASSWORD) config.database.password = process.env.DB_PASSWORD;
    }

    // Redis
    if (process.env.REDIS_URL) {
      config.redis = config.redis || {};
      config.redis.url = process.env.REDIS_URL;
    } else {
      config.redis = config.redis || {};
      if (process.env.REDIS_HOST) config.redis.host = process.env.REDIS_HOST;
      if (process.env.REDIS_PORT) config.redis.port = parseInt(process.env.REDIS_PORT);
      if (process.env.REDIS_PASSWORD) config.redis.password = process.env.REDIS_PASSWORD;
    }

    // API
    if (process.env.API_PORT) {
      config.api = config.api || {};
      config.api.port = parseInt(process.env.API_PORT);
    }

    // Logging
    if (process.env.LOG_LEVEL) {
      config.logging = config.logging || {};
      config.logging.level = process.env.LOG_LEVEL;
    }

    // Features
    if (process.env.FEATURE_MATRIX_MODE !== undefined) {
      config.features = config.features || {};
      config.features.matrixMode = process.env.FEATURE_MATRIX_MODE === 'true';
    }

    return config;
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    const output = { ...target };
    
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            output[key] = source[key];
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          output[key] = source[key];
        }
      });
    }
    
    return output;
  }

  /**
   * Check if value is an object
   */
  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Enable hot-reload for configuration file
   */
  private enableHotReload(): void {
    if (!this.configPath) return;

    watchFile(this.configPath, () => {
      logger.info('Configuration file changed, reloading...');
      
      try {
        const newConfig = this.loadConfig();
        this.config = newConfig;
        
        // Notify callbacks
        this.reloadCallbacks.forEach(callback => {
          try {
            callback(newConfig);
          } catch (error) {
            logger.error({ error }, 'Reload callback failed');
          }
        });
        
        logger.info('Configuration reloaded successfully');
      } catch (error) {
        logger.error({ error }, 'Failed to reload configuration');
      }
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): Config {
    return this.config;
  }

  /**
   * Get specific configuration section
   */
  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  /**
   * Update configuration (runtime only)
   */
  update(updates: Partial<Config>): void {
    try {
      const merged = this.deepMerge(this.config, updates);
      const validated = ConfigSchema.parse(merged);
      this.config = validated;
      
      // Notify callbacks
      this.reloadCallbacks.forEach(callback => {
        try {
          callback(validated);
        } catch (error) {
          logger.error({ error }, 'Update callback failed');
        }
      });
      
      logger.info('Configuration updated');
    } catch (error) {
      logger.error({ error }, 'Configuration update failed');
      throw error;
    }
  }

  /**
   * Register reload callback
   */
  onReload(callback: (config: Config) => void): void {
    this.reloadCallbacks.push(callback);
  }

  /**
   * Export configuration as JSON
   */
  toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors?: z.ZodError } {
    try {
      ConfigSchema.parse(this.config);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { valid: false, errors: error };
      }
      throw error;
    }
  }
}

// Create singleton instance
let configManager: ConfigManager | null = null;

/**
 * Get configuration manager instance
 */
export function getConfigManager(configPath?: string): ConfigManager {
  if (!configManager) {
    configManager = new ConfigManager(configPath || process.env.CONFIG_PATH);
  }
  return configManager;
}

/**
 * Get current configuration
 */
export function getConfig(): Config {
  return getConfigManager().getConfig();
}