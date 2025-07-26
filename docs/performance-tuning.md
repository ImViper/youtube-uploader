# Performance Tuning Guide

## Overview

This guide provides recommendations for optimizing the YouTube Matrix Upload system for maximum throughput and efficiency.

## Key Performance Metrics

- **Upload Throughput**: Videos uploaded per hour
- **Account Utilization**: Percentage of accounts actively uploading
- **Browser Pool Efficiency**: Browser instance utilization rate
- **Queue Processing Rate**: Jobs processed per minute
- **Error Rate**: Failed uploads per hour

## Configuration Optimization

### Browser Pool Settings

```json
{
  "browserPool": {
    "minInstances": 3,      // Minimum browsers always ready
    "maxInstances": 15,     // Maximum concurrent browsers
    "idleTimeout": 300000,  // 5 minutes before closing idle browser
    "healthCheckInterval": 30000  // Check browser health every 30s
  }
}
```

**Recommendations:**
- Set `minInstances` based on average load (typically 20-30% of peak)
- Set `maxInstances` based on system resources (RAM/CPU)
- Each browser instance uses ~500MB RAM
- Monitor browser crashes and adjust health check interval

### Queue Configuration

```json
{
  "queue": {
    "concurrency": 10,      // Parallel upload workers
    "defaultPriority": 0,   // Default job priority
    "maxRetries": 3,        // Retry failed uploads
    "retryDelay": 60000,    // 1 minute between retries
    "rateLimit": {
      "max": 100,           // Max uploads per duration
      "duration": 3600000   // 1 hour window
    }
  }
}
```

**Recommendations:**
- Set `concurrency` to 2x browser pool size for optimal throughput
- Use priority levels: 0 (normal), 1-5 (high), 6-10 (urgent)
- Adjust rate limits based on YouTube quotas

### Account Management

```json
{
  "accounts": {
    "dailyUploadLimit": 10,     // Per account daily limit
    "minHealthScore": 50,       // Minimum health for selection
    "selectionStrategy": "health-score",  // Account selection algorithm
    "reservationTimeout": 300000  // 5 minutes account lock
  }
}
```

**Recommendations:**
- Set daily limits conservatively to avoid YouTube penalties
- Use "health-score" strategy for best reliability
- Monitor account health trends and adjust thresholds

## Database Optimization

### PostgreSQL Tuning

```sql
-- Increase connection pool
ALTER SYSTEM SET max_connections = 200;

-- Optimize for SSD storage
ALTER SYSTEM SET random_page_cost = 1.1;

-- Increase work memory for complex queries
ALTER SYSTEM SET work_mem = '256MB';

-- Enable parallel queries
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;

-- Reload configuration
SELECT pg_reload_conf();
```

### Index Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_accounts_status_health ON accounts(status, health_score);
CREATE INDEX idx_upload_history_created ON upload_history(created_at);
CREATE INDEX idx_upload_tasks_status ON upload_tasks(status, priority);

-- Analyze tables for query planner
ANALYZE accounts;
ANALYZE upload_history;
ANALYZE upload_tasks;
```

## Redis Optimization

### Memory Management

```bash
# Set max memory policy
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Enable persistence with AOF
redis-cli CONFIG SET appendonly yes
redis-cli CONFIG SET appendfsync everysec

