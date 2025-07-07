# Phase 2: Frontend Migration to Cloudflare Pages - Technical Implementation Plan

## Overview

This document provides step-by-step instructions for migrating the List Cutter frontend from a locally-served Vite application to Cloudflare Pages. This plan is designed to be executed by a Claude agent with detailed commands and validation steps.

### Architecture Decision: Pages + Workers

**Why Cloudflare Pages (not Workers Sites):**
- Uses the modern **Cloudflare Pages + Workers** architecture pattern (2024+ recommended approach)
- **NOT** using the deprecated "Workers Sites" pattern
- Frontend: Static React SPA served via Cloudflare Pages
- Backend: API endpoints served via Cloudflare Workers  
- This provides the best separation of concerns, performance, and maintainability
- Future migration path available to "Workers with Static Assets" when it graduates from beta

## Prerequisites

Before starting the migration:
1. Ensure Phase 1 (Django to Workers migration) is complete
2. Have access to Cloudflare dashboard with Pages enabled
3. Install Wrangler CLI: `npm install -g wrangler@latest`
4. Authenticate with Cloudflare: `wrangler login`

## Migration Steps

### Step 1: Install Cloudflare Vite Plugin

Navigate to the frontend directory and install the Cloudflare Vite plugin:

```bash
cd /Users/emilycogsdill/Documents/GitHub/list-cutter/app/frontend
npm install --save-dev @cloudflare/vite-plugin
```

### Step 2: Update Vite Configuration

Replace the current `vite.config.js` with Cloudflare-optimized configuration:

```javascript
// app/frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  build: {
    manifest: true,
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'mui-vendor': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
        }
      }
    }
  },
  publicDir: "public",
  plugins: [
    react(),
    cloudflare({
      // Cloudflare-specific configuration
      persistState: false,
    })
  ],
  define: {
    // Map environment variables for production
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || ''),
    'import.meta.env.VITE_MAX_FILE_SIZE': JSON.stringify(process.env.VITE_MAX_FILE_SIZE || '10485760'),
  },
  // Remove dev server proxy since API will be on Workers
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: {
      host: 'localhost'
    },
    watch: {
      usePolling: true,
    }
  }
})
```

### Step 3: Create Wrangler Configuration

Create a new file `app/frontend/wrangler.json`:

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "cutty-frontend",
  "compatibility_date": "2025-01-05",
  "pages_build_output_dir": "dist",
  "assets": {
    "not_found_handling": "single-page-application"
  }
}
```

### Step 4: Environment Variable Migration

Create environment configuration files for different stages:

#### 4.1 Create `.env.production` for build-time variables:

```bash
# app/frontend/.env.production
VITE_API_URL=https://api.cutty.workers.dev
VITE_MAX_FILE_SIZE=10485760
VITE_APP_VERSION=1.0.0
```

#### 4.2 Create `.env.development.local` for local development:

```bash
# app/frontend/.env.development.local
VITE_API_URL=http://localhost:8787
VITE_MAX_FILE_SIZE=10485760
VITE_APP_VERSION=dev
```

#### 4.3 Update `.gitignore` to exclude local env files:

```bash
echo ".env.development.local" >> /Users/emilycogsdill/Documents/GitHub/list-cutter/app/frontend/.gitignore
echo ".env.production.local" >> /Users/emilycogsdill/Documents/GitHub/list-cutter/app/frontend/.gitignore
```

### Step 5: Update API Endpoints

#### 5.1 Create a centralized API configuration:

```javascript
// app/frontend/src/config/api.config.js
const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_URL || 'https://api.cutty.workers.dev',
  endpoints: {
    // Auth endpoints
    login: '/api/auth/login/',
    logout: '/api/auth/logout/',
    register: '/api/auth/register/',
    refresh: '/api/auth/refresh/',
    
    // File operations
    upload: '/api/upload/',
    process: '/api/process/',
    download: '/api/download/',
    listFiles: '/api/files/',
    deleteFile: '/api/files/delete/',
    
    // User operations
    profile: '/api/user/profile/',
    settings: '/api/user/settings/',
  }
};

