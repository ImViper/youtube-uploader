# Account Module Tests

This directory contains comprehensive unit tests for the account module components.

## Test Coverage

The account module has achieved high test coverage:
- **Overall Coverage**: ~96%
- **Statement Coverage**: 95.95%
- **Branch Coverage**: 87.19%
- **Function Coverage**: 100%
- **Line Coverage**: 96.61%

## Test Files

### account.service.test.ts
Tests for the AccountService class covering:
- Account creation with validation
- Account listing with pagination, filtering, and sorting
- Account retrieval by ID
- Account updates and status changes
- Account deletion (single and batch)
- Import/export functionality (JSON and CSV)
- Health checks and account testing
- Statistics and daily limit resets
- CSV parsing and generation

### account.controller.test.ts
Tests for the AccountController class covering:
- HTTP request/response handling
- Error responses and status codes
- Request validation
- Response formatting
- File download headers for exports

### account.routes.test.ts
Tests for the Express route configuration covering:
- Route registration and ordering
- Middleware integration
- Request routing to correct controllers
- Validation middleware application

### index.test.ts
Tests for module exports ensuring all components are properly exported.

## Running Tests

```bash
# Run all account module tests
npm test -- src/api/account

# Run tests with coverage report
npm test -- src/api/account --coverage

# Run a specific test file
npm test -- src/api/account/account.service.test.ts

# Run tests in watch mode
npm test -- src/api/account --watch
```

## Key Testing Patterns

1. **Mocking**: Uses Jest mocks for external dependencies (AccountManager, logger)
2. **Type Safety**: TypeScript types are properly mocked with `as any` where needed
3. **Edge Cases**: Tests cover error scenarios, empty data, and boundary conditions
4. **Async Testing**: Proper handling of promises and async/await
5. **Request/Response**: Supertest for HTTP endpoint testing

## Notes

- The AccountManager is mocked to avoid database dependencies
- Logger is mocked to prevent console output during tests
- Route order matters - batch routes must come before parameterized routes
- Tests use realistic data structures matching the actual implementation