import { createSlice, createEntityAdapter, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';
import type { LoadingState, BaseEntity } from '@/types';

export interface Upload extends BaseEntity {
  accountId: string;
  videoPath: string;
  title: string;
  description: string;
  tags: string[];
  thumbnailPath?: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'paused';
  progress: number;
  uploadSpeed?: number;
  timeRemaining?: number;
  error?: string;
  videoId?: string;
  url?: string;
  scheduledAt?: string;
  completedAt?: string;
}

interface UploadsState {
  loadingState: LoadingState;
  error: string | null;
  filter: {
    status: 'all' | Upload['status'];
    accountId: string | null;
    dateRange: {
      start: string | null;
      end: string | null;
    };
  };
  activeUploads: string[];
}

const uploadsAdapter = createEntityAdapter<Upload>({
  sortComparer: (a, b) => {
    // Sort by status priority, then by creation date
    const statusPriority = {
      uploading: 0,
      processing: 1,
      paused: 2,
      pending: 3,
      failed: 4,
      cancelled: 5,
      completed: 6,
    };
    const priorityDiff = statusPriority[a.status] - statusPriority[b.status];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  },
});

const initialState = uploadsAdapter.getInitialState<UploadsState>({
  loadingState: 'idle',
  error: null,
  filter: {
    status: 'all',
    accountId: null,
    dateRange: {
      start: null,
      end: null,
    },
  },
  activeUploads: [],
});

const uploadsSlice = createSlice({
  name: 'uploads',
  initialState,
  reducers: {
    fetchUploadsStart: (state) => {
      state.loadingState = 'loading';
      state.error = null;
    },
    fetchUploadsSuccess: (state, action: PayloadAction<Upload[]>) => {
      uploadsAdapter.setAll(state, action.payload);
      state.loadingState = 'succeeded';
      state.error = null;
      // Update active uploads list
      state.activeUploads = action.payload
        .filter((u) => u.status === 'uploading' || u.status === 'processing')
        .map((u) => u.id);
    },
    fetchUploadsFailure: (state, action: PayloadAction<string>) => {
      state.loadingState = 'failed';
      state.error = action.payload;
    },
    addUpload: (state, action: PayloadAction<Upload>) => {
      uploadsAdapter.addOne(state, action.payload);
      if (action.payload.status === 'uploading' || action.payload.status === 'processing') {
        state.activeUploads.push(action.payload.id);
      }
    },
    updateUpload: (state, action: PayloadAction<{ id: string; changes: Partial<Upload> }>) => {
      uploadsAdapter.updateOne(state, action.payload);
      const upload = state.entities[action.payload.id];
      if (upload) {
        const isActive = upload.status === 'uploading' || upload.status === 'processing';
        const wasActive = state.activeUploads.includes(upload.id);

        if (isActive && !wasActive) {
          state.activeUploads.push(upload.id);
        } else if (!isActive && wasActive) {
          state.activeUploads = state.activeUploads.filter((id) => id !== upload.id);
        }
      }
    },
    removeUpload: uploadsAdapter.removeOne,
    updateProgress: (
      state,
      action: PayloadAction<{
        id: string;
        progress: number;
        uploadSpeed?: number;
        timeRemaining?: number;
      }>,
    ) => {
      const { id, progress, uploadSpeed, timeRemaining } = action.payload;
      uploadsAdapter.updateOne(state, {
        id,
        changes: { progress, uploadSpeed, timeRemaining },
      });
    },
    setFilter: (state, action: PayloadAction<Partial<UploadsState['filter']>>) => {
      state.filter = { ...state.filter, ...action.payload };
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  fetchUploadsStart,
  fetchUploadsSuccess,
  fetchUploadsFailure,
  addUpload,
  updateUpload,
  removeUpload,
  updateProgress,
  setFilter,
  clearError,
} = uploadsSlice.actions;

// Export selectors
export const {
  selectAll: selectAllUploads,
  selectById: selectUploadById,
  selectIds: selectUploadIds,
  selectEntities: selectUploadEntities,
  selectTotal: selectTotalUploads,
} = uploadsAdapter.getSelectors((state: RootState) => state.uploads);

export default uploadsSlice.reducer;
