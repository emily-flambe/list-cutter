export function enforceHTTPS(request: Request): Response | null {
  const url = new URL(request.url);
  
  // Redirect HTTP to HTTPS in production
  if (url.protocol === 'http:' && !url.hostname.includes('localhost')) {
    const httpsUrl = url.href.replace('http:', 'https:');
    return Response.redirect(httpsUrl, 301);
  }
  
  return null;
}

export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  
  // HSTS - Force HTTPS for 1 year
  headers.set('Strict-Transport-Security', 
    'max-age=31536000; includeSubDomains; preload');
  
  // Prevent MIME type sniffing
  headers.set('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  headers.set('X-Frame-Options', 'DENY');
  
  // Enable XSS protection
  headers.set('X-XSS-Protection', '1; mode=block');
  
  // Control referrer information
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  
  // Permissions Policy (formerly Feature Policy)
  headers.set('Permissions-Policy', [
    'geolocation=()',
    'camera=()',
    'microphone=()',
    'payment=()',
    'usb=()',
    'bluetooth=()'
  ].join(', '));
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}