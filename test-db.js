const { getDatabase } = require('./dist/database/connection');

async function testDatabase() {
  try {
    const db = getDatabase();
    await db.connect();
    console.log('Connected to database');
    
    // Test simple query
    const result = await db.query('SELECT 1 as test');
    console.log('Test query result:', result.rows);
    
    // Test tasks query
    const tasksQuery = `
      SELECT 
        id, 
        account_id,
        video_data,
        priority,
        status,
        error,
        result,
        created_at,
        scheduled_for,
        started_at,
        completed_at
      FROM upload_tasks 
      WHERE 1=1
      ORDER BY created_at DESC
      LIMIT 10 OFFSET 0
    `;
    
    console.log('Running tasks query...');
    const tasksResult = await db.query(tasksQuery);
    console.log('Tasks found:', tasksResult.rows.length);
    console.log('First task:', tasksResult.rows[0]);
    
  } catch (error) {
    console.error('Database error:', error);
  }
}

testDatabase();