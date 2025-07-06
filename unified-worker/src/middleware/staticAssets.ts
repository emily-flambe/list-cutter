import type { Context, Next } from 'hono';
import type { HonoEnv } from '@/types/env';

export async function staticAssetHandler(
  c: Context<HonoEnv>,
  next: Next
): Promise<Response | void> {
  const url = new URL(c.req.url);
  const path = url.pathname;

  // Skip for API routes
  if (path.startsWith('/api/')) {
    return next();
  }

  // Skip for special routes
  if (path === '/health' || path === '/metrics') {
    return next();
  }

  try {
    // Try to fetch the exact file first
    let assetPath = path === '/' ? '/index.html' : path;
    
    // Ensure path starts with /
    if (!assetPath.startsWith('/')) {
      assetPath = '/' + assetPath;
    }

    const assetUrl = new URL(assetPath, c.req.url);
    const assetResponse = await c.env.ASSETS.fetch(assetUrl.toString());

    // If asset found, return it with appropriate headers
    if (assetResponse.status === 200) {
      const response = new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers: assetResponse.headers
      });

      // Add caching headers for static assets
      if (isStaticAsset(assetPath)) {
        response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        response.headers.set('Cache-Control', 'public, max-age=3600');
      }

      // Add security headers
      response.headers.set('X-Content-Type-Options', 'nosniff');
      
      return response;
    }

    // If not found and it's not an API route, serve index.html for SPA routing
    if (assetResponse.status === 404 && !path.includes('.')) {
      const indexUrl = new URL('/index.html', c.req.url);
      const indexResponse = await c.env.ASSETS.fetch(indexUrl.toString());
      
      if (indexResponse.status === 200) {
        const response = new Response(indexResponse.body, {
          status: 200,
          statusText: 'OK',
          headers: indexResponse.headers
        });
        
        response.headers.set('Cache-Control', 'public, max-age=300');
        response.headers.set('X-Content-Type-Options', 'nosniff');
        
        return response;
      }
    }

    // Asset not found, continue to next middleware (which will likely return 404)
    return next();
  } catch (error) {
    console.error('Static asset handler error:', error);
    return next();
  }
}

function isStaticAsset(path: string): boolean {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', 
    '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.mp3', '.wav'
  ];
  
  return staticExtensions.some(ext => path.endsWith(ext));
}

export function getMimeType(path: string): string {
  const ext = path.toLowerCase().split('.').pop();
  
  const mimeTypes: Record<string, string> = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'eot': 'application/vnd.ms-fontobject',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav'
  };
  
  return mimeTypes[ext || ''] || 'application/octet-stream';
}