export default API_CONFIG;
```

#### 5.2 Update the API client to use the new configuration:

```javascript
// app/frontend/src/api.js
import axios from 'axios';
import { getNewToken } from './auth';
import API_CONFIG from './config/api.config';

const api = axios.create({
  baseURL: API_CONFIG.baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Add timeout for Workers
  timeout: 30000, // 30 seconds
});

// Update interceptor to handle Workers-specific errors
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    // Handle timeout errors
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout - Workers may be cold starting');
      // Retry once for timeout errors
      if (!originalRequest._retryTimeout) {
        originalRequest._retryTimeout = true;
        return api(originalRequest);
      }
    }
    
    // Handle auth errors
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      console.log('Interceptor triggered for 401 error');
      originalRequest._retry = true;
      const newToken = await getNewToken();
      if (newToken) {
        console.log('Token refresh successful, retrying request');
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return api(originalRequest);
      } else {
        console.log('Token refresh failed');
        // Redirect to login
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// Export configured endpoints
export { API_CONFIG };
export default api;
```

### Step 6: Update Build Scripts

Update `package.json` to include Cloudflare-specific scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:cf": "vite build --mode production",
    "preview": "vite preview",
    "preview:cf": "wrangler pages dev dist",
    "deploy": "npm run build:cf && wrangler pages deploy dist",
    "deploy:preview": "npm run build:cf && wrangler pages deploy dist --branch preview",
    "lint": "eslint .",
    "test": "vitest"
  }
}
```

### Step 7: Handle Static Assets

#### 7.1 Update public assets path in components:

```javascript
// Example update for image imports
// Before:
import logo from './assets/cutty_logo.png';

// After:
const logo = new URL('./assets/cutty_logo.png', import.meta.url).href;
```

#### 7.2 Create a `_headers` file for optimal caching:

```
# app/frontend/public/_headers
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.js
  Cache-Control: public, max-age=31536000, immutable

/*.css
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: no-cache
```

### Step 8: Configure Cloudflare Pages

#### 8.1 Via Wrangler CLI (Recommended):

```bash
# Initial deployment
cd /Users/emilycogsdill/Documents/GitHub/list-cutter/app/frontend
npm run build:cf
wrangler pages deploy dist --project-name cutty-frontend

# Set environment variables
wrangler pages secret put VITE_API_URL --project-name cutty-frontend
# Enter value when prompted: https://api.cutty.workers.dev
```

#### 8.2 Via Dashboard (Alternative):

1. Navigate to Cloudflare Dashboard > Pages
2. Create new project > Connect to Git
3. Select repository: `emily-flambe/list-cutter`
4. Configure build settings:
   ```
   Framework preset: None
   Build command: cd app/frontend && npm install && npm run build
   Build output directory: app/frontend/dist
   Root directory: /
   ```
5. Add environment variables:
   - `VITE_API_URL`: `https://api.cutty.workers.dev`
   - `VITE_MAX_FILE_SIZE`: `10485760`

### Step 9: Update CORS Configuration

Ensure the Workers API allows requests from the Pages domain:

```javascript
// In your Workers API code, update CORS headers
const ALLOWED_ORIGINS = [
  'https://cutty.pages.dev',
  'https://custom-domain.com', // If using custom domain
  'http://localhost:5173', // For local development
];

function getCORSHeaders(origin) {
  if (ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    };
  }
  return {};
}
```

## Testing Procedures

### Local Testing

```bash
# Test build process
cd /Users/emilycogsdill/Documents/GitHub/list-cutter/app/frontend
npm run build:cf

# Test with Wrangler
npm run preview:cf

# Verify at http://localhost:8788
```

### Validation Checklist

1. **Build Validation**
   ```bash
   # Check build output
   ls -la dist/
   # Should see index.html, assets/, and other built files
   
   # Check bundle sizes
   du -sh dist/assets/*.js
   ```

2. **Environment Variables**
   ```javascript
   // Add temporary debug in App.jsx
   console.log('API URL:', import.meta.env.VITE_API_URL);
   console.log('Max File Size:', import.meta.env.VITE_MAX_FILE_SIZE);
   ```

3. **API Connectivity**
   - Test login functionality
   - Test file upload
   - Test data fetching

4. **Asset Loading**
   - Verify all images load correctly
   - Check CSS styling is applied
   - Confirm JavaScript functionality

### Production Testing

After deployment:

```bash
# Get deployment URL
wrangler pages deployment list --project-name cutty-frontend

# Test production endpoints
curl https://cutty.pages.dev
curl https://cutty.pages.dev/api/health # Should redirect to Workers
```

## Rollback Procedures

### Immediate Rollback

```bash
# List deployments
wrangler pages deployment list --project-name cutty-frontend

# Rollback to previous deployment
wrangler pages deployment rollback <deployment-id> --project-name cutty-frontend
```

### Complete Rollback

1. **Revert Git Changes**
   ```bash
   git revert HEAD~1  # Or specific commit
   git push origin main
   ```

2. **Restore Local Development**
   ```bash
   # Restore original vite.config.js
   git checkout HEAD~1 -- app/frontend/vite.config.js
   
   # Remove Cloudflare dependencies
   npm uninstall @cloudflare/vite-plugin
   
   # Restart local dev server
   npm run dev
   ```

3. **Update DNS** (if custom domain was configured)
   - Remove CNAME record pointing to Pages
   - Restore original hosting configuration

## Monitoring and Troubleshooting

### Common Issues and Solutions

1. **Build Failures**
   ```bash
   # Check Node version
   node --version  # Should be 18.x or higher
   
   # Clear cache and rebuild
   rm -rf node_modules dist
   npm install
   npm run build:cf
   ```

2. **Environment Variable Issues**
   - Verify variables in Pages dashboard
   - Check for typos in variable names
   - Ensure no trailing spaces in values

3. **CORS Errors**
   - Verify Workers API CORS configuration
   - Check allowed origins include Pages URL
   - Test with `curl` to isolate frontend issues

4. **Asset 404 Errors**
   - Check `base` path in vite.config.js
   - Verify public directory structure
   - Ensure _headers file is in public directory

### Performance Monitoring

```javascript
// Add to App.jsx for monitoring
useEffect(() => {
  // Log Core Web Vitals
  if ('web-vital' in window) {
    window.webVitals.getCLS(console.log);
    window.webVitals.getFID(console.log);
    window.webVitals.getLCP(console.log);
  }
}, []);
```

## Success Criteria

The migration is considered successful when:

1. ✅ Frontend builds and deploys without errors
2. ✅ All environment variables are properly configured
3. ✅ API calls to Workers backend succeed
4. ✅ File upload/download functionality works
5. ✅ Authentication flow functions correctly
6. ✅ All assets load properly
7. ✅ Performance metrics meet targets:
   - First Contentful Paint < 1.5s
   - Time to Interactive < 3s
   - Lighthouse score > 90

## Next Steps

After successful migration:

1. Set up custom domain (optional)
2. Configure analytics and monitoring
3. Implement CI/CD pipeline
4. Document deployment process for team

## Appendix: Quick Reference

### Essential Commands

```bash
# Build and deploy
npm run deploy

# Deploy to preview branch
npm run deploy:preview

# Check deployment status
wrangler pages deployment list --project-name cutty-frontend

# View logs
wrangler pages deployment tail --project-name cutty-frontend
```

### Environment Variables Reference

| Variable | Development | Production | Description |
|----------|------------|------------|-------------|
| VITE_API_URL | http://localhost:8787 | https://api.cutty.workers.dev | API endpoint |
| VITE_MAX_FILE_SIZE | 10485760 | 10485760 | Max upload size in bytes |
| VITE_APP_VERSION | dev | 1.0.0 | Application version |

### File Structure After Migration

```
app/frontend/
├── .env.production
├── .env.development.local
├── wrangler.json
├── vite.config.js (updated)
├── package.json (updated)
├── public/
│   ├── _headers (new)
│   └── index.html
└── src/
    ├── api.js (updated)
    ├── config/
    │   └── api.config.js (new)
    └── [other source files]
```