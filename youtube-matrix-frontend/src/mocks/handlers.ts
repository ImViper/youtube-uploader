import { http, HttpResponse } from 'msw';

export const handlers = [
  // Auth endpoints
  http.post('/api/auth/login', () => {
    return HttpResponse.json({
      token: 'mock-token',
      user: {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      },
    });
  }),

  // Accounts endpoints
  http.get('/api/v1/accounts', () => {
    return HttpResponse.json([
      {
        id: '1',
        name: 'Test Account',
        email: 'account1@example.com',
        status: 'active',
      },
    ]);
  }),

  // Tasks endpoints (uploads are now tasks)
  http.get('/api/v1/tasks', () => {
    return HttpResponse.json([
      {
        id: '1',
        title: 'Test Video',
        status: 'completed',
        progress: 100,
      },
    ]);
  }),

  http.post('/api/v1/tasks', () => {
    return HttpResponse.json({
      id: '2',
      type: 'upload',
      video: {
        title: 'New Upload',
      },
      status: 'pending',
      progress: 0,
    });
  }),

  // Settings endpoints
  http.get('/api/v1/settings', () => {
    return HttpResponse.json({
      uploadDefaults: {
        privacy: 'private',
        category: 'Education',
      },
    });
  }),
];
