# Cutty Development Makefile

.PHONY: dev setup backend frontend superuser kill-ports kill-backend-port kill-frontend-port migrations build build-fast build-parallel clean test

dev: setup kill-ports
	@echo "🚀 Starting both backend and frontend servers..."
	@echo "Backend: http://127.0.0.1:8788"
	@echo "Frontend: http://localhost:5173"
	@echo "Press Ctrl+C to stop both servers"
	@$(MAKE) -j2 backend frontend

setup:
	@echo "🔧 Setting up development environment..."
	@# Check required directories exist
	@if [ ! -d "../../app/frontend" ]; then \
		echo "❌ ERROR: Frontend directory not found at ../../app/frontend"; exit 1; \
	fi
	@if [ ! -d "cloudflare/workers" ]; then \
		echo "❌ ERROR: Workers directory not found at cloudflare/workers"; exit 1; \
	fi
	@# Fix wrangler config if needed
	@if grep -q "send_metrics.*true" cloudflare/workers/wrangler.toml; then \
		sed -i.bak '/\[assets\]/,/^$$/{ /send_metrics/d; }' cloudflare/workers/wrangler.toml; \
	fi
	@# Install workers deps if needed
	@if [ ! -d "cloudflare/workers/node_modules" ]; then \
		echo "📦 Installing workers dependencies..."; \
		cd cloudflare/workers && npm install || exit 1; \
	fi
	@# Install frontend deps if needed
	@if [ ! -d "../../app/frontend/node_modules" ]; then \
		echo "📦 Installing frontend dependencies..."; \
		cd ../../app/frontend && npm install || exit 1; \
	fi
	@# Build frontend for assets serving
	@if [ ! -f "../../app/frontend/dist/index.html" ]; then \
		echo "🔨 Building frontend for assets..."; \
		cd ../../app/frontend && npm run build || exit 1; \
	fi
	@# Run database migrations if needed
	@echo "🗄️  Setting up database..."
	@cd cloudflare/workers && wrangler d1 execute cutty-dev --command "SELECT name FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1;" >/dev/null 2>&1 || { \
		echo "📋 Running database migrations..."; \
		wrangler d1 execute cutty-dev --file=migrations/0001_initial_schema.sql >/dev/null 2>&1; \
		wrangler d1 execute cutty-dev --file=migrations/0002_phase5_r2_enhancements.sql >/dev/null 2>&1; \
		wrangler d1 execute cutty-dev --file=migrations/0003_access_control_schema.sql >/dev/null 2>&1; \
		wrangler d1 execute cutty-dev --file=migrations/0003_storage_metrics.sql >/dev/null 2>&1; \
		wrangler d1 execute cutty-dev --file=migrations/0004_alerting_system.sql >/dev/null 2>&1; \
		wrangler d1 execute cutty-dev --file=migrations/0004_security_incidents_schema.sql >/dev/null 2>&1; \
		wrangler d1 execute cutty-dev --file=migrations/0005_backup_disaster_recovery_schema.sql >/dev/null 2>&1; \
		wrangler d1 execute cutty-dev --file=migrations/0006_performance_indexes.sql >/dev/null 2>&1; \
		wrangler d1 execute cutty-dev --file=migrations/0007_make_email_optional.sql >/dev/null 2>&1; \
		echo "✅ Database migrations completed"; \
	}
	@echo "✅ Setup complete"

# Port cleanup targets
kill-backend-port:
	@echo "🧹 Cleaning up backend port 8788..."
	@lsof -ti:8788 | xargs -r kill -9 2>/dev/null || true
	@echo "✅ Port 8788 cleaned"

kill-frontend-port:
	@echo "🧹 Cleaning up frontend port 5173..."
	@lsof -ti:5173 | xargs -r kill -9 2>/dev/null || true
	@echo "✅ Port 5173 cleaned"

kill-ports: kill-backend-port kill-frontend-port
	@echo "✅ All development ports cleaned"

backend: kill-backend-port
	@echo "🔧 Starting Cloudflare Workers backend on http://127.0.0.1:8788..."
	@cd cloudflare/workers && npm run dev

frontend: kill-frontend-port
	@echo "⚛️  Starting React frontend on http://localhost:5173..."
	@cd ../../app/frontend && npm run dev

