import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test/testUtils';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { accountsApi } from '@/features/accounts/accountsApi';

// Mock server
const server = setupServer(
  http.get('http://localhost:3000/api/v1/accounts', () => {
    return HttpResponse.json({
      items: [
        {
          id: '1',
          username: 'youtube_account_1',
          email: 'account1@youtube.com',
          status: 'active',
          healthScore: 95,
          lastLogin: '2023-12-01T10:00:00Z',
          uploadsCount: 150,
          failureRate: 2.5,
        },
        {
          id: '2',
          username: 'youtube_account_2',
          email: 'account2@youtube.com',
          status: 'warning',
          healthScore: 75,
          lastLogin: '2023-11-30T15:30:00Z',
          uploadsCount: 100,
          failureRate: 8.0,
        },
      ],
      total: 2,
      page: 1,
      pageSize: 10,
      hasNextPage: false,
    });
  }),
  http.post('http://localhost:3000/api/v1/accounts', async ({ request }) => {
    const body = (await request.json()) as { username: string; email: string };
    return HttpResponse.json({
      id: '3',
      username: body.username,
      email: body.email,
      status: 'active',
      healthScore: 100,
      lastLogin: null,
      uploadsCount: 0,
      failureRate: 0,
    });
  }),
  http.delete('http://localhost:3000/api/v1/accounts/:id', ({ params }) => {
    return HttpResponse.json({ success: true, id: params.id });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Test component that uses the accounts API
const AccountListComponent: React.FC = () => {
  const { data: accountsData, isLoading } = accountsApi.useGetAccountsQuery({
    page: 1,
    pageSize: 10,
  });
  const [createAccount] = accountsApi.useCreateAccountMutation();
  const [deleteAccount] = accountsApi.useDeleteAccountMutation();

  const handleCreate = async () => {
    await createAccount({
      username: 'new_account',
      email: 'new@example.com',
      password: 'SecurePassword123!',
    });
  };

  const handleDelete = async (id: string) => {
    await deleteAccount(id);
  };

  if (isLoading) return <div>Loading...</div>;

  const accounts = accountsData?.items || [];

  return (
    <div>
      <button onClick={handleCreate}>Add Account</button>
      {accounts.map((account) => (
        <div key={account.id}>
          <span>{account.username}</span>
          <span>{account.healthScore}%</span>
          <button onClick={() => handleDelete(account.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
};

describe('Account Management Integration', () => {
  it('displays account list with health scores', async () => {
    renderWithProviders(<AccountListComponent />);

    await waitFor(() => {
      expect(screen.getByText('youtube_account_1')).toBeInTheDocument();
      expect(screen.getByText('youtube_account_2')).toBeInTheDocument();
    });

    // Check health scores
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('creates new account', async () => {
    renderWithProviders(<AccountListComponent />);

    await waitFor(() => {
      expect(screen.getByText('Add Account')).toBeInTheDocument();
    });

    const addButton = screen.getByText('Add Account');
    await userEvent.click(addButton);

    await waitFor(() => {
      expect(accountsApi.endpoints.createAccount.matchFulfilled).toBeTruthy();
    });
  });

  it('deletes account', async () => {
    renderWithProviders(<AccountListComponent />);

    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete');
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    const deleteButtons = screen.getAllByText('Delete');
    await userEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(accountsApi.endpoints.deleteAccount.matchFulfilled).toBeTruthy();
    });
  });
});
