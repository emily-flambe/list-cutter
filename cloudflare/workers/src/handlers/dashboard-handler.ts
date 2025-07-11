import { MetricsService } from '../services/monitoring/metrics-service.js';
import { CostCalculator } from '../services/monitoring/cost-calculator.js';
import { AlertManagementService } from '../services/monitoring/alert-management-service.js';
import { AlertConfiguration } from '../services/monitoring/alert-configuration.js';
import type { CloudflareEnv } from '../types/env.js';

/**
 * DashboardHandler
 * Handles user-facing monitoring dashboard API endpoints
 */
export class DashboardHandler {
  private metricsService: MetricsService;
  private costCalculator: CostCalculator;
  private alertManager: AlertManagementService;
  private alertConfiguration: AlertConfiguration;

  constructor(
    private analytics: AnalyticsEngineDataset,
    private db: D1Database,
    private env: CloudflareEnv
  ) {
    this.metricsService = new MetricsService(analytics, db, {
      enableMetrics: true,
      enableDetailedMetrics: true,
      successMetricsSamplingRate: 0.1,
      errorMetricsSamplingRate: 1.0
    });
    
    this.costCalculator = new CostCalculator(db, analytics);
    this.alertManager = new AlertManagementService(db, analytics);
    this.alertConfiguration = new AlertConfiguration(db);
  }

