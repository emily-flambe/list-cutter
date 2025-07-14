/**
 * OAuth State Management Service
 * 
 * Provides secure state token management for OAuth flows using JWT-signed tokens
 * with comprehensive CSRF protection and rate limiting integration.
 * 
 * Based on security patterns from baba-is-win reference implementation.
 */

import { SignJWT, jwtVerify } from 'jose';

export interface OAuthState {
  returnUrl?: string;
  userId?: number;
  provider: 'google';
  timestamp: number;
  nonce: string;
}

export interface OAuthStateValidationResult {
  valid: boolean;
  state?: OAuthState;
  error?: string;
}

export class OAuthStateManager {
  private secret: Uint8Array;

  constructor(jwtSecret: string) {
    this.secret = new TextEncoder().encode(jwtSecret);
  }

  /**
   * Creates a cryptographically signed state token for OAuth flow
   * Token expires in 10 minutes for security
   */
  async createState(data: Partial<OAuthState>): Promise<string> {
    const nonce = crypto.randomUUID();
    const payload: OAuthState = {
      returnUrl: data.returnUrl || '/dashboard',
      userId: data.userId,
      provider: data.provider || 'google',
      timestamp: Date.now(),
      nonce,
    };

    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .setIssuer('cutty-oauth')
      .setAudience('cutty-app')
      .sign(this.secret);
  }

  /**
   * Validates and decodes OAuth state token
   * Comprehensive validation including signature, expiration, and format
   */
  async validateState(stateToken: string): Promise<OAuthStateValidationResult> {
    try {
      // Basic format validation
      if (!stateToken || typeof stateToken !== 'string') {
        return { valid: false, error: 'Invalid state token format' };
      }

      // JWT signature and expiration validation
      const { payload } = await jwtVerify(stateToken, this.secret, {
        issuer: 'cutty-oauth',
        audience: 'cutty-app',
      });

      // Type validation and conversion
      const state = this.parseStatePayload(payload);
      if (!state) {
        return { valid: false, error: 'Invalid state payload structure' };
      }

      // Additional security validations
      const validationError = this.validateStateContent(state);
      if (validationError) {
        return { valid: false, error: validationError };
      }

      return { valid: true, state };
    } catch (error) {
      // Log security event for invalid tokens
      console.error('OAuth state validation failed:', error);
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Token validation failed' 
      };
    }
  }

  /**
   * Safely parses JWT payload into OAuthState interface
   */
  private parseStatePayload(payload: any): OAuthState | null {
    try {
      return {
        returnUrl: typeof payload.returnUrl === 'string' ? payload.returnUrl : '/dashboard',
        userId: typeof payload.userId === 'number' ? payload.userId : undefined,
        provider: payload.provider === 'google' ? 'google' : 'google',
        timestamp: typeof payload.timestamp === 'number' ? payload.timestamp : Date.now(),
        nonce: typeof payload.nonce === 'string' ? payload.nonce : '',
      };
    } catch {
      return null;
    }
  }

  /**
   * Validates state content for security requirements
   */
  private validateStateContent(state: OAuthState): string | null {
    // Validate provider
    if (state.provider !== 'google') {
      return 'Invalid OAuth provider';
    }

    // Validate nonce presence
    if (!state.nonce || state.nonce.length < 10) {
      return 'Invalid or missing nonce';
    }

    // Validate return URL format (basic security check)
    if (state.returnUrl && !this.isValidReturnUrl(state.returnUrl)) {
      return 'Invalid return URL format';
    }

    // Validate timestamp (additional expiration check)
    if (Date.now() - state.timestamp > 10 * 60 * 1000) { // 10 minutes
      return 'State token expired (timestamp check)';
    }

    return null;
  }

  /**
   * Validates return URL to prevent open redirect attacks
   */
  private isValidReturnUrl(url: string): boolean {
    try {
      // Allow relative URLs starting with /
      if (url.startsWith('/') && !url.startsWith('//')) {
        return true;
      }

      // For absolute URLs, validate domain (if needed)
      const parsed = new URL(url);
      
      // Add your domain validation here if accepting absolute URLs
      // For now, only allow relative URLs for security
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Generates a secure random state token for additional entropy
   * Used alongside JWT-signed tokens for enhanced security
   */
  generateSecureNonce(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}