# Issue #65: R2 Storage Monitoring & Alerting - Technical Implementation Plan

## Executive Summary
**Priority**: HIGH (Essential for production operations)
**Estimated Duration**: 3 days
**Dependencies**: Issue #64 (Database Schema) must be completed first
**Risk Level**: Medium (monitoring framework exists, needs activation)

## Problem Statement
While comprehensive monitoring services exist (MetricsService, cost tracking, performance monitoring), they need to be activated and integrated with user-facing dashboards and operational alerting systems. This creates a blind spot for production operations where cost spikes, performance issues, and usage anomalies go undetected.

## Technical Analysis

### Current State
- ✅ **MetricsService implemented**: Comprehensive metrics collection with Analytics Engine
- ✅ **Cost tracking system**: R2 pricing calculations and monthly billing
- ✅ **Performance monitoring**: Throughput, latency, error rate tracking
- ✅ **Database schema**: Storage metrics, cost tracking, pricing tiers tables
- ❌ **Cron job activation**: Monitoring cron jobs are commented out in wrangler.toml
- ❌ **User-facing dashboard**: No frontend monitoring interface
- ❌ **Operational alerting**: Alert system exists but not configured
- ❌ **Real-time monitoring**: Metrics collection not running continuously

### Monitoring Architecture Gap Analysis
**Implemented Components**:
- Advanced metrics collection and analytics
- Cost calculation and billing tracking
- Performance monitoring with detailed metrics
- Alert rule engine and notification system

**Missing Activations**:
- Cron job scheduling for continuous monitoring
- Dashboard frontend for user visibility
- Alert configuration and notification setup
- Real-time metrics streaming

## Implementation Strategy

### Phase 1: Activate Core Monitoring Systems (Day 1)

#### Task 1.1: Enable Monitoring Cron Jobs
**File**: `cloudflare/workers/wrangler.toml`

```toml
# Uncomment and configure monitoring cron jobs
[[triggers.crons]]
cron = "*/5 * * * *"  # Every 5 minutes
route = "/api/monitoring/collect-metrics"

[[triggers.crons]]
cron = "0 */6 * * *"  # Every 6 hours
route = "/api/monitoring/calculate-costs"

[[triggers.crons]]
cron = "0 0 * * *"    # Daily at midnight
route = "/api/monitoring/generate-daily-report"

[[triggers.crons]]
cron = "0 0 1 * *"    # Monthly on 1st at midnight
route = "/api/monitoring/generate-monthly-report"

[[triggers.crons]]
cron = "*/1 * * * *"  # Every minute
route = "/api/monitoring/check-alerts"
```

#### Task 1.2: Create Monitoring Endpoints
**File**: `cloudflare/workers/src/handlers/monitoring-handler.ts`

```typescript
class MonitoringHandler {
  constructor(
    private metricsService: MetricsService,
    private costTracker: CostTracker,
    private alertManager: AlertManager
  ) {}
  
  async handleMetricsCollection(request: Request): Promise<Response> {
    try {
      // 1. Collect current metrics
      const metrics = await this.metricsService.collectCurrentMetrics();
      
      // 2. Store metrics in database
      await this.metricsService.storeMetrics(metrics);
      
      // 3. Update Analytics Engine
      await this.metricsService.sendToAnalyticsEngine(metrics);
      
      // 4. Check for anomalies
      const anomalies = await this.detectAnomalies(metrics);
      if (anomalies.length > 0) {
        await this.alertManager.processAnomalies(anomalies);
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        metricsCollected: metrics.length,
        anomaliesDetected: anomalies.length
      }), { status: 200 });
      
    } catch (error) {
      console.error('Metrics collection failed:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 500 });
    }
  }
  
  async handleCostCalculation(request: Request): Promise<Response> {
    try {
      // 1. Calculate current costs
      const costData = await this.costTracker.calculateCurrentCosts();
      
      // 2. Store cost data
      await this.costTracker.storeCostData(costData);
      
      // 3. Check cost thresholds
      const costAlerts = await this.costTracker.checkCostThresholds(costData);
      if (costAlerts.length > 0) {
        await this.alertManager.processCostAlerts(costAlerts);
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        totalCost: costData.totalCost,
        alertsTriggered: costAlerts.length
      }), { status: 200 });
      
    } catch (error) {
      console.error('Cost calculation failed:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 500 });
    }
  }
  
  async handleAlertChecking(request: Request): Promise<Response> {
    try {
      // 1. Check all alert rules
      const triggeredAlerts = await this.alertManager.checkAllAlerts();
      
      // 2. Process triggered alerts
      for (const alert of triggeredAlerts) {
        await this.alertManager.processAlert(alert);
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        alertsChecked: triggeredAlerts.length
      }), { status: 200 });
      
    } catch (error) {
      console.error('Alert checking failed:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 500 });
    }
  }
}
```

