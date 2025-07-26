import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { selectCurrentUser, selectIsAuthenticated } from '@/app/selectors';
import { loginSuccess, loginFailure, logout as logoutAction } from '@/features/auth/authSlice';
import { useLoginMutation, useLogoutMutation } from '@/features/auth/authApi';
import { resetApiState } from '@/services/baseApi';
import websocketService from '@/services/websocket';
import { showSuccess, showError } from '@/utils/helpers';
// import { useAuthDev } from './useAuthDev';

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  const [loginMutation, { isLoading: isLoggingIn }] = useLoginMutation();
  const [logoutMutation, { isLoading: isLoggingOut }] = useLogoutMutation();

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      try {
        const response = await loginMutation(credentials).unwrap();
        dispatch(loginSuccess(response));

        // Connect WebSocket after successful login
        websocketService.connect();

        showSuccess('Login Successful', `Welcome back, ${response.user.username}!`);
        navigate('/dashboard');

        return response;
      } catch (error: unknown) {
        const errorMessage = (error as any)?.data?.error || (error as any)?.data?.message || 'Invalid credentials';
        dispatch(loginFailure(errorMessage));
        showError('Login Failed', errorMessage);
        throw error;
      }
    },
    [dispatch, navigate, loginMutation],
  );

  const logout = useCallback(async () => {
    try {
      await logoutMutation().unwrap();
    } catch (_error) {
      // Even if logout API fails, we still want to clear local state
      console.error('Logout API error:', _error);
    } finally {
      // Clear local state regardless of API response
      dispatch(logoutAction());
      dispatch(resetApiState());

      // Disconnect WebSocket
      websocketService.disconnect();

      showSuccess('Logged Out', 'You have been successfully logged out.');
      navigate('/login');
    }
  }, [dispatch, navigate, logoutMutation]);

  return {
    user,
    isAuthenticated,
    isLoggingIn,
    isLoggingOut,
    login,
    logout,
  };
};
