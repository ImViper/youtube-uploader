#!/bin/bash

# YouTube Matrix Frontend Deployment Script
# Usage: ./scripts/deploy.sh [environment] [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT=${1:-production}
SKIP_TESTS=${2:-false}
SKIP_BUILD=${3:-false}

# Configuration
AWS_REGION="us-east-1"
S3_BUCKET_PROD="youtube-matrix-frontend-prod"
S3_BUCKET_STAGING="youtube-matrix-frontend-staging"
CLOUDFRONT_DIST_PROD="E1234567890ABC"
CLOUDFRONT_DIST_STAGING="E0987654321XYZ"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
    fi
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is not installed"
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials are not configured"
    fi
    
    log "Prerequisites check passed ✓"
}

# Run tests
run_tests() {
    if [ "$SKIP_TESTS" = "true" ]; then
        warning "Skipping tests as requested"
        return
    fi
    
    log "Running tests..."
    npm run test || error "Tests failed"
    npm run type-check || error "Type check failed"
    log "Tests passed ✓"
}

# Build application
build_application() {
    if [ "$SKIP_BUILD" = "true" ]; then
        warning "Skipping build as requested"
        return
    fi
    
    log "Building application for $ENVIRONMENT..."
    
    # Set environment variables
    export NODE_ENV=production
    export VITE_ENVIRONMENT=$ENVIRONMENT
    
    # Load environment-specific variables
    if [ -f ".env.$ENVIRONMENT" ]; then
        export $(cat .env.$ENVIRONMENT | grep -v '^#' | xargs)
    fi
    
    # Clean previous build
    rm -rf dist
    
    # Build
    npm run build || error "Build failed"
    
    # Generate build info
    echo "{
        \"version\": \"$(git rev-parse HEAD)\",
        \"buildTime\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"environment\": \"$ENVIRONMENT\",
        \"branch\": \"$(git rev-parse --abbrev-ref HEAD)\"
    }" > dist/build-info.json
    
    log "Build completed ✓"
}

# Deploy to S3
deploy_to_s3() {
    log "Deploying to S3..."
    
    # Select bucket based on environment
    if [ "$ENVIRONMENT" = "production" ]; then
        S3_BUCKET=$S3_BUCKET_PROD
        CLOUDFRONT_DIST=$CLOUDFRONT_DIST_PROD
    else
        S3_BUCKET=$S3_BUCKET_STAGING
        CLOUDFRONT_DIST=$CLOUDFRONT_DIST_STAGING
    fi
    
    # Backup current deployment
    log "Creating backup of current deployment..."
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    aws s3 sync s3://$S3_BUCKET s3://$S3_BUCKET-backup/$BACKUP_NAME --quiet
    
    # Upload files with appropriate cache headers
    log "Uploading static assets..."
    aws s3 sync dist/ s3://$S3_BUCKET \
        --delete \
        --cache-control "max-age=31536000,public" \
        --exclude "index.html" \
        --exclude "*.map" \
        --exclude "build-info.json" \
        --exclude "sw.js"
    
    # Upload index.html with no-cache
    log "Uploading index.html..."
    aws s3 cp dist/index.html s3://$S3_BUCKET/ \
        --cache-control "max-age=0,no-cache,no-store,must-revalidate" \
        --content-type "text/html"
    
    # Upload service worker with no-cache
    if [ -f "dist/sw.js" ]; then
        log "Uploading service worker..."
        aws s3 cp dist/sw.js s3://$S3_BUCKET/ \
            --cache-control "max-age=0,no-cache,no-store,must-revalidate"
    fi
    
    # Upload build info
    aws s3 cp dist/build-info.json s3://$S3_BUCKET/ \
        --cache-control "max-age=300"
    
    log "S3 deployment completed ✓"
}

# Invalidate CloudFront
invalidate_cloudfront() {
    log "Invalidating CloudFront cache..."
    
    INVALIDATION_ID=$(aws cloudfront create-invalidation \
        --distribution-id $CLOUDFRONT_DIST \
        --paths "/*" \
        --query 'Invalidation.Id' \
        --output text)
    
    log "CloudFront invalidation started (ID: $INVALIDATION_ID)"
    
    # Optionally wait for invalidation to complete
    if [ "$WAIT_FOR_INVALIDATION" = "true" ]; then
        log "Waiting for invalidation to complete..."
        aws cloudfront wait invalidation-completed \
            --distribution-id $CLOUDFRONT_DIST \
            --id $INVALIDATION_ID
        log "CloudFront invalidation completed ✓"
    fi
}

# Run smoke tests
run_smoke_tests() {
    log "Running smoke tests..."
    
    # Determine URL based on environment
    if [ "$ENVIRONMENT" = "production" ]; then
        URL="https://yourdomain.com"
    else
        URL="https://staging.yourdomain.com"
    fi
    
    # Wait for deployment to propagate
    sleep 10
    
    # Check if site is accessible
    if ! curl -f -s -o /dev/null $URL; then
        error "Site is not accessible at $URL"
    fi
    
    # Check build info
    BUILD_INFO=$(curl -s $URL/build-info.json)
    DEPLOYED_VERSION=$(echo $BUILD_INFO | jq -r .version)
    CURRENT_VERSION=$(git rev-parse HEAD)
    
    if [ "$DEPLOYED_VERSION" != "$CURRENT_VERSION" ]; then
        error "Deployed version mismatch. Expected: $CURRENT_VERSION, Got: $DEPLOYED_VERSION"
    fi
    
    log "Smoke tests passed ✓"
}

# Send notification
send_notification() {
    log "Sending deployment notification..."
    
    # Slack notification (if webhook is set)
    if [ ! -z "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"text\": \"Deployment completed\",
                \"attachments\": [{
                    \"color\": \"good\",
                    \"fields\": [
                        {\"title\": \"Environment\", \"value\": \"$ENVIRONMENT\", \"short\": true},
                        {\"title\": \"Version\", \"value\": \"$(git rev-parse --short HEAD)\", \"short\": true},
                        {\"title\": \"Branch\", \"value\": \"$(git rev-parse --abbrev-ref HEAD)\", \"short\": true},
                        {\"title\": \"Deployed by\", \"value\": \"$(git config user.name)\", \"short\": true}
                    ]
                }]
            }" \
            $SLACK_WEBHOOK
    fi
    
    log "Notification sent ✓"
}

# Main deployment flow
main() {
    log "Starting deployment to $ENVIRONMENT environment"
    
    check_prerequisites
    run_tests
    build_application
    deploy_to_s3
    invalidate_cloudfront
    run_smoke_tests
    send_notification
    
    log "Deployment completed successfully! 🎉"
    log "URL: https://$( [ "$ENVIRONMENT" = "production" ] && echo "yourdomain.com" || echo "staging.yourdomain.com" )"
}

# Run main function
main