# Optimize for low latency
redis-cli CONFIG SET tcp-keepalive 60
redis-cli CONFIG SET timeout 300
```

### Key Expiration

Configure appropriate TTLs to prevent memory bloat:
- Queue jobs: 7 days
- Rate limit counters: 1 hour
- Account reservations: 5 minutes
- Metrics cache: 5 minutes

## System Resource Optimization

### CPU Optimization

1. **Process Affinity**: Pin workers to specific CPU cores
```javascript
// In worker configuration
{
  workerOptions: {
    cpuAffinity: [0, 1, 2, 3]  // Use first 4 cores
  }
}
```

2. **Node.js Flags**:
```bash
node --max-old-space-size=4096 --optimize-for-size server.js
```

### Memory Optimization

1. **Browser Memory Limits**:
```javascript
{
  launchOptions: {
    args: [
      '--max_old_space_size=512',  // Limit V8 memory
      '--disable-dev-shm-usage',   // Use /tmp instead of /dev/shm
      '--disable-gpu',             // Disable GPU acceleration
      '--no-sandbox'               // Required for Docker
    ]
  }
}
```

2. **Garbage Collection Tuning**:
```bash
export NODE_OPTIONS="--expose-gc --max-old-space-size=4096"
```

## Network Optimization

### Proxy Configuration

For distributed proxy usage:

```javascript
{
  proxy: {
    type: "residential",
    rotation: "per-request",
    pool: [
      { host: "proxy1.example.com", port: 8080 },
      { host: "proxy2.example.com", port: 8080 }
    ]
  }
}
```

### Upload Optimization

1. **Video Compression**: Pre-compress videos to reduce upload time
2. **Thumbnail Optimization**: Use WebP format, max 2MB
3. **Batch Metadata**: Group metadata updates to reduce API calls

## Monitoring and Alerts

### Key Metrics to Monitor

1. **System Metrics**:
   - CPU usage < 80%
   - Memory usage < 85%
   - Disk I/O < 80% utilization
   - Network bandwidth utilization

2. **Application Metrics**:
   - Queue depth < 100 jobs
   - Processing rate > 10 jobs/minute
   - Error rate < 5%
   - Account health average > 70%

### Alert Thresholds

```json
{
  "monitoring": {
    "alertThresholds": {
      "errorRate": 10,          // Errors per minute
      "queueDepth": 200,        // Maximum queue size
      "accountHealth": 0.5,     // 50% healthy accounts
      "browserErrors": 5        // Browser crashes per hour
    }
  }
}
```

## Scaling Strategies

### Horizontal Scaling

1. **Multi-Instance Deployment**:
   - Run multiple worker instances
   - Use Redis for coordination
   - Implement distributed locking

2. **Load Balancing**:
   - Distribute accounts across instances
   - Use consistent hashing for account assignment
   - Implement health-based routing

### Vertical Scaling

1. **Resource Allocation**:
   - 4GB RAM per 10 browser instances
   - 2 CPU cores per 5 workers
   - 100GB SSD for video storage
   - 10Mbps upload per concurrent upload

## Performance Testing

### Load Testing Script

```typescript
async function loadTest() {
  const videos = Array(100).fill(null).map((_, i) => ({
    path: `/test/video${i}.mp4`,
    title: `Load Test Video ${i}`,
    description: 'Performance test video'
  }));

  const startTime = Date.now();
  const results = await matrixManager.batchUpload(videos);
  const duration = Date.now() - startTime;

  console.log(`Uploaded ${videos.length} videos in ${duration}ms`);
  console.log(`Throughput: ${videos.length / (duration / 1000)} videos/second`);
}
```

### Bottleneck Identification

1. **Database Queries**: Enable slow query logging
2. **Network Latency**: Monitor upload speeds
3. **CPU Profiling**: Use Node.js profiler
4. **Memory Leaks**: Monitor heap snapshots

## Best Practices

1. **Regular Maintenance**:
   - Clean old jobs weekly
   - Reset account health monthly
   - Rotate logs daily
   - Update browser versions monthly

2. **Capacity Planning**:
   - Monitor growth trends
   - Plan for 2x peak capacity
   - Implement auto-scaling triggers
   - Regular performance reviews

3. **Error Recovery**:
   - Implement circuit breakers
   - Use exponential backoff
   - Monitor recovery success rates
   - Automate account recovery

4. **Security Considerations**:
   - Rotate API keys monthly
   - Monitor for unusual activity
   - Implement rate limiting
   - Regular security audits