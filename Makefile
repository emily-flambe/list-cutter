# Cutty Development Makefile

.PHONY: dev setup backend frontend superuser

dev: setup
	@echo "🚀 Starting both backend and frontend servers..."
	@echo "Backend: http://127.0.0.1:8788"
	@echo "Frontend: http://localhost:3000"
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
		echo "✅ Database migrations completed"; \
	}
	@echo "✅ Setup complete"

backend:
	@echo "🔧 Starting Cloudflare Workers backend on http://127.0.0.1:8788..."
	@cd cloudflare/workers && npm run dev

frontend:
	@echo "⚛️  Starting React frontend on http://localhost:3000..."
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