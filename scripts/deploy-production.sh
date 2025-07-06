#!/bin/bash
# scripts/deploy-production.sh
# Production deployment script for List Cutter unified Worker

set -e

echo "🚀 Starting List Cutter production deployment..."
echo "============================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verify environment
print_status "Verifying environment..."

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    print_error "CLOUDFLARE_API_TOKEN not set"
    echo "Please set your Cloudflare API token:"
    echo "export CLOUDFLARE_API_TOKEN=your_token_here"
    exit 1
fi

if [ ! -d "unified-worker" ]; then
    print_error "unified-worker directory not found"
    echo "Please run this script from the repository root"
    exit 1
fi

cd unified-worker

# Pre-deployment checks
print_status "Running pre-deployment checks..."

# Type checking
print_status "Running TypeScript type check..."
npm run typecheck
if [ $? -ne 0 ]; then
    print_error "TypeScript type checking failed"
    exit 1
fi
print_success "TypeScript type check passed"

# Linting
print_status "Running ESLint..."
npm run lint
if [ $? -ne 0 ]; then
    print_error "Linting failed"
    exit 1
fi
print_success "Linting passed"

# Test suite
print_status "Running test suite..."
npm test
if [ $? -ne 0 ]; then
    print_error "Tests failed"
    exit 1
fi
print_success "Tests passed"

# Build application
print_status "Building application..."
npm run build
if [ $? -ne 0 ]; then
    print_error "Build failed"
    exit 1
fi
print_success "Build completed"

# Deploy to staging first
print_status "Deploying to staging for validation..."
wrangler deploy --env staging
if [ $? -ne 0 ]; then
    print_error "Staging deployment failed"
    exit 1
fi
print_success "Staging deployment completed"

# Staging validation
print_status "Running staging validation..."
./scripts/validate-staging.sh
if [ $? -ne 0 ]; then
    print_error "Staging validation failed"
    exit 1
fi
print_success "Staging validation passed"

# Confirmation prompt for production
echo ""
print_warning "Ready to deploy to production"
echo "This will:"
echo "  - Deploy the unified Worker to production"
echo "  - Update DNS routing to the new Worker"
echo "  - Make the application live for all users"
echo ""
read -p "Continue with production deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Production deployment cancelled"
    exit 0
fi

# Deploy to production
print_status "Deploying to production..."
wrangler deploy --env production
if [ $? -ne 0 ]; then
    print_error "Production deployment failed"
    exit 1
fi
print_success "Production deployment completed"

# Post-deployment validation
print_status "Running production validation..."
sleep 30 # Wait for deployment to propagate
./scripts/validate-production.sh
if [ $? -eq 0 ]; then
    print_success "🎉 Production deployment successful!"
    print_success "List Cutter is now live on the unified Worker architecture"
    
    echo ""
    echo "Deployment Summary:"
    echo "=================="
    echo "✅ TypeScript compilation: PASSED"
    echo "✅ Linting: PASSED"
    echo "✅ Tests: PASSED"
    echo "✅ Staging deployment: PASSED"
    echo "✅ Staging validation: PASSED"
    echo "✅ Production deployment: PASSED"
    echo "✅ Production validation: PASSED"
    echo ""
    echo "🌐 Application URL: https://list-cutter.com"
    echo "📊 Health Check: https://list-cutter.com/health"
    echo "📈 Metrics: https://list-cutter.com/metrics"
    echo ""
    
    # Send notification
    ./scripts/notify-deployment.sh success
else
    print_error "Production validation failed"
    print_warning "Consider rolling back the deployment"
    ./scripts/notify-deployment.sh failure
    exit 1
fi