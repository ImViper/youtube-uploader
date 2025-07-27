import * as accountExports from '../../../api/account/index';
import { AccountController } from '../../../api/account/account.controller';
import { AccountService } from '../../../api/account/account.service';
import { createAccountRoutes } from '../../../api/account/account.routes';

describe('Account Module Exports', () => {
  it('should export AccountController', () => {
    expect(accountExports.AccountController).toBe(AccountController);
  });

  it('should export AccountService', () => {
    expect(accountExports.AccountService).toBe(AccountService);
  });

  it('should export createAccountRoutes', () => {
    expect(accountExports.createAccountRoutes).toBe(createAccountRoutes);
  });

  it('should export all required modules', () => {
    const exports = Object.keys(accountExports);
    expect(exports).toContain('AccountController');
    expect(exports).toContain('AccountService');
    expect(exports).toContain('createAccountRoutes');
    expect(exports).toHaveLength(3);
  });
});