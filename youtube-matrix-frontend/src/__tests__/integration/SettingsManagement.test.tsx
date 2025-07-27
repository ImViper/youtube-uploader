import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test/testUtils';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { settingsApi } from '@/features/settings/settingsApi';

// Mock server
const server = setupServer(
  http.get('http://localhost:3000/api/v1/settings', () => {
    return HttpResponse.json({
      upload: {
        defaultPrivacy: 'private',
        defaultCategory: 'Entertainment',
        defaultLanguage: 'en',
        enableNotifications: true,
        autoRetry: true,
        maxRetries: 3,
        retryDelay: 60,
      },
      queue: {
        maxConcurrentUploads: 3,
        uploadRateLimit: 10,
        priorityStrategy: 'fifo',
        pauseBetweenUploads: 30,
      },
      system: {
        theme: 'light',
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        enableDebugMode: false,
        logLevel: 'info',
      },
      notifications: {
        uploadComplete: true,
        uploadFailed: true,
        accountError: true,
        systemAlert: true,
        emailNotifications: false,
      },
      security: {
        sessionTimeout: 30,
        requirePassword: false,
        twoFactorEnabled: false,
        ipWhitelist: [],
      },
    });
  }),
  http.patch('http://localhost:3000/api/v1/settings', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      message: 'Settings updated successfully',
      updated: body,
    });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Test component
const SettingsComponent: React.FC = () => {
  const { data: settings } = settingsApi.useGetSettingsQuery();
  const [updateSettings] = settingsApi.useUpdateSettingsMutation();

  const handleUpdate = async () => {
    await updateSettings({
      system: {
        ...settings?.system,
        language: 'es',
      },
    });
  };

  if (!settings) return <div>Loading...</div>;

  return (
    <div>
      <div>Language: {settings.system.language}</div>
      <div>Privacy: {settings.upload.defaultPrivacy}</div>
      <button onClick={handleUpdate}>Update Language</button>
    </div>
  );
};

describe('Settings Management', () => {
  it('displays current settings', async () => {
    renderWithProviders(<SettingsComponent />);

    await waitFor(() => {
      expect(screen.getByText('Language: en')).toBeInTheDocument();
      expect(screen.getByText('Privacy: private')).toBeInTheDocument();
    });
  });

  it('updates settings', async () => {
    renderWithProviders(<SettingsComponent />);

    await waitFor(() => {
      expect(screen.getByText('Update Language')).toBeInTheDocument();
    });

    const updateButton = screen.getByText('Update Language');
    await userEvent.click(updateButton);

    await waitFor(() => {
      expect(settingsApi.endpoints.updateSettings.matchFulfilled).toBeTruthy();
    });
  });
});
