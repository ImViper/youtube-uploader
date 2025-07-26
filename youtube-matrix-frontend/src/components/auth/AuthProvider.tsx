import React, { useEffect, useState } from 'react';
import { useAppDispatch } from '@/app/hooks';
import { useGetCurrentUserQuery } from '@/features/auth/authApi';
import { loginSuccess, logout } from '@/features/auth/authSlice';
import { STORAGE_KEYS } from '@/utils/constants';
import LoadingScreen from '@/components/common/LoadingScreen';
import websocketService from '@/services/websocket';

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const [isInitializing, setIsInitializing] = useState(true);

  // Try to get current user if token exists
  const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  const {
    data: user,
    isLoading,
    isError,
  } = useGetCurrentUserQuery(undefined, {
    skip: !token,
  });

  useEffect(() => {
    const initAuth = async () => {
      if (!token) {
        setIsInitializing(false);
        return;
      }

      if (user) {
        // User is authenticated, update state
        const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) || '';
        dispatch(
          loginSuccess({
            user,
            accessToken: token,
            refreshToken,
          }),
        );

        // Connect WebSocket
        websocketService.connect();
      } else if (isError) {
        // Token is invalid, clear auth state
        dispatch(logout());
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      }

      setIsInitializing(false);
    };

    if (!isLoading) {
      initAuth();
    }
  }, [token, user, isLoading, isError, dispatch]);

  if (isInitializing || isLoading) {
    return <LoadingScreen tip="Initializing application..." />;
  }

  return <>{children}</>;
};

export default AuthProvider;