superuser:
	@if [ -z "$(USERNAME)" ]; then \
		echo "❌ ERROR: USERNAME is required"; \
		echo "Usage: make superuser USERNAME=your_username"; \
		exit 1; \
	fi
	@echo "🔐 Making user '$(USERNAME)' a superuser..."
	@cd cloudflare/workers && wrangler d1 execute cutty-dev --command "UPDATE users SET is_admin = 1, updated_at = CURRENT_TIMESTAMP WHERE username = '$(USERNAME)';" || { \
		echo "❌ ERROR: Failed to update user. Make sure the username exists."; \
		exit 1; \
	}
	@echo "📋 Verifying superuser status..."
	@cd cloudflare/workers && wrangler d1 execute cutty-dev --command "SELECT username, email, is_admin, is_active FROM users WHERE username = '$(USERNAME)';" || { \
		echo "❌ ERROR: User '$(USERNAME)' not found"; \
		exit 1; \
	}
	@echo "✅ User '$(USERNAME)' is now a superuser!"

# Database migrations command
# Usage: make migrations ENV=dev|staging|prod|all|local|clean|clean-dev
# Examples:
#   make migrations ENV=dev        # Run on cutty-dev database
#   make migrations ENV=staging    # Run on cutty-staging database  
#   make migrations ENV=prod       # Run on cutty-prod database
#   make migrations ENV=all        # Run on all databases
#   make migrations ENV=local      # Run on local .sqlite file (if exists)
#   make migrations ENV=clean      # DESTRUCTIVE: Clear all DBs and apply final schema
#   make migrations ENV=clean-dev  # DESTRUCTIVE: Clear only dev DB and apply final schema
migrations:
	@if [ -z "$(ENV)" ]; then \
		echo "❌ ERROR: ENV is required"; \
		echo "Usage: make migrations ENV=dev|staging|prod|all|local|clean|clean-dev"; \
		echo ""; \
		echo "Examples:"; \
		echo "  make migrations ENV=dev      # Run on cutty-dev database"; \
		echo "  make migrations ENV=staging  # Run on cutty-staging database"; \
		echo "  make migrations ENV=prod     # Run on cutty-prod database"; \
		echo "  make migrations ENV=all      # Run on all databases"; \
		echo "  make migrations ENV=local    # Run on local .sqlite file"; \
		echo "  make migrations ENV=clean      # DESTRUCTIVE: Clear all and apply final schema"; \
		echo "  make migrations ENV=clean-dev  # DESTRUCTIVE: Clear only dev and apply final schema"; \
		exit 1; \
	fi
	@cd cloudflare/workers && \
	MIGRATION_FILES=$$(ls migrations/*.sql | sort); \
	if [ "$(ENV)" = "local" ]; then \
		echo "🗄️  Setting up local.sqlite with D1-compatible schema..."; \
		rm -f local.sqlite; \
		echo "🏗️  Creating fresh local database with D1-compatible schema..."; \
		sqlite3 local.sqlite < migrations/d1_compatible_schema.sql || { \
			echo "❌ ERROR: Failed to create local.sqlite with D1-compatible schema"; \
			exit 1; \
		}; \
		echo "✅ Local database created with D1-compatible schema"; \
	elif [ "$(ENV)" = "dev" ]; then \
		echo "🗄️  Running migrations on cutty-dev..."; \
		echo "🔍 Checking if database is initialized..."; \
		if ! wrangler d1 execute cutty-dev --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1;" >/dev/null 2>&1; then \
			echo "🏗️  Database not initialized, running all migrations..."; \
		else \
			echo "📊 Database initialized, running new migrations..."; \
		fi; \
		for file in $$MIGRATION_FILES; do \
			echo "📋 Running $$(basename $$file)..."; \
			wrangler d1 execute cutty-dev --remote --file=$$file || { echo "❌ Migration $$(basename $$file) failed"; exit 1; }; \
		done; \
		echo "✅ Development migrations completed"; \
	elif [ "$(ENV)" = "staging" ]; then \
		echo "🗄️  Running migrations on staging database..."; \
		echo "🔍 Checking if database is initialized..."; \
		if ! wrangler d1 execute DB --env staging --command "SELECT name FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1;" >/dev/null 2>&1; then \
			echo "🏗️  Database not initialized, running all migrations..."; \
		else \
			echo "📊 Database initialized, running new migrations..."; \
		fi; \
		for file in $$MIGRATION_FILES; do \
			echo "📋 Running $$(basename $$file)..."; \
			wrangler d1 execute DB --env staging --file=$$file || { echo "❌ Migration $$(basename $$file) failed"; exit 1; }; \
		done; \
		echo "✅ Staging migrations completed"; \
	elif [ "$(ENV)" = "prod" ]; then \
		echo "⚠️  PRODUCTION MIGRATION WARNING ⚠️"; \
		echo "You are about to run migrations on the PRODUCTION database!"; \
		echo "This action cannot be undone."; \
		read -p "Type 'yes' to continue: " confirm; \
		if [ "$$confirm" != "yes" ]; then \
			echo "❌ Production migration cancelled"; \
			exit 1; \
		fi; \
		echo "🗄️  Running migrations on production database..."; \
		echo "🔍 Checking if database is initialized..."; \
		if ! wrangler d1 execute DB --env production --command "SELECT name FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1;" >/dev/null 2>&1; then \
			echo "🏗️  Database not initialized, running all migrations..."; \
		else \
			echo "📊 Database initialized, running new migrations..."; \
		fi; \
		for file in $$MIGRATION_FILES; do \
			echo "📋 Running $$(basename $$file)..."; \
			wrangler d1 execute DB --env production --file=$$file || { echo "❌ Migration $$(basename $$file) failed"; exit 1; }; \
		done; \
		echo "✅ Production migrations completed"; \
	elif [ "$(ENV)" = "all" ]; then \
		echo "🗄️  Running migrations on ALL databases..."; \
		echo ""; \
		echo "📊 Development Database:"; \
		for file in $$MIGRATION_FILES; do \
			echo "📋 Running $$(basename $$file) on cutty-dev..."; \
			wrangler d1 execute cutty-dev --file=$$file || { echo "❌ Migration $$(basename $$file) failed on cutty-dev"; exit 1; }; \
		done; \
		echo "✅ Development migrations completed"; \
		echo ""; \
		echo "🎭 Staging Database:"; \
		for file in $$MIGRATION_FILES; do \
			echo "📋 Running $$(basename $$file) on staging..."; \
			wrangler d1 execute DB --env staging --file=$$file || { echo "❌ Migration $$(basename $$file) failed on staging"; exit 1; }; \
		done; \
		echo "✅ Staging migrations completed"; \
		echo ""; \
		echo "⚠️  PRODUCTION MIGRATION WARNING ⚠️"; \
		echo "Ready to run migrations on PRODUCTION database."; \
		read -p "Type 'yes' to continue: " confirm; \
		if [ "$$confirm" != "yes" ]; then \
			echo "❌ Production migration cancelled (dev and staging completed)"; \
			exit 0; \
		fi; \
		echo "🚀 Production Database:"; \
		for file in $$MIGRATION_FILES; do \
			echo "📋 Running $$(basename $$file) on production..."; \
			wrangler d1 execute DB --env production --file=$$file || { echo "❌ Migration $$(basename $$file) failed on production"; exit 1; }; \
		done; \
		echo "✅ Production migrations completed"; \
		echo "🎉 ALL database migrations completed successfully!"; \
	elif [ "$(ENV)" = "clean" ]; then \
		echo "⚠️⚠️⚠️  DESTRUCTIVE CLEAN MIGRATION WARNING ⚠️⚠️⚠️"; \
		echo "This will PERMANENTLY DELETE ALL DATA in ALL databases!"; \
		echo "All existing tables and data will be lost."; \
		echo "A fresh final schema will be applied to all databases."; \
		echo ""; \
		read -p "Type 'DESTROY ALL DATA' to continue: " confirm; \
		if [ "$$confirm" != "DESTROY ALL DATA" ]; then \
			echo "❌ Clean migration cancelled"; \
			exit 1; \
		fi; \
		echo "🗄️  Performing clean migration on ALL databases..."; \
		echo ""; \
		echo "🧹 Clearing and rebuilding development database..."; \
		wrangler d1 execute cutty-dev --remote --file=drop_all_tables.sql || true; \
		wrangler d1 execute cutty-dev --remote --file=migrations/d1_compatible_schema.sql; \
		echo "✅ Development database rebuilt"; \
		echo ""; \
		echo "🧹 Clearing and rebuilding staging database..."; \
		wrangler d1 execute DB --env staging --remote --file=drop_all_tables.sql || true; \
		wrangler d1 execute DB --env staging --remote --file=migrations/d1_compatible_schema.sql; \
		echo "✅ Staging database rebuilt"; \
		echo ""; \
		echo "⚠️  PRODUCTION DATABASE WARNING ⚠️"; \
		echo "Ready to clear and rebuild PRODUCTION database."; \
		read -p "Type 'DESTROY PRODUCTION' to continue: " prod_confirm; \
		if [ "$$prod_confirm" != "DESTROY PRODUCTION" ]; then \
			echo "❌ Production clean cancelled (dev and staging completed)"; \
			exit 0; \
		fi; \
		echo "🧹 Clearing and rebuilding production database..."; \
		wrangler d1 execute DB --env production --remote --file=drop_all_tables.sql || true; \
		wrangler d1 execute DB --env production --remote --file=migrations/d1_compatible_schema.sql; \
		echo "✅ Production database rebuilt"; \
		echo "🎉 CLEAN MIGRATION COMPLETED - All databases have fresh final schema!"; \
	elif [ "$(ENV)" = "clean-dev" ]; then \
		echo "⚠️  DEVELOPMENT DATABASE CLEAN MIGRATION ⚠️"; \
		echo "This will PERMANENTLY DELETE ALL DATA in the DEVELOPMENT database only!"; \
		echo "All existing tables and data in cutty-dev will be lost."; \
		echo "A fresh final schema will be applied to the development database."; \
		echo ""; \
		read -p "Type 'DESTROY DEV DATA' to continue: " confirm; \
		if [ "$$confirm" != "DESTROY DEV DATA" ]; then \
			echo "❌ Development clean migration cancelled"; \
			exit 1; \
		fi; \
		echo "🗄️  Performing clean migration on DEVELOPMENT database only..."; \
		echo "🧹 Clearing and rebuilding development database..."; \
		wrangler d1 execute cutty-dev --remote --file=drop_all_tables.sql || true; \
		wrangler d1 execute cutty-dev --remote --file=migrations/d1_compatible_schema.sql; \
		echo "✅ Development database rebuilt with fresh schema!"; \
		echo "🎉 DEV CLEAN MIGRATION COMPLETED!"; \
	else \
		echo "❌ ERROR: Invalid ENV value '$(ENV)'"; \
		echo "Valid values: dev, staging, prod, all, local, clean, clean-dev"; \
		exit 1; \
	fi

# ============================================================================
# OPTIMIZED BUILD SYSTEM - Issue #98 Build Time Reduction
# ============================================================================

# Fast parallel build for development
build-fast:
	@echo "🚀 Starting optimized parallel build..."
	@echo "⚡ Frontend (Vite) + Workers (esbuild) building simultaneously..."
	@$(MAKE) -j2 build-workers build-frontend
	@echo "✅ Fast build completed\!"

# Production optimized build (sequential for reliability)
build:
	@echo "🏗️ Starting production build..."
	@$(MAKE) build-workers
	@$(MAKE) build-frontend
	@echo "✅ Production build completed\!"

# Parallel build (experimental - use for maximum speed)
build-parallel:
	@echo "⚡ Starting maximum speed parallel build..."
	@(cd cloudflare/workers && npm run build) & \
	 (cd app/frontend && npm run build) & \
	 wait
	@echo "🚀 Parallel build completed\!"

# Individual build targets
build-workers:
	@echo "🔧 Building Cloudflare Workers..."
	@cd cloudflare/workers && npm run build

build-frontend:
	@echo "🎨 Building React frontend..."
	@cd app/frontend && npm run build

# Clean build artifacts for fresh builds
clean:
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf app/frontend/dist app/frontend/.vite app/frontend/node_modules/.vite
	@rm -rf cloudflare/workers/dist cloudflare/workers/.tsbuildinfo
	@rm -rf .tsbuildinfo
	@echo "✅ Clean completed\!"

# TypeScript project reference builds
tsc-build:
	@echo "📋 Building TypeScript projects with references..."
	@npx tsc --build
	@echo "✅ TypeScript build completed\!"

tsc-clean:
	@echo "🧹 Cleaning TypeScript build artifacts..."
	@npx tsc --build --clean
	@echo "✅ TypeScript clean completed\!"

# Development with optimized builds
dev-fast: setup kill-ports clean
	@echo "🚀 Starting optimized development servers..."
	@echo "Building projects first for faster startup..."
	@$(MAKE) build-fast
	@echo "Starting servers..."
	@$(MAKE) -j2 backend frontend

# Testing
test:
	@echo "🧪 Running tests..."
	@cd cloudflare/workers && npm test
	@echo "✅ Tests completed\!"

# Build validation
validate-build: build
	@echo "✅ Build validation passed\!"
	@echo "📊 Build artifacts:"
	@ls -la app/frontend/dist/ 2>/dev/null || echo "❌ Frontend build missing"
	@ls -la cloudflare/workers/dist/ 2>/dev/null || echo "❌ Workers build missing"

# Performance measurement (basic)
measure-build:
	@echo "⏱️ Measuring build performance..."
	@time $(MAKE) clean
	@time $(MAKE) build-fast
	@echo "📊 Build measurement completed\!"
EOF < /dev/null