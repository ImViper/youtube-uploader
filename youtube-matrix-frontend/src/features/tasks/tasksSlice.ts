import { createSlice, createEntityAdapter, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';
import type { LoadingState, BaseEntity } from '@/types';

export interface Task extends BaseEntity {
  type: 'upload' | 'update' | 'comment' | 'delete';
  accountId: string;
  uploadId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  priority: 'high' | 'medium' | 'low';
  progress: number;
  error?: string;
  result?: any;
  attempts: number;
  maxAttempts: number;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  metadata?: Record<string, any>;
}

interface TasksState {
  loadingState: LoadingState;
  error: string | null;
  filter: {
    status: 'all' | Task['status'];
    type: 'all' | Task['type'];
    accountId: string | null;
    dateRange: {
      start: string | null;
      end: string | null;
    };
  };
  activeTasks: string[];
}

const tasksAdapter = createEntityAdapter<Task>({
  sortComparer: (a, b) => {
    // Sort by priority, then status, then creation date
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const statusOrder = {
      running: 0,
      pending: 1,
      paused: 2,
      failed: 3,
      cancelled: 4,
      completed: 5,
    };

    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  },
});

const initialState = tasksAdapter.getInitialState<TasksState>({
  loadingState: 'idle',
  error: null,
  filter: {
    status: 'all',
    type: 'all',
    accountId: null,
    dateRange: {
      start: null,
      end: null,
    },
  },
  activeTasks: [],
});

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    fetchTasksStart: (state) => {
      state.loadingState = 'loading';
      state.error = null;
    },
    fetchTasksSuccess: (state, action: PayloadAction<Task[]>) => {
      tasksAdapter.setAll(state, action.payload);
      state.loadingState = 'succeeded';
      state.error = null;
      // Update active tasks list
      state.activeTasks = action.payload
        .filter((t) => t.status === 'running' || t.status === 'pending')
        .map((t) => t.id);
    },
    fetchTasksFailure: (state, action: PayloadAction<string>) => {
      state.loadingState = 'failed';
      state.error = action.payload;
    },
    addTask: (state, action: PayloadAction<Task>) => {
      tasksAdapter.addOne(state, action.payload);
      if (action.payload.status === 'running' || action.payload.status === 'pending') {
        state.activeTasks.push(action.payload.id);
      }
    },
    updateTask: (state, action: PayloadAction<{ id: string; changes: Partial<Task> }>) => {
      tasksAdapter.updateOne(state, action.payload);
      const task = state.entities[action.payload.id];
      if (task) {
        const isActive = task.status === 'running' || task.status === 'pending';
        const wasActive = state.activeTasks.includes(task.id);

        if (isActive && !wasActive) {
          state.activeTasks.push(task.id);
        } else if (!isActive && wasActive) {
          state.activeTasks = state.activeTasks.filter((id) => id !== task.id);
        }
      }
    },
    removeTask: tasksAdapter.removeOne,
    removeTasks: tasksAdapter.removeMany,
    updateProgress: (state, action: PayloadAction<{ id: string; progress: number }>) => {
      tasksAdapter.updateOne(state, {
        id: action.payload.id,
        changes: { progress: action.payload.progress },
      });
    },
    setFilter: (state, action: PayloadAction<Partial<TasksState['filter']>>) => {
      state.filter = { ...state.filter, ...action.payload };
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  fetchTasksStart,
  fetchTasksSuccess,
  fetchTasksFailure,
  addTask,
  updateTask,
  removeTask,
  removeTasks,
  updateProgress,
  setFilter,
  clearError,
} = tasksSlice.actions;

// Export selectors
export const {
  selectAll: selectAllTasks,
  selectById: selectTaskById,
  selectIds: selectTaskIds,
  selectEntities: selectTaskEntities,
  selectTotal: selectTotalTasks,
} = tasksAdapter.getSelectors((state: RootState) => state.tasks);

export default tasksSlice.reducer;
