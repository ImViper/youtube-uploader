# Deployment Guide

This guide covers deployment strategies for the YouTube Matrix Frontend application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Build Process](#build-process)
4. [Deployment Options](#deployment-options)
5. [Docker Deployment](#docker-deployment)
6. [Cloud Deployments](#cloud-deployments)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Monitoring and Logging](#monitoring-and-logging)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Docker (for containerized deployment)
- Cloud provider account (AWS/GCP/Azure)
- Domain name and SSL certificate

## Environment Configuration

### Environment Variables

Create environment-specific `.env` files:

#### `.env.production`
```env
# API Configuration
VITE_API_URL=https://api.yourdomain.com
VITE_WEBSOCKET_URL=wss://api.yourdomain.com

# Application Settings
VITE_ENVIRONMENT=production
VITE_APP_NAME=YouTube Matrix
VITE_APP_VERSION=1.0.0

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_TRACKING=true

# Third-party Services
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
VITE_GA_TRACKING_ID=UA-XXXXXXXXX-X

# Security
VITE_CSRF_HEADER=X-CSRF-Token
VITE_SESSION_TIMEOUT=3600
```

#### `.env.staging`
```env
VITE_API_URL=https://staging-api.yourdomain.com
VITE_WEBSOCKET_URL=wss://staging-api.yourdomain.com
VITE_ENVIRONMENT=staging
VITE_ENABLE_DEBUG=true
```

### Build Configuration

#### `vite.config.ts`
```typescript
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { compression } from 'vite-plugin-compression2';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [
      react(),
      compression({
        algorithm: 'gzip',
        ext: '.gz',
      }),
      compression({
        algorithm: 'brotliCompress',
        ext: '.br',
      }),
      visualizer({
        filename: './dist/stats.html',
        open: false,
      }),
    ],
    build: {
      target: 'es2015',
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: mode === 'production' ? 'hidden' : true,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'redux-vendor': ['@reduxjs/toolkit', 'react-redux'],
            'ui-vendor': ['antd', '@ant-design/icons'],
            'chart-vendor': ['echarts', 'echarts-for-react'],
            'utils': ['axios', 'date-fns', 'dayjs'],
          },
          assetFileNames: (assetInfo) => {
            let extType = assetInfo.name.split('.').at(1);
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
              extType = 'img';
            }
            return `assets/${extType}/[name]-[hash][extname]`;
          },
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    define: {
      __APP_VERSION__: JSON.stringify(env.npm_package_version),
    },
  };
});
```

## Build Process

### Production Build

1. **Install dependencies**:
   ```bash
   npm ci --production=false
   ```

2. **Run tests**:
   ```bash
   npm run test
   npm run e2e
   ```

3. **Type check**:
   ```bash
   npm run type-check
   ```

4. **Build application**:
   ```bash
   npm run build
   ```

5. **Analyze bundle**:
   ```bash
   npx vite-bundle-visualizer
   ```

### Build Optimization

1. **Enable tree shaking**:
   ```json
   // package.json
   {
     "sideEffects": false
   }
   ```

2. **Optimize images**:
   ```bash
   # Install image optimization tools
   npm install -D imagemin imagemin-webp

   # Convert images to WebP
   npx imagemin src/assets/images/* --out-dir=public/images --plugin=webp
   ```

3. **Preload critical assets**:
   ```html
   <!-- index.html -->
   <link rel="preload" href="/assets/fonts/Inter-Regular.woff2" as="font" crossorigin>
   <link rel="preconnect" href="https://api.yourdomain.com">
   ```

## Deployment Options

### Static Hosting

#### Nginx Configuration
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/ssl/certs/yourdomain.com.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.com.key;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google-analytics.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.yourdomain.com wss://api.yourdomain.com;" always;

    root /var/www/youtube-matrix;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Brotli compression
    brotli on;
    brotli_comp_level 6;
    brotli_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Cache HTML files
    location ~* \.(html)$ {
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy (optional)
    location /api {
        proxy_pass https://api.yourdomain.com;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Docker Deployment

### Dockerfile
```dockerfile
# Build stage
FROM node:18-alpine AS builder

# Install dependencies for node-gyp
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf /etc/nginx/conf.d/default.conf

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose
```yaml
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: youtube-matrix-frontend
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./ssl:/etc/nginx/ssl:ro
      - ./logs:/var/log/nginx
    environment:
      - NODE_ENV=production
    networks:
      - youtube-matrix-network
    restart: unless-stopped

networks:
  youtube-matrix-network:
    driver: bridge
```

### Build and Run
```bash
# Build image
docker build -t youtube-matrix-frontend:latest .

# Run container
docker run -d \
  --name youtube-matrix-frontend \
  -p 80:80 \
  -p 443:443 \
  -v $(pwd)/ssl:/etc/nginx/ssl:ro \
  youtube-matrix-frontend:latest

# Using docker-compose
docker-compose up -d
```

## Cloud Deployments

### AWS S3 + CloudFront

1. **Create S3 bucket**:
   ```bash
   aws s3 mb s3://youtube-matrix-frontend
   ```

2. **Configure bucket for static hosting**:
   ```bash
   aws s3 website s3://youtube-matrix-frontend \
     --index-document index.html \
     --error-document index.html
   ```

3. **Deploy files**:
   ```bash
   aws s3 sync dist/ s3://youtube-matrix-frontend \
     --delete \
     --cache-control max-age=31536000,public \
     --exclude "index.html" \
     --exclude "*.map"
   
   aws s3 cp dist/index.html s3://youtube-matrix-frontend/ \
     --cache-control max-age=3600,must-revalidate
   ```

4. **CloudFront distribution**:
   ```json
   {
     "DistributionConfig": {
       "Origins": [{
         "DomainName": "youtube-matrix-frontend.s3.amazonaws.com",
         "S3OriginConfig": {
           "OriginAccessIdentity": ""
         }
       }],
       "DefaultRootObject": "index.html",
       "CustomErrorResponses": [{
         "ErrorCode": 404,
         "ResponseCode": 200,
         "ResponsePagePath": "/index.html"
       }],
       "DefaultCacheBehavior": {
         "TargetOriginId": "S3-youtube-matrix",
         "ViewerProtocolPolicy": "redirect-to-https",
         "Compress": true
       }
     }
   }
   ```

### Google Cloud Platform

1. **Build and push to Cloud Storage**:
   ```bash
   # Build application
   npm run build

   # Upload to Cloud Storage
   gsutil -m cp -r dist/* gs://youtube-matrix-frontend/
   
   # Set cache headers
   gsutil -m setmeta -h "Cache-Control:public,max-age=31536000" \
     gs://youtube-matrix-frontend/**/*.js
   
   gsutil -m setmeta -h "Cache-Control:public,max-age=3600" \
     gs://youtube-matrix-frontend/index.html
   ```

2. **Configure Load Balancer with CDN**:
   ```yaml
   apiVersion: compute.cnrm.cloud.google.com/v1beta1
   kind: ComputeBackendBucket
   metadata:
     name: youtube-matrix-backend
   spec:
     bucketName: youtube-matrix-frontend
     enableCdn: true
   ```

### Vercel Deployment

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel --prod
   ```

3. **Configuration** (`vercel.json`):
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "framework": "vite",
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ],
     "headers": [
       {
         "source": "/assets/(.*)",
         "headers": [
           {
             "key": "Cache-Control",
             "value": "public, max-age=31536000, immutable"
           }
         ]
       }
     ]
   }
   ```

## CI/CD Pipeline

### GitHub Actions

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  NODE_VERSION: '18'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: |
          npm run test
          npm run type-check
      
      - name: Run E2E tests
        run: |
          npm run build
          npm run preview &
          npm run e2e

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
          VITE_WEBSOCKET_URL: ${{ secrets.VITE_WEBSOCKET_URL }}
          VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Download artifacts
        uses: actions/download-artifact@v3
        with:
          name: dist
          path: dist/
      
      - name: Deploy to S3
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: us-east-1
        run: |
          aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }} \
            --delete \
            --cache-control max-age=31536000,public \
            --exclude "index.html" \
            --exclude "*.map"
          
          aws s3 cp dist/index.html s3://${{ secrets.S3_BUCKET }}/ \
            --cache-control max-age=3600,must-revalidate
      
      - name: Invalidate CloudFront
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: us-east-1
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
      
      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Deployment completed'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: always()
```

### GitLab CI/CD

`.gitlab-ci.yml`:
```yaml
stages:
  - test
  - build
  - deploy

variables:
  NODE_VERSION: "18"

.node_template: &node_template
  image: node:${NODE_VERSION}
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/

test:
  <<: *node_template
  stage: test
  script:
    - npm ci
    - npm run test
    - npm run type-check
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'

build:
  <<: *node_template
  stage: build
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 week
  only:
    - main
    - develop

deploy:
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache aws-cli
  script:
    - aws s3 sync dist/ s3://${S3_BUCKET} --delete
    - aws cloudfront create-invalidation --distribution-id ${CF_DISTRIBUTION_ID} --paths "/*"
  only:
    - main
```

## Monitoring and Logging

### Application Monitoring

1. **Sentry Integration**:
   ```typescript
   // src/utils/monitoring/sentry.ts
   import * as Sentry from '@sentry/react';
   import { BrowserTracing } from '@sentry/tracing';

   export function initSentry() {
     if (import.meta.env.PROD) {
       Sentry.init({
         dsn: import.meta.env.VITE_SENTRY_DSN,
         integrations: [
           new BrowserTracing(),
         ],
         tracesSampleRate: 0.1,
         environment: import.meta.env.VITE_ENVIRONMENT,
         beforeSend(event) {
           // Filter sensitive data
           if (event.request?.cookies) {
             delete event.request.cookies;
           }
           return event;
         },
       });
     }
   }
   ```

2. **Google Analytics**:
   ```html
   <!-- index.html -->
   <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
     gtag('config', 'GA_MEASUREMENT_ID');
   </script>
   ```

3. **Custom Logging**:
   ```typescript
   // src/utils/logger.ts
   class Logger {
     log(level: string, message: string, data?: any) {
       if (import.meta.env.PROD) {
         // Send to logging service
         fetch('/api/logs', {
           method: 'POST',
           body: JSON.stringify({ level, message, data }),
         });
       } else {
         console[level](message, data);
       }
     }
   }
   ```

### Server Monitoring

1. **Nginx Access Logs**:
   ```nginx
   log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                   '$status $body_bytes_sent "$http_referer" '
                   '"$http_user_agent" "$http_x_forwarded_for"';

   access_log /var/log/nginx/access.log main;
   ```

2. **CloudWatch Integration**:
   ```bash
   # Install CloudWatch agent
   wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
   sudo rpm -U ./amazon-cloudwatch-agent.rpm
   ```

## Troubleshooting

### Common Issues

1. **Build Failures**

   **Issue**: Out of memory during build
   ```bash
   FATAL ERROR: Reached heap limit Allocation failed
   ```
   
   **Solution**:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm run build
   ```

2. **404 Errors on Routes**

   **Issue**: Direct URL access returns 404
   
   **Solution**: Configure server for SPA routing
   ```nginx
   location / {
     try_files $uri $uri/ /index.html;
   }
   ```

3. **CORS Issues**

   **Issue**: API calls blocked by CORS
   
   **Solution**: Configure proper CORS headers on API
   ```nginx
   add_header 'Access-Control-Allow-Origin' 'https://yourdomain.com' always;
   add_header 'Access-Control-Allow-Credentials' 'true' always;
   ```

4. **WebSocket Connection Failures**

   **Issue**: WebSocket fails to connect
   
   **Solution**: Configure nginx for WebSocket
   ```nginx
   location /socket.io/ {
     proxy_pass http://backend;
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "upgrade";
   }
   ```

### Performance Issues

1. **Slow Initial Load**
   - Enable compression (gzip/brotli)
   - Implement code splitting
   - Use CDN for static assets
   - Preload critical resources

2. **Large Bundle Size**
   - Analyze bundle with `npm run analyze`
   - Remove unused dependencies
   - Use dynamic imports
   - Enable tree shaking

### Rollback Strategy

1. **Quick Rollback**:
   ```bash
   # S3 deployment
   aws s3 sync s3://youtube-matrix-frontend-backup/ s3://youtube-matrix-frontend/
   
   # Docker deployment
   docker run -d --name youtube-matrix-frontend youtube-matrix-frontend:previous-version
   ```

2. **Database Rollback**: N/A (frontend only)

3. **Feature Flags**:
   ```typescript
   if (featureFlags.newFeature) {
     // New feature code
   } else {
     // Old feature code
   }
   ```

## Security Checklist

- [ ] Environment variables are not exposed in build
- [ ] SSL/TLS certificates are valid and up-to-date
- [ ] Security headers are configured
- [ ] CSP policy is properly set
- [ ] Sensitive data is not logged
- [ ] API keys are stored securely
- [ ] Dependencies are up-to-date
- [ ] Source maps are hidden in production
- [ ] Error messages don't expose sensitive info
- [ ] HTTPS is enforced