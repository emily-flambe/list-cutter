import type { Env } from '../../types';

/**
 * Simple metrics collector for authentication and authorization events
 */
export class MetricsCollector {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Record authentication metrics
   * @param operation Operation type (login, register, refresh, logout)
   * @param duration Operation duration in milliseconds
   * @param success Whether operation was successful
   * @param userId User ID if known
   */
  async recordAuthMetrics(
    operation: string,
    duration: number,
    success: boolean,
    userId?: number
  ): Promise<void> {
    try {
      const metric = {
        timestamp: Date.now(),
        operation,
        duration,
        success,
        user_id: userId,
        response_status: success ? 200 : 400
      };

      // Log to console in development/test
      if (this.env.ENVIRONMENT === 'development' || this.env.ENVIRONMENT === 'test') {
        console.log('Auth Metrics:', JSON.stringify(metric, null, 2));
      }

      // Store in Analytics Engine if available
      if (this.env.ANALYTICS) {
        await this.env.ANALYTICS.writeDataPoint({
          blobs: [operation, success ? 'success' : 'failure'],
          doubles: [duration],
          indexes: [userId?.toString() || 'anonymous']
        });
      }

      // Store in KV if available
      if (this.env.CUTTY_SECURITY_METRICS) {
        const metricKey = `auth_metric:${Date.now()}:${crypto.randomUUID()}`;
        await this.env.CUTTY_SECURITY_METRICS.put(
          metricKey,
          JSON.stringify(metric),
          { expirationTtl: 86400 * 7 } // 7 days retention for metrics
        );
      }
    } catch (error) {
      console.error('Failed to record auth metrics:', error);
    }
  }

  /**
   * Record API key usage metrics
   * @param keyId API key ID
   * @param operation Operation performed
   * @param success Whether operation was successful
   * @param duration Operation duration in milliseconds
   */
  async recordAPIKeyMetrics(
    keyId: string,
    operation: string,
    success: boolean,
    duration: number
  ): Promise<void> {
    try {
      const metric = {
        timestamp: Date.now(),
        key_id: keyId,
        operation,
        success,
        duration,
        response_status: success ? 200 : 400
      };

      // Log to console in development/test
      if (this.env.ENVIRONMENT === 'development' || this.env.ENVIRONMENT === 'test') {
        console.log('API Key Metrics:', JSON.stringify(metric, null, 2));
      }

      // Store in Analytics Engine if available
      if (this.env.ANALYTICS) {
        await this.env.ANALYTICS.writeDataPoint({
          blobs: ['api_key', operation, success ? 'success' : 'failure'],
          doubles: [duration],
          indexes: [keyId]
        });
      }
    } catch (error) {
      console.error('Failed to record API key metrics:', error);
    }
  }
}