// Development mode authentication hook - bypasses login
export const useAuthDev = () => {
  // Mock user for development
  const mockUser = {
    id: '1',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin' as const,
  };

  return {
    user: mockUser,
    isAuthenticated: true,
    isLoggingIn: false,
    isLoggingOut: false,
    login: async () => {
      console.log('Dev mode: login bypassed');
      return { user: mockUser, accessToken: 'dev-token', refreshToken: 'dev-refresh' };
    },
    logout: async () => {
      console.log('Dev mode: logout');
      window.location.href = '/login';
    },
  };
};
