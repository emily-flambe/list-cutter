import type { Env } from './types';
import { errorHandler } from './middleware/error';
import { addCorsHeaders, corsHeaders } from './middleware/cors';
import { handleHome } from './routes/home';
import { handleCsvCutterUpload } from './routes/list_cutter/csv_cutter';
import { handleExportCsv } from './routes/list_cutter/export_csv';
import { handleDownload } from './routes/list_cutter/download';
import { handleRegister } from './routes/accounts/register';
import { handleLogin } from './routes/accounts/login';
import { handleRefresh } from './routes/accounts/refresh';
import { handleGetUser } from './routes/accounts/user';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, { 
          status: 204, 
          headers: corsHeaders() 
        });
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
      } else if (pathname === '/api/accounts/user' && method === 'GET') {
        response = await handleGetUser(request, env);
      } else {
        response = new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return addCorsHeaders(response);
    } catch (error) {
      const errorResponse = errorHandler(error);
      return addCorsHeaders(errorResponse);
    }
  },
};