import { createSlice, createEntityAdapter, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';
import type { LoadingState, BaseEntity } from '@/types';

export interface Account extends BaseEntity {
  username: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended' | 'error';
  healthScore: number;
  lastActive: string | null;
  uploadsCount: number;
  successRate: number;
  browserWindowName?: string;
  browserWindowId?: string;
  isWindowLoggedIn?: boolean;
  proxy?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
  cookies?: string;
  notes?: string;
}

interface AccountsState {
  loadingState: LoadingState;
  error: string | null;
  filter: {
    status: 'all' | 'active' | 'inactive' | 'suspended' | 'error';
    search: string;
  };
  selectedIds: string[];
}

// Create entity adapter for normalized state management
const accountsAdapter = createEntityAdapter<Account>({
  sortComparer: (a, b) => b.healthScore - a.healthScore,
});

const initialState = accountsAdapter.getInitialState<AccountsState>({
  loadingState: 'idle',
  error: null,
  filter: {
    status: 'all',
    search: '',
  },
  selectedIds: [],
});

const accountsSlice = createSlice({
  name: 'accounts',
  initialState,
  reducers: {
    fetchAccountsStart: (state) => {
      state.loadingState = 'loading';
      state.error = null;
    },
    fetchAccountsSuccess: (state, action: PayloadAction<Account[]>) => {
      accountsAdapter.setAll(state, action.payload);
      state.loadingState = 'succeeded';
      state.error = null;
    },
    fetchAccountsFailure: (state, action: PayloadAction<string>) => {
      state.loadingState = 'failed';
      state.error = action.payload;
    },
    addAccount: accountsAdapter.addOne,
    updateAccount: accountsAdapter.updateOne,
    removeAccount: accountsAdapter.removeOne,
    removeAccounts: accountsAdapter.removeMany,
    setFilter: (state, action: PayloadAction<Partial<AccountsState['filter']>>) => {
      state.filter = { ...state.filter, ...action.payload };
    },
    setSelectedIds: (state, action: PayloadAction<string[]>) => {
      state.selectedIds = action.payload;
    },
    toggleSelection: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      const index = state.selectedIds.indexOf(id);
      if (index >= 0) {
        state.selectedIds.splice(index, 1);
      } else {
        state.selectedIds.push(id);
      }
    },
    clearSelection: (state) => {
      state.selectedIds = [];
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  fetchAccountsStart,
  fetchAccountsSuccess,
  fetchAccountsFailure,
  addAccount,
  updateAccount,
  removeAccount,
  removeAccounts,
  setFilter,
  setSelectedIds,
  toggleSelection,
  clearSelection,
  clearError,
} = accountsSlice.actions;

// Export selectors
export const {
  selectAll: selectAllAccounts,
  selectById: selectAccountById,
  selectIds: selectAccountIds,
  selectEntities: selectAccountEntities,
  selectTotal: selectTotalAccounts,
} = accountsAdapter.getSelectors((state: RootState) => state.accounts);

export default accountsSlice.reducer;
