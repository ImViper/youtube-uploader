import authReducer, {
  loginStart,
  loginSuccess,
  loginFailure,
  logout,
  updateUser,
  clearError,
} from '@/features/auth/authSlice';
import type { User, LoadingState } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loadingState: LoadingState;
  error: string | null;
}

describe('authSlice', () => {
  const initialState: AuthState = {
    user: null,
    isAuthenticated: false,
    loadingState: 'idle',
    error: null,
  };

  const mockUser: User = {
    id: '1',
    username: 'testuser',
    email: 'test@example.com',
    role: 'user',
    createdAt: new Date().toISOString(),
  };

  describe('reducers', () => {
    it('should handle initial state', () => {
      expect(authReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });

    it('should handle loginStart', () => {
      const actual = authReducer(initialState, loginStart());
      expect(actual.loadingState).toBe('loading');
      expect(actual.error).toBeNull();
    });

    it('should handle loginSuccess', () => {
      const tokens = {
        user: mockUser,
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
      };

      const actual = authReducer(initialState, loginSuccess(tokens));

      expect(actual.isAuthenticated).toBe(true);
      expect(actual.user).toEqual(mockUser);
      expect(actual.loadingState).toBe('succeeded');
      expect(actual.error).toBeNull();
    });

    it('should handle loginFailure', () => {
      const error = 'Invalid credentials';
      const actual = authReducer(initialState, loginFailure(error));

      expect(actual.isAuthenticated).toBe(false);
      expect(actual.user).toBeNull();
      expect(actual.loadingState).toBe('failed');
      expect(actual.error).toBe(error);
    });

    it('should handle logout', () => {
      const loggedInState: AuthState = {
        user: mockUser,
        isAuthenticated: true,
        loadingState: 'succeeded',
        error: null,
      };

      const actual = authReducer(loggedInState, logout());

      expect(actual.isAuthenticated).toBe(false);
      expect(actual.user).toBeNull();
      expect(actual.loadingState).toBe('idle');
    });

    it('should handle updateUser', () => {
      const loggedInState: AuthState = {
        user: mockUser,
        isAuthenticated: true,
        loadingState: 'succeeded',
        error: null,
      };

      const updatedUser: User = {
        ...mockUser,
        username: 'newname',
        email: 'new@example.com',
      };

      const actual = authReducer(loggedInState, updateUser(updatedUser));

      expect(actual.user?.username).toBe('newname');
      expect(actual.user?.email).toBe('new@example.com');
      expect(actual.user?.id).toBe('1');
    });

    it('should handle clearError', () => {
      const stateWithError: AuthState = {
        ...initialState,
        error: 'Test error',
      };

      const actual = authReducer(stateWithError, clearError());
      expect(actual.error).toBeNull();
    });
  });

  describe('business logic', () => {
    it('should maintain user data on token refresh', () => {
      const authenticatedState: AuthState = {
        user: mockUser,
        isAuthenticated: true,
        loadingState: 'succeeded',
        error: null,
      };

      const actual = authReducer(
        authenticatedState,
        loginSuccess({
          user: mockUser,
          accessToken: 'new-token',
          refreshToken: 'new-refresh-token',
        }),
      );

      expect(actual.isAuthenticated).toBe(true);
      expect(actual.user).toEqual(mockUser);
    });

    it('should clear all data on logout', () => {
      const authenticatedState: AuthState = {
        user: mockUser,
        isAuthenticated: true,
        loadingState: 'succeeded',
        error: 'Previous error',
      };

      const actual = authReducer(authenticatedState, logout());

      expect(actual).toEqual(initialState);
    });

    it('should handle login flow correctly', () => {
      // Start login
      let state = authReducer(initialState, loginStart());
      expect(state.loadingState).toBe('loading');

      // Login success
      state = authReducer(
        state,
        loginSuccess({
          user: mockUser,
          accessToken: 'token',
          refreshToken: 'refresh',
        }),
      );
      expect(state.isAuthenticated).toBe(true);
      expect(state.loadingState).toBe('succeeded');

      // Logout
      state = authReducer(state, logout());
      expect(state.isAuthenticated).toBe(false);
      expect(state.loadingState).toBe('idle');
    });
  });
});
