import type { Env } from './types';
import { errorHandler } from './middleware/error';
import { addCorsHeaders, corsHeaders } from './middleware/cors';
import { securityMiddleware, addSecurityHeaders } from './middleware/security';
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

      if (pathname === '/' && method === 'GET') {
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
      } else {
        response = new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Apply security headers and CORS to all responses
      response = addSecurityHeaders(response, pathname);
      return addCorsHeaders(response);
    } catch (error) {
      const errorResponse = errorHandler(error);
      const secureErrorResponse = addSecurityHeaders(errorResponse, new URL(request.url).pathname);
      return addCorsHeaders(secureErrorResponse);
    }
  },
};