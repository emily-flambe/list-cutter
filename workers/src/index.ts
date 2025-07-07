import type { Env } from './types';
import type { ScheduledEvent } from '@cloudflare/workers-types';
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
import { 
  handleCreateBackup, 
  handleGetBackupStatus, 
  handleListBackups, 
  handleVerifyBackup, 
  handleRestoreBackup, 
  handleGetBackupStats, 
  handleCleanupBackups 
} from './routes/backup';
import {
  handleCreateUserExport,
  handleCreateBulkExport,
  handleGetExportStatus,
  handleDownloadExport,
  handleListExports,
  handleScheduleExport,
  handleVerifyExport,
  handleGetExportStats,
  handleCleanupExports,
  handleProcessScheduledExports
} from './routes/data-export';
import { handleScheduledBackup } from './services/backup/scheduler';
import {
  getHealthStatus,
  runHealthCheck,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
  getHealthHistory,
  getActiveAlerts,
  resolveAlert,
  getMonitoringConfig,
  updateMonitoringConfig,
  startMonitoring,
  stopMonitoring,
  getHealthMetrics,
  initializeHealthMonitor
} from './routes/monitoring/health';
import { Hono } from 'hono';
import testing from './routes/testing';

// Initialize Hono app
const app = new Hono<{ Bindings: Env }>();

// Add testing routes
app.route('/api/testing', testing);

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    try {
      console.log('Scheduled event triggered:', event.cron);
      
      // Handle scheduled backup
      await handleScheduledBackup(env, ctx);
      
      // Process scheduled exports
      try {
        const { createExportService } = await import('./services/data-export/export-service');
        const exportService = createExportService(env);
        await exportService.processScheduledExports();
        await exportService.cleanupExpiredExports();
      } catch (error) {
        console.error('Scheduled export processing failed:', error);
      }
      
      // Initialize and run health check if monitoring is enabled
      try {
        const monitor = initializeHealthMonitor(env);
        if (monitor) {
          await monitor.performHealthCheck();
        }
      } catch (error) {
        console.error('Scheduled health check failed:', error);
      }

      // Run scheduled DR tests if any
      try {
        const DRTestingService = (await import('./services/testing/dr-testing')).DRTestingService;
        const testingService = new DRTestingService(env);
        await testingService.executeScheduledTests();
      } catch (error) {
        console.error('Scheduled DR testing failed:', error);
      }
    } catch (error) {
      console.error('Scheduled event error:', error);
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Initialize health monitoring on first request
      try {
        initializeHealthMonitor(env);
      } catch (error) {
        console.warn('Failed to initialize health monitoring:', error);
      }

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

      // Check if this is a testing route
      if (pathname.startsWith('/api/testing')) {
        return app.fetch(request, env, ctx);
      }

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
      } else if (pathname === '/api/backup/create' && method === 'POST') {
        response = await handleCreateBackup(request, env);
      } else if (pathname.startsWith('/api/backup/status/') && method === 'GET') {
        const backupId = pathname.split('/').pop();
        if (!backupId) {
          response = new Response(JSON.stringify({ error: 'No backup ID provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          response = await handleGetBackupStatus(request, env, backupId);
        }
      } else if (pathname === '/api/backup/list' && method === 'GET') {
        response = await handleListBackups(request, env);
      } else if (pathname.startsWith('/api/backup/verify/') && method === 'POST') {
        const backupId = pathname.split('/').pop();
        if (!backupId) {
          response = new Response(JSON.stringify({ error: 'No backup ID provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          response = await handleVerifyBackup(request, env, backupId);
        }
      } else if (pathname.startsWith('/api/backup/restore/') && method === 'POST') {
        const backupId = pathname.split('/').pop();
        if (!backupId) {
          response = new Response(JSON.stringify({ error: 'No backup ID provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          response = await handleRestoreBackup(request, env, backupId);
        }
      } else if (pathname === '/api/backup/stats' && method === 'GET') {
        response = await handleGetBackupStats(request, env);
      } else if (pathname === '/api/backup/cleanup' && method === 'POST') {
        response = await handleCleanupBackups(request, env);
      } else if (pathname === '/api/health' && method === 'GET') {
        response = await getHealthStatus(env);
      } else if (pathname === '/api/health/check' && method === 'POST') {
        response = await runHealthCheck(env);
      } else if (pathname === '/api/health/circuit-breaker' && method === 'GET') {
        response = await getCircuitBreakerStatus(env);
      } else if (pathname === '/api/health/circuit-breaker/reset' && method === 'POST') {
        response = await resetCircuitBreaker(env);
      } else if (pathname === '/api/health/history' && method === 'GET') {
        response = await getHealthHistory(env, request);
      } else if (pathname === '/api/health/alerts' && method === 'GET') {
        response = await getActiveAlerts(env);
      } else if (pathname.startsWith('/api/health/alerts/') && pathname.endsWith('/resolve') && method === 'POST') {
        response = await resolveAlert(env, request);
      } else if (pathname === '/api/health/config' && method === 'GET') {
        response = await getMonitoringConfig(env);
      } else if (pathname === '/api/health/config' && method === 'PUT') {
        response = await updateMonitoringConfig(env, request);
      } else if (pathname === '/api/health/monitoring/start' && method === 'POST') {
        response = await startMonitoring(env);
      } else if (pathname === '/api/health/monitoring/stop' && method === 'POST') {
        response = await stopMonitoring(env);
      } else if (pathname === '/api/health/metrics' && method === 'GET') {
        response = await getHealthMetrics(env, request);
      } else if (pathname === '/api/exports/user' && method === 'POST') {
        response = await handleCreateUserExport(request, env);
      } else if (pathname === '/api/exports/bulk' && method === 'POST') {
        response = await handleCreateBulkExport(request, env);
      } else if (pathname.startsWith('/api/exports/') && pathname.endsWith('/status') && method === 'GET') {
        const exportId = pathname.split('/')[3];
        if (!exportId) {
          response = new Response(JSON.stringify({ error: 'No export ID provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          response = await handleGetExportStatus(request, env, exportId);
        }
      } else if (pathname.startsWith('/api/exports/') && pathname.endsWith('/download') && method === 'GET') {
        const exportId = pathname.split('/')[3];
        if (!exportId) {
          response = new Response(JSON.stringify({ error: 'No export ID provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          response = await handleDownloadExport(request, env, exportId);
        }
      } else if (pathname === '/api/exports' && method === 'GET') {
        response = await handleListExports(request, env);
      } else if (pathname === '/api/exports/schedule' && method === 'POST') {
        response = await handleScheduleExport(request, env);
      } else if (pathname.startsWith('/api/exports/') && pathname.endsWith('/verify') && method === 'POST') {
        const exportId = pathname.split('/')[3];
        if (!exportId) {
          response = new Response(JSON.stringify({ error: 'No export ID provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          response = await handleVerifyExport(request, env, exportId);
        }
      } else if (pathname === '/api/exports/stats' && method === 'GET') {
        response = await handleGetExportStats(request, env);
      } else if (pathname === '/api/exports/cleanup' && method === 'POST') {
        response = await handleCleanupExports(request, env);
      } else if (pathname === '/api/exports/process-scheduled' && method === 'POST') {
        response = await handleProcessScheduledExports(request, env);
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