#### Task 1.3: Configure Alert Rules
**File**: `cloudflare/workers/src/services/alert-configuration.ts`

```typescript
class AlertConfiguration {
  constructor(private db: D1Database) {}
  
  async setupDefaultAlerts(): Promise<void> {
    const defaultAlerts = [
      // Cost monitoring alerts
      {
        name: 'High Monthly Cost',
        type: 'cost_threshold',
        threshold: 100, // $100 monthly
        severity: 'high',
        condition: 'monthly_cost > threshold'
      },
      {
        name: 'Daily Cost Spike',
        type: 'cost_anomaly',
        threshold: 50, // 50% increase
        severity: 'medium',
        condition: 'daily_cost_increase > threshold'
      },
      
      // Performance alerts
      {
        name: 'High Error Rate',
        type: 'error_rate',
        threshold: 5, // 5% error rate
        severity: 'high',
        condition: 'error_rate > threshold'
      },
      {
        name: 'Slow Response Time',
        type: 'latency',
        threshold: 2000, // 2 seconds
        severity: 'medium',
        condition: 'avg_response_time > threshold'
      },
      
      // Storage alerts
      {
        name: 'Storage Quota Warning',
        type: 'quota_usage',
        threshold: 80, // 80% of quota
        severity: 'medium',
        condition: 'quota_usage_percent > threshold'
      },
      {
        name: 'Large File Upload',
        type: 'file_size',
        threshold: 1000000000, // 1GB
        severity: 'low',
        condition: 'file_size > threshold'
      },
      
      // Security alerts
      {
        name: 'Multiple Failed Access',
        type: 'security_event',
        threshold: 10, // 10 failed attempts
        severity: 'high',
        condition: 'failed_access_count > threshold'
      }
    ];
    
    for (const alert of defaultAlerts) {
      await this.createAlert(alert);
    }
  }
  
  private async createAlert(alertConfig: AlertConfig): Promise<void> {
    await this.db.prepare(`
      INSERT INTO alert_rules (
        id, name, type, threshold, severity, condition, 
        enabled, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      alertConfig.name,
      alertConfig.type,
      alertConfig.threshold,
      alertConfig.severity,
      alertConfig.condition,
      true,
      new Date().toISOString()
    ).run();
  }
}
```

### Phase 2: Create User-Facing Dashboard (Day 2)

#### Task 2.1: Dashboard API Endpoints
**File**: `cloudflare/workers/src/handlers/dashboard-handler.ts`

```typescript
class DashboardHandler {
  constructor(
    private metricsService: MetricsService,
    private costTracker: CostTracker,
    private storageAnalyzer: StorageAnalyzer
  ) {}
  
