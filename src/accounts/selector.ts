import { AccountManager, AccountProfile } from './manager';
import { getRedis } from '../redis/connection';
import pino from 'pino';

const logger = pino({
  name: 'account-selector',
  level: process.env.LOG_LEVEL || 'info'
});

export interface AccountSelectionStrategy {
  name: string;
  select(accounts: AccountProfile[]): AccountProfile | null;
}

export class HealthScoreStrategy implements AccountSelectionStrategy {
  name = 'health-score';

  select(accounts: AccountProfile[]): AccountProfile | null {
    if (accounts.length === 0) return null;
    
    // Sort by health score (descending) and daily upload count (ascending)
    accounts.sort((a, b) => {
      if (a.healthScore !== b.healthScore) {
        return b.healthScore - a.healthScore;
      }
      return a.dailyUploadCount - b.dailyUploadCount;
    });

    return accounts[0];
  }
}

export class RoundRobinStrategy implements AccountSelectionStrategy {
  name = 'round-robin';
  private lastIndex = 0;

  select(accounts: AccountProfile[]): AccountProfile | null {
    if (accounts.length === 0) return null;
    
    this.lastIndex = (this.lastIndex + 1) % accounts.length;
    return accounts[this.lastIndex];
  }
}

export class LeastUsedStrategy implements AccountSelectionStrategy {
  name = 'least-used';

  select(accounts: AccountProfile[]): AccountProfile | null {
    if (accounts.length === 0) return null;
    
    // Sort by daily upload count (ascending)
    accounts.sort((a, b) => a.dailyUploadCount - b.dailyUploadCount);
    return accounts[0];
  }
}

export interface AccountSelectorConfig {
  strategy?: AccountSelectionStrategy;
  minHealthScore?: number;
  reservationTimeout?: number; // ms
}

export class AccountSelector {
  private accountManager: AccountManager;
  private redis = getRedis();
  private config: AccountSelectorConfig;
  private reservationPrefix = 'account:reserved:';
  private defaultReservationTimeout = 300000; // 5 minutes

  constructor(accountManager: AccountManager, config: AccountSelectorConfig = {}) {
    this.accountManager = accountManager;
    this.config = {
      strategy: config.strategy || new HealthScoreStrategy(),
      minHealthScore: config.minHealthScore || 50,
      reservationTimeout: config.reservationTimeout || this.defaultReservationTimeout,
      ...config
    };
  }

  /**
   * Select an available account for upload
   */
  async selectAccount(requesterId: string): Promise<AccountProfile | null> {
    logger.info({ requesterId, strategy: this.config.strategy!.name }, 'Selecting account');

    try {
      // Get available accounts
      const accounts = await this.accountManager.listAccounts({
        status: 'active',
        minHealthScore: this.config.minHealthScore,
        hasAvailableUploads: true
      });

      if (accounts.length === 0) {
        logger.warn('No available accounts found');
        return null;
      }

      // Filter out reserved accounts
      const availableAccounts: AccountProfile[] = [];
      for (const account of accounts) {
        const isReserved = await this.isAccountReserved(account.id);
        if (!isReserved) {
          availableAccounts.push(account);
        }
      }

      if (availableAccounts.length === 0) {
        logger.warn('All accounts are reserved');
        return null;
      }

      // Use strategy to select account
      const selectedAccount = this.config.strategy!.select(availableAccounts);
      
      if (!selectedAccount) {
        return null;
      }

      // Reserve the account
      const reserved = await this.reserveAccount(selectedAccount.id, requesterId);
      if (!reserved) {
        // Someone else grabbed it, try again
        return this.selectAccount(requesterId);
      }

      logger.info({ 
        accountId: selectedAccount.id, 
        email: selectedAccount.email,
        healthScore: selectedAccount.healthScore,
        dailyUploads: selectedAccount.dailyUploadCount
      }, 'Account selected');

      return selectedAccount;

    } catch (error) {
      logger.error({ requesterId, error }, 'Failed to select account');
      throw error;
    }
  }

