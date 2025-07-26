// Mock database connection for testing
export class DatabaseConnection {
  private mockResults: any = {};
  
  // Make query a jest mock function
  query = jest.fn(async (text: string, params?: any[]): Promise<any> => {
    // Return mock results based on query
    if (text.includes('INSERT INTO upload_tasks')) {
      return {
        rows: [{
          id: params?.[0],
          account_id: params?.[1],
          video_data: params?.[2],
          priority: params?.[3],
          status: params?.[4],
          scheduled_for: params?.[5],
          created_at: params?.[6]
        }],
        rowCount: 1
      };
    }
    
    // Handle stats queries
    if (text.includes('COUNT(*) as total') && text.includes('FILTER')) {
      return {
        rows: [{
          total: '100',
          pending: '20',
          active: '0',
          completed: '70',
          failed: '10',
          avg_completion_time: '300000' // 300 seconds in milliseconds
        }],
        rowCount: 1
      };
    }
    
    // Handle priority stats query
    if (text.includes('priority_name') && text.includes('GROUP BY priority')) {
      return {
        rows: [
          { priority_name: 'low', count: '10' },
          { priority_name: 'normal', count: '60' },
          { priority_name: 'high', count: '20' },
          { priority_name: 'urgent', count: '10' }
        ],
        rowCount: 4
      };
    }
    
    if (text.includes('SELECT') && text.includes('FROM upload_tasks')) {
      return {
        rows: this.mockResults.tasks || [],
        rowCount: (this.mockResults.tasks || []).length
      };
    }

    if (text.includes('UPDATE upload_tasks')) {
      return {
        rows: [{ id: params?.[params.length - 1] }],
        rowCount: 1
      };
    }

    if (text.includes('DELETE FROM upload_tasks')) {
      return {
        rows: [],
        rowCount: 1
      };
    }

    // Default response
    return {
      rows: [],
      rowCount: 0
    };
  });

  async connect(): Promise<void> {
    // Mock successful connection
  }

  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const mockClient = {
      query: this.query.bind(this),
      release: jest.fn()
    };
    try {
      return await callback(mockClient);
    } catch (error) {
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  getPoolStats() {
    return {
      totalCount: 10,
      idleCount: 8,
      waitingCount: 0
    };
  }

  async close(): Promise<void> {
    // Mock close
  }

  get connected(): boolean {
    return true;
  }

  // Helper method for tests to set mock data
  setMockData(key: string, data: any) {
    this.mockResults[key] = data;
  }
}

let mockInstance: DatabaseConnection | null = null;

export function getDatabase(): DatabaseConnection {
  if (!mockInstance) {
    mockInstance = new DatabaseConnection();
  }
  return mockInstance;
}

export async function closeDatabase(): Promise<void> {
  if (mockInstance) {
    await mockInstance.close();
    mockInstance = null;
  }
}