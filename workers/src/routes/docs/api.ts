import type { Env } from '../../types';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Serve interactive API documentation using Swagger UI
 * 
 * @param request - The incoming request
 * @param env - Environment variables
 * @returns Response with Swagger UI HTML
 */
export async function serveAPIDocs(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  
  // Handle OpenAPI spec file requests
  if (url.pathname === '/docs/openapi.yaml') {
    return serveOpenAPISpec(request, env);
  }
  
  // Serve Swagger UI interface
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Cutty API Documentation</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
      <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5.9.0/favicon-32x32.png" sizes="32x32" />
      <style>
        html { 
          box-sizing: border-box; 
          overflow: -moz-scrollbars-vertical; 
          overflow-y: scroll; 
        }
        *, *:before, *:after { 
          box-sizing: inherit; 
        }
        body { 
          margin: 0; 
          background: #fafafa; 
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .swagger-ui .topbar {
          background-color: #1f2937;
          padding: 16px 0;
        }
        .swagger-ui .topbar .download-url-wrapper {
          display: none;
        }
        .auth-controls {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 1000;
          display: flex;
          gap: 8px;
        }
        .auth-button {
          padding: 8px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: background-color 0.2s;
        }
        .auth-button:hover {
          background: #2563eb;
        }
        .auth-button.clear {
          background: #ef4444;
        }
        .auth-button.clear:hover {
          background: #dc2626;
        }
        .auth-status {
          padding: 8px 16px;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }
        .auth-status.authenticated {
          background: #dcfce7;
          border-color: #16a34a;
          color: #166534;
        }
        .info-section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 24px;
          margin: 24px;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }
        .info-section h2 {
          margin: 0 0 16px 0;
          color: #1f2937;
          font-size: 24px;
        }
        .info-section p {
          margin: 0 0 12px 0;
          color: #6b7280;
          line-height: 1.6;
        }
        .info-section code {
          background: #f3f4f6;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, monospace;
          font-size: 14px;
        }
        .quick-start {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 16px;
          margin-top: 16px;
        }
        .quick-start-item {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 16px;
        }
        .quick-start-item h3 {
          margin: 0 0 8px 0;
          color: #1f2937;
          font-size: 16px;
        }
        .quick-start-item p {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
        }
      </style>
    </head>
    <body>
      <div class="auth-controls">
        <div class="auth-status" id="authStatus">Not authenticated</div>
        <button class="auth-button" id="setToken">Set JWT Token</button>
        <button class="auth-button" id="setApiKey">Set API Key</button>
        <button class="auth-button clear" id="clearAuth">Clear Auth</button>
      </div>

      <div class="info-section">
        <h2>🔐 Cutty Authentication & File Management API</h2>
        <p>
          Welcome to the Cutty API documentation. This API provides comprehensive authentication, 
          security monitoring, and file management capabilities built on Cloudflare Workers.
        </p>
        
        <div class="quick-start">
          <div class="quick-start-item">
            <h3>🚀 Quick Start</h3>
            <p>
              1. Register a new account<br>
              2. Use the JWT token for API calls<br>
              3. Create API keys for programmatic access
            </p>
          </div>
          <div class="quick-start-item">
            <h3>🔑 Authentication</h3>
            <p>
              Use JWT tokens (10min) with refresh tokens (1day)<br>
              Or API keys with <code>cutty_</code> prefix<br>
              Rate limiting: 100 req/min (IP), 60 req/min (user)
            </p>
          </div>
          <div class="quick-start-item">
            <h3>🛡️ Security</h3>
            <p>
              PBKDF2 password hashing (600k iterations)<br>
              Token blacklisting and rotation<br>
              Real-time threat detection and monitoring
            </p>
          </div>
          <div class="quick-start-item">
            <h3>📁 File Management</h3>
            <p>
              CSV upload, processing, and export<br>
              File lineage tracking and metadata<br>
              Secure R2 storage with access controls
            </p>
          </div>
        </div>
      </div>

      <div id="swagger-ui"></div>

      <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
      <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
      <script>
        // Initialize Swagger UI
        window.onload = function() {
          const ui = SwaggerUIBundle({
            url: '/docs/openapi.yaml',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIStandalonePreset
            ],
            plugins: [
              SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "StandaloneLayout",
            tryItOutEnabled: true,
            filter: true,
            requestInterceptor: (request) => {
              // Add auth token if available
              const token = localStorage.getItem('cutty_access_token');
              const apiKey = localStorage.getItem('cutty_api_key');
              
              if (token) {
                request.headers.Authorization = 'Bearer ' + token;
              } else if (apiKey) {
                request.headers.Authorization = 'Bearer ' + apiKey;
              }
              
              return request;
            },
            responseInterceptor: (response) => {
              // Handle token refresh if needed
              if (response.status === 401 && response.url.includes('/api/')) {
                const refreshToken = localStorage.getItem('cutty_refresh_token');
                if (refreshToken) {
                  // Could implement automatic token refresh here
                  console.log('Token expired, refresh needed');
                }
              }
              return response;
            },
            onComplete: () => {
              updateAuthStatus();
            }
          });

          // Authentication management
          function updateAuthStatus() {
            const token = localStorage.getItem('cutty_access_token');
            const apiKey = localStorage.getItem('cutty_api_key');
            const status = document.getElementById('authStatus');
            
            if (token) {
              try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                const expiry = new Date(payload.exp * 1000);
                const now = new Date();
                
                if (expiry > now) {
                  status.textContent = \`JWT: \${payload.username} (expires \${expiry.toLocaleTimeString()})\`;
                  status.className = 'auth-status authenticated';
                } else {
                  status.textContent = 'JWT token expired';
                  status.className = 'auth-status';
                  localStorage.removeItem('cutty_access_token');
                }
              } catch (e) {
                status.textContent = 'Invalid JWT token';
                status.className = 'auth-status';
                localStorage.removeItem('cutty_access_token');
              }
            } else if (apiKey) {
              status.textContent = \`API Key: \${apiKey.substring(0, 15)}...\`;
              status.className = 'auth-status authenticated';
            } else {
              status.textContent = 'Not authenticated';
              status.className = 'auth-status';
            }
          }

          // Set JWT token
          document.getElementById('setToken').onclick = () => {
            const token = prompt('Enter your JWT access token (from /api/accounts/login):');
            if (token && token.trim()) {
              localStorage.setItem('cutty_access_token', token.trim());
              localStorage.removeItem('cutty_api_key'); // Clear API key if set
              updateAuthStatus();
              alert('JWT token saved! API calls will now include authentication.');
            }
          };

          // Set API key
          document.getElementById('setApiKey').onclick = () => {
            const key = prompt('Enter your API key (starts with cutty_):');
            if (key && key.trim().startsWith('cutty_')) {
              localStorage.setItem('cutty_api_key', key.trim());
              localStorage.removeItem('cutty_access_token'); // Clear JWT if set
              updateAuthStatus();
              alert('API key saved! API calls will now include authentication.');
            } else if (key) {
              alert('API key must start with "cutty_"');
            }
          };

          // Clear authentication
          document.getElementById('clearAuth').onclick = () => {
            localStorage.removeItem('cutty_access_token');
            localStorage.removeItem('cutty_refresh_token');
            localStorage.removeItem('cutty_api_key');
            updateAuthStatus();
            alert('Authentication cleared.');
          };

          // Update auth status every 30 seconds
          setInterval(updateAuthStatus, 30000);
        };
      </script>
    </body>
    </html>
  `;
  
  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

/**
 * Serve the OpenAPI specification file
 * 
 * @param request - The incoming request  
 * @param env - Environment variables
 * @returns Response with OpenAPI YAML content
 */
export async function serveOpenAPISpec(request: Request, env: Env): Promise<Response> {
  // In a real implementation, you might read this from R2 storage or embed it
  // For now, we'll serve the static OpenAPI spec content
  const openApiContent = await getOpenAPISpecContent();
  
  return new Response(openApiContent, {
    headers: {
      'Content-Type': 'application/x-yaml',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

/**
 * Get the OpenAPI specification content
 * In production, this could be read from R2 storage or embedded as a module
 */
async function getOpenAPISpecContent(): Promise<string> {
  // This would typically read from the docs/api/openapi.yaml file
  // For Cloudflare Workers, we'd need to embed it or store in R2
  
  // For now, return a reference to fetch from the docs endpoint
  // In production, you'd embed the full OpenAPI spec here
  return \`# This would contain the full OpenAPI spec
# In production, embed the openapi.yaml content here or fetch from R2
openapi: 3.0.3
info:
  title: Cutty API Documentation
  description: Visit /docs for the full interactive documentation
  version: 1.0.0
servers:
  - url: /api
paths:
  /docs:
    get:
      summary: Access full API documentation
      responses:
        '200':
          description: Interactive API documentation
\`;
}

/**
 * Check if a request path is for API documentation
 */
export function isDocsRoute(pathname: string): boolean {
  return pathname.startsWith('/docs') || pathname === '/api-docs';
}

/**
 * Route handler for all documentation routes
 */
export async function handleDocsRoutes(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  
  // Main API documentation
  if (pathname === '/docs' || pathname === '/docs/' || pathname === '/api-docs') {
    return await serveAPIDocs(request, env);
  }
  
  // OpenAPI spec file
  if (pathname === '/docs/openapi.yaml') {
    return await serveOpenAPISpec(request, env);
  }
  
  // API key management frontend (redirect to main docs with anchor)
  if (pathname === '/docs/api-keys') {
    const url = new URL(request.url);
    url.pathname = '/docs';
    url.hash = '#/API%20Keys';
    return Response.redirect(url.toString(), 302);
  }
  
  // Authentication guide (redirect to main docs with anchor)
  if (pathname === '/docs/auth') {
    const url = new URL(request.url);
    url.pathname = '/docs';
    url.hash = '#/Authentication';
    return Response.redirect(url.toString(), 302);
  }
  
  return null;
}