  /**
   * Reserve an account for exclusive use
   */
  async reserveAccount(accountId: string, requesterId: string): Promise<boolean> {
    const key = `${this.reservationPrefix}${accountId}`;
    const ttl = Math.ceil(this.config.reservationTimeout! / 1000);

    try {
      // Try to set reservation with NX (only if not exists)
      const result = await this.redis.getClient().set(
        key, 
        requesterId, 
        'PX', 
        this.config.reservationTimeout!,
        'NX'
      );

      const reserved = result === 'OK';
      
      if (reserved) {
        logger.debug({ accountId, requesterId, ttl }, 'Account reserved');
      }

      return reserved;

    } catch (error) {
      logger.error({ accountId, requesterId, error }, 'Failed to reserve account');
      return false;
    }
  }

  /**
   * Release account reservation
   */
  async releaseAccount(accountId: string, requesterId: string): Promise<void> {
    const key = `${this.reservationPrefix}${accountId}`;

    try {
      // Check if the requester owns the reservation
      const currentOwner = await this.redis.get(key);
      
      if (currentOwner === requesterId) {
        await this.redis.del(key);
        logger.debug({ accountId, requesterId }, 'Account reservation released');
      } else {
        logger.warn({ 
          accountId, 
          requesterId, 
          currentOwner 
        }, 'Attempted to release account reserved by another requester');
      }

    } catch (error) {
      logger.error({ accountId, requesterId, error }, 'Failed to release account');
    }
  }

  /**
   * Check if account is reserved
   */
  private async isAccountReserved(accountId: string): Promise<boolean> {
    const key = `${this.reservationPrefix}${accountId}`;
    try {
      const exists = await this.redis.exists(key);
      return exists > 0;
    } catch (error) {
      logger.error({ accountId, error }, 'Failed to check reservation');
      return true; // Assume reserved on error
    }
  }

  /**
   * Get all reserved accounts
   */
  async getReservedAccounts(): Promise<{ accountId: string; reservedBy: string }[]> {
    try {
      const pattern = `${this.reservationPrefix}*`;
      const keys = await this.redis.getClient().keys(pattern);
      
      const reserved: { accountId: string; reservedBy: string }[] = [];
      
      for (const key of keys) {
        const accountId = key.replace(this.reservationPrefix, '');
        const reservedBy = await this.redis.get(key);
        
        if (reservedBy) {
          reserved.push({ accountId, reservedBy });
        }
      }

      return reserved;

    } catch (error) {
      logger.error({ error }, 'Failed to get reserved accounts');
      return [];
    }
  }

  /**
   * Force release all reservations (admin function)
   */
  async releaseAllReservations(): Promise<void> {
    logger.warn('Releasing all account reservations');

    try {
      const pattern = `${this.reservationPrefix}*`;
      const keys = await this.redis.getClient().keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info({ count: keys.length }, 'Released all account reservations');
      }

    } catch (error) {
      logger.error({ error }, 'Failed to release all reservations');
      throw error;
    }
  }

  /**
   * Update selection strategy
   */
  setStrategy(strategy: AccountSelectionStrategy): void {
    this.config.strategy = strategy;
    logger.info({ strategy: strategy.name }, 'Selection strategy updated');
  }

  /**
   * Get account availability stats
   */
  async getAvailabilityStats() {
    try {
      const accounts = await this.accountManager.listAccounts({
        status: 'active'
      });

      const reserved = await this.getReservedAccounts();
      const reservedIds = new Set(reserved.map(r => r.accountId));

      const stats = {
        total: accounts.length,
        available: 0,
        reserved: reserved.length,
        healthyAvailable: 0,
        limitReached: 0,
        byStatus: {
          active: 0,
          limited: 0,
          suspended: 0,
          error: 0
        }
      };

      for (const account of accounts) {
        if (!reservedIds.has(account.id)) {
          stats.available++;
          
          if (account.healthScore >= this.config.minHealthScore!) {
            stats.healthyAvailable++;
          }
        }

        if (account.dailyUploadCount >= account.dailyUploadLimit) {
          stats.limitReached++;
        }

        stats.byStatus[account.status]++;
      }

      return stats;

    } catch (error) {
      logger.error({ error }, 'Failed to get availability stats');
      throw error;
    }
  }
}