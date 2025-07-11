/**
 * Alert Analytics Service
 * Provides analytics and reporting capabilities for the alerting system
 */

import {
  AlertAnalytics,
  TimeSeriesData,
  AlertTypeAnalytics,
  UserAlertAnalytics,
  AlertFrequencyData,
  AlertDurationData,
  // AlertMetricsQuery
} from '../../types/alerts.js';

export class AlertAnalyticsService {
  constructor(
    private db: D1Database,
    private analytics: AnalyticsEngineDataset
  ) {}

  /**
   * Get comprehensive alert analytics
   */
  async getAlertAnalytics(
    userId?: string,
    timeRange: { startTime: string; endTime: string } = {
      startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date().toISOString()
    }
  ): Promise<AlertAnalytics> {
    // const _userFilter = userId ? 'AND ar.user_id = ?' : '';
    // const _baseParams = userId ? [timeRange.startTime, timeRange.endTime, userId] : [timeRange.startTime, timeRange.endTime];

    // Get alert volume over time
    const alertVolume = await this.getAlertVolumeTimeSeries(timeRange, userId);
    
    // Get alert resolution time trends
    const alertResolutionTime = await this.getResolutionTimeTimeSeries(timeRange, userId);
    
    // Get analytics by alert type
    const alertsByType = await this.getAlertAnalyticsByType(timeRange, userId);
    
    // Get analytics by user
    const alertsByUser = await this.getAlertAnalyticsByUser(timeRange);
    
    // Calculate performance metrics
    const performanceMetrics = await this.calculatePerformanceMetrics(timeRange, userId);
    
    // Get trend analysis
    const trends = await this.calculateTrends(timeRange, userId);
    
    // Get top alerts by frequency and duration
    const topAlertsByFrequency = await this.getTopAlertsByFrequency(timeRange, userId);
    const topAlertsByDuration = await this.getTopAlertsByDuration(timeRange, userId);

    return {
      alertVolume,
      alertResolutionTime,
      alertsByType,
      alertsByUser: userId ? [] : alertsByUser, // Don't show other users if filtered by user
      falsePositiveRate: performanceMetrics.falsePositiveRate,
      averageResolutionTime: performanceMetrics.averageResolutionTime,
      escalationRate: performanceMetrics.escalationRate,
      weekOverWeekChange: trends.weekOverWeekChange,
      monthOverMonthChange: trends.monthOverMonthChange,
      topAlertsByFrequency,
      topAlertsByDuration
    };
  }

  /**
   * Get alert volume time series data
   */
  private async getAlertVolumeTimeSeries(
    timeRange: { startTime: string; endTime: string },
    userId?: string
  ): Promise<TimeSeriesData[]> {
    const userFilter = userId ? 'AND ar.user_id = ?' : '';
    const params = userId ? [timeRange.startTime, timeRange.endTime, userId] : [timeRange.startTime, timeRange.endTime];

    const results = await this.db.prepare(`
      SELECT 
        date(ai.started_at) as date,
        strftime('%H', ai.started_at) as hour,
        COUNT(*) as value
      FROM alert_instances ai
      JOIN alert_rules ar ON ai.alert_rule_id = ar.id
      WHERE ai.started_at >= ? AND ai.started_at <= ? ${userFilter}
      GROUP BY date(ai.started_at), strftime('%H', ai.started_at)
      ORDER BY ai.started_at
    `).bind(...params).all();

    return results.results.map((row: DatabaseRow) => ({
      timestamp: `${row.date}T${String(row.hour).padStart(2, '0')}:00:00.000Z`,
      value: row.value
    }));
  }