  async getDashboardData(request: Request): Promise<Response> {
    try {
      const userId = await this.extractUserId(request);
      
      // 1. Get current metrics
      const metrics = await this.metricsService.getUserMetrics(userId);
      
      // 2. Get cost data
      const costData = await this.costTracker.getUserCosts(userId);
      
      // 3. Get storage analytics
      const storageData = await this.storageAnalyzer.getUserStorage(userId);
      
      // 4. Get recent activity
      const recentActivity = await this.getRecentActivity(userId);
      
      const dashboardData = {
        metrics: {
          totalFiles: metrics.totalFiles,
          totalStorage: metrics.totalStorage,
          uploadsToday: metrics.uploadsToday,
          downloadsToday: metrics.downloadsToday,
          errorRate: metrics.errorRate,
          avgResponseTime: metrics.avgResponseTime
        },
        costs: {
          monthlyTotal: costData.monthlyTotal,
          dailyAverage: costData.dailyAverage,
          storageCharges: costData.storageCharges,
          requestCharges: costData.requestCharges,
          trend: costData.trend
        },
        storage: {
          used: storageData.used,
          quota: storageData.quota,
          usagePercent: storageData.usagePercent,
          fileTypes: storageData.fileTypes,
          largestFiles: storageData.largestFiles
        },
        activity: recentActivity,
        alerts: await this.getActiveAlerts(userId)
      };
      
      return new Response(JSON.stringify(dashboardData), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Dashboard data retrieval failed:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to load dashboard data' 
      }), { status: 500 });
    }
  }
  
  async getMetricsHistory(request: Request): Promise<Response> {
    try {
      const userId = await this.extractUserId(request);
      const timeRange = new URL(request.url).searchParams.get('range') || '7d';
      
      const historyData = await this.metricsService.getMetricsHistory(
        userId, 
        timeRange
      );
      
      return new Response(JSON.stringify(historyData), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Metrics history retrieval failed:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to load metrics history' 
      }), { status: 500 });
    }
  }
}
```

#### Task 2.2: Dashboard Frontend Components
**File**: `frontend/src/components/MonitoringDashboard.tsx`

```typescript
interface DashboardData {
  metrics: UserMetrics;
  costs: CostData;
  storage: StorageData;
  activity: ActivityData[];
  alerts: AlertData[];
}

