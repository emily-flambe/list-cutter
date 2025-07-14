# Cutty Development Makefile

.PHONY: dev setup backend frontend superuser kill-ports kill-backend-port kill-frontend-port migrations build clean test install-deps branch-cleanup

dev: setup kill-ports
	@echo "🚀 Starting both backend and frontend servers..."
	@echo "Backend: http://127.0.0.1:8788"
	@echo "Frontend: http://localhost:5173"
	@echo "Press Ctrl+C to stop both servers"
	@$(MAKE) -j2 backend frontend

setup:
	@echo "🔧 Setting up development environment..."
	@# Check required directories exist
	@if [ ! -d "app/frontend" ]; then \
		echo "❌ ERROR: Frontend directory not found at app/frontend"; exit 1; \
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
	@if [ ! -d "app/frontend/node_modules" ]; then \
		echo "📦 Installing frontend dependencies..."; \
		cd app/frontend && npm install || exit 1; \
	fi
	@# Build frontend for assets serving
	@if [ ! -f "app/frontend/dist/index.html" ]; then \
		echo "🔨 Building frontend for assets..."; \
		cd app/frontend && npm run build || exit 1; \
	fi
	@# Run database migrations if needed
	@echo "🗄️  Setting up database..."
	@cd cloudflare/workers && wrangler d1 execute cutty-dev --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1;" >/dev/null 2>&1 || { \
		echo "📋 Running database migrations..."; \
		wrangler d1 execute cutty-dev --remote --file=migrations/0000_initial_schema.sql >/dev/null 2>&1; \
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
	@cd app/frontend && npm run dev

superuser:
	@if [ -z "$(USERNAME)" ]; then \
		echo "❌ ERROR: USERNAME is required"; \
		echo "Usage: make superuser USERNAME=your_username"; \
		exit 1; \
	fi
	@echo "🔐 Making user '$(USERNAME)' a superuser..."
	@cd cloudflare/workers && wrangler d1 execute cutty-dev --remote --command "UPDATE users SET is_admin = 1, updated_at = CURRENT_TIMESTAMP WHERE username = '$(USERNAME)';" || { \
		echo "❌ ERROR: Failed to update user. Make sure the username exists."; \
		exit 1; \
	}
	@echo "📋 Verifying superuser status..."
	@cd cloudflare/workers && wrangler d1 execute cutty-dev --remote --command "SELECT username, email, is_admin, is_active FROM users WHERE username = '$(USERNAME)';" || { \
		echo "❌ ERROR: User '$(USERNAME)' not found"; \
		exit 1; \
	}
	@echo "✅ User '$(USERNAME)' is now a superuser!"

