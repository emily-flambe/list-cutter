# Claude Code Project Configuration

This file contains project-specific instructions for Claude Code usage.

## Project Identity

**Important**: While this GitHub repository is named "list-cutter", the **preferred identity** for all Cloudflare deployments, resources, and references is **"cutty"**.

### Naming Convention

- **GitHub Repository**: `list-cutter` (historical name)
- **Cloudflare Resources**: `cutty-*` (preferred naming)
- **Domains**: `cutty.com`, `api.cutty.com`, `staging.cutty.com`
- **Worker Names**: `cutty-api`, `cutty-workers`, `cutty-frontend`
- **Database Names**: `cutty-db`, `cutty-dev`, `cutty-staging`, `cutty-production`
- **R2 Buckets**: `cutty-files`, `cutty-files-dev`, `cutty-files-staging`, `cutty-files-production`

### Wrangler Commands

When working with Cloudflare Wrangler commands, always use the "cutty" naming convention:

```bash
# Database operations
wrangler d1 create cutty-db
wrangler d1 execute cutty-db --file=schema.sql

# R2 storage operations
wrangler r2 bucket create cutty-files
wrangler r2 bucket cors put cutty-files --file cors.json

# Pages deployment
wrangler pages deploy dist --project-name cutty-frontend
```

## Project Structure

This is a Django + React application being migrated to Cloudflare Workers with D1 database and R2 storage. The project includes comprehensive file migration tools for transitioning from traditional filesystem storage to Cloudflare R2.

## Development Notes

- Main application: Django backend with React frontend
- Target deployment: Cloudflare Workers with D1 + R2
- Migration tools: Comprehensive Python scripts for file migration
- Identity: Use "cutty" for all new Cloudflare resources