export const MonitoringDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);
  
  const loadDashboardData = async () => {
    try {
      const response = await fetch('/api/dashboard');
      if (!response.ok) throw new Error('Failed to load dashboard');
      const data = await response.json();
      setDashboardData(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;
  if (!dashboardData) return <NoDataDisplay />;
  
  return (
    <div className="monitoring-dashboard">
      <div className="dashboard-header">
        <h1>Storage Monitoring Dashboard</h1>
        <div className="last-updated">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>
      
      <div className="dashboard-grid">
        <MetricsOverview metrics={dashboardData.metrics} />
        <CostAnalysis costs={dashboardData.costs} />
        <StorageUsage storage={dashboardData.storage} />
        <RecentActivity activity={dashboardData.activity} />
        <ActiveAlerts alerts={dashboardData.alerts} />
      </div>
    </div>
  );
};

const MetricsOverview: React.FC<{ metrics: UserMetrics }> = ({ metrics }) => (
  <div className="metrics-overview">
    <h2>Performance Metrics</h2>
    <div className="metrics-grid">
      <MetricCard 
        title="Total Files" 
        value={metrics.totalFiles} 
        trend={metrics.filesTrend}
      />
      <MetricCard 
        title="Storage Used" 
        value={formatBytes(metrics.totalStorage)} 
        trend={metrics.storageTrend}
      />
      <MetricCard 
        title="Error Rate" 
        value={`${metrics.errorRate.toFixed(2)}%`} 
        trend={metrics.errorTrend}
        warning={metrics.errorRate > 5}
      />
      <MetricCard 
        title="Avg Response Time" 
        value={`${metrics.avgResponseTime}ms`} 
        trend={metrics.responseTrend}
        warning={metrics.avgResponseTime > 2000}
      />
    </div>
  </div>
);

const CostAnalysis: React.FC<{ costs: CostData }> = ({ costs }) => (
  <div className="cost-analysis">
    <h2>Cost Analysis</h2>
    <div className="cost-summary">
      <div className="cost-item">
        <label>Monthly Total</label>
        <span className="cost-value">${costs.monthlyTotal.toFixed(2)}</span>
      </div>
      <div className="cost-item">
        <label>Daily Average</label>
        <span className="cost-value">${costs.dailyAverage.toFixed(2)}</span>
      </div>
      <div className="cost-breakdown">
        <div className="breakdown-item">
          <span>Storage: ${costs.storageCharges.toFixed(2)}</span>
        </div>
        <div className="breakdown-item">
          <span>Requests: ${costs.requestCharges.toFixed(2)}</span>
        </div>
      </div>
    </div>
    <CostTrendChart data={costs.trend} />
  </div>
);
```

### Phase 3: Advanced Alerting and Notifications (Day 3)

#### Task 3.1: Enhanced Alert Processing
**File**: `cloudflare/workers/src/services/enhanced-alert-manager.ts`

```typescript
class EnhancedAlertManager {
  constructor(
    private db: D1Database,
    private notificationService: NotificationService,
    private metricsService: MetricsService
  ) {}
  
  async processAlert(alert: TriggeredAlert): Promise<void> {
    // 1. Check if alert should be suppressed
    if (await this.shouldSuppressAlert(alert)) {
      return;
    }
    
    // 2. Determine alert severity and escalation
    const escalationLevel = await this.determineEscalation(alert);
    
    // 3. Send notifications based on escalation level
    await this.sendNotifications(alert, escalationLevel);
    
    // 4. Record alert in database
    await this.recordAlert(alert);
    
    // 5. Trigger automated responses if configured
    await this.triggerAutomatedResponse(alert);
  }
  
  private async shouldSuppressAlert(alert: TriggeredAlert): Promise<boolean> {
    // Check for alert suppression rules
    // - Rate limiting (don't spam same alert)
    // - Maintenance windows
    // - User preferences
    
    const recentSimilarAlerts = await this.db.prepare(`
      SELECT COUNT(*) as count FROM alert_notifications 
      WHERE alert_type = ? AND created_at > datetime('now', '-1 hour')
    `).bind(alert.type).first();
    
    return (recentSimilarAlerts?.count || 0) > 5; // Max 5 similar alerts per hour
  }
  
  private async determineEscalation(alert: TriggeredAlert): Promise<EscalationLevel> {
    const escalationRules = await this.getEscalationRules(alert.type);
    
    // Check escalation conditions
    for (const rule of escalationRules) {
      if (await this.evaluateEscalationCondition(alert, rule)) {
        return rule.escalationLevel;
      }
    }
    
    return 'standard';
  }
  
  private async sendNotifications(alert: TriggeredAlert, escalation: EscalationLevel): Promise<void> {
    const notifications = await this.getNotificationTargets(alert.type, escalation);
    
    for (const notification of notifications) {
      switch (notification.type) {
        case 'email':
          await this.notificationService.sendEmail(notification.target, alert);
          break;
        case 'webhook':
          await this.notificationService.sendWebhook(notification.target, alert);
          break;
        case 'slack':
          await this.notificationService.sendSlack(notification.target, alert);
          break;
      }
    }
  }
  
  private async triggerAutomatedResponse(alert: TriggeredAlert): Promise<void> {
    // Trigger automated responses based on alert type
    switch (alert.type) {
      case 'high_error_rate':
        await this.enableCircuitBreaker();
        break;
      case 'quota_exceeded':
        await this.notifyQuotaExceeded(alert.userId);
        break;
      case 'security_threat':
        await this.escalateSecurityIncident(alert);
        break;
    }
  }
}
```

#### Task 3.2: Notification Service Integration
**File**: `cloudflare/workers/src/services/notification-service.ts`

```typescript
class NotificationService {
  constructor(
    private env: Environment,
    private db: D1Database
  ) {}
  
  async sendEmail(recipient: string, alert: TriggeredAlert): Promise<void> {
    const emailData = {
      to: recipient,
      subject: `[Cutty Alert] ${alert.name}`,
      html: this.generateEmailHtml(alert),
      text: this.generateEmailText(alert)
    };
    
    // Use Cloudflare Email API or external service
    await this.sendEmailViaAPI(emailData);
  }
  
  async sendWebhook(webhookUrl: string, alert: TriggeredAlert): Promise<void> {
    const webhookData = {
      alert_id: alert.id,
      alert_name: alert.name,
      alert_type: alert.type,
      severity: alert.severity,
      timestamp: alert.timestamp,
      details: alert.details,
      user_id: alert.userId
    };
    
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookData)
    });
  }
  
  async sendSlack(slackWebhookUrl: string, alert: TriggeredAlert): Promise<void> {
    const slackMessage = {
      text: `🚨 Alert: ${alert.name}`,
      attachments: [{
        color: this.getSlackColor(alert.severity),
        fields: [
          { title: 'Type', value: alert.type, short: true },
          { title: 'Severity', value: alert.severity, short: true },
          { title: 'Timestamp', value: alert.timestamp, short: true },
          { title: 'Details', value: alert.details, short: false }
        ]
      }]
    };
    
    await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    });
  }
  
  private generateEmailHtml(alert: TriggeredAlert): string {
    return `
      <html>
        <body>
          <h2>🚨 Cutty Storage Alert</h2>
          <p><strong>Alert:</strong> ${alert.name}</p>
          <p><strong>Type:</strong> ${alert.type}</p>
          <p><strong>Severity:</strong> ${alert.severity}</p>
          <p><strong>Timestamp:</strong> ${alert.timestamp}</p>
          <p><strong>Details:</strong> ${alert.details}</p>
          
          <h3>Recommended Actions:</h3>
          <ul>
            ${alert.recommendations?.map(r => `<li>${r}</li>`).join('') || '<li>Review the alert details and take appropriate action</li>'}
          </ul>
          
          <p><a href="${this.env.DASHBOARD_URL}">View Dashboard</a></p>
        </body>
      </html>
    `;
  }
}
```

## Validation and Testing

### Monitoring System Testing
```bash
# Test cron job endpoints
curl -X POST https://cutty-api.emilycogsdill.com/api/monitoring/collect-metrics
curl -X POST https://cutty-api.emilycogsdill.com/api/monitoring/calculate-costs
curl -X POST https://cutty-api.emilycogsdill.com/api/monitoring/check-alerts

