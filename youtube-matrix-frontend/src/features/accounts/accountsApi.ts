import { baseApi } from '@/services/baseApi';
import type { ApiResponse, PaginatedResponse } from '@/types';
import type { Account } from './accountsSlice';

interface AccountsQueryParams {
  page?: number;
  pageSize?: number;
  status?: Account['status'] | 'all';
  search?: string;
  sortBy?: 'username' | 'healthScore' | 'lastActive' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

interface CreateAccountRequest {
  username: string;
  email: string;
  password: string;
  browserWindowName?: string;
  proxy?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
  cookies?: string;
  notes?: string;
}

interface UpdateAccountRequest {
  id: string;
  data: Partial<Omit<CreateAccountRequest, 'username' | 'email'>>;
}

interface ImportAccountsRequest {
  file: File;
  format: 'csv' | 'json';
}

interface ImportAccountsResponse {
  imported: number;
  failed: number;
  errors: Array<{
    row: number;
    error: string;
  }>;
}

export const accountsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAccounts: builder.query<PaginatedResponse<Account>, AccountsQueryParams>({
      query: (params) => ({
        url: '/v1/accounts',
        params,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: 'Account' as const, id })),
              { type: 'Account', id: 'LIST' },
            ]
          : [{ type: 'Account', id: 'LIST' }],
    }),

    getAccount: builder.query<Account, string>({
      query: (id) => `/v1/accounts/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Account', id }],
    }),

    createAccount: builder.mutation<Account, CreateAccountRequest>({
      query: (body) => ({
        url: '/v1/accounts',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Account', id: 'LIST' }],
    }),

    updateAccount: builder.mutation<Account, UpdateAccountRequest>({
      query: ({ id, data }) => ({
        url: `/v1/accounts/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Account', id },
        { type: 'Account', id: 'LIST' },
      ],
    }),

    deleteAccount: builder.mutation<ApiResponse, string>({
      query: (id) => ({
        url: `/v1/accounts/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Account', id },
        { type: 'Account', id: 'LIST' },
      ],
    }),

    deleteAccounts: builder.mutation<ApiResponse, string[]>({
      query: (ids) => ({
        url: '/v1/accounts/batch',
        method: 'DELETE',
        body: { ids },
      }),
      invalidatesTags: [{ type: 'Account', id: 'LIST' }],
    }),

    importAccounts: builder.mutation<ImportAccountsResponse, ImportAccountsRequest>({
      query: ({ file, format }) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('format', format);

        return {
          url: '/v1/accounts/import',
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: [{ type: 'Account', id: 'LIST' }],
    }),

    exportAccounts: builder.query<Blob, { ids?: string[]; format: 'csv' | 'json' }>({
      query: ({ ids, format }) => ({
        url: '/v1/accounts/export',
        params: { format, ids: ids?.join(',') },
        responseHandler: (response) => response.blob(),
      }),
    }),

    testAccount: builder.mutation<ApiResponse<{ success: boolean; error?: string }>, string>({
      query: (id) => ({
        url: `/v1/accounts/${id}/test`,
        method: 'POST',
      }),
    }),
  }),
});

export const {
  useGetAccountsQuery,
  useGetAccountQuery,
  useCreateAccountMutation,
  useUpdateAccountMutation,
  useDeleteAccountMutation,
  useDeleteAccountsMutation,
  useImportAccountsMutation,
  useLazyExportAccountsQuery,
  useTestAccountMutation,
} = accountsApi;

// 为了兼容性，添加导出别名
export const useExportAccountsMutation = () => {
  const [trigger, result] = useLazyExportAccountsQuery();

  const exportAccounts = async (params: { format: 'csv' | 'json'; includePasswords?: boolean }) => {
    const response = await trigger({ format: params.format }).unwrap();
    // 创建下载链接
    const url = URL.createObjectURL(response);
    const link = document.createElement('a');
    link.href = url;
    link.download = `accounts.${params.format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return { data: response };
  };

  return [exportAccounts, result] as const;
};
