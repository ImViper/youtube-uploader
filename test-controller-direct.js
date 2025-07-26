require('dotenv').config();
const { TaskService } = require('./dist/api/task/task.service');
const { TaskController } = require('./dist/api/task/task.controller');

async function testControllerDirectly() {
  console.log('Testing TaskController directly...\n');
  
  try {
    // Create service and controller
    const taskService = new TaskService();
    const taskController = new TaskController(taskService);
    
    // Mock request and response
    const mockReq = {
      query: {
        page: 1,
        pageSize: 10,
        type: 'upload'
      },
      params: {},
      body: {}
    };
    
    const mockRes = {
      json: (data) => {
        console.log('Response JSON:', JSON.stringify(data, null, 2));
      },
      status: (code) => {
        console.log('Response Status:', code);
        return mockRes; // for chaining
      }
    };
    
    // Call the getTasks method directly
    await taskController.getTasks(mockReq, mockRes);
    
  } catch (error) {
    console.error('Direct error:', error);
    console.error('Stack:', error.stack);
  }
}

testControllerDirectly();