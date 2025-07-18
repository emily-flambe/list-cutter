# Cutty (List Cutter)

A web application for processing and managing CSV files.

## Tech Stack

- **Frontend**: React + Vite + Material-UI
- **Backend**: Cloudflare Workers (Hono.js)
- **Database**: Cloudflare D1
- **Storage**: Cloudflare R2
- **Authentication**: JWT + Google OAuth

## Local Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup

1. **Install dependencies**
   ```bash
   # Frontend
   cd app/frontend
   npm install

   # Backend
   cd cloudflare/workers
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cd cloudflare/workers
   # Create .dev.vars file with:
   # JWT_SECRET=dev-secret-key-for-local-testing-only
   # API_KEY_SALT=dev-salt-for-api-keys-local-testing-only
   ```

3. **Start development servers**
   ```bash
   # Terminal 1: Backend (port 8788)
   cd cloudflare/workers
   npm run dev

   # Terminal 2: Frontend (port 5173)
   cd app/frontend
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8788

## Deployment

### Environments

- **Development**: `cutty-dev` worker → https://cutty-dev.emilycogsdill.com
- **Production**: `cutty` worker → https://cutty.emilycogsdill.com

### Deploy Commands

```bash
cd cloudflare/workers

# Deploy to development
npm run deploy:dev

# Deploy to production
npm run deploy:production
```

### Database Migrations

```bash
# Development
wrangler d1 execute cutty-dev --file=migrations/[migration-file].sql

# Production
wrangler d1 execute cutty-prod --file=migrations/[migration-file].sql
```

## Key Commands

```bash
# Run tests
cd cloudflare/workers && npm test

# Build frontend
cd app/frontend && npm run build

# Check deployment status
wrangler tail
```

## License

This project is available under the [LICENSE](LICENSE) terms.