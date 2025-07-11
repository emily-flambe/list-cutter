import type { Env } from './types';
import { errorHandler } from './middleware/error';
import { addCorsHeaders, corsHeaders } from './middleware/cors';
import { securityMiddleware, securityResponseMiddleware, addSecurityHeaders } from './middleware/security';
import { handleHome } from './routes/home';
import { handleCsvCutterUpload } from './routes/list_cutter/csv_cutter';
import { handleExportCsv } from './routes/list_cutter/export_csv';
import { handleDownload } from './routes/list_cutter/download';
import { handleRegister } from './routes/accounts/register';
import { handleLogin } from './routes/accounts/login';
import { handleRefresh } from './routes/accounts/refresh';
import { handleLogout } from './routes/accounts/logout';
import { handleGetUser } from './routes/accounts/user';
import { handleUpload } from './routes/list_cutter/upload';
import { handleListSavedFiles } from './routes/list_cutter/list_files';
import { handleDeleteFile } from './routes/list_cutter/delete';
import { handleSaveGeneratedFile } from './routes/list_cutter/save_generated_file';
import { handleFetchSavedFile } from './routes/list_cutter/fetch_saved_file';
import { handleUpdateTags } from './routes/list_cutter/update_tags';
import { handleFetchFileLineage } from './routes/list_cutter/fetch_file_lineage';
import { 
  getSecurityAnalytics, 
  getSecurityMetrics, 
  getSecurityEvents, 
  getBlockedIPs, 
  blockIP, 
  unblockIP, 
  triggerAggregation 
} from './routes/analytics/security';
import { handleAPIKeyRoutes, isAPIKeyRoute } from './routes/api-keys/index';
import { handleDocsRoutes, isDocsRoute } from './routes/docs/api';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Handle CORS preflight requests
      if (request.method === 'OPTIONS') {
        return addSecurityHeaders(new Response(null, { 
          status: 204, 
          headers: corsHeaders() 
        }), new URL(request.url).pathname);
      }

      // Apply security middleware first
      const securityResponse = await securityMiddleware(request, env, ctx);
      if (securityResponse) {
        return securityResponse;
      }

      const url = new URL(request.url);
      const { pathname, method } = { pathname: url.pathname, method: request.method };

      let response: Response;

      // Health check endpoints
      if (pathname === '/health' && method === 'GET') {
        response = new Response(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT || 'unknown',
          version: '1.0.0'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (pathname === '/health/auth' && method === 'GET') {
        // Test database and KV connectivity
        try {
          // Test database connection
          await env.DB.prepare('SELECT 1 as test').first();
          
          // Test KV connectivity
          await env.AUTH_KV.get('health_check_test');
          
          response = new Response(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: env.ENVIRONMENT || 'unknown',
            services: {
              database: 'connected',
              kv: 'available',
              r2: 'available'
            }
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          response = new Response(JSON.stringify({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            environment: env.ENVIRONMENT || 'unknown',
            error: error instanceof Error ? error.message : 'Service connectivity failed',
            services: {
              database: 'error',
              kv: 'error',
              r2: 'unknown'
            }
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } else if (pathname === '/' && method === 'GET') {
        response = handleHome();
      } else if (pathname === '/api/list_cutter/csv_cutter' && method === 'POST') {
        response = await handleCsvCutterUpload(request, env);
      } else if (pathname === '/api/list_cutter/export_csv' && method === 'POST') {
        response = await handleExportCsv(request, env);
      } else if (pathname.startsWith('/api/list_cutter/download/') && method === 'GET') {
        const filename = pathname.split('/').pop();
        if (!filename) {
          response = new Response(JSON.stringify({ error: 'No filename provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          response = await handleDownload(request, env, filename);
        }
      } else if (pathname === '/api/accounts/register' && method === 'POST') {
        response = await handleRegister(request, env);
      } else if (pathname === '/api/accounts/login' && method === 'POST') {
        response = await handleLogin(request, env);
      } else if (pathname === '/api/accounts/token/refresh' && method === 'POST') {
        response = await handleRefresh(request, env);
      } else if (pathname === '/api/accounts/logout' && method === 'POST') {
        response = await handleLogout(request, env);
      } else if (pathname === '/api/accounts/user' && method === 'GET') {
        response = await handleGetUser(request, env);
      } else if (pathname === '/api/list_cutter/upload' && method === 'POST') {
        response = await handleUpload(request, env);
      } else if (pathname === '/api/list_cutter/list_saved_files' && method === 'GET') {
        response = await handleListSavedFiles(request, env);
      } else if (pathname.startsWith('/api/list_cutter/delete/') && method === 'DELETE') {
        const fileId = pathname.split('/').pop();
        if (!fileId) {
          response = new Response(JSON.stringify({ error: 'No file ID provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          response = await handleDeleteFile(request, env, fileId);
        }
      } else if (pathname === '/api/list_cutter/save_generated_file' && method === 'POST') {
        response = await handleSaveGeneratedFile(request, env);
      } else if (pathname.startsWith('/api/list_cutter/fetch_saved_file/') && method === 'GET') {
        const fileId = pathname.split('/').pop();
        if (!fileId) {
          response = new Response(JSON.stringify({ error: 'No file ID provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          response = await handleFetchSavedFile(request, env, fileId);
        }
      } else if (pathname.startsWith('/api/list_cutter/update_tags/') && method === 'PATCH') {
        const fileId = pathname.split('/').pop();
        if (!fileId) {
          response = new Response(JSON.stringify({ error: 'No file ID provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          response = await handleUpdateTags(request, env, fileId);
        }
      } else if (pathname.startsWith('/api/list_cutter/fetch_file_lineage/') && method === 'GET') {
        const fileId = pathname.split('/').pop();
        if (!fileId) {
          response = new Response(JSON.stringify({ error: 'No file ID provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          response = await handleFetchFileLineage(request, env, fileId);
        }
      } else if (pathname === '/api/analytics/security' && method === 'GET') {
        response = await getSecurityAnalytics(request, env);
      } else if (pathname === '/api/analytics/security/metrics' && method === 'GET') {
        response = await getSecurityMetrics(request, env);
      } else if (pathname === '/api/analytics/security/events' && method === 'GET') {
        response = await getSecurityEvents(request, env);
      } else if (pathname === '/api/analytics/security/blocked-ips' && method === 'GET') {
        response = await getBlockedIPs(request, env);
      } else if (pathname === '/api/analytics/security/block-ip' && method === 'POST') {
        response = await blockIP(request, env);
      } else if (pathname === '/api/analytics/security/unblock-ip' && method === 'POST') {
        response = await unblockIP(request, env);
      } else if (pathname === '/api/analytics/security/aggregate' && method === 'POST') {
        response = await triggerAggregation(request, env);
      } else if (isAPIKeyRoute(pathname)) {
        // Handle API key management routes
        const apiKeyResponse = await handleAPIKeyRoutes(request, env, pathname, method);
        if (apiKeyResponse) {
          response = apiKeyResponse;
        } else {
          response = new Response(JSON.stringify({ error: 'API key route not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } else if (isDocsRoute(pathname)) {
        // Handle API documentation routes
        const docsResponse = await handleDocsRoutes(request, env, pathname);
        if (docsResponse) {
          response = docsResponse;
        } else {
          response = new Response(JSON.stringify({ error: 'Documentation route not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } else {
        response = new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Apply security response monitoring and headers
      response = await securityResponseMiddleware(request, response, env);
      response = addSecurityHeaders(response, pathname);
      return addCorsHeaders(response);
    } catch (error) {
      const errorResponse = errorHandler(error);
      const secureErrorResponse = addSecurityHeaders(errorResponse, new URL(request.url).pathname);
      return addCorsHeaders(secureErrorResponse);
    }
  },
};