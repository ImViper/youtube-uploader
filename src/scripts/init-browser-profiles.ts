/**
 * Initialize browser profiles and account mappings
 * This script sets up the mapping between YouTube accounts and BitBrowser windows
 */

import { AccountManager } from '../accounts/manager';
import { BitBrowserManager } from '../bitbrowser/manager';
import { browserProfiles, getAllWindowNames } from '../config/browser-profiles';
import { getDatabase } from '../database/connection';
import pino from 'pino';

const logger = pino({
  name: 'init-browser-profiles',
  level: 'info',
  transport: {
    target: 'pino-pretty'
  }
});

async function initializeBrowserProfiles() {
  logger.info('Starting browser profile initialization...');
  
  const accountManager = new AccountManager();
  const bitBrowserManager = new BitBrowserManager();
  const db = getDatabase();

  try {
    // 1. Get all configured window names
    const configuredWindows = getAllWindowNames();
    logger.info({ count: configuredWindows.length }, 'Found configured windows');

    // 2. Initialize persistent browsers
    logger.info('Initializing persistent browsers...');
    await bitBrowserManager.initializePersistentBrowsers(configuredWindows);

    // 3. Get all browser windows from BitBrowser
    const browserWindows = await bitBrowserManager.listBrowsers();
    logger.info({ count: browserWindows.length }, 'Found browser windows in BitBrowser');

    // 4. Process each browser profile mapping
    for (const profile of browserProfiles) {
      logger.info({ profile: profile.windowName }, 'Processing browser profile');

      // Find the window in BitBrowser
      const window = browserWindows.find(w => w.windowName === profile.windowName);
      
      if (!window) {
        logger.warn({ windowName: profile.windowName }, 'Window not found in BitBrowser');
        continue;
      }

      // Check if account exists
      let account = await accountManager.getAccountByEmail(profile.accountEmail);
      
      if (!account) {
        logger.info({ email: profile.accountEmail }, 'Creating new account');
        
        // Create account with empty password since we're using pre-logged windows
        account = await accountManager.addAccount(
          profile.accountEmail,
          '', // Empty password
          {
            windowName: profile.windowName,
            windowId: window.id,
            proxy: profile.proxy,
            userAgent: profile.userAgent
          }
        );
      }

      // Update window mapping
      logger.info({ email: profile.accountEmail, windowId: window.id }, 'Updating window mapping');
      await accountManager.updateAccountBrowserMapping(
        profile.accountEmail,
        profile.windowName
      );

      // Check if window is logged in
      logger.info({ windowName: profile.windowName }, 'Checking window login status');
      const browserInstance = await bitBrowserManager.getOrCreatePersistentBrowser(profile.windowName);
      const isLoggedIn = await bitBrowserManager.checkYouTubeLogin(browserInstance.id);

      // Log login status (no longer updating in DB)
      logger.info({ accountId: account.id, isLoggedIn }, 'Window login status checked');
      
      logger.info({
        email: profile.accountEmail,
        windowName: profile.windowName,
        windowId: window.id,
        isLoggedIn
      }, 'Profile initialized');

      // Store instance data in database
      await db.query(
        `INSERT INTO browser_instances (window_id, profile_data, is_logged_in, is_active)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (window_id) DO UPDATE SET
           profile_data = $2,
           is_logged_in = $3,
           is_active = $4,
           last_health_check = CURRENT_TIMESTAMP`,
        [
          window.id,
          JSON.stringify({
            windowName: profile.windowName,
            proxy: profile.proxy,
            userAgent: profile.userAgent,
            metadata: profile.metadata
          }),
          isLoggedIn,
          true
        ]
      );
    }

    // 5. List final mapping status
    const mappings = await accountManager.listAccountsWithWindowMapping();
    logger.info('=== Browser Profile Mapping Status ===');
    
    for (const mapping of mappings) {
      logger.info({
        email: mapping.email,
        windowName: mapping.bitbrowser_window_name,
        accountStatus: mapping.status,
        healthScore: mapping.healthScore
      }, 'Account mapping');
    }

    logger.info('Browser profile initialization completed successfully');
    
  } catch (error) {
    logger.error({ error }, 'Failed to initialize browser profiles');
    throw error;
  } finally {
    await bitBrowserManager.cleanup();
    await db.close();
  }
}

// Run if called directly
if (require.main === module) {
  initializeBrowserProfiles()
    .then(() => {
      logger.info('Script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, 'Script failed');
      process.exit(1);
    });
}

export { initializeBrowserProfiles };