  /**
   * Get alert resolution time time series
   */
  private async getResolutionTimeTimeSeries(
    timeRange: { startTime: string; endTime: string },
    userId?: string
  ): Promise<TimeSeriesData[]> {
    const userFilter = userId ? 'AND ar.user_id = ?' : '';
    const params = userId ? [timeRange.startTime, timeRange.endTime, userId] : [timeRange.startTime, timeRange.endTime];

    const results = await this.db.prepare(`
      SELECT 
        date(ai.resolved_at) as date,
        AVG(
          (julianday(ai.resolved_at) - julianday(ai.started_at)) * 24 * 60
        ) as value
      FROM alert_instances ai
      JOIN alert_rules ar ON ai.alert_rule_id = ar.id
      WHERE ai.resolved_at IS NOT NULL 
        AND ai.resolved_at >= ? AND ai.resolved_at <= ? ${userFilter}
      GROUP BY date(ai.resolved_at)
      ORDER BY ai.resolved_at
    `).bind(...params).all();

    return results.results.map((row: DatabaseRow) => ({
      timestamp: `${row.date}T00:00:00.000Z`,
      value: row.value ?? 0
    }));
  }

  /**
   * Get alert analytics by type
   */
  private async getAlertAnalyticsByType(
    timeRange: { startTime: string; endTime: string },
    userId?: string
  ): Promise<AlertTypeAnalytics[]> {
    const userFilter = userId ? 'AND ar.user_id = ?' : '';
    const params = userId ? [timeRange.startTime, timeRange.endTime, userId] : [timeRange.startTime, timeRange.endTime];

    const results = await this.db.prepare(`
      SELECT 
        ar.alert_type,
        COUNT(ai.id) as total_alerts,
        AVG(
          CASE WHEN ai.resolved_at IS NOT NULL 
          THEN (julianday(ai.resolved_at) - julianday(ai.started_at)) * 24 * 60
          END
        ) as avg_resolution_time,
        COUNT(CASE WHEN ai.state = 'resolved' AND ai.notes LIKE '%false positive%' THEN 1 END) as false_positives
      FROM alert_instances ai
      JOIN alert_rules ar ON ai.alert_rule_id = ar.id
      WHERE ai.started_at >= ? AND ai.started_at <= ? ${userFilter}
      GROUP BY ar.alert_type
      ORDER BY total_alerts DESC
    `).bind(...params).all();

    // Calculate trends for each type
    const currentPeriodStart = new Date(timeRange.startTime);
    const previousPeriodStart = new Date(currentPeriodStart.getTime() - (new Date(timeRange.endTime).getTime() - currentPeriodStart.getTime()));
    const previousPeriodEnd = currentPeriodStart;

    return Promise.all(results.results.map(async (row: DatabaseRow) => {
      const previousPeriodAlerts = await this.db.prepare(`
        SELECT COUNT(ai.id) as count
        FROM alert_instances ai
        JOIN alert_rules ar ON ai.alert_rule_id = ar.id
        WHERE ar.alert_type = ? 
          AND ai.started_at >= ? AND ai.started_at <= ? ${userFilter}
      `).bind(row.alert_type, previousPeriodStart.toISOString(), previousPeriodEnd.toISOString(), ...(userId ? [userId] : [])).first();

      const previousCount = previousPeriodAlerts?.count ?? 0;
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      
      if (row.total_alerts > previousCount * 1.1) {
        trend = 'increasing';
      } else if (row.total_alerts < previousCount * 0.9) {
        trend = 'decreasing';
      }

      return {
        alertType: row.alert_type,
        totalAlerts: row.total_alerts,
        averageResolutionTime: row.avg_resolution_time ?? 0,
        falsePositiveRate: row.total_alerts > 0 ? (row.false_positives / row.total_alerts) * 100 : 0,
        trend
      };
    }));
  }

