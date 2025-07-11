import type { Env } from '../../types';
import { SecurityEvent } from './logger';

export interface DailyAnalytics {
  date: string;
  event_type: string;
  count: number;
  success_count: number;
  failure_count: number;
  unique_users: number;
  unique_ips: number;
  avg_response_time: number | null;
  created_at: string;
}

export interface SecuritySummary {
  total_events: number;
  success_rate: number;
  error_rate: number;
  unique_users: number;
  unique_ips: number;
  top_event_types: Array<{ event_type: string; count: number }>;
  avg_response_time: number;
  threats_detected: number;
  ips_blocked: number;
}

export class SecurityAnalyticsAggregator {
  private env: Env;
  
  constructor(env: Env) {
    this.env = env;
  }
  
  /**
   * Aggregate security events for a specific date
   */
  async aggregateDaily(date: string): Promise<void> {
    const startOfDay = new Date(date + 'T00:00:00.000Z').getTime();
    const endOfDay = new Date(date + 'T23:59:59.999Z').getTime();
    
    try {
      // Get all events for the day
      const results = await this.env.DB.prepare(`
        SELECT * FROM security_events
        WHERE timestamp >= ? AND timestamp <= ?
      `).bind(startOfDay, endOfDay).all();
      
      const events = results.results as any[];
      
      if (events.length === 0) {
        console.log(`No security events found for ${date}`);
        return;
      }
      
      // Group events by type
      const eventsByType = this.groupEventsByType(events);
      
      // Calculate aggregations for each event type
      for (const [eventType, eventList] of eventsByType) {
        const analytics = this.calculateDailyAnalytics(date, eventType, eventList);
        await this.storeDailyAnalytics(analytics);
      }
      
      console.log(`Aggregated ${events.length} security events for ${date}`);
      
    } catch (error) {
      console.error(`Failed to aggregate daily analytics for ${date}:`, error);
      throw error;
    }
  }
  
  /**
   * Run aggregation for yesterday (typically called by cron job)
   */
  async runDailyAggregation(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateString = yesterday.toISOString().split('T')[0];
    
    await this.aggregateDaily(dateString);
  }
  
