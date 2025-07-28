import { Router, Request, Response } from 'express';
import { AccountManager } from '../../accounts/manager';
import { BitBrowserManager } from '../../bitbrowser/manager';
import { browserProfiles } from '../../config/browser-profiles';
import { getDatabase } from '../../database/connection';
import pino from 'pino';

const router = Router();
const logger = pino({
  name: 'browser-mapping-api',
  level: process.env.LOG_LEVEL || 'info'
});

/**
 * GET /api/browser/mappings
 * List all browser window mappings
 */
router.get('/mappings', async (req: Request, res: Response) => {
  try {
    const bitBrowserManager = new BitBrowserManager();
    const accountManager = new AccountManager();
    const db = getDatabase();

    // Get all windows from BitBrowser
    const windows = await bitBrowserManager.listBrowsers();
    
    // Get all accounts with window mappings
    const accounts = await accountManager.listAccountsWithWindowMapping();
    
    // Get browser instances from database
    const instancesResult = await db.query(
      'SELECT * FROM browser_instances WHERE is_active = true ORDER BY window_id'
    );
    const instances = instancesResult.rows;

    // Build comprehensive mapping list
    const mappings = windows.map(window => {
      const account = accounts.find(a => a.bitbrowser_window_name === window.windowName);
      const instance = instances.find(i => i.window_id === window.id);
      const config = browserProfiles.find(bp => bp.windowName === window.windowName);

      return {
        windowId: window.id,
        windowName: window.windowName || window.windowId,
        status: window.status,
        account: account ? {
          id: account.id,
          email: account.email,
          status: account.status,
          healthScore: account.healthScore,
          windowName: account.bitbrowser_window_name
        } : null,
        instance: instance ? {
          isLoggedIn: instance.is_logged_in,
          lastHealthCheck: instance.last_health_check,
          profileData: instance.profile_data
        } : null,
        configured: !!config
      };
    });

    res.json({
      success: true,
      data: mappings
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get browser mappings');
    res.status(500).json({
      success: false,
      error: 'Failed to get browser mappings'
    });
  }
});

/**
 * POST /api/browser/map
 * Map an account to a browser window
 */
router.post('/map', async (req: Request, res: Response) => {
  try {
    const { accountEmail, windowId, windowName } = req.body;

    if (!accountEmail || !windowId || !windowName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: accountEmail, windowId, windowName'
      });
    }

    const accountManager = new AccountManager();
    
    // Update the mapping
    await accountManager.updateAccountBrowserMapping(
      accountEmail,
      windowName
    );

    res.json({
      success: true,
      message: 'Account mapped to browser window'
    });
  } catch (error) {
    logger.error({ error }, 'Failed to map browser');
    res.status(500).json({
      success: false,
      error: 'Failed to map browser'
    });
  }
});

/**
 * POST /api/browser/check-login
 * Check if a browser window is logged into YouTube
 */
router.post('/check-login', async (req: Request, res: Response) => {
  try {
    const { windowId } = req.body;

    if (!windowId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: windowId'
      });
    }

    const bitBrowserManager = new BitBrowserManager();
    const accountManager = new AccountManager();

    // Get browser instance
    const instance = await bitBrowserManager.getInstance(windowId);
    if (!instance) {
      // Try to get window by name
      const windows = await bitBrowserManager.listBrowsers();
      const window = windows.find(w => w.id === windowId || w.windowName === windowId);
      
      if (!window) {
        return res.status(404).json({
          success: false,
          error: 'Browser window not found'
        });
      }

      // Create instance
      await bitBrowserManager.getOrCreatePersistentBrowser(window.windowName!);
    }

    // Check login status
    const isLoggedIn = await bitBrowserManager.checkYouTubeLogin(windowId);

    // Update account login status
    const account = await accountManager.getAccountByWindowName(windowId);
    if (account) {
      // Note: updateWindowLoginStatus method has been removed
      // Login status is now tracked in browser_instances table
      logger.info({ accountId: account.id, isLoggedIn }, 'Login status checked');
    }

    res.json({
      success: true,
      data: {
        windowId,
        isLoggedIn
      }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to check login status');
    res.status(500).json({
      success: false,
      error: 'Failed to check login status'
    });
  }
});

/**
 * GET /api/browser/unmapped-windows
 * Get windows that are not mapped to any account
 */
router.get('/unmapped-windows', async (req: Request, res: Response) => {
  try {
    const bitBrowserManager = new BitBrowserManager();
    const accountManager = new AccountManager();

    // Get all windows
    const windows = await bitBrowserManager.listBrowsers();
    
    // Get all accounts
    const accounts = await accountManager.listAccounts();
    const mappedWindowNames = accounts
      .map(a => a.bitbrowser_window_name)
      .filter(name => name);

    // Filter unmapped windows
    const unmappedWindows = windows.filter(
      window => !mappedWindowNames.includes((window as any).windowName || window.id)
    );

    res.json({
      success: true,
      data: unmappedWindows
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get unmapped windows');
    res.status(500).json({
      success: false,
      error: 'Failed to get unmapped windows'
    });
  }
});

/**
 * POST /api/browser/sync-mappings
 * Sync browser mappings from config file
 */
router.post('/sync-mappings', async (req: Request, res: Response) => {
  try {
    const accountManager = new AccountManager();
    const bitBrowserManager = new BitBrowserManager();
    const db = getDatabase();

    // Get all windows from BitBrowser
    const windows = await bitBrowserManager.listBrowsers();
    
    const results = [];

    for (const profile of browserProfiles) {
      try {
        // Find window by name
        const window = windows.find(w => w.windowName === profile.windowName);
        
        if (!window) {
          results.push({
            email: profile.accountEmail,
            windowName: profile.windowName,
            success: false,
            error: 'Window not found'
          });
          continue;
        }

        // Check if account exists
        let account = await accountManager.getAccountByEmail(profile.accountEmail);
        
        if (!account) {
          // Create account
          account = await accountManager.addAccount(
            profile.accountEmail,
            '', // Empty password for pre-logged windows
            {
              windowName: profile.windowName,
              windowId: window.id,
              proxy: profile.proxy
            }
          );
        }

        // Update mapping
        await accountManager.updateAccountBrowserMapping(
          profile.accountEmail,
          profile.windowName
        );

        // Store instance data
        await db.query(
          `INSERT INTO browser_instances (window_id, profile_data, is_active)
           VALUES ($1, $2, $3)
           ON CONFLICT (window_id) DO UPDATE SET
             profile_data = $2,
             is_active = $3,
             last_activity = CURRENT_TIMESTAMP`,
          [
            window.id,
            JSON.stringify({
              proxy: profile.proxy,
              userAgent: profile.userAgent,
              metadata: profile.metadata,
              windowName: profile.windowName
            }),
            true
          ]
        );

        results.push({
          email: profile.accountEmail,
          windowName: profile.windowName,
          windowId: window.id,
          success: true
        });

      } catch (error) {
        results.push({
          email: profile.accountEmail,
          windowName: profile.windowName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error({ error }, 'Failed to sync mappings');
    res.status(500).json({
      success: false,
      error: 'Failed to sync mappings'
    });
  }
});

export default router;