  /**
   * Get alert analytics by user (admin only)
   */
  private async getAlertAnalyticsByUser(
    timeRange: { startTime: string; endTime: string }
  ): Promise<UserAlertAnalytics[]> {
    const results = await this.db.prepare(`
      SELECT 
        u.id as user_id,
        u.email as user_email,
        COUNT(ai.id) as total_alerts,
        COUNT(CASE WHEN ai.state = 'active' THEN 1 END) as active_alerts,
        AVG(
          CASE WHEN ai.resolved_at IS NOT NULL 
          THEN (julianday(ai.resolved_at) - julianday(ai.started_at)) * 24 * 60
          END
        ) as avg_resolution_time,
        ar.alert_type as most_common_type,
        COUNT(CASE WHEN ar.alert_type = ar.alert_type THEN 1 END) as type_count
      FROM users u
      JOIN alert_rules ar ON u.id = ar.user_id
      LEFT JOIN alert_instances ai ON ar.id = ai.alert_rule_id
        AND ai.started_at >= ? AND ai.started_at <= ?
      GROUP BY u.id, u.email, ar.alert_type
      HAVING COUNT(ai.id) > 0
      ORDER BY total_alerts DESC, type_count DESC
    `).bind(timeRange.startTime, timeRange.endTime).all();

    // Group by user and find most common alert type
    const userMap = new Map<string, UserAlertEntry>();
    
    results.results.forEach((row: DatabaseRow) => {
      if (!userMap.has(row.user_id) || row.type_count > (userMap.get(row.user_id)?.type_count ?? 0)) {
        userMap.set(row.user_id, {
          userId: row.user_id,
          userEmail: row.user_email,
          totalAlerts: row.total_alerts,
          activeAlerts: row.active_alerts,
          averageResolutionTime: row.avg_resolution_time ?? 0,
          mostCommonAlertType: row.most_common_type
        });
      }
    });

    return Array.from(userMap.values()).slice(0, 20); // Top 20 users
  }

  /**
   * Calculate performance metrics
   */
  private async calculatePerformanceMetrics(
    timeRange: { startTime: string; endTime: string },
    userId?: string
  ): Promise<{
    falsePositiveRate: number;
    averageResolutionTime: number;
    escalationRate: number;
  }> {
    const userFilter = userId ? 'AND ar.user_id = ?' : '';
    const params = userId ? [timeRange.startTime, timeRange.endTime, userId] : [timeRange.startTime, timeRange.endTime];

    const metrics = await this.db.prepare(`
      SELECT 
        COUNT(ai.id) as total_alerts,
        COUNT(CASE WHEN ai.notes LIKE '%false positive%' THEN 1 END) as false_positives,
        COUNT(CASE WHEN ai.escalation_level > 0 THEN 1 END) as escalated_alerts,
        AVG(
          CASE WHEN ai.resolved_at IS NOT NULL 
          THEN (julianday(ai.resolved_at) - julianday(ai.started_at)) * 24 * 60
          END
        ) as avg_resolution_time
      FROM alert_instances ai
      JOIN alert_rules ar ON ai.alert_rule_id = ar.id
      WHERE ai.started_at >= ? AND ai.started_at <= ? ${userFilter}
    `).bind(...params).first();

    return {
      falsePositiveRate: metrics?.total_alerts > 0 ? (metrics.false_positives / metrics.total_alerts) * 100 : 0,
      averageResolutionTime: metrics?.avg_resolution_time ?? 0,
      escalationRate: metrics?.total_alerts > 0 ? (metrics.escalated_alerts / metrics.total_alerts) * 100 : 0
    };
  }

