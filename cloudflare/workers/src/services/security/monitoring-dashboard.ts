import {
  SecurityEvent,
  SecurityEventType,
  SecurityEventSeverity,
  SecurityEventCategory,
  RiskLevel,
  SecurityMetrics,
  SecurityIncident,
  SecurityDashboardWidget,
  SecurityAlertRule
} from '../../types/security-events';
import { SecurityAuditLogger } from './audit-logger';

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  userId: string;
  role: string;
  refreshInterval: number; // in seconds
  autoRefresh: boolean;
  widgets: SecurityDashboardWidget[];
  alertRules: SecurityAlertRule[];
}

/**
 * Real-time dashboard data
 */
export interface DashboardData {
  summary: {
    totalEvents: number;
    criticalEvents: number;
    activeIncidents: number;
    threatsBlocked: number;
    lastUpdated: Date;
  };
  metrics: SecurityMetrics;
  recentEvents: SecurityEvent[];
  activeIncidents: SecurityIncident[];
  alertSummary: {
    triggeredAlerts: number;
    suppressedAlerts: number;
    escalatedIncidents: number;
  };
  systemHealth: {
    storageUsage: number;
    processingLatency: number;
    errorRate: number;
    availability: number;
  };
}

/**
 * Widget query result
 */
export interface WidgetData {
  widgetId: string;
  data: unknown;
  lastUpdated: Date;
  error?: string;
}

/**
 * Alert notification
 */
export interface AlertNotification {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: SecurityEventSeverity;
  message: string;
  eventIds: string[];
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

/**
 * Security monitoring dashboard service
 * Provides real-time security monitoring and alerting capabilities
 */
export class SecurityMonitoringDashboard {
  private db: D1Database;
  private auditLogger: SecurityAuditLogger;
  private dashboardConfigs = new Map<string, DashboardConfig>();
  private widgetCache = new Map<string, WidgetData>();
  private activeAlerts = new Map<string, AlertNotification>();
  private refreshTimers = new Map<string, NodeJS.Timeout>();

