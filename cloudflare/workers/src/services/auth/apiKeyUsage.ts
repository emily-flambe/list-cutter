import type { Env } from '../../types';

export interface APIKeyUsageData {
  key_id: string;
  timestamp: number;
  endpoint: string;
  method: string;
  ip_address?: string;
  user_agent?: string;
  response_status: number;
  response_time: number;
}

export class APIKeyUsageTracker {
  private env: Env;
  
  constructor(env: Env) {
    this.env = env;
  }
  
  async trackUsage(
    keyId: string,
    request: Request,
    responseStatus: number,
    responseTime: number
  ): Promise<void> {
    const url = new URL(request.url);
    const ipAddress = this.getClientIP(request);
    
    try {
      await this.env.DB.prepare(`
        INSERT INTO api_key_usage (
          key_id, timestamp, endpoint, method, ip_address, 
          user_agent, response_status, response_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        keyId,
        Date.now(),
        url.pathname,
        request.method,
        ipAddress,
        request.headers.get('User-Agent') || 'unknown',
        responseStatus,
        responseTime
      ).run();
      
    } catch (error) {
      console.error('Failed to track API key usage:', error);
      // Don't throw - usage tracking failures shouldn't break the application
    }
  }
  
  async getUsageStats(keyId: string, days: number = 30): Promise<any> {
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    try {
      const stats = await this.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN response_status >= 200 AND response_status < 300 THEN 1 END) as successful_requests,
          COUNT(CASE WHEN response_status >= 400 THEN 1 END) as error_requests,
          AVG(response_time) as avg_response_time,
          MAX(response_time) as max_response_time,
          MIN(timestamp) as first_request,
          MAX(timestamp) as last_request,
          COUNT(DISTINCT ip_address) as unique_ips,
          COUNT(DISTINCT endpoint) as unique_endpoints
        FROM api_key_usage
        WHERE key_id = ? AND timestamp > ?
      `).bind(keyId, since).first();
      
      return stats;
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      return null;
    }
  }
  
  async getRecentUsage(keyId: string, limit: number = 100): Promise<APIKeyUsageData[]> {
    try {
      const results = await this.env.DB.prepare(`
        SELECT * FROM api_key_usage
        WHERE key_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `).bind(keyId, limit).all();
      
      return results.results.map(row => ({
        key_id: row.key_id as string,
        timestamp: row.timestamp as number,
        endpoint: row.endpoint as string,
        method: row.method as string,
        ip_address: row.ip_address as string,
        user_agent: row.user_agent as string,
        response_status: row.response_status as number,
        response_time: row.response_time as number
      }));
      
    } catch (error) {
      console.error('Failed to get recent usage:', error);
      return [];
    }
  }
  
  async getEndpointStats(keyId: string, days: number = 30): Promise<any[]> {
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    try {
      const results = await this.env.DB.prepare(`
        SELECT 
          endpoint,
          method,
          COUNT(*) as request_count,
          COUNT(CASE WHEN response_status >= 200 AND response_status < 300 THEN 1 END) as success_count,
          COUNT(CASE WHEN response_status >= 400 THEN 1 END) as error_count,
          AVG(response_time) as avg_response_time
        FROM api_key_usage
        WHERE key_id = ? AND timestamp > ?
        GROUP BY endpoint, method
        ORDER BY request_count DESC
      `).bind(keyId, since).all();
      
      return results.results;
    } catch (error) {
      console.error('Failed to get endpoint stats:', error);
      return [];
    }
  }
  
  async getHourlyUsage(keyId: string, days: number = 7): Promise<any[]> {
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    try {
      const results = await this.env.DB.prepare(`
        SELECT 
          strftime('%Y-%m-%d %H:00:00', datetime(timestamp/1000, 'unixepoch')) as hour,
          COUNT(*) as request_count,
          COUNT(CASE WHEN response_status >= 200 AND response_status < 300 THEN 1 END) as success_count,
          COUNT(CASE WHEN response_status >= 400 THEN 1 END) as error_count,
          AVG(response_time) as avg_response_time
        FROM api_key_usage
        WHERE key_id = ? AND timestamp > ?
        GROUP BY hour
        ORDER BY hour DESC
      `).bind(keyId, since).all();
      
      return results.results;
    } catch (error) {
      console.error('Failed to get hourly usage:', error);
      return [];
    }
  }
  
  async getTopUserAgents(keyId: string, days: number = 30, limit: number = 10): Promise<any[]> {
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    try {
      const results = await this.env.DB.prepare(`
        SELECT 
          user_agent,
          COUNT(*) as request_count,
          COUNT(CASE WHEN response_status >= 200 AND response_status < 300 THEN 1 END) as success_count
        FROM api_key_usage
        WHERE key_id = ? AND timestamp > ? AND user_agent != 'unknown'
        GROUP BY user_agent
        ORDER BY request_count DESC
        LIMIT ?
      `).bind(keyId, since, limit).all();
      
      return results.results;
    } catch (error) {
      console.error('Failed to get top user agents:', error);
      return [];
    }
  }
  
  async getTopIPs(keyId: string, days: number = 30, limit: number = 10): Promise<any[]> {
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    try {
      const results = await this.env.DB.prepare(`
        SELECT 
          ip_address,
          COUNT(*) as request_count,
          COUNT(CASE WHEN response_status >= 200 AND response_status < 300 THEN 1 END) as success_count
        FROM api_key_usage
        WHERE key_id = ? AND timestamp > ? AND ip_address != 'unknown'
        GROUP BY ip_address
        ORDER BY request_count DESC
        LIMIT ?
      `).bind(keyId, since, limit).all();
      
      return results.results;
    } catch (error) {
      console.error('Failed to get top IPs:', error);
      return [];
    }
  }
  
  /**
   * Clean up old usage data to prevent database bloat
   */
  async cleanupOldUsage(retentionDays: number = 90): Promise<void> {
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    
    try {
      const result = await this.env.DB.prepare(`
        DELETE FROM api_key_usage WHERE timestamp < ?
      `).bind(cutoffTime).run();
      
      console.log(`Cleaned up ${result.changes} old API key usage records`);
    } catch (error) {
      console.error('Failed to cleanup old usage data:', error);
    }
  }
  
  private getClientIP(request: Request): string {
    return request.headers.get('CF-Connecting-IP') || 
           request.headers.get('X-Forwarded-For') || 
           request.headers.get('X-Real-IP') ||
           'unknown';
  }
}