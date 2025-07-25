# Cutty Development Makefile

.PHONY: help backend frontend deploy-dev build-deploy-dev build-deploy-prod

# Default target - show help
.DEFAULT_GOAL := help

# Help command
help:
	@echo "🔧 Cutty Development Commands"
	@echo ""
	@echo "📚 Local Development:"
	@echo "  make backend          - Start Cloudflare Workers backend (port 8788)"
	@echo "  make frontend         - Start React frontend (port 5173)"
	@echo ""
	@echo "🚀 Deployment:"
	@echo "  make deploy-dev       - Deploy to cutty-dev environment"
	@echo "  make build-deploy-dev - Build frontend and deploy to dev"
	@echo "  make build-deploy-prod - Build frontend and deploy to production"

# Start backend development server
backend:
	@echo "🔧 Starting Cloudflare Workers backend on http://127.0.0.1:8788..."
	@cd cloudflare/workers && npm run dev

# Start frontend development server
frontend:
	@echo "⚛️  Starting React frontend on http://localhost:5173..."
	@cd app/frontend && npm run dev

# Deploy to development environment
deploy-dev:
	@echo "🚀 Deploying to cutty-dev worker..."
	@cd cloudflare/workers && npm run deploy
	@echo "✅ Deployment completed!"
	@echo "🌐 Access at: https://cutty-dev.emilycogsdill.com"

# Build frontend and deploy to development
build-deploy-dev:
	@echo "🎨 Building React frontend..."
	@cd app/frontend && npm run build
	@echo "🚀 Deploying to cutty-dev worker..."
	@cd cloudflare/workers && npm run deploy
	@echo "✅ Build and deployment completed!"
	@echo "🌐 Access at: https://cutty-dev.emilycogsdill.com"

# Build frontend and deploy to production
build-deploy-prod:
	@echo "🎨 Building React frontend for production..."
	@cd app/frontend && npm run build
	@echo "🚀 Deploying to production worker..."
	@cd cloudflare/workers && npm run deploy-prod
	@echo "✅ Production deployment completed!"
	@echo "🌐 Access at: https://cutty.app"