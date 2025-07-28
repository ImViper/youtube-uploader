const { Queue } = require('bullmq');
const IORedis = require('ioredis');
require('dotenv').config({ path: '../.env' });

const redis = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null
});

async function cleanFailedTasks() {
  console.log('=== 清理失败任务 ===\n');
  
  const queue = new Queue('youtube-uploads', { connection: redis });
  
  try {
    // 获取失败任务
    const failedJobs = await queue.getFailed();
    console.log(`找到 ${failedJobs.length} 个失败任务`);
    
    // 删除所有失败任务
    for (const job of failedJobs) {
      console.log(`删除失败任务 ${job.id}: ${job.data.taskId || job.data.id}`);
      await job.remove();
    }
    
    console.log('\n✅ 失败任务已清理');
    
    // 显示当前队列状态
    console.log('\n当前队列状态:');
    console.log(`等待中: ${await queue.getWaitingCount()}`);
    console.log(`活跃中: ${await queue.getActiveCount()}`);
    console.log(`已完成: ${await queue.getCompletedCount()}`);
    console.log(`已失败: ${await queue.getFailedCount()}`);
    
  } catch (error) {
    console.error('清理失败:', error.message);
  } finally {
    await queue.close();
    await redis.quit();
  }
}

cleanFailedTasks().catch(console.error);