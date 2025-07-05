# Phase 2: Frontend Migration to Cloudflare Pages
**Duration**: 2-3 days  
**Status**: Ready for Implementation

## Overview
This phase migrates the existing React frontend from Docker deployment to Cloudflare Pages. The frontend is already well-structured with Vite and modern React practices, making it suitable for static hosting. The main focus is on updating API configurations and ensuring proper routing.

## Prerequisites
- Phase 1 completed (development environment setup)
- Existing React frontend analysis completed
- Cloudflare Pages project created

## Current Frontend Architecture Summary

### Tech Stack
- **Build Tool**: Vite 6.0.5
- **Framework**: React 18.3.1 with React DOM
- **UI Library**: Material-UI (MUI) v6.4.2
- **Routing**: React Router DOM v6.28.2
- **HTTP Client**: Axios v1.7.9
- **Authentication**: JWT tokens with automatic refresh

### Key Components
- Entry: `index.html` → `main.jsx` → `App.jsx`
- Authentication: `AuthContext` with token management
- Navigation: `Layout.jsx` with authentication-aware menu
- Core Features: CSV processing, file management, user management

## Tasks Breakdown

### 2.1 Frontend Code Preparation
**Duration**: 2 hours

#### 2.1.1 Move Frontend Code to New Structure
```bash
# Create new frontend directory structure
mkdir -p apps/frontend
cd apps/frontend

# Copy existing frontend code
cp -r ../../app/frontend/* .

# Verify structure
ls -la
```

#### 2.1.2 Update Package.json Scripts
**apps/frontend/package.json** (update scripts section):
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview",
    "build:staging": "vite build --mode staging",
    "build:production": "vite build --mode production"
  }
}
```

### 2.2 Environment Configuration
**Duration**: 1.5 hours

#### 2.2.1 Create Environment Files
**apps/frontend/.env.development**:
```
VITE_APP_NAME=List Cutter
VITE_API_BASE_URL=http://localhost:8787
VITE_ENVIRONMENT=development
```

**apps/frontend/.env.staging**:
```
VITE_APP_NAME=List Cutter (Staging)
VITE_API_BASE_URL=https://list-cutter-api-staging.your-subdomain.workers.dev
VITE_ENVIRONMENT=staging
```

**apps/frontend/.env.production**:
```
VITE_APP_NAME=List Cutter
VITE_API_BASE_URL=https://list-cutter-api-prod.your-subdomain.workers.dev
VITE_ENVIRONMENT=production
```

#### 2.2.2 Update Vite Configuration
**apps/frontend/vite.config.js**:
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: mode === 'development',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            mui: ['@mui/material', '@mui/icons-material'],
            utils: ['axios']
          }
        }
      }
    },
    optimizeDeps: {
      include: ['react-archer']
    },
    // Remove proxy configuration for production builds
    server: mode === 'development' ? {
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false
        }
      }
    } : undefined
  };
});
```

### 2.3 API Configuration Updates
**Duration**: 2 hours

#### 2.3.1 Update API Base Configuration
**apps/frontend/src/api.js**:
```javascript
import axios from 'axios';

// Get API base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }
        
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh: refreshToken
        });
        
        const { access } = response.data;
        localStorage.setItem('authToken', access);
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
```

#### 2.3.2 Update Authentication Service
**apps/frontend/src/auth.js**:
```javascript
import api from './api';

// Update API endpoints to match new Workers API structure
export const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', { email, password });
    const { access, refresh, user } = response.data;
    
    localStorage.setItem('authToken', access);
    localStorage.setItem('refreshToken', refresh);
    
    return { token: access, user };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const register = async (email, password, username) => {
  try {
    const response = await api.post('/auth/register', { 
      email, 
      password, 
      username 
    });
    return response.data;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

export const logout = async () => {
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      await api.post('/auth/logout', { refresh: refreshToken });
    }
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await api.get('/auth/user');
    return response.data;
  } catch (error) {
    console.error('Get user error:', error);
    throw error;
  }
};

export const isAuthenticated = () => {
  return !!localStorage.getItem('authToken');
};
```

### 2.4 Routing Configuration
**Duration**: 1 hour

#### 2.4.1 Update App.jsx for Environment Awareness
**apps/frontend/src/App.jsx** (add environment indicator):
```jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
// ... other imports

const theme = createTheme({
  // ... existing theme configuration
});

function App() {
  const environment = import.meta.env.VITE_ENVIRONMENT;
  const showEnvironmentBanner = environment !== 'production';
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          {showEnvironmentBanner && (
            <div style={{
              background: environment === 'staging' ? '#ff9800' : '#2196f3',
              color: 'white',
              textAlign: 'center',
              padding: '4px',
              fontSize: '12px'
            }}>
              {environment.toUpperCase()} Environment
            </div>
          )}
          <Routes>
            <Route path="/*" element={<Layout />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
```

