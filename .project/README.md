# Cutty (List Cutter) - Project Documentation

## For AI Assistants
**MANDATORY**: Read ALL files in `.project/` before starting work, especially:
1. `guidelines/ai-behavior.md` - Critical behavioral rules
2. `requirements/overview.md` - What we're building
3. `requirements/technical.md` - How we're building it
4. `guidelines/tdd-approach.md` - Testing philosophy
5. `guidelines/troubleshooting.md` - Common issues

## For Humans
- Requirements: See `requirements/overview.md`  
- Tech Stack: See `requirements/technical.md`
- Common Issues: See `guidelines/troubleshooting.md`

## Project Overview
Cutty is a modern web application for list management and CSV processing built on Cloudflare's edge computing platform. It features a React frontend, Cloudflare Workers backend, D1 database, R2 storage, and an AI-powered assistant (Cutty the Cuttlefish) for intelligent help and automation.

## Key Commands
```bash
# Development (requires 2 terminals)
cd cloudflare/workers && npm run dev  # Backend
cd app/frontend && npm run dev        # Frontend

# Testing
cd cloudflare/workers && npm test

# Build/Deploy
make build-frontend  # Build React app first
make deploy-dev      # Deploy to development
make deploy-prod     # Deploy to production
```

## Architecture
```
Frontend (React) → API (Workers) → Database (D1)
                                 → Storage (R2)
                                 → Cache (KV)
```

- **Edge-First**: Global sub-50ms response times via Cloudflare
- **Serverless**: Auto-scaling Cloudflare Workers
- **AI-Powered**: Integrated chatbot with WebSocket real-time actions
- **JWT Auth**: With Google OAuth integration

## Performance Targets
- API Response: <200ms p95
- Frontend Load: <3s on 3G
- Database Queries: <50ms
- File Upload: 10MB max per file

## Security Considerations
- JWT-based authentication (24h expiry)
- Google OAuth integration
- API key support for programmatic access
- Multi-layered rate limiting
- Input validation with Zod
- Secure file storage in R2