  // Performance tracking
  private performanceMetrics = {
    queriesExecuted: 0,
    totalQueryTime: 0,
    averageQueryTime: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  constructor(db: D1Database, auditLogger: SecurityAuditLogger) {
    this.db = db;
    this.auditLogger = auditLogger;
  }

  /**
   * Get dashboard data for a user
   */
  async getDashboardData(userId: string, role: string): Promise<DashboardData> {
    const startTime = Date.now();
    
    try {
      // Get or create dashboard configuration
      const config = await this.getDashboardConfig(userId, role);
      
      // Get real-time dashboard data
      const [summary, metrics, recentEvents, activeIncidents, alertSummary, systemHealth] = await Promise.all([
        this.getSummaryData(),
        this.getMetricsData(),
        this.getRecentEvents(role),
        this.getActiveIncidents(role),
        this.getAlertSummary(),
        this.getSystemHealth()
      ]);

      this.updatePerformanceMetrics(startTime);

      return {
        summary,
        metrics,
        recentEvents,
        activeIncidents,
        alertSummary,
        systemHealth
      };
    } catch (error) {
      console.error('Failed to get dashboard data:', error);
      throw error;
    }
  }

  /**
   * Get widget data by ID
   */
  async getWidgetData(widgetId: string, userId: string): Promise<WidgetData> {
    const cached = this.widgetCache.get(widgetId);
    const now = new Date();
    
    // Check cache validity (5 minutes)
    if (cached && (now.getTime() - cached.lastUpdated.getTime()) < 300000) {
      this.performanceMetrics.cacheHits++;
      return cached;
    }

    this.performanceMetrics.cacheMisses++;
    const startTime = Date.now();

    try {
      // Get widget configuration
      const widget = await this.getWidgetConfig(widgetId);
      if (!widget) {
        throw new Error(`Widget ${widgetId} not found`);
      }

      // Check permissions
      if (!widget.visibleToRoles.includes('*') && !widget.visibleToRoles.includes(userId)) {
        throw new Error('Access denied to widget');
      }

      // Execute widget query
      const data = await this.executeWidgetQuery(widget);
      
      const widgetData: WidgetData = {
        widgetId,
        data,
        lastUpdated: now
      };

      // Cache the result
      this.widgetCache.set(widgetId, widgetData);
      this.updatePerformanceMetrics(startTime);

      return widgetData;
    } catch (error) {
      const widgetData: WidgetData = {
        widgetId,
        data: null,
        lastUpdated: now,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.updatePerformanceMetrics(startTime);
      return widgetData;
    }
  }

  /**
   * Create or update a dashboard widget
   */
  async createWidget(widget: Omit<SecurityDashboardWidget, 'id' | 'createdAt'>): Promise<string> {
    const widgetId = crypto.randomUUID();
    const now = new Date();

    const widgetData: SecurityDashboardWidget = {
      ...widget,
      id: widgetId,
      createdAt: now
    };

    await this.db.prepare(`
      INSERT INTO security_dashboard_widgets (
        id, type, title, description, data_source, query, refresh_interval,
        chart_type, display_options, position, size, visible_to_roles, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      widgetData.id,
      widgetData.type,
      widgetData.title,
      widgetData.description,
      widgetData.dataSource,
      JSON.stringify(widgetData.query),
      widgetData.refreshInterval,
      widgetData.chartType,
      JSON.stringify(widgetData.displayOptions),
      JSON.stringify(widgetData.position),
      JSON.stringify(widgetData.size),
      JSON.stringify(widgetData.visibleToRoles),
      widgetData.createdBy
    ).run();

    return widgetId;
  }

  /**
   * Update an existing widget
   */
  async updateWidget(widgetId: string, updates: Partial<SecurityDashboardWidget>): Promise<void> {
    const fields = [];
    const values = [];

    if (updates.title) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.description) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.query) {
      fields.push('query = ?');
      values.push(JSON.stringify(updates.query));
    }
    if (updates.refreshInterval) {
      fields.push('refresh_interval = ?');
      values.push(updates.refreshInterval);
    }
    if (updates.displayOptions) {
      fields.push('display_options = ?');
      values.push(JSON.stringify(updates.displayOptions));
    }
    if (updates.position) {
      fields.push('position = ?');
      values.push(JSON.stringify(updates.position));
    }
    if (updates.size) {
      fields.push('size = ?');
      values.push(JSON.stringify(updates.size));
    }

    if (fields.length === 0) return;

    values.push(widgetId);

    await this.db.prepare(`
      UPDATE security_dashboard_widgets SET ${fields.join(', ')} WHERE id = ?
    `).bind(...values).run();

    // Invalidate cache
    this.widgetCache.delete(widgetId);
  }

  /**
   * Delete a widget
   */
  async deleteWidget(widgetId: string): Promise<void> {
    await this.db.prepare('DELETE FROM security_dashboard_widgets WHERE id = ?')
      .bind(widgetId)
      .run();

    this.widgetCache.delete(widgetId);
  }

  /**
   * Get active alerts for a user
   */
  async getActiveAlerts(userId: string): Promise<AlertNotification[]> {
    const userAlerts: AlertNotification[] = [];
    
    for (const alert of this.activeAlerts.values()) {
      // Check if user should see this alert based on role/permissions
      // For now, show all alerts to all users
      userAlerts.push(alert);
    }

    return userAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();

    // Log the acknowledgment
    await this.auditLogger.logSystemEvent(
      SecurityEventType.SYSTEM_MAINTENANCE,
      {
        component: 'monitoring-dashboard',
        details: {
          action: 'alert_acknowledged',
          alertId,
          userId,
          ruleName: alert.ruleName
        }
      }
    );
  }

  /**
   * Add a new alert notification
   */
  addAlert(alert: Omit<AlertNotification, 'id'>): string {
    const alertId = crypto.randomUUID();
    this.activeAlerts.set(alertId, { ...alert, id: alertId });
    return alertId;
  }

  /**
   * Remove an alert notification
   */
  removeAlert(alertId: string): void {
    this.activeAlerts.delete(alertId);
  }

  /**
   * Get dashboard performance metrics
   */
  getPerformanceMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Export dashboard configuration
   */
  async exportDashboardConfig(userId: string): Promise<DashboardConfig> {
    const config = this.dashboardConfigs.get(userId);
    if (!config) {
      throw new Error('Dashboard configuration not found');
    }

    return { ...config };
  }

  /**
   * Import dashboard configuration
   */
  async importDashboardConfig(userId: string, config: DashboardConfig): Promise<void> {
    // Validate configuration
    this.validateDashboardConfig(config);

    // Store configuration
    this.dashboardConfigs.set(userId, config);

    // Update database
    await this.storeDashboardConfig(userId, config);
  }

  /**
   * Private: Get dashboard configuration
   */
  private async getDashboardConfig(userId: string, role: string): Promise<DashboardConfig> {
    let config = this.dashboardConfigs.get(userId);
    
    if (!config) {
      // Load from database or create default
      config = await this.loadDashboardConfig(userId) || this.createDefaultDashboardConfig(userId, role);
      this.dashboardConfigs.set(userId, config);
    }

    return config;
  }

  /**
   * Private: Create default dashboard configuration
   */
  private createDefaultDashboardConfig(userId: string, role: string): DashboardConfig {
    const widgets: SecurityDashboardWidget[] = [
      {
        id: crypto.randomUUID(),
        type: 'metric',
        title: 'Security Events Today',
        description: 'Total security events in the last 24 hours',
        dataSource: 'security_events',
        query: {
          filters: {
            timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          },
          aggregation: 'count',
          timeRange: {
            start: new Date(Date.now() - 24 * 60 * 60 * 1000),
            end: new Date()
          }
        },
        refreshInterval: 300,
        displayOptions: { color: 'primary', size: 'large' },
        position: { x: 0, y: 0 },
        size: { width: 4, height: 2 },
        visibleToRoles: [role],
        createdBy: userId,
        createdAt: new Date()
      },
      {
        id: crypto.randomUUID(),
        type: 'chart',
        title: 'Events by Severity',
        description: 'Security events grouped by severity level',
        dataSource: 'security_events',
        query: {
          filters: {
            timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          },
          aggregation: 'group_by_severity',
          timeRange: {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            end: new Date()
          }
        },
        refreshInterval: 300,
        chartType: 'pie',
        displayOptions: { showLegend: true },
        position: { x: 4, y: 0 },
        size: { width: 4, height: 4 },
        visibleToRoles: [role],
        createdBy: userId,
        createdAt: new Date()
      },
      {
        id: crypto.randomUUID(),
        type: 'table',
        title: 'Recent Critical Events',
        description: 'Latest critical security events',
        dataSource: 'security_events',
        query: {
          filters: {
            severity: 'critical',
            timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          },
          timeRange: {
            start: new Date(Date.now() - 24 * 60 * 60 * 1000),
            end: new Date()
          }
        },
        refreshInterval: 60,
        displayOptions: { pageSize: 10, sortBy: 'timestamp' },
        position: { x: 8, y: 0 },
        size: { width: 4, height: 4 },
        visibleToRoles: [role],
        createdBy: userId,
        createdAt: new Date()
      }
    ];

    return {
      userId,
      role,
      refreshInterval: 300,
      autoRefresh: true,
      widgets,
      alertRules: []
    };
  }

  /**
   * Private: Get summary data
   */
  private async getSummaryData(): Promise<DashboardData['summary']> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalEvents, criticalEvents, activeIncidents, threatsBlocked] = await Promise.all([
      this.db.prepare('SELECT COUNT(*) as count FROM security_events WHERE timestamp >= ?')
        .bind(today.toISOString())
        .first(),
      this.db.prepare('SELECT COUNT(*) as count FROM security_events WHERE severity = ? AND timestamp >= ?')
        .bind('critical', today.toISOString())
        .first(),
      this.db.prepare('SELECT COUNT(*) as count FROM security_incidents WHERE status IN (?, ?)')
        .bind('open', 'investigating')
        .first(),
      this.db.prepare('SELECT COUNT(*) as count FROM security_events WHERE type = ? AND timestamp >= ?')
        .bind(SecurityEventType.MALICIOUS_FILE_DETECTED, today.toISOString())
        .first()
    ]);

    return {
      totalEvents: totalEvents?.count as number || 0,
      criticalEvents: criticalEvents?.count as number || 0,
      activeIncidents: activeIncidents?.count as number || 0,
      threatsBlocked: threatsBlocked?.count as number || 0,
      lastUpdated: new Date()
    };
  }

  /**
   * Private: Get metrics data
   */
  private async getMetricsData(): Promise<SecurityMetrics> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

    return await this.auditLogger.generateSecurityMetrics(startDate, endDate, 'hourly');
  }

  /**
   * Private: Get recent events
   */
  private async getRecentEvents(role: string): Promise<SecurityEvent[]> {
    const limit = role === 'admin' ? 50 : 20;
    
    const events = await this.auditLogger.querySecurityEvents({
      limit,
      offset: 0
    });

    return events.events;
  }

  /**
   * Private: Get active incidents
   */
  private async getActiveIncidents(role: string): Promise<SecurityIncident[]> {
    const results = await this.db.prepare(`
      SELECT * FROM security_incidents 
      WHERE status IN ('open', 'investigating') 
      ORDER BY detected_at DESC 
      LIMIT ?
    `).bind(role === 'admin' ? 20 : 10).all();

    return results.results.map(this.mapDatabaseRowToIncident);
  }

  /**
   * Private: Get alert summary
   */
  private async getAlertSummary(): Promise<DashboardData['alertSummary']> {
    const activeAlertsCount = this.activeAlerts.size;
    const acknowledgedCount = Array.from(this.activeAlerts.values()).filter(a => a.acknowledged).length;

    return {
      triggeredAlerts: activeAlertsCount,
      suppressedAlerts: 0, // Would be calculated based on suppression rules
      escalatedIncidents: 0 // Would be calculated based on escalation
    };
  }

  /**
   * Private: Get system health
   */
  private async getSystemHealth(): Promise<DashboardData['systemHealth']> {
    // In a real implementation, these would be actual metrics
    return {
      storageUsage: 75.5, // percentage
      processingLatency: this.performanceMetrics.averageQueryTime,
      errorRate: 0.1, // percentage
      availability: 99.9 // percentage
    };
  }

  /**
   * Private: Get widget configuration
   */
  private async getWidgetConfig(widgetId: string): Promise<SecurityDashboardWidget | null> {
    const result = await this.db.prepare('SELECT * FROM security_dashboard_widgets WHERE id = ?')
      .bind(widgetId)
      .first();

    if (!result) return null;

    return this.mapDatabaseRowToWidget(result);
  }

  /**
   * Private: Execute widget query
   */
  private async executeWidgetQuery(widget: SecurityDashboardWidget): Promise<unknown> {
    switch (widget.dataSource) {
      case 'security_events':
        return await this.executeSecurityEventsQuery(widget.query);
      case 'audit_trail':
        return await this.executeAuditTrailQuery(widget.query);
      case 'metrics':
        return await this.executeMetricsQuery(widget.query);
      case 'incidents':
        return await this.executeIncidentsQuery(widget.query);
      default:
        throw new Error(`Unsupported data source: ${widget.dataSource}`);
    }
  }

  /**
   * Private: Execute security events query
   */
  private async executeSecurityEventsQuery(query: any): Promise<unknown> {
    // This is a simplified implementation
    // In production, this would build more complex queries based on the query object
    const events = await this.auditLogger.querySecurityEvents({
      startDate: query.timeRange?.start,
      endDate: query.timeRange?.end,
      limit: 100
    });

    if (query.aggregation === 'count') {
      return events.totalCount;
    } else if (query.aggregation === 'group_by_severity') {
      const groups: Record<string, number> = {};
      for (const event of events.events) {
        groups[event.severity] = (groups[event.severity] || 0) + 1;
      }
      return groups;
    }

    return events.events;
  }

  /**
   * Private: Execute audit trail query
   */
  private async executeAuditTrailQuery(query: any): Promise<unknown> {
    // Simplified audit trail query implementation
    const results = await this.db.prepare(`
      SELECT * FROM audit_trail 
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp DESC 
      LIMIT 100
    `).bind(
      query.timeRange?.start?.toISOString() || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      query.timeRange?.end?.toISOString() || new Date().toISOString()
    ).all();

    return results.results;
  }

  /**
   * Private: Execute metrics query
   */
  private async executeMetricsQuery(query: any): Promise<unknown> {
    const results = await this.db.prepare(`
      SELECT * FROM security_metrics 
      WHERE timeframe_start >= ? AND timeframe_end <= ?
      ORDER BY timeframe_start DESC
    `).bind(
      query.timeRange?.start?.toISOString() || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      query.timeRange?.end?.toISOString() || new Date().toISOString()
    ).all();

    return results.results.map(row => ({
      ...row,
      event_counts: JSON.parse(row.event_counts as string),
      severity_counts: JSON.parse(row.severity_counts as string),
      category_counts: JSON.parse(row.category_counts as string)
    }));
  }

  /**
   * Private: Execute incidents query
   */
  private async executeIncidentsQuery(query: any): Promise<unknown> {
    const results = await this.db.prepare(`
      SELECT * FROM security_incidents 
      WHERE detected_at >= ? AND detected_at <= ?
      ORDER BY detected_at DESC 
      LIMIT 100
    `).bind(
      query.timeRange?.start?.toISOString() || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      query.timeRange?.end?.toISOString() || new Date().toISOString()
    ).all();

    return results.results.map(this.mapDatabaseRowToIncident);
  }

  /**
   * Private: Load dashboard configuration from database
   */
  private async loadDashboardConfig(userId: string): Promise<DashboardConfig | null> {
    // In a real implementation, this would load from a user_dashboard_configs table
    return null;
  }

  /**
   * Private: Store dashboard configuration to database
   */
  private async storeDashboardConfig(userId: string, config: DashboardConfig): Promise<void> {
    // In a real implementation, this would store to a user_dashboard_configs table
  }

  /**
   * Private: Validate dashboard configuration
   */
  private validateDashboardConfig(config: DashboardConfig): void {
    if (!config.userId || !config.role) {
      throw new Error('Invalid dashboard configuration: missing userId or role');
    }

    if (!Array.isArray(config.widgets)) {
      throw new Error('Invalid dashboard configuration: widgets must be an array');
    }

    for (const widget of config.widgets) {
      if (!widget.id || !widget.type || !widget.title) {
        throw new Error('Invalid widget configuration: missing required fields');
      }
    }
  }

  /**
   * Private: Update performance metrics
   */
  private updatePerformanceMetrics(startTime: number): void {
    const queryTime = Date.now() - startTime;
    this.performanceMetrics.queriesExecuted++;
    this.performanceMetrics.totalQueryTime += queryTime;
    this.performanceMetrics.averageQueryTime = 
      this.performanceMetrics.totalQueryTime / this.performanceMetrics.queriesExecuted;
  }

  /**
   * Private: Map database row to widget
   */
  private mapDatabaseRowToWidget(row: any): SecurityDashboardWidget {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      dataSource: row.data_source,
      query: JSON.parse(row.query),
      refreshInterval: row.refresh_interval,
      chartType: row.chart_type,
      displayOptions: row.display_options ? JSON.parse(row.display_options) : {},
      position: JSON.parse(row.position),
      size: JSON.parse(row.size),
      visibleToRoles: JSON.parse(row.visible_to_roles),
      createdBy: row.created_by,
      createdAt: new Date(row.created_at)
    };
  }

  /**
   * Private: Map database row to incident
   */
  private mapDatabaseRowToIncident(row: any): SecurityIncident {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      eventIds: JSON.parse(row.event_ids || '[]'),
      affectedUsers: JSON.parse(row.affected_users || '[]'),
      affectedResources: JSON.parse(row.affected_resources || '[]'),
      rootCause: row.root_cause,
      impactAssessment: row.impact_assessment,
      detectedAt: new Date(row.detected_at),
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      closedAt: row.closed_at ? new Date(row.closed_at) : undefined,
      assignedTo: row.assigned_to,
      responseTeam: JSON.parse(row.response_team || '[]'),
      actionsTaken: JSON.parse(row.actions_taken || '[]'),
      preventiveMeasures: JSON.parse(row.preventive_measures || '[]'),
      reportingRequired: Boolean(row.reporting_required),
      reportedToAuthorities: row.reported_to_authorities ? new Date(row.reported_to_authorities) : undefined,
      complianceFrameworks: JSON.parse(row.compliance_frameworks || '[]'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      tags: JSON.parse(row.tags || '[]'),
      externalTicketId: row.external_ticket_id
    };
  }
}