# Test dashboard API
curl -H "Authorization: Bearer TOKEN" https://cutty-api.emilycogsdill.com/api/dashboard
curl -H "Authorization: Bearer TOKEN" https://cutty-api.emilycogsdill.com/api/dashboard/metrics-history?range=7d
```

### Alert System Testing
```bash
# Test alert creation
npm test -- --testNamePattern="AlertManager.*creation"

# Test alert processing
npm test -- --testNamePattern="AlertManager.*processing"

# Test notification sending
npm test -- --testNamePattern="NotificationService.*send"
```

### Dashboard Testing
```bash
# Test dashboard components
npm test -- --testNamePattern="MonitoringDashboard"

# Test real-time updates
npm test -- --testNamePattern="Dashboard.*realtime"
```

## Success Criteria

### Core Monitoring
- [ ] Metrics collection running continuously via cron jobs
- [ ] Cost calculations updating regularly
- [ ] Performance metrics being tracked and stored
- [ ] Alert rules configured and active

### User Experience
- [ ] Dashboard displays real-time metrics
- [ ] Cost analysis visible to users
- [ ] Storage usage tracking operational
- [ ] Alert notifications working

### Operational Excellence
- [ ] Automated alerting for cost spikes
- [ ] Performance issue detection
- [ ] Security event monitoring
- [ ] Comprehensive logging and reporting

## Risk Mitigation

### High Risk: Monitoring Overload
**Mitigation**: 
- Rate limiting on monitoring endpoints
- Efficient metrics collection and storage
- Optimized database queries for dashboard
- Caching for frequently accessed data

### Medium Risk: Alert Fatigue
**Mitigation**:
- Intelligent alert suppression
- Escalation-based notifications
- Configurable alert thresholds
- Alert correlation and grouping

### Low Risk: Dashboard Performance
**Mitigation**:
- Efficient data aggregation
- Frontend caching strategies
- Incremental data loading
- Performance monitoring of dashboard itself

## Deliverables

### Monitoring Infrastructure
- [ ] Activated cron jobs for continuous monitoring
- [ ] Metrics collection and storage system
- [ ] Cost tracking and analysis
- [ ] Alert rule configuration

### User Interface
- [ ] Real-time monitoring dashboard
- [ ] Cost analysis interface
- [ ] Storage usage visualization
- [ ] Alert management interface

### Alerting System
- [ ] Comprehensive alert rules
- [ ] Multi-channel notification system
- [ ] Escalation procedures
- [ ] Alert suppression and management

## Next Steps After Completion

1. **Immediate**: Coordinate with Issue #67 (Security) for security monitoring integration
2. **Week 2**: Integrate with Issue #68 (Disaster Recovery) for backup monitoring
3. **Week 3**: Optimize based on real production metrics
4. **Ongoing**: Monitor system health and adjust thresholds as needed

This monitoring and alerting system provides essential visibility into production operations and enables proactive management of the R2 storage system.