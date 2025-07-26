import { BrowserProfileMapping } from '../types/browser-profile';

/**
 * Browser profile mappings configuration
 * Maps YouTube accounts to BitBrowser windows
 * 
 * IMPORTANT: Make sure the window names match exactly with the names in BitBrowser
 */
export const browserProfiles: BrowserProfileMapping[] = [
  // Example mappings - Replace with your actual account and window names
  {
    accountEmail: 'youtube001@gmail.com',
    windowName: 'YouTube账号001',
    proxy: {
      host: 'proxy1.example.com',
      port: 8080,
      protocol: 'http'
    }
  },
  {
    accountEmail: 'youtube002@gmail.com',
    windowName: 'YouTube账号002',
    proxy: {
      host: 'proxy2.example.com',
      port: 8080,
      protocol: 'http'
    }
  },
  {
    accountEmail: 'youtube003@gmail.com',
    windowName: 'YouTube账号003',
    // No proxy for this account
  },
  // Add more mappings as needed
];

/**
 * Get browser profile by account email
 */
export function getBrowserProfileByEmail(email: string): BrowserProfileMapping | undefined {
  return browserProfiles.find(profile => profile.accountEmail === email);
}

/**
 * Get browser profile by window name
 */
export function getBrowserProfileByWindowName(windowName: string): BrowserProfileMapping | undefined {
  return browserProfiles.find(profile => profile.windowName === windowName);
}

/**
 * Get all configured window names
 */
export function getAllWindowNames(): string[] {
  return browserProfiles.map(profile => profile.windowName);
}

/**
 * Browser window configuration
 */
export const browserWindowConfig = {
  // Default window position
  windowPosition: {
    x: 1380,
    y: 400
  },
  
  // Window startup args
  defaultArgs: [
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-sandbox'
  ],
  
  // Timeouts
  timeouts: {
    windowOpen: 30000,      // 30 seconds to open window
    pageLoad: 30000,        // 30 seconds for page load
    loginCheck: 5000,       // 5 seconds to check login status
    healthCheck: 10000,     // 10 seconds for health check
  },
  
  // Retry configuration
  retries: {
    maxRetries: 3,
    retryDelay: 1000,       // 1 second between retries
  }
};