  /**
   * Calculate trend changes
   */
  private async calculateTrends(
    timeRange: { startTime: string; endTime: string },
    userId?: string
  ): Promise<{
    weekOverWeekChange: number;
    monthOverMonthChange: number;
  }> {
    const currentPeriodStart = new Date(timeRange.startTime);
    const currentPeriodEnd = new Date(timeRange.endTime);
    // const _periodDuration = currentPeriodEnd.getTime() - currentPeriodStart.getTime();

    // Calculate week over week
    const lastWeekStart = new Date(currentPeriodStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekEnd = new Date(currentPeriodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    const currentWeekAlerts = await this.getAlertCount(timeRange, userId);
    const lastWeekAlerts = await this.getAlertCount(
      { startTime: lastWeekStart.toISOString(), endTime: lastWeekEnd.toISOString() },
      userId
    );

    // Calculate month over month
    const lastMonthStart = new Date(currentPeriodStart.getTime() - 30 * 24 * 60 * 60 * 1000);
    const lastMonthEnd = new Date(currentPeriodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

    const currentMonthAlerts = await this.getAlertCount(timeRange, userId);
    const lastMonthAlerts = await this.getAlertCount(
      { startTime: lastMonthStart.toISOString(), endTime: lastMonthEnd.toISOString() },
      userId
    );

    return {
      weekOverWeekChange: lastWeekAlerts > 0 ? ((currentWeekAlerts - lastWeekAlerts) / lastWeekAlerts) * 100 : 0,
      monthOverMonthChange: lastMonthAlerts > 0 ? ((currentMonthAlerts - lastMonthAlerts) / lastMonthAlerts) * 100 : 0
    };
  }

  /**
   * Get top alerts by frequency
   */
  private async getTopAlertsByFrequency(
    timeRange: { startTime: string; endTime: string },
    userId?: string
  ): Promise<AlertFrequencyData[]> {
    const userFilter = userId ? 'AND ar.user_id = ?' : '';
    const params = userId ? [timeRange.startTime, timeRange.endTime, userId] : [timeRange.startTime, timeRange.endTime];

    const results = await this.db.prepare(`
      SELECT 
        ar.id as alert_rule_id,
        ar.name as alert_rule_name,
        ar.alert_type,
        COUNT(ai.id) as frequency,
        MAX(ai.started_at) as last_triggered
      FROM alert_rules ar
      LEFT JOIN alert_instances ai ON ar.id = ai.alert_rule_id
        AND ai.started_at >= ? AND ai.started_at <= ?
      WHERE 1=1 ${userFilter}
      GROUP BY ar.id, ar.name, ar.alert_type
      HAVING frequency > 0
      ORDER BY frequency DESC
      LIMIT 10
    `).bind(...params).all();

    return results.results.map((row: DatabaseRow) => ({
      alertRuleId: row.alert_rule_id,
      alertRuleName: row.alert_rule_name,
      alertType: row.alert_type,
      frequency: row.frequency,
      lastTriggered: row.last_triggered
    }));
  }

  /**
   * Get top alerts by duration
   */
  private async getTopAlertsByDuration(
    timeRange: { startTime: string; endTime: string },
    userId?: string
  ): Promise<AlertDurationData[]> {
    const userFilter = userId ? 'AND ar.user_id = ?' : '';
    const params = userId ? [timeRange.startTime, timeRange.endTime, userId] : [timeRange.startTime, timeRange.endTime];

    const results = await this.db.prepare(`
      SELECT 
        ar.id as alert_rule_id,
        ar.name as alert_rule_name,
        ar.alert_type,
        AVG(
          CASE WHEN ai.resolved_at IS NOT NULL 
          THEN (julianday(ai.resolved_at) - julianday(ai.started_at)) * 24 * 60
          END
        ) as avg_duration,
        MAX(
          CASE WHEN ai.resolved_at IS NOT NULL 
          THEN (julianday(ai.resolved_at) - julianday(ai.started_at)) * 24 * 60
          END
        ) as longest_duration
      FROM alert_rules ar
      LEFT JOIN alert_instances ai ON ar.id = ai.alert_rule_id
        AND ai.started_at >= ? AND ai.started_at <= ?
        AND ai.resolved_at IS NOT NULL
      WHERE 1=1 ${userFilter}
      GROUP BY ar.id, ar.name, ar.alert_type
      HAVING avg_duration IS NOT NULL
      ORDER BY avg_duration DESC
      LIMIT 10
    `).bind(...params).all();

    return results.results.map((row: DatabaseRow) => ({
      alertRuleId: row.alert_rule_id,
      alertRuleName: row.alert_rule_name,
      alertType: row.alert_type,
      averageDuration: row.avg_duration,
      longestDuration: row.longest_duration
    }));
  }

  /**
   * Get alert count for a time range
   */
  private async getAlertCount(
    timeRange: { startTime: string; endTime: string },
    userId?: string
  ): Promise<number> {
    const userFilter = userId ? 'AND ar.user_id = ?' : '';
    const params = userId ? [timeRange.startTime, timeRange.endTime, userId] : [timeRange.startTime, timeRange.endTime];

    const result = await this.db.prepare(`
      SELECT COUNT(ai.id) as count
      FROM alert_instances ai
      JOIN alert_rules ar ON ai.alert_rule_id = ar.id
      WHERE ai.started_at >= ? AND ai.started_at <= ? ${userFilter}
    `).bind(...params).first();

    return result?.count ?? 0;
  }

  /**
   * Generate alert report
   */
  async generateAlertReport(
    userId?: string,
    timeRange: { startTime: string; endTime: string } = {
      startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date().toISOString()
    },
    format: 'json' | 'csv' = 'json'
  ): Promise<Record<string, unknown>> {
    const analytics = await this.getAlertAnalytics(userId, timeRange);
    
    if (format === 'csv') {
      return this.convertToCsv(analytics);
    }
    
    return {
      reportMetadata: {
        generatedAt: new Date().toISOString(),
        timeRange,
        userId,
        format
      },
      analytics,
      summary: {
        totalAlerts: analytics.alertsByType.reduce((sum, type) => sum + type.totalAlerts, 0),
        averageResolutionTime: analytics.averageResolutionTime,
        falsePositiveRate: analytics.falsePositiveRate,
        escalationRate: analytics.escalationRate
      }
    };
  }

  /**
   * Get alert health score
   */
  async getAlertHealthScore(userId?: string): Promise<{
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    factors: Array<{ name: string; score: number; weight: number; status: 'good' | 'warning' | 'critical' }>;
  }> {
    const timeRange = {
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date().toISOString()
    };

    const analytics = await this.getAlertAnalytics(userId, timeRange);
    
    const factors = [
      {
        name: 'False Positive Rate',
        score: Math.max(0, 100 - analytics.falsePositiveRate * 2),
        weight: 0.3,
        status: analytics.falsePositiveRate < 5 ? 'good' : analytics.falsePositiveRate < 15 ? 'warning' : 'critical'
      },
      {
        name: 'Resolution Time',
        score: Math.max(0, 100 - (analytics.averageResolutionTime / 60)), // Penalize long resolution times
        weight: 0.25,
        status: analytics.averageResolutionTime < 30 ? 'good' : analytics.averageResolutionTime < 120 ? 'warning' : 'critical'
      },
      {
        name: 'Escalation Rate',
        score: Math.max(0, 100 - analytics.escalationRate * 3),
        weight: 0.2,
        status: analytics.escalationRate < 10 ? 'good' : analytics.escalationRate < 25 ? 'warning' : 'critical'
      },
      {
        name: 'Alert Volume Trend',
        score: analytics.weekOverWeekChange < 0 ? 100 : Math.max(0, 100 - analytics.weekOverWeekChange),
        weight: 0.15,
        status: analytics.weekOverWeekChange < 20 ? 'good' : analytics.weekOverWeekChange < 50 ? 'warning' : 'critical'
      },
      {
        name: 'Coverage Completeness',
        score: Math.min(100, analytics.alertsByType.length * 20), // Assume 5 types is good coverage
        weight: 0.1,
        status: analytics.alertsByType.length >= 3 ? 'good' : analytics.alertsByType.length >= 2 ? 'warning' : 'critical'
      }
    ];

    const weightedScore = factors.reduce((sum, factor) => sum + factor.score * factor.weight, 0);
    
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (weightedScore >= 90) grade = 'A';
    else if (weightedScore >= 80) grade = 'B';
    else if (weightedScore >= 70) grade = 'C';
    else if (weightedScore >= 60) grade = 'D';
    else grade = 'F';

    return {
      score: Math.round(weightedScore),
      grade,
      factors: factors.map(f => ({ ...f, status: f.status as 'good' | 'warning' | 'critical' }))
    };
  }

  /**
   * Convert analytics to CSV format
   */
  private convertToCsv(analytics: AlertAnalytics): string {
    const headers = ['Alert Type', 'Total Alerts', 'Avg Resolution Time (min)', 'False Positive Rate (%)', 'Trend'];
    const rows = analytics.alertsByType.map(type => [
      type.alertType,
      type.totalAlerts.toString(),
      type.averageResolutionTime.toFixed(2),
      type.falsePositiveRate.toFixed(2),
      type.trend
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }
}

// Type definitions
interface DatabaseRow {
  [key: string]: unknown;
}

interface UserAlertEntry {
  userId: string;
  userEmail: string;
  totalAlerts: number;
  activeAlerts: number;
  averageResolutionTime: number;
  mostCommonAlertType: string;
  type_count?: number;
}