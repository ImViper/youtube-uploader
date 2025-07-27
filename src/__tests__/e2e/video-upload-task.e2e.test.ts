import request from 'supertest';
import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { createTaskRoutes } from '../../api/task/task.routes';
import { TaskService } from '../../api/task/task.service';
import { QueueManager } from '../../queue/manager';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getDatabase } from '../../database/connection';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Mock only the queue manager
jest.mock('../../queue/manager');
jest.mock('ioredis', () => {
  const Redis = jest.fn(() => ({
    on: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    quit: jest.fn(),
  }));
  return Redis;
});

describe('Video Upload Task E2E Tests', () => {
  let app: express.Express;
  let server: any;
  let io: Server;
  let mockQueueManager: jest.Mocked<QueueManager>;
  let db: any;
  
  // Test data
  let testAccountId: string;
  const testMatrixId = uuidv4();
  const testVideoPath = path.join(__dirname, 'test-video.mp4');
  const createdTaskIds: string[] = [];
  
  beforeAll(async () => {
    // Create a mock video file
    if (!fs.existsSync(testVideoPath)) {
      fs.writeFileSync(testVideoPath, 'mock video content');
    }
    
    // Connect to the test database
    db = getDatabase();
    await db.connect();
    
    // Create a test account
    const accountResult = await db.query(
      `INSERT INTO accounts (email, encrypted_credentials, browser_profile_id, status, daily_upload_limit) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      ['test@example.com', 'encrypted_test_credentials', `test-profile-${uuidv4()}`, 'active', 10]
    );
    testAccountId = accountResult.rows[0].id;
  });
  
  afterAll(async () => {
    // Clean up mock video file
    if (fs.existsSync(testVideoPath)) {
      fs.unlinkSync(testVideoPath);
    }
    
    // Clean up all created tasks from database
    if (createdTaskIds.length > 0) {
      await db.query(
        `DELETE FROM upload_tasks WHERE id = ANY($1)`,
        [createdTaskIds]
      );
    }
    
    // Clean up test account
    if (testAccountId) {
      await db.query(
        `DELETE FROM accounts WHERE id = $1`,
        [testAccountId]
      );
    }
    
    // Close database connection
    await db.close();
  });
  
  beforeEach(() => {
    // Set up Express app
    app = express();
    app.use(express.json());
    
    // Create HTTP server and Socket.IO
    server = createServer(app);
    io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true
      }
    });
    
    // Mock queue manager
    mockQueueManager = {
      addUploadTask: jest.fn().mockResolvedValue({ 
        id: uuidv4(),
        name: `upload-${uuidv4()}`,
        data: {},
        opts: { priority: 0 }
      }),
      getJob: jest.fn().mockResolvedValue({
        id: uuidv4(),
        name: `upload-${uuidv4()}`,
        data: {
          id: uuidv4(),
          status: 'completed',
          progress: 100,
          result: { videoId: 'mock-youtube-video-id' }
        },
        progress: 100,
        getState: jest.fn().mockResolvedValue('completed')
      }),
      removeTask: jest.fn().mockResolvedValue(true),
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
    } as any;
    
    // Set up routes
    app.use('/api/v1/tasks', createTaskRoutes(mockQueueManager));
  });
  
  afterEach((done) => {
    // Clean up
    server.close(() => {
      io.close(() => {
        done();
      });
    });
    jest.clearAllMocks();
  });
  
  describe('POST /api/v1/tasks - Create Upload Task', () => {
    it('should create a video upload task successfully', async () => {
      const uploadTaskData = {
        type: 'upload',
        video: {
          path: testVideoPath,
          title: 'Test Video Upload',
          description: 'This is a test video upload via E2E test',
          tags: ['test', 'e2e', 'automation'],
          privacy: 'private',
          category: 'Education',
          language: 'en'
        },
        priority: 'normal',
        accountId: testAccountId,
        matrixId: testMatrixId,
        metadata: {
          source: 'e2e-test',
          testId: 'video-upload-001'
        }
      };
      
      const response = await request(app)
        .post('/api/v1/tasks')
        .send(uploadTaskData);
      
      if (response.status !== 201) {
        console.error('Response status:', response.status);
        console.error('Response body:', response.body);
      }
      
      expect(response.status).toBe(201);
      expect(response.header['content-type']).toMatch(/json/);
      
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          type: 'upload',
          status: 'queued',
          priority: 'normal'
        }
      });
      
      // Track created task for cleanup
      createdTaskIds.push(response.body.data.id);
      
      // Verify task was created in database
      const result = await db.query(
        'SELECT * FROM upload_tasks WHERE id = $1',
        [response.body.data.id]
      );
      
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({
        id: response.body.data.id,
        account_id: testAccountId,
        status: 'pending'
      });
    });
    
    it('should validate required fields', async () => {
      const invalidTaskData = {
        type: 'upload',
        video: {
          // Missing required fields: path and title
          description: 'Invalid task'
        }
      };
      
      const response = await request(app)
        .post('/api/v1/tasks')
        .send(invalidTaskData)
        .expect('Content-Type', /json/)
        .expect(400);
      
      expect(response.body).toMatchObject({
        error: expect.stringContaining('Validation')
      });
    });
    
    it('should handle video with all optional fields', async () => {
      const uploadTaskData = {
        type: 'upload',
        video: {
          path: testVideoPath,
          title: 'Complete Video Upload Test',
          description: 'Video with all optional fields',
          tags: ['test', 'complete', 'all-fields'],
          thumbnail: path.join(__dirname, 'thumbnail.jpg'),
          publishAt: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          privacy: 'public',
          playlist: 'Test Playlist',
          language: 'en',
          category: 'Science & Technology'
        },
        priority: 'high',
        accountId: testAccountId,
        matrixId: testMatrixId,
        scheduledAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        retryPolicy: {
          maxAttempts: 5,
          backoffMultiplier: 2,
          initialDelay: 2000
        },
        metadata: {
          campaign: 'tech-tutorials',
          series: 'advanced-programming'
        }
      };
      
      const response = await request(app)
        .post('/api/v1/tasks')
        .send(uploadTaskData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.priority).toBe('high');
      
      // Track created task for cleanup
      createdTaskIds.push(response.body.data.id);
    });
  });
  
  describe('GET /api/v1/tasks/:id - Get Task Status', () => {
    it('should retrieve task status and progress', async () => {
      // First create a task
      const createResponse = await request(app)
        .post('/api/v1/tasks')
        .send({
          type: 'upload',
          video: {
            path: testVideoPath,
            title: 'Task Status Test'
          },
          accountId: testAccountId
        })
        .expect(201);
      
      const taskId = createResponse.body.data.id;
      createdTaskIds.push(taskId);
      
      // Now retrieve it
      const response = await request(app)
        .get(`/api/v1/tasks/${taskId}`)
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: taskId,
          type: 'upload',
          status: expect.any(String)
        }
      });
    });
    
    it('should return 404 for non-existent task', async () => {
      const nonExistentId = uuidv4();
      
      const response = await request(app)
        .get(`/api/v1/tasks/${nonExistentId}`)
        .expect(404);
      
      expect(response.body).toMatchObject({
        success: false,
        error: 'Task not found'
      });
    });
  });
  
  describe('GET /api/v1/tasks/:id/progress - Get Task Progress', () => {
    it('should retrieve real-time task progress', async () => {
      // First create a task
      const createResponse = await request(app)
        .post('/api/v1/tasks')
        .send({
          type: 'upload',
          video: {
            path: testVideoPath,
            title: 'Progress Test'
          },
          accountId: testAccountId
        })
        .expect(201);
      
      const taskId = createResponse.body.data.id;
      createdTaskIds.push(taskId);
      
      const response = await request(app)
        .get(`/api/v1/tasks/${taskId}/progress`)
        .expect(200);
      
      expect(response.body).toMatchObject({
        success: true,
        data: {
          taskId: taskId,
          status: expect.any(String),
          progress: expect.any(Number)
        }
      });
    });
  });
  
  describe('POST /api/v1/tasks/batch - Batch Create Tasks', () => {
    it('should create multiple upload tasks', async () => {
      const batchData = {
        tasks: [
          {
            type: 'upload',
            video: {
              path: testVideoPath,
              title: 'Batch Video 1',
              description: 'First video in batch',
              privacy: 'private'
            },
            priority: 'normal',
            accountId: testAccountId,
            matrixId: testMatrixId
          },
          {
            type: 'upload',
            video: {
              path: testVideoPath,
              title: 'Batch Video 2',
              description: 'Second video in batch',
              privacy: 'private'
            },
            priority: 'high',
            accountId: testAccountId,
            matrixId: testMatrixId
          },
          {
            type: 'upload',
            video: {
              path: testVideoPath,
              title: 'Batch Video 3',
              description: 'Third video in batch',
              privacy: 'public'
            },
            priority: 'low',
            accountId: testAccountId,
            matrixId: testMatrixId
          }
        ]
      };
      
      const response = await request(app)
        .post('/api/v1/tasks/batch')
        .send(batchData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.created).toBe(3);
      expect(response.body.data.failed).toBe(0);
      expect(response.body.data.tasks).toHaveLength(3);
      expect(response.body.data.tasks[0].type).toBe('upload');
      expect(response.body.data.tasks[2].status).toBe('queued');
      
      // Track created tasks for cleanup
      response.body.data.tasks.forEach((task: any) => {
        createdTaskIds.push(task.id);
      });
    });
  });
  
  describe('PATCH /api/v1/tasks/:id - Update Task', () => {
    it('should update task priority', async () => {
      // First create a task
      const createResponse = await request(app)
        .post('/api/v1/tasks')
        .send({
          type: 'upload',
          video: {
            path: testVideoPath,
            title: 'Update Test'
          },
          priority: 'normal',
          accountId: testAccountId
        })
        .expect(201);
      
      const taskId = createResponse.body.data.id;
      createdTaskIds.push(taskId);
      
      const updateData = {
        priority: 'urgent',
        metadata: {
          reason: 'Client request',
          updatedBy: 'e2e-test'
        }
      };
      
      const response = await request(app)
        .patch(`/api/v1/tasks/${taskId}`)
        .send(updateData)
        .expect(200);
      
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: taskId,
          priority: 'urgent'
        }
      });
    });
  });
  
  describe('POST /api/v1/tasks/:id/cancel - Cancel Task', () => {
    it('should cancel a pending task', async () => {
      // First create a task
      const createResponse = await request(app)
        .post('/api/v1/tasks')
        .send({
          type: 'upload',
          video: {
            path: testVideoPath,
            title: 'Cancel Test'
          },
          accountId: testAccountId
        })
        .expect(201);
      
      const taskId = createResponse.body.data.id;
      createdTaskIds.push(taskId);
      
      const response = await request(app)
        .post(`/api/v1/tasks/${taskId}/cancel`)
        .expect(200);
      
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: taskId,
          status: 'failed'
        }
      });
      
      // Verify task was cancelled in database
      const result = await db.query(
        'SELECT status, error FROM upload_tasks WHERE id = $1',
        [taskId]
      );
      
      expect(result.rows[0]).toMatchObject({
        status: 'failed',
        error: 'Task cancelled by user'
      });
    });
  });
  
  describe('Complete Upload Workflow', () => {
    it('should handle complete upload workflow from creation to completion', async () => {
      // Step 1: Create upload task
      const uploadData = {
        type: 'upload',
        video: {
          path: testVideoPath,
          title: 'Complete Workflow Test',
          description: 'Testing complete upload workflow',
          tags: ['test', 'workflow'],
          privacy: 'private',
          category: 'Education'
        },
        priority: 'high',
        accountId: testAccountId,
        matrixId: testMatrixId
      };
      
      const createResponse = await request(app)
        .post('/api/v1/tasks')
        .send(uploadData)
        .expect(201);
      
      const taskId = createResponse.body.data.id;
      createdTaskIds.push(taskId);
      expect(taskId).toBeTruthy();
      
      // Step 2: Check initial status
      const statusResponse = await request(app)
        .get(`/api/v1/tasks/${taskId}`)
        .expect(200);
      
      expect(statusResponse.body.data.status).toBe('pending');
      expect(statusResponse.body.data.priority).toBe('high');
      
      // Step 3: Check progress
      const progressResponse = await request(app)
        .get(`/api/v1/tasks/${taskId}/progress`)
        .expect(200);
      
      expect(progressResponse.body.data.status).toBe('pending');
      
      // Step 4: Simulate completion by updating the task in database
      await db.query(
        `UPDATE upload_tasks 
         SET status = 'completed', 
             completed_at = NOW(),
             result = $1
         WHERE id = $2`,
        [
          JSON.stringify({
            videoId: 'yt-video-123',
            videoUrl: 'https://youtube.com/watch?v=yt-video-123',
            uploadDuration: 45000,
            thumbnailUrl: 'https://i.ytimg.com/vi/yt-video-123/default.jpg'
          }),
          taskId
        ]
      );
      
      // Step 5: Final completion check
      const finalResponse = await request(app)
        .get(`/api/v1/tasks/${taskId}`)
        .expect(200);
      
      expect(finalResponse.body.data).toMatchObject({
        status: 'completed',
        result: {
          videoId: 'yt-video-123',
          videoUrl: expect.stringContaining('youtube.com')
        }
      });
    });
  });
});