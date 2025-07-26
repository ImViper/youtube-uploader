// ***********************************************************
// This file is processed and loaded automatically before test files.
// ***********************************************************

import './commands';
import '@testing-library/cypress/add-commands';

// Disable uncaught exception handling
Cypress.on('uncaught:exception', (err, runnable) => {
  // Returning false here prevents Cypress from failing the test
  if (err.message.includes('ResizeObserver') || err.message.includes('Non-Error')) {
    return false;
  }
  return true;
});

// Add custom types
declare global {
  namespace Cypress {
    interface Chainable {
      login(username?: string, password?: string): Chainable<void>;
      logout(): Chainable<void>;
      createAccount(account: {
        username: string;
        email: string;
        password: string;
      }): Chainable<void>;
      uploadVideo(video: { title: string; description: string; file: string }): Chainable<void>;
      waitForToast(message: string): Chainable<void>;
      mockApiResponse(method: string, url: string, response: any, status?: number): Chainable<void>;
    }
  }
}

// Prevent TypeScript from treating this as a module
export {};