  /**
   * Get comprehensive dashboard data for a user
   */
  async getDashboardData(userId: string, timeRange: string = '7d'): Promise<Response> {
    try {
      // 1. Get current metrics
      const metrics = await this.getUserMetrics(userId, timeRange);
      
      // 2. Get cost data
      const costData = await this.getUserCosts(userId, timeRange);
      
      // 3. Get storage analytics
      const storageData = await this.getUserStorage(userId);
      
      // 4. Get recent activity
      const recentActivity = await this.getRecentActivity(userId, 50);
      
      // 5. Get active alerts
      const activeAlerts = await this.getActiveAlerts(userId);
      
      // 6. Get performance metrics
      const performanceMetrics = await this.getPerformanceMetrics(userId, timeRange);
      
      const dashboardData = {
        metrics: {
          totalFiles: metrics.totalFiles,
          totalStorage: metrics.totalStorage,
          uploadsToday: metrics.uploadsToday,
          downloadsToday: metrics.downloadsToday,
          errorRate: metrics.errorRate,
          avgResponseTime: metrics.avgResponseTime,
          successRate: metrics.successRate,
          bandwidthUsed: metrics.bandwidthUsed
        },
        costs: {
          monthlyTotal: costData.monthlyTotal,
          dailyAverage: costData.dailyAverage,
          storageCharges: costData.storageCharges,
          requestCharges: costData.requestCharges,
          trend: costData.trend,
          projectedMonthly: costData.projectedMonthly
        },
        storage: {
          used: storageData.used,
          quota: storageData.quota,
          usagePercent: storageData.usagePercent,
          fileTypes: storageData.fileTypes,
          largestFiles: storageData.largestFiles,
          averageFileSize: storageData.averageFileSize
        },
        activity: recentActivity,
        alerts: activeAlerts,
        performance: performanceMetrics,
        lastUpdated: new Date().toISOString()
      };
      
      return new Response(JSON.stringify(dashboardData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Dashboard data retrieval failed:', error);
      return new Response(JSON.stringify({
        error: 'Failed to load dashboard data',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get metrics history for charts
   */
  async getMetricsHistory(userId: string, timeRange: string = '7d', metricType?: string): Promise<Response> {
    try {
      const timeRangeMap: Record<string, number> = {
        '1d': 1,
        '7d': 7,
        '30d': 30,
        '90d': 90
      };
      
      const days = timeRangeMap[timeRange] || 7;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      let query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as uploads,
          SUM(file_size) as total_size,
          AVG(file_size) as avg_size
        FROM files
        WHERE user_id = ? AND created_at >= ?
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;
      
      const result = await this.db.prepare(query).bind(userId, startDate.toISOString()).all();
      
      const historyData = result.results.map((row: DatabaseRow) => ({
        date: String(row.date),
        uploads: Number(row.uploads) || 0,
        totalSize: Number(row.total_size) || 0,
        avgSize: Number(row.avg_size) || 0
      }));
      
      // Get activity history
      const activityQuery = `
        SELECT 
          DATE(created_at) as date,
          action,
          COUNT(*) as count,
          SUM(bytes_transferred) as bytes
        FROM file_access_logs
        WHERE user_id = ? AND created_at >= ?
        GROUP BY DATE(created_at), action
        ORDER BY date DESC
      `;
      
      const activityResult = await this.db.prepare(activityQuery).bind(userId, startDate.toISOString()).all();
      
      const activityHistory = activityResult.results.reduce((acc: any, row: DatabaseRow) => {
        const date = String(row.date);
        if (!acc[date]) {
          acc[date] = { date, downloads: 0, deletes: 0, bandwidth: 0 };
        }
        
        if (row.action === 'download') {
          acc[date].downloads = Number(row.count) || 0;
          acc[date].bandwidth = Number(row.bytes) || 0;
        } else if (row.action === 'delete') {
          acc[date].deletes = Number(row.count) || 0;
        }
        
        return acc;
      }, {});
      
      return new Response(JSON.stringify({
        uploadHistory: historyData,
        activityHistory: Object.values(activityHistory),
        timeRange,
        generatedAt: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Metrics history retrieval failed:', error);
      return new Response(JSON.stringify({
        error: 'Failed to load metrics history',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get cost breakdown and analysis
   */
  async getCostAnalysis(userId: string, timeRange: string = '30d'): Promise<Response> {
    try {
      const costAnalysis = await this.costCalculator.getUserCostAnalysis(userId, timeRange);
      
      return new Response(JSON.stringify({
        currentMonth: costAnalysis.currentMonth,
        previousMonth: costAnalysis.previousMonth,
        breakdown: costAnalysis.breakdown,
        projections: costAnalysis.projections,
        trends: costAnalysis.trends,
        recommendations: costAnalysis.recommendations,
        generatedAt: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Cost analysis retrieval failed:', error);
      return new Response(JSON.stringify({
        error: 'Failed to load cost analysis',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get user alert settings and history
   */
  async getAlertSettings(userId: string): Promise<Response> {
    try {
      const alertRules = await this.alertConfiguration.getUserAlertRules(userId);
      const alertHistory = await this.alertManager.getAlertHistory(userId, { limit: 100 });
      const alertDashboard = await this.alertManager.getAlertDashboard(userId);
      
      return new Response(JSON.stringify({
        alertRules,
        alertHistory,
        dashboard: alertDashboard,
        generatedAt: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Alert settings retrieval failed:', error);
      return new Response(JSON.stringify({
        error: 'Failed to load alert settings',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Update user alert settings
   */
  async updateAlertSettings(userId: string, alertId: string, updates: any): Promise<Response> {
    try {
      await this.alertManager.updateAlertRule(alertId, userId, updates);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Alert settings updated successfully',
        updatedAt: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Alert settings update failed:', error);
      return new Response(JSON.stringify({
        error: 'Failed to update alert settings',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get storage usage analysis
   */
  async getStorageAnalysis(userId: string): Promise<Response> {
    try {
      const storageAnalysis = await this.getDetailedStorageAnalysis(userId);
      
      return new Response(JSON.stringify({
        overview: storageAnalysis.overview,
        fileTypes: storageAnalysis.fileTypes,
        sizeDistribution: storageAnalysis.sizeDistribution,
        growth: storageAnalysis.growth,
        optimization: storageAnalysis.optimization,
        generatedAt: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Storage analysis retrieval failed:', error);
      return new Response(JSON.stringify({
        error: 'Failed to load storage analysis',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Private helper methods
  private async getUserMetrics(userId: string, timeRange: string): Promise<any> {
    const days = this.getTimeRangeDays(timeRange);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Get total files and storage
    const totalStats = await this.db.prepare(`
      SELECT 
        COUNT(*) as total_files,
        SUM(file_size) as total_storage
      FROM files
      WHERE user_id = ?
    `).bind(userId).first();
    
    // Get today's uploads
    const todayUploads = await this.db.prepare(`
      SELECT COUNT(*) as uploads
      FROM files
      WHERE user_id = ? AND DATE(created_at) = DATE('now')
    `).bind(userId).first();
    
    // Get recent activity
    const recentActivity = await this.db.prepare(`
      SELECT 
        action,
        COUNT(*) as count,
        SUM(bytes_transferred) as bytes
      FROM file_access_logs
      WHERE user_id = ? AND created_at >= ?
      GROUP BY action
    `).bind(userId, startDate.toISOString()).all();
    
    let downloadsToday = 0;
    let errorRate = 0;
    let successRate = 100;
    let bandwidthUsed = 0;
    
    recentActivity.results.forEach((row: DatabaseRow) => {
      if (row.action === 'download') {
        downloadsToday = Number(row.count) || 0;
        bandwidthUsed = Number(row.bytes) || 0;
      }
    });
    
    return {
      totalFiles: Number(totalStats?.total_files) || 0,
      totalStorage: Number(totalStats?.total_storage) || 0,
      uploadsToday: Number(todayUploads?.uploads) || 0,
      downloadsToday,
      errorRate,
      avgResponseTime: 150, // Would be calculated from metrics
      successRate,
      bandwidthUsed
    };
  }

  private async getUserCosts(userId: string, timeRange: string): Promise<any> {
    return await this.costCalculator.getUserCosts(userId, timeRange);
  }

  private async getUserStorage(userId: string): Promise<any> {
    const storageQuery = `
      SELECT 
        COUNT(*) as file_count,
        SUM(file_size) as total_size,
        AVG(file_size) as avg_size,
        content_type,
        COUNT(*) as type_count
      FROM files
      WHERE user_id = ?
      GROUP BY content_type
      ORDER BY type_count DESC
    `;
    
    const result = await this.db.prepare(storageQuery).bind(userId).all();
    
    const totalSize = result.results.reduce((sum: number, row: DatabaseRow) => sum + (Number(row.total_size) || 0), 0);
    const quota = 10 * 1024 * 1024 * 1024; // 10GB default quota
    
    const fileTypes = result.results.map((row: DatabaseRow) => ({
      type: String(row.content_type),
      count: Number(row.type_count) || 0,
      size: Number(row.total_size) || 0
    }));
    
    // Get largest files
    const largestFiles = await this.db.prepare(`
      SELECT file_name, file_size, created_at
      FROM files
      WHERE user_id = ?
      ORDER BY file_size DESC
      LIMIT 10
    `).bind(userId).all();
    
    return {
      used: totalSize,
      quota,
      usagePercent: (totalSize / quota) * 100,
      fileTypes,
      largestFiles: largestFiles.results.map((row: DatabaseRow) => ({
        name: String(row.file_name),
        size: Number(row.file_size),
        createdAt: String(row.created_at)
      })),
      averageFileSize: totalSize / (result.results.length || 1)
    };
  }

  private async getRecentActivity(userId: string, limit: number = 50): Promise<any[]> {
    const result = await this.db.prepare(`
      SELECT 
        action,
        file_name,
        bytes_transferred,
        created_at,
        success
      FROM file_access_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(userId, limit).all();
    
    return result.results.map((row: DatabaseRow) => ({
      action: String(row.action),
      fileName: String(row.file_name),
      bytes: Number(row.bytes_transferred) || 0,
      timestamp: String(row.created_at),
      success: Boolean(row.success)
    }));
  }

  private async getActiveAlerts(userId: string): Promise<any[]> {
    const alerts = await this.alertManager.listAlertInstances(userId, { 
      state: 'active',
      limit: 20
    });
    
    return alerts.map(alert => ({
      id: alert.id,
      name: alert.alertRuleId, // Would join with alert_rules table
      severity: alert.alertLevel,
      message: `Alert triggered at ${alert.startedAt}`,
      startedAt: alert.startedAt,
      currentValue: alert.currentValue,
      thresholdValue: alert.thresholdValue
    }));
  }

  private async getPerformanceMetrics(userId: string, timeRange: string): Promise<any> {
    const days = this.getTimeRangeDays(timeRange);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // This would be calculated from actual metrics stored in Analytics Engine
    // For now, returning mock data
    return {
      avgResponseTime: 150,
      errorRate: 0.5,
      throughput: 1024 * 1024, // 1MB/s
      uptime: 99.9,
      requestCount: 1000
    };
  }

  private async getDetailedStorageAnalysis(userId: string): Promise<any> {
    // Get file type distribution
    const fileTypes = await this.db.prepare(`
      SELECT 
        content_type,
        COUNT(*) as count,
        SUM(file_size) as total_size,
        AVG(file_size) as avg_size
      FROM files
      WHERE user_id = ?
      GROUP BY content_type
      ORDER BY total_size DESC
    `).bind(userId).all();
    
    // Get size distribution
    const sizeDistribution = await this.db.prepare(`
      SELECT 
        CASE 
          WHEN file_size < 1024 THEN 'Under 1KB'
          WHEN file_size < 1024*1024 THEN '1KB-1MB'
          WHEN file_size < 1024*1024*10 THEN '1MB-10MB'
          WHEN file_size < 1024*1024*100 THEN '10MB-100MB'
          ELSE 'Over 100MB'
        END as size_range,
        COUNT(*) as count,
        SUM(file_size) as total_size
      FROM files
      WHERE user_id = ?
      GROUP BY size_range
    `).bind(userId).all();
    
    // Get growth over time
    const growth = await this.db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as files_added,
        SUM(file_size) as size_added
      FROM files
      WHERE user_id = ? AND created_at >= date('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).bind(userId).all();
    
    return {
      overview: {
        totalFiles: fileTypes.results.reduce((sum: number, row: DatabaseRow) => sum + (Number(row.count) || 0), 0),
        totalSize: fileTypes.results.reduce((sum: number, row: DatabaseRow) => sum + (Number(row.total_size) || 0), 0)
      },
      fileTypes: fileTypes.results.map((row: DatabaseRow) => ({
        type: String(row.content_type),
        count: Number(row.count) || 0,
        totalSize: Number(row.total_size) || 0,
        avgSize: Number(row.avg_size) || 0
      })),
      sizeDistribution: sizeDistribution.results.map((row: DatabaseRow) => ({
        range: String(row.size_range),
        count: Number(row.count) || 0,
        totalSize: Number(row.total_size) || 0
      })),
      growth: growth.results.map((row: DatabaseRow) => ({
        date: String(row.date),
        filesAdded: Number(row.files_added) || 0,
        sizeAdded: Number(row.size_added) || 0
      })),
      optimization: {
        duplicateFiles: 0, // Would be calculated
        largeFiles: 0, // Would be calculated
        oldFiles: 0, // Would be calculated
        recommendations: [
          'Consider removing duplicate files to save space',
          'Archive old files that are rarely accessed',
          'Compress large files to reduce storage costs'
        ]
      }
    };
  }

  private getTimeRangeDays(timeRange: string): number {
    const timeRangeMap: Record<string, number> = {
      '1d': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90
    };
    
    return timeRangeMap[timeRange] || 7;
  }
}

// Helper function to extract user ID from request
export function extractUserIdFromRequest(request: Request): string | null {
  // This would extract user ID from JWT token or session
  // For now, returning a default user ID
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // In a real implementation, decode and validate JWT
    return 'user-123'; // Mock user ID
  }
  
  return null;
}

// Type definitions
interface DatabaseRow {
  [key: string]: unknown;
}