#### 2.4.2 Add 404 Handling
**apps/frontend/public/_redirects**:
```
/*    /index.html   200
```

### 2.5 Build Optimization
**Duration**: 1 hour

#### 2.5.1 Add Build Analysis
**apps/frontend/package.json** (add script):
```json
{
  "scripts": {
    "analyze": "vite build --mode production && npx vite-bundle-analyzer dist/stats.json"
  }
}
```

#### 2.5.2 Update Index.html Template
**apps/frontend/index.html**:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>%VITE_APP_NAME%</title>
    <meta name="description" content="CSV processing and data management tool" />
    
    <!-- Preconnect to API domain for better performance -->
    <link rel="dns-prefetch" href="%VITE_API_BASE_URL%" />
    
    <!-- CSP meta tag for security -->
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' %VITE_API_BASE_URL%;">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### 2.6 Cloudflare Pages Configuration
**Duration**: 2 hours

#### 2.6.1 Create Wrangler Configuration
**apps/frontend/wrangler.toml**:
```toml
name = "list-cutter-frontend"
compatibility_date = "2024-01-01"

[build]
command = "npm run build"
destination = "dist"

[build.environment_variables]
NODE_VERSION = "18"

# Development environment
[env.development]
vars = { VITE_ENVIRONMENT = "development" }

# Staging environment
[env.staging]
name = "list-cutter-frontend-staging"
vars = { 
  VITE_ENVIRONMENT = "staging",
  VITE_API_BASE_URL = "https://list-cutter-api-staging.your-subdomain.workers.dev"
}

# Production environment
[env.production]
name = "list-cutter-frontend-prod"
vars = { 
  VITE_ENVIRONMENT = "production",
  VITE_API_BASE_URL = "https://list-cutter-api-prod.your-subdomain.workers.dev"
}

# Headers for security and performance
[[headers]]
for = "/*"
[headers.values]
X-Frame-Options = "DENY"
X-Content-Type-Options = "nosniff"
Referrer-Policy = "strict-origin-when-cross-origin"
Permissions-Policy = "camera=(), microphone=(), geolocation=()"

# Cache static assets
[[headers]]
for = "/assets/*"
[headers.values]
Cache-Control = "public, max-age=31536000, immutable"

# Cache HTML with short expiration
[[headers]]
for = "*.html"
[headers.values]
Cache-Control = "public, max-age=300"
```

#### 2.6.2 Create Deployment Script
**apps/frontend/scripts/deploy.sh**:
```bash
#!/bin/bash

# Frontend deployment script
set -e

ENVIRONMENT=${1:-staging}

echo "🚀 Deploying frontend to $ENVIRONMENT environment..."

# Build the application
echo "📦 Building application..."
npm run build:$ENVIRONMENT

# Deploy to Cloudflare Pages
echo "🌐 Deploying to Cloudflare Pages..."
npx wrangler pages deploy dist --project-name=list-cutter-frontend-$ENVIRONMENT

echo "✅ Frontend deployment completed!"
echo "🔗 Check your Cloudflare Pages dashboard for deployment status"
```

### 2.7 Development Workflow Updates
**Duration**: 1 hour

#### 2.7.1 Update Development Scripts
**apps/frontend/package.json** (add development scripts):
```json
{
  "scripts": {
    "dev": "vite",
    "dev:staging": "vite --mode staging",
    "dev:production": "vite --mode production",
    "build": "vite build",
    "build:staging": "vite build --mode staging",
    "build:production": "vite build --mode production",
    "preview": "vite preview",
    "preview:staging": "vite preview --mode staging",
    "lint": "eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint . --ext js,jsx --fix",
    "test": "echo \"No tests specified\" && exit 0",
    "deploy:staging": "bash scripts/deploy.sh staging",
    "deploy:production": "bash scripts/deploy.sh production"
  }
}
```

#### 2.7.2 Create Development Documentation
**apps/frontend/README.md**:
```markdown
# List Cutter Frontend

React frontend for the List Cutter application, deployed on Cloudflare Pages.

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup
```bash
npm install
```

### Development Server
```bash
# Local development (with proxy to Django)
npm run dev

# Development with staging API
npm run dev:staging

# Development with production API
npm run dev:production
```

### Building
```bash
# Build for staging
npm run build:staging

