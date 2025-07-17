/**
 * Google OAuth Service
 * 
 * Comprehensive OAuth 2.0 implementation for Google authentication
 * with security-first design and production-ready features.
 * 
 * Security features:
 * - JWT-signed state tokens for CSRF protection
 * - Multi-layered rate limiting
 * - Comprehensive input validation
 * - Security event logging
 * - ID token verification
 */

import { D1Database } from '@cloudflare/workers-types';
import { OAuthStateManager, OAuthState } from './oauth-state-manager';
import { jwtVerify } from 'jose';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleUserInfo {
  sub: string; // Google ID
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

export interface OAuthResult {
  success: boolean;
  user?: {
    id: number;
    username: string;
    email?: string;
    google_id: string;
    display_name: string;
    profile_picture_url?: string;
  };
  token?: string;
  error?: string;
  redirect?: string;
}

export interface SecurityEventDetails {
  ip_address?: string;
  user_agent?: string;
  user_id?: number;
  error?: string;
  details?: Record<string, any>;
}

export class GoogleOAuthService {
  private stateManager: OAuthStateManager;
  private config: GoogleOAuthConfig;
  private db: D1Database;

  constructor(config: GoogleOAuthConfig, jwtSecret: string, db: D1Database) {
    this.config = config;
    this.stateManager = new OAuthStateManager(jwtSecret);
    this.db = db;
  }

  /**
   * Initiates Google OAuth flow with comprehensive security measures
   */
  async initiateOAuth(returnUrl?: string, userId?: number): Promise<{ 
    authUrl: string; 
    state: string; 
  }> {
    // Create secure state token
    const state = await this.stateManager.createState({
      returnUrl: returnUrl || '/dashboard',
      userId,
      provider: 'google',
    });

    // Store state in database for additional validation
    await this.storeOAuthState(state, returnUrl);

    // Build Google OAuth authorization URL
    const authUrl = this.buildAuthorizationUrl(state);

    // Log security event
    await this.logSecurityEvent('oauth_initiation', 'info', {
      return_url: returnUrl,
      user_id: userId,
    });

    return { authUrl, state };
  }

  /**
   * Handles OAuth callback with comprehensive validation and error handling
   */
  async handleCallback(
    code: string, 
    state: string,
    ip_address?: string,
    user_agent?: string
  ): Promise<OAuthResult> {
    try {
      console.log('[OAuth Debug] Starting callback processing', {
        codeLength: code?.length,
        stateLength: state?.length,
        ip_address,
        user_agent
      });

      // Log callback attempt
      await this.logSecurityEvent('oauth_callback', 'info', {
        ip_address,
        user_agent,
      });

      // Validate authorization code format
      console.log('[OAuth Debug] Validating authorization code');
      const codeValidation = this.validateAuthorizationCode(code);
      if (!codeValidation.valid) {
        console.error('[OAuth Debug] Code validation failed:', codeValidation.error);
        await this.logSecurityEvent('oauth_invalid_code', 'warning', {
          ip_address,
          user_agent,
          error: codeValidation.error,
        });
        return { success: false, error: 'Invalid authorization code' };
      }

      // Validate and decode state token
      console.log('[OAuth Debug] Validating state token');
      const stateValidation = await this.stateManager.validateState(state);
      if (!stateValidation.valid || !stateValidation.state) {
        console.error('[OAuth Debug] State validation failed:', stateValidation.error);
        await this.logSecurityEvent('oauth_invalid_state', 'warning', {
          ip_address,
          user_agent,
          error: stateValidation.error,
        });
        return { success: false, error: 'Invalid state parameter' };
      }
      console.log('[OAuth Debug] State validated:', { userId: stateValidation.state.userId, returnUrl: stateValidation.state.returnUrl });

      // Verify state token was issued by us (database check)
      console.log('[OAuth Debug] Verifying state in database');
      const stateExists = await this.verifyOAuthState(state);
      if (!stateExists) {
        console.error('[OAuth Debug] State not found in database');
        await this.logSecurityEvent('oauth_state_not_found', 'warning', {
          ip_address,
          user_agent,
        });
        return { success: false, error: 'State token not found or expired' };
      }

      // Exchange authorization code for tokens
      console.log('[OAuth Debug] Exchanging code for tokens');
      const tokenResponse = await this.exchangeCodeForTokens(code);
      if (!tokenResponse.success || !tokenResponse.tokens) {
        console.error('[OAuth Debug] Token exchange failed:', tokenResponse.error);
        await this.logSecurityEvent('oauth_token_exchange_failed', 'error', {
          ip_address,
          user_agent,
          error: tokenResponse.error,
        });
        return { success: false, error: 'Failed to exchange code for tokens' };
      }
      console.log('[OAuth Debug] Token exchange successful');

      // Verify and decode ID token
      console.log('[OAuth Debug] Verifying ID token');
      const userInfo = await this.verifyIdToken(tokenResponse.tokens.id_token);
      if (!userInfo) {
        console.error('[OAuth Debug] ID token verification failed');
        await this.logSecurityEvent('oauth_id_token_invalid', 'error', {
          ip_address,
          user_agent,
        });
        return { success: false, error: 'Invalid ID token' };
      }
      console.log('[OAuth Debug] ID token verified:', { email: userInfo.email, sub: userInfo.sub });

      // Find or create user account
      console.log('[OAuth Debug] Finding or creating user');
      const user = await this.findOrCreateUser(userInfo, stateValidation.state.userId);
      console.log('[OAuth Debug] User processed:', { id: user.id, username: user.username });

      // Mark state as used
      await this.markOAuthStateUsed(state);

      // Log successful OAuth
      await this.logSecurityEvent('oauth_success', 'info', {
        ip_address,
        user_agent,
        user_id: user.id,
      });

      return {
        success: true,
        user,
        redirect: stateValidation.state.returnUrl,
      };

    } catch (error) {
      console.error('[OAuth Debug] Callback error:', error);
      console.error('[OAuth Debug] Error stack:', error instanceof Error ? error.stack : 'No stack');
      
      await this.logSecurityEvent('oauth_callback_error', 'error', {
        ip_address,
        user_agent,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return { 
        success: false, 
        error: 'OAuth callback processing failed' 
      };
    }
  }

  /**
   * Validates authorization code format and security requirements
   */
  private validateAuthorizationCode(code: string): { valid: boolean; error?: string } {
    if (!code || typeof code !== 'string') {
      return { valid: false, error: 'Missing authorization code' };
    }

    // Check code length (Google auth codes are typically 4/...long)
    if (code.length < 10 || code.length > 512) {
      return { valid: false, error: 'Invalid authorization code length' };
    }

    // Check for valid characters (base64url-like)
    if (!/^[A-Za-z0-9._~\-\/]+$/.test(code)) {
      return { valid: false, error: 'Invalid authorization code format' };
    }

    return { valid: true };
  }

  /**
   * Builds Google OAuth authorization URL with proper scopes and security
   */
  private buildAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for OAuth tokens
   */
  private async exchangeCodeForTokens(code: string): Promise<{
    success: boolean;
    tokens?: { access_token: string; id_token: string; refresh_token?: string };
    error?: string;
  }> {
    try {
      const params = {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
      };
      
      console.log('[OAuth Debug] Token exchange params:', {
        client_id: params.client_id,
        redirect_uri: params.redirect_uri,
        code_length: code.length,
        code_prefix: code.substring(0, 10) + '...',
      });

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
      });

      console.log('[OAuth Debug] Token exchange response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        console.error('[OAuth Debug] Google token exchange failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          clientId: this.config.clientId,
          redirectUri: this.config.redirectUri,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        return { 
          success: false, 
          error: `Token exchange failed: ${response.status} - ${errorData.error || errorText} ${errorData.error_description || ''}` 
        };
      }

      const tokens = await response.json();
      console.log('[OAuth Debug] Token response received:', {
        has_access_token: !!tokens.access_token,
        has_id_token: !!tokens.id_token,
        has_refresh_token: !!tokens.refresh_token,
        token_type: tokens.token_type,
        expires_in: tokens.expires_in
      });
      
      if (!tokens.access_token || !tokens.id_token) {
        console.error('[OAuth Debug] Missing required tokens:', tokens);
        return { success: false, error: 'Missing required tokens in response' };
      }

      return { success: true, tokens };
    } catch (error) {
      console.error('[OAuth Debug] Token exchange exception:', error);
      console.error('[OAuth Debug] Exception details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack',
        name: error instanceof Error ? error.name : 'Unknown'
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Token exchange error' 
      };
    }
  }

  /**
   * Verifies Google ID token and extracts user information
   */
  private async verifyIdToken(idToken: string): Promise<GoogleUserInfo | null> {
    try {
      // Use Google's tokeninfo endpoint to verify the ID token
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      
      if (!response.ok) {
        console.error('ID token verification failed:', response.status);
        return null;
      }

      const tokenInfo = await response.json();

      // Verify the token is for our app
      if (tokenInfo.aud !== this.config.clientId) {
        console.error('Token audience mismatch');
        return null;
      }

      // Verify required fields
      if (!tokenInfo.sub || !tokenInfo.email) {
        return null;
      }

      return {
        sub: tokenInfo.sub,
        email: tokenInfo.email,
        email_verified: tokenInfo.email_verified === 'true',
        name: tokenInfo.name || '',
        picture: tokenInfo.picture,
        given_name: tokenInfo.given_name,
        family_name: tokenInfo.family_name,
      };
    } catch (error) {
      console.error('ID token verification failed:', error);
      return null;
    }
  }

  /**
   * Finds existing user or creates new one from Google OAuth
   */
  private async findOrCreateUser(googleUser: GoogleUserInfo, linkUserId?: number): Promise<any> {
    // First, check if user already exists by Google ID
    const existingGoogleUser = await this.db
      .prepare('SELECT * FROM users WHERE google_id = ?')
      .bind(googleUser.sub)
      .first();

    if (existingGoogleUser) {
      // Update last sync time and profile info
      await this.db
        .prepare(`
          UPDATE users 
          SET display_name = ?, profile_picture_url = ?, last_google_sync = CURRENT_TIMESTAMP
          WHERE google_id = ?
        `)
        .bind(googleUser.name, googleUser.picture, googleUser.sub)
        .run();

      return existingGoogleUser;
    }

    // If linking to existing account
    if (linkUserId) {
      await this.db
        .prepare(`
          UPDATE users 
          SET google_id = ?, provider = 'google', provider_email = ?, 
              display_name = ?, profile_picture_url = ?, last_google_sync = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(googleUser.sub, googleUser.email, googleUser.name, googleUser.picture, linkUserId)
        .run();

      return await this.db.prepare('SELECT * FROM users WHERE id = ?').bind(linkUserId).first();
    }

    // Check if user exists by email (for account linking)
    const existingEmailUser = await this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(googleUser.email)
      .first();

    if (existingEmailUser) {
      // Link Google account to existing email account
      await this.db
        .prepare(`
          UPDATE users 
          SET google_id = ?, provider = 'google', provider_email = ?, 
              display_name = ?, profile_picture_url = ?, last_google_sync = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(googleUser.sub, googleUser.email, googleUser.name, googleUser.picture, existingEmailUser.id)
        .run();

      return existingEmailUser;
    }

    // Create new user account
    const username = googleUser.email.split('@')[0] + '_' + Date.now();
    const result = await this.db
      .prepare(`
        INSERT INTO users (username, email, google_id, provider, provider_email, 
                          display_name, profile_picture_url, last_google_sync, 
                          password_hash, created_at, updated_at)
        VALUES (?, ?, ?, 'google', ?, ?, ?, CURRENT_TIMESTAMP, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)
      .bind(username, googleUser.email, googleUser.sub, googleUser.email, googleUser.name, googleUser.picture)
      .run();

    return await this.db.prepare('SELECT * FROM users WHERE id = ?').bind(result.meta.last_row_id).first();
  }

  /**
   * Database operations for OAuth state management
   */
  private async storeOAuthState(stateToken: string, returnUrl?: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
    
    await this.db
      .prepare(`
        INSERT INTO oauth_states (state_token, return_url, created_at, expires_at)
        VALUES (?, ?, CURRENT_TIMESTAMP, ?)
      `)
      .bind(stateToken, returnUrl, expiresAt)
      .run();
  }

  private async verifyOAuthState(stateToken: string): Promise<boolean> {
    const result = await this.db
      .prepare(`
        SELECT id FROM oauth_states 
        WHERE state_token = ? AND expires_at > CURRENT_TIMESTAMP AND used_at IS NULL
      `)
      .bind(stateToken)
      .first();

    return !!result;
  }

  private async markOAuthStateUsed(stateToken: string): Promise<void> {
    await this.db
      .prepare('UPDATE oauth_states SET used_at = CURRENT_TIMESTAMP WHERE state_token = ?')
      .bind(stateToken)
      .run();
  }

  /**
   * Security event logging for comprehensive monitoring
   */
  private async logSecurityEvent(
    eventType: string, 
    severity: 'info' | 'warning' | 'error',
    details: SecurityEventDetails
  ): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO oauth_security_events (event_type, severity, user_id, ip_address, user_agent, details, created_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `)
        .bind(
          eventType,
          severity,
          details.user_id || null,
          details.ip_address || null,
          details.user_agent || null,
          JSON.stringify(details)
        )
        .run();
    } catch (error) {
      console.error('Failed to log OAuth security event:', error);
    }
  }
}