# Database migrations command
# Usage: make migrations ENV=dev|prod|all|local|clean|clean-dev
# Examples:
#   make migrations ENV=dev        # Run on cutty-dev database
#   make migrations ENV=prod       # Run on cutty-prod database
#   make migrations ENV=all        # Run on all databases
#   make migrations ENV=local      # Run on local .sqlite file (if exists)
#   make migrations ENV=clean      # DESTRUCTIVE: Clear all DBs and apply final schema
#   make migrations ENV=clean-dev  # DESTRUCTIVE: Clear only dev DB and apply final schema
migrations:
	@if [ -z "$(ENV)" ]; then \
		echo "❌ ERROR: ENV is required"; \
		echo "Usage: make migrations ENV=dev|prod|all|local|clean|clean-dev"; \
		echo ""; \
		echo "Examples:"; \
		echo "  make migrations ENV=dev      # Run on cutty-dev database"; \
		echo "  make migrations ENV=prod     # Run on cutty-prod database"; \
		echo "  make migrations ENV=all      # Run on all databases"; \
		echo "  make migrations ENV=local    # Run on local .sqlite file"; \
		echo "  make migrations ENV=clean      # DESTRUCTIVE: Clear all and apply final schema"; \
		echo "  make migrations ENV=clean-dev  # DESTRUCTIVE: Clear only dev and apply final schema"; \
		exit 1; \
	fi
	@cd cloudflare/workers && \
	if [ "$(ENV)" = "local" ]; then \
		echo "🗄️  Running migrations on local database..."; \
		echo "📋 Using D1's built-in migration tracking system..."; \
		wrangler d1 migrations apply cutty-dev --local || { \
			echo "❌ Migration failed"; \
			echo "💡 Tip: Check which migrations have been applied with:"; \
			echo "   wrangler d1 migrations list cutty-dev --local"; \
			exit 1; \
		}; \
		echo "✅ Local migrations completed"; \
	elif [ "$(ENV)" = "dev" ]; then \
		echo "🗄️  Running migrations on cutty-dev..."; \
		echo "📋 Using D1's built-in migration tracking system..."; \
		wrangler d1 migrations apply cutty-dev --remote || { \
			echo "❌ Migration failed"; \
			echo "💡 Tip: Check which migrations have been applied with:"; \
			echo "   wrangler d1 migrations list cutty-dev --remote"; \
			exit 1; \
		}; \
		echo "✅ Development migrations completed"; \
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
		echo "📋 Using D1's built-in migration tracking system..."; \
		wrangler d1 migrations apply DB --env production --remote || { \
			echo "❌ Migration failed"; \
			echo "💡 Tip: Check which migrations have been applied with:"; \
			echo "   wrangler d1 migrations list DB --env production --remote"; \
			exit 1; \
		}; \
		echo "✅ Production migrations completed"; \
	elif [ "$(ENV)" = "all" ]; then \
		echo "🗄️  Running migrations on ALL databases..."; \
		echo ""; \
		echo "📊 Development Database:"; \
		wrangler d1 migrations apply cutty-dev --remote || { \
			echo "❌ Development migration failed"; \
			exit 1; \
		}; \
		echo "✅ Development migrations completed"; \
		echo ""; \
		echo "⚠️  PRODUCTION MIGRATION WARNING ⚠️"; \
		echo "Ready to run migrations on PRODUCTION database."; \
		read -p "Type 'yes' to continue: " confirm; \
		if [ "$$confirm" != "yes" ]; then \
			echo "❌ Production migration cancelled (dev completed)"; \
			exit 0; \
		fi; \
		echo "🚀 Production Database:"; \
		wrangler d1 migrations apply DB --env production --remote || { \
			echo "❌ Production migration failed"; \
			exit 1; \
		}; \
		echo "✅ Production migrations completed"; \
		echo "🎉 ALL database migrations completed successfully!"; \
	elif [ "$(ENV)" = "clean" ]; then \
		echo "⚠️⚠️⚠️  DESTRUCTIVE CLEAN MIGRATION WARNING ⚠️⚠️⚠️"; \
		echo "This will PERMANENTLY DELETE ALL DATA in development and production databases!"; \
		echo "All existing tables and data will be lost."; \
		echo "A fresh final schema will be applied to both databases."; \
		echo ""; \
		read -p "Type 'DESTROY ALL DATA' to continue: " confirm; \
		if [ "$$confirm" != "DESTROY ALL DATA" ]; then \
			echo "❌ Clean migration cancelled"; \
			exit 1; \
		fi; \
		echo "🗄️  Performing clean migration on development and production databases..."; \
		echo ""; \
		echo "🧹 Clearing and rebuilding development database..."; \
		wrangler d1 execute cutty-dev --remote --file=drop_all_tables.sql || true; \
		wrangler d1 execute cutty-dev --remote --file=migrations/0000_initial_schema.sql; \
		echo "✅ Development database rebuilt"; \
		echo ""; \
		echo "⚠️  PRODUCTION DATABASE WARNING ⚠️"; \
		echo "Ready to clear and rebuild PRODUCTION database."; \
		read -p "Type 'DESTROY PRODUCTION' to continue: " prod_confirm; \
		if [ "$$prod_confirm" != "DESTROY PRODUCTION" ]; then \
			echo "❌ Production clean cancelled (dev completed)"; \
			exit 0; \
		fi; \
		echo "🧹 Clearing and rebuilding production database..."; \
		wrangler d1 execute DB --env production --remote --file=drop_all_tables.sql || true; \
		wrangler d1 execute DB --env production --remote --file=migrations/0000_initial_schema.sql; \
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
		wrangler d1 execute cutty-dev --remote --file=migrations/0000_initial_schema.sql; \
		echo "✅ Development database rebuilt with fresh schema!"; \
		echo "🎉 DEV CLEAN MIGRATION COMPLETED!"; \
	else \
		echo "❌ ERROR: Invalid ENV value '$(ENV)'"; \
		echo "Valid values: dev, prod, all, local, clean, clean-dev"; \
		exit 1; \
	fi