# Build for production
npm run build:production
```

### Deployment
```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

## Environment Variables

- `VITE_APP_NAME`: Application name
- `VITE_API_BASE_URL`: Backend API URL
- `VITE_ENVIRONMENT`: Environment (development/staging/production)

## Architecture

- **Build Tool**: Vite 6.0.5
- **Framework**: React 18.3.1
- **UI Library**: Material-UI v6.4.2
- **Routing**: React Router DOM v6.28.2
- **HTTP Client**: Axios v1.7.9
- **Authentication**: JWT with automatic refresh
```

### 2.8 Testing and Validation
**Duration**: 3 hours

#### 2.8.1 Local Testing Checklist
- [ ] Development server starts correctly
- [ ] All routes load without errors
- [ ] API calls use correct base URL
- [ ] Authentication flow works
- [ ] File upload functionality works
- [ ] Environment variables are correctly applied
- [ ] Build process completes successfully
- [ ] Built files are correctly structured

#### 2.8.2 Build Testing Commands
```bash
# Test local development
cd apps/frontend
npm run dev

# Test staging build
npm run build:staging
npm run preview:staging

# Test production build
npm run build:production
npm run preview:production

# Test linting
npm run lint
```

#### 2.8.3 Manual Testing Scenarios
1. **Authentication Flow**:
   - Register new user
   - Login with credentials
   - Token refresh on expiration
   - Logout functionality

2. **Core Features**:
   - CSV file upload
   - Data filtering and processing
   - File management
   - User profile management

3. **Navigation**:
   - All routes accessible
   - Menu items work correctly
   - Client-side routing works
   - 404 handling

### 2.9 Deployment to Cloudflare Pages
**Duration**: 2 hours

#### 2.9.1 Create Pages Project
```bash
# Create Pages project via Wrangler
cd apps/frontend
npx wrangler pages project create list-cutter-frontend-staging

# Deploy initial version
npm run deploy:staging
```

#### 2.9.2 Configure Custom Domain (Optional)
```bash
# Add custom domain via Cloudflare dashboard
# Configure DNS records
# Update environment variables with final URLs
```

#### 2.9.3 Validation Commands
```bash
# Check deployment status
npx wrangler pages deployment list --project-name=list-cutter-frontend-staging

# Test deployed application
curl -I https://list-cutter-frontend-staging.pages.dev
```

## Validation Checklist

### 2.10 Pre-deployment Validation
- [ ] All environment variables configured
- [ ] API base URLs point to correct Workers
- [ ] Build completes without errors
- [ ] No console errors in browser
- [ ] Authentication works end-to-end
- [ ] File upload functionality works
- [ ] All routes accessible
- [ ] Static assets load correctly
- [ ] CSP headers configured
- [ ] Performance optimizations applied

### 2.11 Post-deployment Validation
- [ ] Application loads on Cloudflare Pages
- [ ] All API calls work correctly
- [ ] Authentication persists across sessions
- [ ] File operations work with R2 storage
- [ ] Performance meets expectations
- [ ] No CORS errors
- [ ] All routes work with client-side routing
- [ ] Error handling works correctly

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure Workers API has correct CORS headers
   - Check API base URL configuration
   - Verify authentication headers

2. **Build Failures**
   - Check for missing environment variables
   - Verify all dependencies are installed
   - Review Vite configuration

3. **Authentication Issues**
   - Verify JWT token format
   - Check token refresh mechanism
   - Ensure API endpoints match

4. **Routing Problems**
   - Verify `_redirects` file exists
   - Check React Router configuration
   - Ensure client-side routing is enabled

## Next Steps

After completing Phase 2:
1. **Frontend is deployed and accessible**
2. **Ready for Phase 3**: Begin backend migration
3. **API endpoints**: Start implementing Workers API to replace Django
4. **Parallel development**: Frontend can be tested against Django while Workers is built

## Files Modified/Created

- `apps/frontend/` - Complete frontend application
- `apps/frontend/wrangler.toml` - Cloudflare Pages configuration
- `apps/frontend/.env.*` - Environment configurations
- `apps/frontend/vite.config.js` - Updated build configuration
- `apps/frontend/src/api.js` - Updated API configuration
- `apps/frontend/src/auth.js` - Updated authentication service
- `apps/frontend/scripts/deploy.sh` - Deployment automation
- `apps/frontend/README.md` - Documentation

## Success Criteria

- [ ] Frontend deployed to Cloudflare Pages
- [ ] All features accessible via web interface
- [ ] API configuration ready for Workers migration
- [ ] Development workflow established
- [ ] Ready to begin backend migration in Phase 3