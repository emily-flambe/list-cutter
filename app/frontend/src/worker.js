export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Log the domain for debugging (remove in production)
    console.log(`Request from: ${url.hostname}`);
    
    // Try to serve the asset directly
    const asset = await env.ASSETS.fetch(request);
    
    // If asset exists, add appropriate headers and return it
    if (asset.status !== 404) {
      const response = new Response(asset.body, asset);
      
      // Add security headers
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('X-XSS-Protection', '1; mode=block');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      
      // Dynamic CSP based on environment
      const apiOrigins = getApiOrigins(env.ENVIRONMENT);
      response.headers.set('Content-Security-Policy', 
        `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' ${apiOrigins}`
      );
      
      // Set caching headers based on file type
      const pathname = url.pathname;
      if (pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot)$/)) {
        // Static assets - cache for 1 year
        response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (pathname.match(/\.(html)$/)) {
        // HTML files - no cache for SPA
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
      }
      
      return response;
    }
    
    // If asset not found, serve index.html for SPA routing
    const indexRequest = new Request(new URL('/index.html', request.url));
    const indexAsset = await env.ASSETS.fetch(indexRequest);
    
    if (indexAsset.status === 404) {
      return new Response('Not Found', { status: 404 });
    }
    
    // Dynamic CSP for index.html
    const apiOrigins = getApiOrigins(env.ENVIRONMENT);
    const indexResponse = new Response(indexAsset.body, {
      ...indexAsset,
      headers: {
        ...indexAsset.headers,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        'Content-Security-Policy': `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' ${apiOrigins}`
      }
    });
    
    return indexResponse;
  },
};

// Helper function to get API origins based on environment
function getApiOrigins(environment) {
  switch (environment) {
    case 'production':
      return 'https://api.emilycogsdill.com';
    case 'staging':
      return 'https://cutty-staging.emilycogsdill.com';
    case 'preview':
      return 'https://cutty-preview.emilycogsdill.com';
    default:
      return 'http://localhost:8787 https://cutty.emilycogsdill.com';
  }
}