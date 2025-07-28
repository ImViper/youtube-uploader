import { z } from 'zod';

// Common schemas
export const paginationSchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  pageSize: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional()
});

// Matrix schemas
export const createMatrixSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  config: z.object({
    maxConcurrentUploads: z.number().int().positive().default(3),
    retryAttempts: z.number().int().positive().max(10).default(3),
    retryDelay: z.number().int().positive().default(5000),
    dailyUploadLimit: z.number().int().positive().optional(),
    priority: z.enum(['low', 'normal', 'high']).default('normal')
  }).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

export const updateMatrixSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  config: z.object({
    maxConcurrentUploads: z.number().int().positive().optional(),
    retryAttempts: z.number().int().positive().max(10).optional(),
    retryDelay: z.number().int().positive().optional(),
    dailyUploadLimit: z.number().int().positive().optional(),
    priority: z.enum(['low', 'normal', 'high']).optional()
  }).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  status: z.enum(['active', 'paused', 'disabled']).optional()
});

// Account schemas
export const createAccountSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  bitbrowser_window_name: z.string().optional(),
  proxy: z.object({
    host: z.string(),
    port: z.number().int().positive().max(65535),
    username: z.string().optional(),
    password: z.string().optional()
  }).optional(),
  metadata: z.object({
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
    customFields: z.record(z.string(), z.any()).optional()
  }).optional(),
  dailyUploadLimit: z.number().int().positive().default(10)
});

export const updateAccountSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  bitbrowser_window_name: z.string().optional(),
  browserWindowName: z.string().optional(), // Support camelCase from frontend
  proxy: z.object({
    host: z.string(),
    port: z.number().int().positive().max(65535),
    username: z.string().optional(),
    password: z.string().optional()
  }).optional(),
  metadata: z.object({
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
    customFields: z.record(z.string(), z.any()).optional()
  }).optional(),
  notes: z.string().optional(), // Support root-level notes from frontend
  dailyUploadLimit: z.number().int().positive().optional(),
  status: z.enum(['active', 'suspended', 'disabled']).optional(),
  healthScore: z.number().min(0).max(100).optional()
});

export const accountFilterSchema = z.object({
  status: z.enum(['active', 'suspended', 'disabled', 'all']).optional(),
  minHealthScore: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  hasAvailableUploads: z.string().optional().transform(val => val === 'true' ? true : val === 'false' ? false : undefined),
  tags: z.array(z.string()).optional()
});

// Task schemas
export const createTaskSchema = z.object({
  type: z.enum(['upload', 'update', 'comment', 'analytics']),
  video: z.object({
    path: z.string().min(1),
    title: z.string().min(1).max(100),
    description: z.string().max(5000).optional(),
    tags: z.array(z.string()).max(15).optional(),
    thumbnail: z.string().optional(),
    publishAt: z.string().datetime().optional(),
    privacy: z.enum(['public', 'private', 'unlisted']).default('public'),
    playlist: z.string().optional(),
    language: z.string().optional(),
    category: z.string().optional()
  }),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  accountId: z.string().uuid().optional(),
  matrixId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  retryPolicy: z.object({
    maxAttempts: z.number().int().positive().max(10).default(3),
    backoffMultiplier: z.number().positive().default(2),
    initialDelay: z.number().int().positive().default(1000)
  }).optional()
});

export const updateTaskSchema = z.object({
  status: z.enum(['pending', 'queued', 'processing', 'completed', 'failed', 'cancelled']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  result: z.record(z.string(), z.any()).optional(),
  error: z.string().optional()
});

export const taskFilterSchema = z.object({
  status: z.enum(['pending', 'queued', 'processing', 'completed', 'failed', 'cancelled', 'all']).optional(),
  type: z.enum(['upload', 'update', 'comment', 'analytics', 'all']).optional(),
  accountId: z.string().uuid().optional(),
  matrixId: z.string().uuid().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent', 'all']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional()
});

// Batch operation schemas
export const batchTaskSchema = z.object({
  tasks: z.array(createTaskSchema).min(1).max(100)
});

export const batchAccountSchema = z.object({
  accounts: z.array(createAccountSchema).min(1).max(100)
});

// Import/Export schemas
export const importAccountsSchema = z.object({
  format: z.enum(['csv', 'json']),
  data: z.string().optional(),
  accounts: z.array(createAccountSchema).optional()
});

export const exportAccountsSchema = z.object({
  format: z.enum(['csv', 'json']).default('json'),
  ids: z.array(z.string().uuid()).optional(),
  includePasswords: z.string().optional().transform(val => val === 'true')
});