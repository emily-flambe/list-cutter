import type { Env } from '../../types';

/**
 * Security event logger for authentication and authorization events
 */
export class SecurityLogger {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Log authentication event
   * @param eventType Type of auth event (login, logout, registration, etc.)
   * @param request Original request object
   * @param success Whether the auth attempt was successful
   * @param userId User ID if known
   * @param errorCode Error code if failed
   * @param errorMessage Error message if failed
   * @param metadata Additional event metadata
   */
  async logAuthEvent(
    eventType: string,
    request: Request,
    success: boolean,
    userId?: string,
    errorCode?: string,
    errorMessage?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const event = {
        timestamp: Date.now(),
        event_type: eventType,
        user_id: userId,
        ip_address: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown',
        user_agent: request.headers.get('User-Agent') || 'unknown',
        success,
        error_code: errorCode,
        error_message: errorMessage,
        metadata: {
          url: new URL(request.url).pathname,
          method: request.method,
          ...metadata
        }
      };

      // Log to console in development/test
      if (this.env.ENVIRONMENT === 'development' || this.env.ENVIRONMENT === 'test') {
        console.log('Security Event:', JSON.stringify(event, null, 2));
      }

      // Store in KV if available
      if (this.env.CUTTY_SECURITY_EVENTS) {
        const eventKey = `security_event:${Date.now()}:${crypto.randomUUID()}`;
        await this.env.CUTTY_SECURITY_EVENTS.put(
          eventKey,
          JSON.stringify(event),
          { expirationTtl: 86400 * 30 } // 30 days retention
        );
      }
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Log general security event
   * @param event Security event data
   */
  async logEvent(event: {
    timestamp: number;
    event_type: string;
    user_id?: number;
    success: boolean;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      // Log to console in development/test
      if (this.env.ENVIRONMENT === 'development' || this.env.ENVIRONMENT === 'test') {
        console.log('Security Event:', JSON.stringify(event, null, 2));
      }

      // Store in KV if available
      if (this.env.CUTTY_SECURITY_EVENTS) {
        const eventKey = `security_event:${event.timestamp}:${crypto.randomUUID()}`;
        await this.env.CUTTY_SECURITY_EVENTS.put(
          eventKey,
          JSON.stringify(event),
          { expirationTtl: 86400 * 30 } // 30 days retention
        );
      }
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }
}