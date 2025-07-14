# Development Environment Setup

## Required Environment Variables

For local development, create a `.dev.vars` file in the `cloudflare/workers/` directory with the following content:

```
JWT_SECRET=dev-secret-key-for-local-testing-only-never-use-in-production
API_KEY_SALT=dev-salt-for-api-keys-local-testing-only
```

## Important Notes

- The `.dev.vars` file is ignored by git for security reasons
- These environment variables are required for authentication endpoints to function
- In production, these secrets are managed via Cloudflare Workers secrets
- Never commit actual secrets to the repository

## Setup Steps

1. Copy the template above to `cloudflare/workers/.dev.vars`
2. Start the development server: `npm run dev`
3. Test authentication endpoints at `http://127.0.0.1:8788/api/v1/auth/*`

## Troubleshooting

If you see "JWT_SECRET environment variable is required" errors:
1. Verify `.dev.vars` file exists and contains the required variables
2. Restart the development server to load the new environment variables
3. Kill existing processes: `pkill -f "wrangler"` if needed