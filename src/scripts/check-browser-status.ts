/**
 * Check browser window status and login state
 * This script checks all configured browser windows and their YouTube login status
 */

import { AccountManager } from '../accounts/manager';
import { BitBrowserManager } from '../bitbrowser/manager';
import { browserProfiles } from '../config/browser-profiles';
import { getDatabase } from '../database/connection';
import pino from 'pino';

const logger = pino({
  name: 'check-browser-status',
  level: 'info',
  transport: {
    target: 'pino-pretty'
  }
});

interface WindowStatus {
  windowId: string;
  windowName: string;
  isOpen: boolean;
  isLoggedIn: boolean;
  account?: {
    email: string;
    status: string;
    healthScore: number;
  };
  error?: string;
}

async function checkBrowserStatus() {
  logger.info('Starting browser status check...');
  
  const accountManager = new AccountManager();
  const bitBrowserManager = new BitBrowserManager();
  const db = getDatabase();

  const results: WindowStatus[] = [];

  try {
    // Get all configured profiles
    const profiles = browserProfiles;
    logger.info({ count: profiles.length }, 'Checking configured profiles');

    // Get all browser windows
    const windows = await bitBrowserManager.listBrowsers();
    logger.info({ count: windows.length }, 'Found browser windows');

    // Check each configured profile
    for (const profile of profiles) {
      logger.info({ windowName: profile.windowName }, 'Checking browser profile');

      const status: WindowStatus = {
        windowId: '',
        windowName: profile.windowName,
        isOpen: false,
        isLoggedIn: false
      };

      try {
        // Find window in BitBrowser
        const window = windows.find(w => w.windowName === profile.windowName);
        
        if (!window) {
          status.error = 'Window not found in BitBrowser';
          results.push(status);
          continue;
        }

        status.windowId = window.id;
        status.isOpen = true;

        // Get account info
        const account = await accountManager.getAccountByEmail(profile.accountEmail);
        if (account) {
          status.account = {
            email: account.email,
            status: account.status,
            healthScore: account.healthScore
          };
        } else {
          status.error = 'Account not found in database';
        }

        // Check if window is logged in
        try {
          const browserInstance = await bitBrowserManager.getOrCreatePersistentBrowser(profile.windowName);
          const isLoggedIn = await bitBrowserManager.checkYouTubeLogin(browserInstance.id);
          
          status.isLoggedIn = isLoggedIn;

          // Log login status (no longer updating in DB)
          if (account) {
            logger.info({ accountId: account.id, isLoggedIn }, 'Account login status checked');
          }

          // Update profile in database
          await db.query(
            `UPDATE browser_instances 
             SET is_logged_in = $1, last_health_check = CURRENT_TIMESTAMP
             WHERE window_id = $2`,
            [isLoggedIn, window.id]
          );

        } catch (error) {
          status.error = `Failed to check login: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }

      } catch (error) {
        status.error = error instanceof Error ? error.message : 'Unknown error';
      }

      results.push(status);
    }

    // Print results
    logger.info('\n=== Browser Status Report ===\n');
    
    const loggedInCount = results.filter(r => r.isLoggedIn).length;
    const totalCount = results.length;
    
    logger.info(`Total Profiles: ${totalCount}`);
    logger.info(`Logged In: ${loggedInCount}`);
    logger.info(`Not Logged In: ${totalCount - loggedInCount}\n`);

    // Print detailed status
    console.table(results.map(r => ({
      'Window Name': r.windowName,
      'Window ID': r.windowId || 'N/A',
      'Account': r.account?.email || 'N/A',
      'Status': r.account?.status || 'N/A',
      'Health': r.account?.healthScore || 'N/A',
      'Logged In': r.isLoggedIn ? '✓' : '✗',
      'Error': r.error || '-'
    })));

    // Summary by status
    const byStatus = {
      open: results.filter(r => r.isOpen).length,
      loggedIn: results.filter(r => r.isLoggedIn).length,
      errors: results.filter(r => r.error).length
    };

    logger.info('\n=== Summary ===');
    logger.info(`Windows Open: ${byStatus.open}/${totalCount}`);
    logger.info(`Logged In: ${byStatus.loggedIn}/${totalCount}`);
    logger.info(`Errors: ${byStatus.errors}/${totalCount}`);

    // List windows that need attention
    const needsAttention = results.filter(r => !r.isLoggedIn || r.error);
    if (needsAttention.length > 0) {
      logger.warn('\n=== Windows Needing Attention ===');
      needsAttention.forEach(w => {
        logger.warn(`- ${w.windowName}: ${w.error || 'Not logged in'}`);
      });
    }

    return results;

  } catch (error) {
    logger.error({ error }, 'Failed to check browser status');
    throw error;
  } finally {
    await bitBrowserManager.cleanup();
    await db.close();
  }
}

// Run if called directly
if (require.main === module) {
  checkBrowserStatus()
    .then((results) => {
      const allLoggedIn = results.every(r => r.isLoggedIn);
      if (allLoggedIn) {
        logger.info('\n✅ All browsers are logged in and ready!');
        process.exit(0);
      } else {
        logger.warn('\n⚠️  Some browsers need attention');
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error({ error }, 'Script failed');
      process.exit(1);
    });
}

export { checkBrowserStatus };