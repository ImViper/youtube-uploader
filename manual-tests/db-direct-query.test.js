const { getDatabase } = require('../dist/database/connection');

async function testDirectQuery() {
  const db = getDatabase();
  
  try {
    console.log('Testing direct database query...');
    
    // Test the accounts table
    const result = await db.query('SELECT * FROM accounts LIMIT 5');
    console.log('Query successful!');
    console.log('Row count:', result.rows.length);
    console.log('Columns:', Object.keys(result.rows[0] || {}));
    
    if (result.rows.length > 0) {
      console.log('\nFirst row:');
      console.log(result.rows[0]);
    }
    
    // Check if table has required columns
    const columnsResult = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'accounts'
      ORDER BY ordinal_position
    `);
    
    console.log('\nTable columns:');
    columnsResult.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });
    
  } catch (error) {
    console.error('Database query failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await db.close();
  }
}

testDirectQuery();