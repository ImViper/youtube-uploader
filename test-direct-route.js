require('dotenv').config();
const express = require('express');
const { TaskService } = require('./dist/api/task/task.service');

// Create a simple express app to test the route
const app = express();

// Add a test route that directly calls TaskService
app.get('/test-tasks', async (req, res) => {
  try {
    console.log('Direct route called');
    const taskService = new TaskService();
    const result = await taskService.findAll({
      page: 1,
      pageSize: 10,
      type: 'upload'
    });
    console.log('TaskService result:', result);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in test route:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    });
  }
});

const port = 5990;
app.listen(port, () => {
  console.log(`Test server running on port ${port}`);
  console.log('Visit http://localhost:5990/test-tasks to test TaskService directly');
});