  /**
   * Aggregate security events for a date range
   */
  async aggregateDateRange(startDate: string, endDate: string): Promise<void> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const promises: Promise<void>[] = [];
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateString = date.toISOString().split('T')[0];
      promises.push(this.aggregateDaily(dateString));
    }
    
    await Promise.all(promises);
  }
  
  /**
   * Get security summary for a date range
   */
  async getSecuritySummary(
    startDate: string, 
    endDate: string
  ): Promise<SecuritySummary> {
    try {
      const results = await this.env.DB.prepare(`
        SELECT 
          event_type,
          SUM(count) as total_count,
          SUM(success_count) as total_success,
          SUM(failure_count) as total_failure,
          AVG(avg_response_time) as avg_response_time,
          MAX(unique_users) as max_unique_users,
          MAX(unique_ips) as max_unique_ips
        FROM security_analytics
        WHERE date >= ? AND date <= ?
        GROUP BY event_type
        ORDER BY total_count DESC
      `).bind(startDate, endDate).all();
      
      const analytics = results.results as any[];
      
      const totalEvents = analytics.reduce((sum, row) => sum + row.total_count, 0);
      const totalSuccess = analytics.reduce((sum, row) => sum + row.total_success, 0);
      const totalFailure = analytics.reduce((sum, row) => sum + row.total_failure, 0);
      
      const successRate = totalEvents > 0 ? (totalSuccess / totalEvents) * 100 : 0;
      const errorRate = totalEvents > 0 ? (totalFailure / totalEvents) * 100 : 0;
      
      const responseTimeValues = analytics
        .map(row => row.avg_response_time)
        .filter(time => time !== null);
      const avgResponseTime = responseTimeValues.length > 0 
        ? responseTimeValues.reduce((sum, time) => sum + time, 0) / responseTimeValues.length 
        : 0;
      
      const uniqueUsers = Math.max(...analytics.map(row => row.max_unique_users || 0), 0);
      const uniqueIps = Math.max(...analytics.map(row => row.max_unique_ips || 0), 0);
      
      const topEventTypes = analytics
        .slice(0, 10)
        .map(row => ({
          event_type: row.event_type,
          count: row.total_count
        }));
      
      const threatsDetected = analytics
        .filter(row => row.event_type.includes('threat') || row.event_type.includes('detected'))
        .reduce((sum, row) => sum + row.total_count, 0);
      
      const ipsBlocked = analytics
        .filter(row => row.event_type.includes('blocked'))
        .reduce((sum, row) => sum + row.total_count, 0);
      
      return {
        total_events: totalEvents,
        success_rate: Math.round(successRate * 100) / 100,
        error_rate: Math.round(errorRate * 100) / 100,
        unique_users: uniqueUsers,
        unique_ips: uniqueIps,
        top_event_types: topEventTypes,
        avg_response_time: Math.round(avgResponseTime * 100) / 100,
        threats_detected: threatsDetected,
        ips_blocked: ipsBlocked
      };
      
    } catch (error) {
      console.error('Failed to get security summary:', error);
      return {
        total_events: 0,
        success_rate: 0,
        error_rate: 0,
        unique_users: 0,
        unique_ips: 0,
        top_event_types: [],
        avg_response_time: 0,
        threats_detected: 0,
        ips_blocked: 0
      };
    }
  }
  
  /**
   * Get daily analytics for a date range
   */
  async getDailyAnalytics(
    startDate: string, 
    endDate: string, 
    eventTypes?: string[]
  ): Promise<DailyAnalytics[]> {
    try {
      let query = `
        SELECT * FROM security_analytics
        WHERE date >= ? AND date <= ?
      `;
      const params: any[] = [startDate, endDate];
      
      if (eventTypes && eventTypes.length > 0) {
        const placeholders = eventTypes.map(() => '?').join(', ');
        query += ` AND event_type IN (${placeholders})`;
        params.push(...eventTypes);
      }
      
      query += ` ORDER BY date ASC, event_type ASC`;
      
      const results = await this.env.DB.prepare(query).bind(...params).all();
      
      return results.results.map(row => ({
        date: row.date as string,
        event_type: row.event_type as string,
        count: row.count as number,
        success_count: row.success_count as number,
        failure_count: row.failure_count as number,
        unique_users: row.unique_users as number,
        unique_ips: row.unique_ips as number,
        avg_response_time: row.avg_response_time as number | null,
        created_at: row.created_at as string
      }));
      
    } catch (error) {
      console.error('Failed to get daily analytics:', error);
      return [];
    }
  }
  
  /**
   * Get trend analysis for key metrics
   */
  async getTrendAnalysis(days: number = 30): Promise<{
    daily_totals: Array<{ date: string; total_events: number; success_rate: number }>;
    event_type_trends: Array<{ event_type: string; trend: 'up' | 'down' | 'stable'; change_percent: number }>;
    threat_trends: Array<{ date: string; threats: number; blocks: number }>;
  }> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    
    try {
      // Get daily totals
      const dailyTotals = await this.env.DB.prepare(`
        SELECT 
          date,
          SUM(count) as total_events,
          CASE 
            WHEN SUM(count) > 0 THEN (SUM(success_count) * 100.0 / SUM(count))
            ELSE 0 
          END as success_rate
        FROM security_analytics
        WHERE date >= ? AND date <= ?
        GROUP BY date
        ORDER BY date ASC
      `).bind(startDate, endDate).all();
      
      // Get event type trends
      const eventTypeTrends = await this.calculateEventTypeTrends(startDate, endDate);
      
      // Get threat trends
      const threatTrends = await this.env.DB.prepare(`
        SELECT 
          date,
          SUM(CASE WHEN event_type LIKE '%threat%' OR event_type LIKE '%detected%' THEN count ELSE 0 END) as threats,
          SUM(CASE WHEN event_type LIKE '%blocked%' THEN count ELSE 0 END) as blocks
        FROM security_analytics
        WHERE date >= ? AND date <= ?
        GROUP BY date
        ORDER BY date ASC
      `).bind(startDate, endDate).all();
      
      return {
        daily_totals: dailyTotals.results.map(row => ({
          date: row.date as string,
          total_events: row.total_events as number,
          success_rate: Math.round((row.success_rate as number) * 100) / 100
        })),
        event_type_trends: eventTypeTrends,
        threat_trends: threatTrends.results.map(row => ({
          date: row.date as string,
          threats: row.threats as number,
          blocks: row.blocks as number
        }))
      };
      
    } catch (error) {
      console.error('Failed to get trend analysis:', error);
      return {
        daily_totals: [],
        event_type_trends: [],
        threat_trends: []
      };
    }
  }
  
  /**
   * Group events by type
   */
  private groupEventsByType(events: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();
    
    events.forEach(event => {
      const eventType = event.event_type;
      if (!grouped.has(eventType)) {
        grouped.set(eventType, []);
      }
      grouped.get(eventType)!.push(event);
    });
    
    return grouped;
  }
  
  /**
   * Calculate daily analytics for an event type
   */
  private calculateDailyAnalytics(
    date: string, 
    eventType: string, 
    events: any[]
  ): DailyAnalytics {
    const successCount = events.filter(e => e.success).length;
    const failureCount = events.length - successCount;
    
    const uniqueUsers = new Set(
      events.map(e => e.user_id).filter(id => id !== null && id !== undefined)
    ).size;
    
    const uniqueIps = new Set(
      events.map(e => e.ip_address).filter(ip => ip !== null && ip !== undefined)
    ).size;
    
    // Calculate average response time from metadata
    const responseTimes = events
      .map(e => {
        try {
          const metadata = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata;
          return metadata?.response_time;
        } catch {
          return null;
        }
      })
      .filter(time => typeof time === 'number') as number[];
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : null;
    
    return {
      date,
      event_type: eventType,
      count: events.length,
      success_count: successCount,
      failure_count: failureCount,
      unique_users: uniqueUsers,
      unique_ips: uniqueIps,
      avg_response_time: avgResponseTime,
      created_at: new Date().toISOString()
    };
  }
  
  /**
   * Store daily analytics in database
   */
  private async storeDailyAnalytics(analytics: DailyAnalytics): Promise<void> {
    await this.env.DB.prepare(`
      INSERT OR REPLACE INTO security_analytics (
        date, event_type, count, success_count, failure_count,
        unique_users, unique_ips, avg_response_time, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      analytics.date,
      analytics.event_type,
      analytics.count,
      analytics.success_count,
      analytics.failure_count,
      analytics.unique_users,
      analytics.unique_ips,
      analytics.avg_response_time,
      analytics.created_at
    ).run();
  }
  
  /**
   * Calculate event type trends
   */
  private async calculateEventTypeTrends(
    startDate: string, 
    endDate: string
  ): Promise<Array<{ event_type: string; trend: 'up' | 'down' | 'stable'; change_percent: number }>> {
    const results = await this.env.DB.prepare(`
      SELECT 
        event_type,
        SUM(count) as total_count,
        date
      FROM security_analytics
      WHERE date >= ? AND date <= ?
      GROUP BY event_type, date
      ORDER BY event_type, date
    `).bind(startDate, endDate).all();
    
    const eventTypeData = new Map<string, number[]>();
    
    results.results.forEach((row: any) => {
      const eventType = row.event_type;
      if (!eventTypeData.has(eventType)) {
        eventTypeData.set(eventType, []);
      }
      eventTypeData.get(eventType)!.push(row.total_count);
    });
    
    const trends: Array<{ event_type: string; trend: 'up' | 'down' | 'stable'; change_percent: number }> = [];
    
    eventTypeData.forEach((counts, eventType) => {
      if (counts.length < 2) {
        trends.push({ event_type: eventType, trend: 'stable', change_percent: 0 });
        return;
      }
      
      const firstHalf = counts.slice(0, Math.floor(counts.length / 2));
      const secondHalf = counts.slice(Math.floor(counts.length / 2));
      
      const firstAvg = firstHalf.reduce((sum, count) => sum + count, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, count) => sum + count, 0) / secondHalf.length;
      
      const changePercent = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
      
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (Math.abs(changePercent) > 10) {
        trend = changePercent > 0 ? 'up' : 'down';
      }
      
      trends.push({
        event_type: eventType,
        trend,
        change_percent: Math.round(changePercent * 100) / 100
      });
    });
    
    return trends.sort((a, b) => Math.abs(b.change_percent) - Math.abs(a.change_percent));
  }
}