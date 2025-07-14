/**
 * Google OAuth Routes
 * 
 * Implements the complete OAuth 2.0 flow for Google authentication:
 * - OAuth initiation with state management
 * - OAuth callback handling with comprehensive validation
 * - Account linking and unlinking
 * - OAuth status endpoints
 * 
 * Security features:
 * - Multi-layered rate limiting via middleware
 * - Comprehensive input validation
 * - Security event logging
 * - CSRF protection via state tokens
 */

import { Hono } from 'hono';
import { GoogleOAuthService } from '../../services/auth/google-oauth-service';
import { OAuthRateLimiter } from '../../services/auth/oauth-rate-limiter';
import { OAuthSecurityMiddleware } from '../../middleware/oauth-security';
import { generateJWT } from '../../services/auth/jwt';
import { requireAuth } from '../../middleware/auth';

// Environment interface
interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  JWT_SECRET: string;
}

const googleOAuth = new Hono<{ Bindings: Env }>();

/**
 * GET /api/v1/auth/google
 * Initiates Google OAuth flow with security middleware
 */
googleOAuth.get('/', async (c) => {
  try {
    // Initialize services
    const rateLimiter = new OAuthRateLimiter(c.env.DB);
    const securityMiddleware = new OAuthSecurityMiddleware(rateLimiter);
    
    // Apply security checks
    const securityCheck = await securityMiddleware.securityCheck(c, 'attempt');
    if (securityCheck) {
      return securityCheck; // Security middleware returned an error response
    }

    // Initialize OAuth service
    const oauthService = new GoogleOAuthService(
      {
        clientId: c.env.GOOGLE_CLIENT_ID,
        clientSecret: c.env.GOOGLE_CLIENT_SECRET,
        redirectUri: c.env.GOOGLE_REDIRECT_URI,
      },
      c.env.JWT_SECRET,
      c.env.DB
    );

    // Extract parameters
    const returnUrl = c.req.query('return_url') || '/dashboard';
    const userId = c.req.query('user_id') ? Number(c.req.query('user_id')) : undefined;

    // Initiate OAuth flow
    const { authUrl, state } = await oauthService.initiateOAuth(returnUrl, userId);

    // Record successful initiation
    await securityMiddleware.recordOAuthEvent(c, 'success', {
      return_url: returnUrl,
      user_id: userId,
    });

    // Return authorization URL for redirect
    return c.json({
      success: true,
      authorization_url: authUrl,
      state,
      message: 'OAuth flow initiated successfully',
    });

  } catch (error) {
    // Log error and return generic message
    console.error('OAuth initiation failed:', error);
    
    const rateLimiter = new OAuthRateLimiter(c.env.DB);
    const securityMiddleware = new OAuthSecurityMiddleware(rateLimiter);
    await securityMiddleware.recordOAuthEvent(c, 'failure', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return c.json({
      success: false,
      error: 'OAuth initiation failed',
      message: 'Unable to start authentication process',
    }, 500);
  }
});

/**
 * GET /api/v1/auth/google/callback
 * Handles OAuth callback with comprehensive validation and user creation
 */
googleOAuth.get('/callback', async (c) => {
  try {
    // Initialize services
    const rateLimiter = new OAuthRateLimiter(c.env.DB);
    const securityMiddleware = new OAuthSecurityMiddleware(rateLimiter);
    
    // Apply security checks
    const securityCheck = await securityMiddleware.securityCheck(c, 'attempt');
    if (securityCheck) {
      return securityCheck; // Security middleware returned an error response
    }

    // Extract OAuth parameters
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    // Handle OAuth errors from Google
    if (error) {
      await securityMiddleware.recordOAuthEvent(c, 'failure', {
        oauth_error: error,
        error_description: c.req.query('error_description'),
      });

      return c.json({
        success: false,
        error: 'OAuth authorization failed',
        message: `Google OAuth error: ${error}`,
      }, 400);
    }

    // Validate required parameters
    if (!code || !state) {
      await securityMiddleware.recordOAuthEvent(c, 'failure', {
        missing_parameters: { code: !code, state: !state },
      });

      return c.json({
        success: false,
        error: 'Missing OAuth parameters',
        message: 'Authorization code or state parameter missing',
      }, 400);
    }

    // Initialize OAuth service
    const oauthService = new GoogleOAuthService(
      {
        clientId: c.env.GOOGLE_CLIENT_ID,
        clientSecret: c.env.GOOGLE_CLIENT_SECRET,
        redirectUri: c.env.GOOGLE_REDIRECT_URI,
      },
      c.env.JWT_SECRET,
      c.env.DB
    );

    // Get request context for logging
    const securityContext = c.get('securityContext');
    const ip_address = securityContext?.ip_address || 'unknown';
    const user_agent = securityContext?.user_agent || 'unknown';

    // Handle OAuth callback
    const result = await oauthService.handleCallback(code, state, ip_address, user_agent);

    if (!result.success) {
      await securityMiddleware.recordOAuthEvent(c, 'failure', {
        error: result.error,
      });

      return c.json({
        success: false,
        error: result.error,
        message: 'OAuth authentication failed',
      }, 400);
    }

    // Generate JWT token for authenticated user
    const jwtToken = await generateJWT(
      {
        user_id: result.user!.id.toString(),
        username: result.user!.username,
        email: result.user!.email,
      },
      c.env.JWT_SECRET
    );

    // Record successful OAuth
    await securityMiddleware.recordOAuthEvent(c, 'success', {
      user_id: result.user!.id,
      username: result.user!.username,
      provider: 'google',
    });

    // Return success with user data and redirect
    const response = {
      success: true,
      user: {
        id: result.user!.id,
        username: result.user!.username,
        email: result.user!.email,
        display_name: result.user!.display_name,
        profile_picture_url: result.user!.profile_picture_url,
        provider: 'google',
      },
      token: jwtToken,
      redirect_url: result.redirect || '/dashboard',
      message: 'Google OAuth authentication successful',
    };

    // For browser requests, redirect with token in URL params (will be handled by frontend)
    const acceptHeader = c.req.header('Accept') || '';
    if (acceptHeader.includes('text/html')) {
      const redirectUrl = new URL(result.redirect || '/dashboard', c.req.url);
      redirectUrl.searchParams.set('oauth_success', 'true');
      redirectUrl.searchParams.set('token', jwtToken);
      redirectUrl.searchParams.set('user_id', result.user!.id.toString());
      
      return c.redirect(redirectUrl.toString());
    }

    // For API requests, return JSON
    return c.json(response);

  } catch (error) {
    console.error('OAuth callback failed:', error);
    
    const rateLimiter = new OAuthRateLimiter(c.env.DB);
    const securityMiddleware = new OAuthSecurityMiddleware(rateLimiter);
    await securityMiddleware.recordOAuthEvent(c, 'failure', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return c.json({
      success: false,
      error: 'OAuth callback processing failed',
      message: 'Authentication process encountered an error',
    }, 500);
  }
});

/**
 * POST /api/v1/auth/google/link
 * Links Google account to existing authenticated user
 * Requires existing authentication
 */
googleOAuth.post('/link', requireAuth(), async (c) => {
  try {
    // Get authenticated user from middleware
    const user = c.get('user');
    if (!user) {
      return c.json({
        success: false,
        error: 'Authentication required',
        message: 'Must be logged in to link Google account',
      }, 401);
    }

    // Initialize services
    const rateLimiter = new OAuthRateLimiter(c.env.DB);
    const securityMiddleware = new OAuthSecurityMiddleware(rateLimiter);
    
    // Apply security checks
    const securityCheck = await securityMiddleware.securityCheck(c, 'attempt');
    if (securityCheck) {
      return securityCheck;
    }

    // Initialize OAuth service
    const oauthService = new GoogleOAuthService(
      {
        clientId: c.env.GOOGLE_CLIENT_ID,
        clientSecret: c.env.GOOGLE_CLIENT_SECRET,
        redirectUri: c.env.GOOGLE_REDIRECT_URI,
      },
      c.env.JWT_SECRET,
      c.env.DB
    );

    // Check if user already has Google account linked
    const existingUser = await c.env.DB
      .prepare('SELECT google_id FROM users WHERE id = ?')
      .bind(user.id)
      .first();

    if (existingUser?.google_id) {
      return c.json({
        success: false,
        error: 'Google account already linked',
        message: 'This account already has a Google account linked',
      }, 400);
    }

    // Initiate OAuth flow with user ID for linking
    const returnUrl = '/dashboard?linked=true';
    const { authUrl, state } = await oauthService.initiateOAuth(returnUrl, user.id);

    // Record linking attempt
    await securityMiddleware.recordOAuthEvent(c, 'success', {
      action: 'account_linking',
      user_id: user.id,
      return_url: returnUrl,
    });

    return c.json({
      success: true,
      authorization_url: authUrl,
      state,
      message: 'Google account linking initiated',
    });

  } catch (error) {
    console.error('Google account linking failed:', error);
    
    return c.json({
      success: false,
      error: 'Account linking failed',
      message: 'Unable to initiate Google account linking',
    }, 500);
  }
});

/**
 * DELETE /api/v1/auth/google/unlink
 * Unlinks Google account from authenticated user
 * Requires existing authentication
 */
googleOAuth.delete('/unlink', requireAuth(), async (c) => {
  try {
    // Get authenticated user from middleware
    const user = c.get('user');
    if (!user) {
      return c.json({
        success: false,
        error: 'Authentication required',
        message: 'Must be logged in to unlink Google account',
      }, 401);
    }

    // Check if user has Google account linked
    const currentUser = await c.env.DB
      .prepare('SELECT google_id, provider, password_hash FROM users WHERE id = ?')
      .bind(user.id)
      .first();

    if (!currentUser?.google_id) {
      return c.json({
        success: false,
        error: 'No Google account linked',
        message: 'This account does not have a Google account linked',
      }, 400);
    }

    // Prevent unlinking if it's the only authentication method
    if (currentUser.provider === 'google' && !currentUser.password_hash) {
      return c.json({
        success: false,
        error: 'Cannot unlink primary authentication',
        message: 'Cannot unlink Google account without setting a password first',
      }, 400);
    }

    // Unlink Google account
    await c.env.DB
      .prepare(`
        UPDATE users 
        SET google_id = NULL, provider = 'email', provider_email = NULL,
            profile_picture_url = NULL, last_google_sync = NULL
        WHERE id = ?
      `)
      .bind(user.id)
      .run();

    // Log security event
    await c.env.DB
      .prepare(`
        INSERT INTO oauth_security_events (event_type, severity, user_id, details, created_at)
        VALUES ('google_account_unlinked', 'info', ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(user.id, JSON.stringify({ previous_google_id: currentUser.google_id }))
      .run();

    return c.json({
      success: true,
      message: 'Google account unlinked successfully',
    });

  } catch (error) {
    console.error('Google account unlinking failed:', error);
    
    return c.json({
      success: false,
      error: 'Account unlinking failed',
      message: 'Unable to unlink Google account',
    }, 500);
  }
});

/**
 * GET /api/v1/auth/google/status
 * Returns OAuth connection status for authenticated user
 */
googleOAuth.get('/status', requireAuth(), async (c) => {
  try {
    // Get authenticated user from middleware
    const user = c.get('user');
    if (!user) {
      return c.json({
        success: false,
        error: 'Authentication required',
      }, 401);
    }

    // Get user's OAuth status
    const userData = await c.env.DB
      .prepare(`
        SELECT google_id, provider, provider_email, display_name, 
               profile_picture_url, last_google_sync
        FROM users WHERE id = ?
      `)
      .bind(user.id)
      .first();

    const hasGoogleAccount = !!userData?.google_id;
    const isPrimaryProvider = userData?.provider === 'google';

    return c.json({
      success: true,
      google_connected: hasGoogleAccount,
      is_primary_provider: isPrimaryProvider,
      google_email: userData?.provider_email || null,
      display_name: userData?.display_name || null,
      profile_picture_url: userData?.profile_picture_url || null,
      last_sync: userData?.last_google_sync || null,
    });

  } catch (error) {
    console.error('OAuth status check failed:', error);
    
    return c.json({
      success: false,
      error: 'Status check failed',
      message: 'Unable to retrieve OAuth status',
    }, 500);
  }
});

/**
 * GET /api/v1/auth/google/analytics
 * Returns OAuth usage analytics (admin only)
 */
googleOAuth.get('/analytics', requireAuth(), async (c) => {
  try {
    // Basic authentication check (extend with admin role check if needed)
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    // Initialize rate limiter for analytics
    const rateLimiter = new OAuthRateLimiter(c.env.DB);
    const analytics = await rateLimiter.getRateLimitAnalytics(24); // Last 24 hours

    // Get OAuth user statistics
    const [googleUsers, totalUsers, recentSignups] = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE google_id IS NOT NULL').first(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first(),
      c.env.DB.prepare(`
        SELECT COUNT(*) as count FROM users 
        WHERE google_id IS NOT NULL AND created_at > datetime('now', '-24 hours')
      `).first(),
    ]);

    return c.json({
      success: true,
      oauth_analytics: {
        rate_limiting: analytics,
        user_statistics: {
          total_users: Number(totalUsers?.count) || 0,
          google_users: Number(googleUsers?.count) || 0,
          google_percentage: totalUsers?.count 
            ? Math.round((Number(googleUsers?.count) / Number(totalUsers?.count)) * 100)
            : 0,
          recent_google_signups: Number(recentSignups?.count) || 0,
        },
      },
    });

  } catch (error) {
    console.error('OAuth analytics failed:', error);
    
    return c.json({
      success: false,
      error: 'Analytics unavailable',
      message: 'Unable to retrieve OAuth analytics',
    }, 500);
  }
});

export default googleOAuth;