# Manual Tests

This directory contains manual test scripts for testing various components of the YouTube Matrix system.

## API Tests

- **api-endpoints.test.js** - Tests all API endpoints to ensure they are working correctly
- **api-accounts-detailed.test.js** - Detailed testing of the accounts API endpoint
- **api-auth.test.js** - Tests authentication behavior and dev token access

## Database Tests

- **db-direct-query.test.js** - Direct database query testing for debugging

## BitBrowser Tests

- **bitbrowser-api.test.js** - Tests BitBrowser API connectivity
- **bitbrowser-window.test.js** - Tests BitBrowser window operations
- **auth-login.test.js** - Tests user authentication flow

## Running Tests

Before running tests, ensure the server is running:
```bash
npm run dev
```

Then run individual tests:
```bash
node manual-tests/api-endpoints.test.js
```

## Note

These are manual integration tests that require a running server and database. They are not part of the automated test suite (`npm test`).