# ============================================================================
# OPTIMIZED BUILD SYSTEM - Issue #98 Build Time Reduction
# ============================================================================

# Optimized build with clean and dependency check
build: clean install-deps
	@echo "🏗️ Starting optimized build..."
	@$(MAKE) -j2 build-workers build-frontend
	@echo "✅ Build completed!"

# Ensure dependencies are installed
install-deps:
	@echo "📦 Checking dependencies..."
	@if [ ! -d "cloudflare/workers/node_modules" ]; then \
		echo "Installing workers dependencies..."; \
		cd cloudflare/workers && npm install; \
	fi
	@if [ ! -d "app/frontend/node_modules" ]; then \
		echo "Installing frontend dependencies..."; \
		cd app/frontend && npm install; \
	fi
	@echo "✅ Dependencies ready"

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
	@echo "✅ Clean completed!"

# Testing
test:
	@echo "🧪 Running tests..."
	@cd cloudflare/workers && npm test
	@echo "✅ Tests completed!"

# Branch and worktree cleanup
branch-cleanup:
	@echo "🌿 Cleaning up branches, worktrees, and remotes without open pull requests..."
	@echo "⚠️  This will delete local branches, remote branches, and worktrees that don't have open PRs!"
	@echo -n "Type 'CLEANUP' to confirm: " && read confirm && [ "$$confirm" = "CLEANUP" ] || (echo "❌ Cancelled" && exit 1)
	@echo "Fetching latest changes..."
	@git fetch --all --prune
	@echo "Getting list of branches with open PRs..."
	@BRANCHES_WITH_PRS=$$(gh pr list --state open --json headRefName --jq '.[].headRefName' 2>/dev/null | sort | uniq); \
	ALL_LOCAL_BRANCHES=$$(git for-each-ref --format='%(refname:short)' refs/heads/ | grep -v '^main$$' | grep -v '^master$$'); \
	ALL_REMOTE_BRANCHES=$$(git for-each-ref --format='%(refname:short)' refs/remotes/origin/ | sed 's|^origin/||' | grep -v '^main$$' | grep -v '^master$$' | grep -v '^HEAD$$'); \
	ALL_WORKTREES=$$(git worktree list --porcelain | grep '^worktree ' | sed 's/^worktree //' | grep 'worktrees/' | xargs -I {} basename {}); \
	echo "🔍 Checking worktrees..."; \
	for worktree in $$ALL_WORKTREES; do \
		if ! echo "$$BRANCHES_WITH_PRS" | grep -q "^$$worktree$$"; then \
			echo "  🗑️  Removing worktree: $$worktree"; \
			git worktree remove "worktrees/$$worktree" --force 2>/dev/null || true; \
		else \
			echo "  ✅ Keeping worktree: $$worktree (has open PR)"; \
		fi; \
	done; \
	echo "🔍 Checking local branches..."; \
	for branch in $$ALL_LOCAL_BRANCHES; do \
		if ! echo "$$BRANCHES_WITH_PRS" | grep -q "^$$branch$$"; then \
			echo "  🗑️  Deleting local branch: $$branch"; \
			git branch -D "$$branch" 2>/dev/null || true; \
		else \
			echo "  ✅ Keeping local branch: $$branch (has open PR)"; \
		fi; \
	done; \
	echo "🔍 Checking remote branches..."; \
	for branch in $$ALL_REMOTE_BRANCHES; do \
		if ! echo "$$BRANCHES_WITH_PRS" | grep -q "^$$branch$$"; then \
			echo "  🗑️  Deleting remote branch: $$branch"; \
			git push origin --delete "$$branch" 2>/dev/null || true; \
		else \
			echo "  ✅ Keeping remote branch: $$branch (has open PR)"; \
		fi; \
	done; \
	echo "✅ Branch and worktree cleanup completed!"
