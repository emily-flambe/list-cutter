/**
 * Comprehensive alerting system interfaces for R2 storage monitoring
 */

export type AlertType = 'cost_spike' | 'error_rate' | 'performance' | 'storage_growth' | 'quota_violation' | 'custom';

export type MetricType = 'storage_bytes' | 'requests_class_a' | 'requests_class_b' | 'data_transfer_out' | 'data_transfer_in' | 'error_rate' | 'response_time' | 'throughput';

export type ThresholdOperator = '>' | '<' | '>=' | '<=' | '=' | '!=';

export type ThresholdUnit = 'bytes' | 'percentage' | 'count' | 'rate' | 'milliseconds' | 'dollars';

export type ComparisonType = 'absolute' | 'percentage_change' | 'moving_average' | 'month_over_month' | 'week_over_week';

export type ComparisonWindow = '1h' | '1d' | '1w' | '1m' | '3m';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AlertState = 'inactive' | 'active' | 'acknowledged' | 'suppressed';

export type AlertInstanceState = 'active' | 'acknowledged' | 'resolved' | 'suppressed';

export type AlertLevel = 'warning' | 'critical';

export type NotificationChannelType = 'email' | 'webhook' | 'slack' | 'discord' | 'teams' | 'sms';

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';

export type AggregationMethod = 'avg' | 'max' | 'min' | 'sum' | 'count';

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  userId?: string;
  
  // Alert configuration
  alertType: AlertType;
  metricType: MetricType;
  
  // Threshold configuration
  thresholdValue: number;
  thresholdOperator: ThresholdOperator;
  thresholdUnit: ThresholdUnit;
  
  // Comparison configuration
  comparisonType: ComparisonType;
  comparisonWindow: ComparisonWindow;
  
  // Alert conditions
  minDurationMinutes: number;
  evaluationFrequencyMinutes: number;
  aggregationMethod: AggregationMethod;
  
  // Alert severity and priority
  severity: AlertSeverity;
  priority: number;
  
  // State management
  enabled: boolean;
  state: AlertState;
  
  // Suppression rules
  suppressionDurationMinutes: number;
  maxAlertsPerDay: number;
  
  // Additional filters
  filters?: Record<string, unknown>;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastEvaluatedAt?: string;
  lastTriggeredAt?: string;
}

export interface NotificationChannel {
  id: string;
  name: string;
  channelType: NotificationChannelType;
  userId?: string;
  
  // Channel configuration
  configuration: Record<string, unknown>;
  
  // Delivery settings
  enabled: boolean;
  rateLimitPerHour: number;
  
  // Retry configuration
  maxRetries: number;
  retryDelayMinutes: number;
  
  // Templates
  subjectTemplate?: string;
  bodyTemplate?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export interface AlertRuleChannel {
  id: string;
  alertRuleId: string;
  notificationChannelId: string;
  
  // Channel-specific overrides
  severityFilter?: AlertSeverity;
  enabled: boolean;
  
  createdAt: string;
}

export interface AlertInstance {
  id: string;
  alertRuleId: string;
  
  // Alert details
  alertLevel: AlertLevel;
  currentValue: number;
  thresholdValue: number;
  
  // Alert lifecycle
  state: AlertInstanceState;
  startedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  
  // User actions
  acknowledgedBy?: string;
  resolvedBy?: string;
  notes?: string;
  
  // Alert context
  context?: Record<string, unknown>;
  affectedResources?: string[];
  
  // Escalation tracking
  escalationLevel: number;
  escalatedAt?: string;
  escalatedTo?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDelivery {
  id: string;
  alertInstanceId: string;
  notificationChannelId: string;
  
  // Delivery details
  deliveryStatus: DeliveryStatus;
  deliveryAttempt: number;
  
  // Message details
  subject?: string;
  messageBody?: string;
  
  // Delivery tracking
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  
  // Error tracking
  errorMessage?: string;
  errorCode?: string;
  
  // Retry information
  nextRetryAt?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface AlertEvaluation {
  id: string;
  alertRuleId: string;
  
  // Evaluation details
  evaluationTime: string;
  currentValue: number;
  thresholdValue: number;
  
  // Evaluation result
  thresholdBreached: boolean;
  alertTriggered: boolean;
  alertInstanceId?: string;
  
  // Evaluation context
  evaluationData?: Record<string, unknown>;
  
  // Performance metrics
  evaluationDurationMs: number;
  
  createdAt: string;
}

export interface AlertEscalationPolicy {
  id: string;
  name: string;
  description?: string;
  userId?: string;
  
  // Escalation configuration
  escalationSteps: EscalationStep[];
  
  // Timing
  initialDelayMinutes: number;
  escalationIntervalMinutes: number;
  maxEscalationLevel: number;
  
  // Conditions
  appliesToSeverity?: AlertSeverity[];
  appliesToAlertTypes?: AlertType[];
  
  // State
  enabled: boolean;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface EscalationStep {
  level: number;
  delayMinutes: number;
  channels: string[];
  customMessage?: string;
}

export interface AlertSuppressionRule {
  id: string;
  name: string;
  description?: string;
  userId?: string;
  
  // Suppression conditions
  alertRuleIds?: string[];
  alertTypes?: AlertType[];
  severities?: AlertSeverity[];
  
  // Time-based suppression
  startTime?: string;
  endTime?: string;
  daysOfWeek?: number[];
  timezone: string;
  
  // Date-based suppression
  startDate?: string;
  endDate?: string;
  
  // Conditional suppression
  conditions?: Record<string, unknown>;
  
  // State
  enabled: boolean;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface AlertConfiguration {
  // Default thresholds
  defaultThresholds: Record<AlertType, AlertThreshold>;
  
  // Evaluation settings
  evaluationFrequencyMinutes: number;
  minDurationMinutes: number;
  
  // Notification settings
  enableNotifications: boolean;
  maxNotificationsPerHour: number;
  
  // Escalation settings
  enableEscalation: boolean;
  defaultEscalationPolicy?: string;
  
  // Suppression settings
  enableSuppression: boolean;
  defaultSuppressionDurationMinutes: number;
}

export interface AlertThreshold {
  thresholdValue: number;
  thresholdOperator: ThresholdOperator;
  thresholdUnit: ThresholdUnit;
  comparisonType: ComparisonType;
  comparisonWindow: ComparisonWindow;
  severity: AlertSeverity;
}

export interface AlertDashboardData {
  // Overview statistics
  totalAlerts: number;
  activeAlerts: number;
  acknowledgedAlerts: number;
  resolvedAlerts: number;
  
  // Alert breakdown
  alertsByType: Record<AlertType, number>;
  alertsBySeverity: Record<AlertSeverity, number>;
  alertsByState: Record<AlertInstanceState, number>;
  
  // Recent alerts
  recentAlerts: AlertInstance[];
  
  // Notification statistics
  notificationStats: NotificationStats;
  
  // Performance metrics
  evaluationMetrics: EvaluationMetrics;
}

export interface NotificationStats {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  deliveryRate: number;
  averageDeliveryTime: number;
  deliveriesByChannel: Record<NotificationChannelType, number>;
}

export interface EvaluationMetrics {
  totalEvaluations: number;
  evaluationsPerMinute: number;
  averageEvaluationTime: number;
  thresholdBreaches: number;
  alertsTrigger: number;
  alertTriggerRate: number;
}

export interface AlertMetricsQuery {
  alertType?: AlertType;
  severity?: AlertSeverity;
  state?: AlertInstanceState;
  userId?: string;
  timeRange?: {
    startTime: string;
    endTime: string;
  };
  limit?: number;
  offset?: number;
}

export interface AlertHistoryItem {
  id: string;
  alertRuleId: string;
  alertRuleName: string;
  alertType: AlertType;
  severity: AlertSeverity;
  state: AlertInstanceState;
  currentValue: number;
  thresholdValue: number;
  startedAt: string;
  resolvedAt?: string;
  duration?: number;
  acknowledgedBy?: string;
  resolvedBy?: string;
  notes?: string;
}

export interface AlertTemplate {
  id: string;
  name: string;
  description?: string;
  alertType: AlertType;
  
  // Template configuration
  defaultThreshold: AlertThreshold;
  defaultNotificationChannels: string[];
  
  // Customization options
  customizableFields: string[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface AlertAnalytics {
  // Time-based metrics
  alertVolume: TimeSeriesData[];
  alertResolutionTime: TimeSeriesData[];
  
  // Type-based metrics
  alertsByType: AlertTypeAnalytics[];
  alertsByUser: UserAlertAnalytics[];
  
  // Performance metrics
  falsePositiveRate: number;
  averageResolutionTime: number;
  escalationRate: number;
  
  // Trend analysis
  weekOverWeekChange: number;
  monthOverMonthChange: number;
  
  // Top alerts
  topAlertsByFrequency: AlertFrequencyData[];
  topAlertsByDuration: AlertDurationData[];
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
}

export interface AlertTypeAnalytics {
  alertType: AlertType;
  totalAlerts: number;
  averageResolutionTime: number;
  falsePositiveRate: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface UserAlertAnalytics {
  userId: string;
  userEmail: string;
  totalAlerts: number;
  activeAlerts: number;
  averageResolutionTime: number;
  mostCommonAlertType: AlertType;
}

export interface AlertFrequencyData {
  alertRuleId: string;
  alertRuleName: string;
  alertType: AlertType;
  frequency: number;
  lastTriggered: string;
}

export interface AlertDurationData {
  alertRuleId: string;
  alertRuleName: string;
  alertType: AlertType;
  averageDuration: number;
  longestDuration: number;
}

export interface AlertCreateRequest {
  name: string;
  description?: string;
  alertType: AlertType;
  metricType: MetricType;
  thresholdValue: number;
  thresholdOperator: ThresholdOperator;
  thresholdUnit: ThresholdUnit;
  comparisonType: ComparisonType;
  comparisonWindow: ComparisonWindow;
  severity: AlertSeverity;
  priority?: number;
  minDurationMinutes?: number;
  evaluationFrequencyMinutes?: number;
  aggregationMethod?: AggregationMethod;
  suppressionDurationMinutes?: number;
  maxAlertsPerDay?: number;
  filters?: Record<string, unknown>;
  notificationChannelIds?: string[];
}

export interface AlertUpdateRequest {
  name?: string;
  description?: string;
  thresholdValue?: number;
  thresholdOperator?: ThresholdOperator;
  severity?: AlertSeverity;
  priority?: number;
  enabled?: boolean;
  minDurationMinutes?: number;
  evaluationFrequencyMinutes?: number;
  suppressionDurationMinutes?: number;
  maxAlertsPerDay?: number;
  filters?: Record<string, unknown>;
}

export interface NotificationChannelCreateRequest {
  name: string;
  channelType: NotificationChannelType;
  configuration: Record<string, unknown>;
  rateLimitPerHour?: number;
  maxRetries?: number;
  retryDelayMinutes?: number;
  subjectTemplate?: string;
  bodyTemplate?: string;
}

export interface NotificationChannelUpdateRequest {
  name?: string;
  configuration?: Record<string, unknown>;
  enabled?: boolean;
  rateLimitPerHour?: number;
  maxRetries?: number;
  retryDelayMinutes?: number;
  subjectTemplate?: string;
  bodyTemplate?: string;
}

export interface AlertAcknowledgeRequest {
  notes?: string;
}

export interface AlertResolveRequest {
  notes?: string;
}

export interface AlertTestRequest {
  alertRuleId: string;
  testValue: number;
  testContext?: Record<string, unknown>;
}

export interface AlertTestResponse {
  wouldTrigger: boolean;
  currentValue: number;
  thresholdValue: number;
  thresholdBreached: boolean;
  evaluationData: Record<string, unknown>;
  estimatedNotifications: number;
}

export interface AlertBulkOperationRequest {
  alertInstanceIds: string[];
  operation: 'acknowledge' | 'resolve' | 'suppress';
  notes?: string;
}

export interface AlertBulkOperationResponse {
  success: boolean;
  processedCount: number;
  errors: Array<{
    alertInstanceId: string;
    error: string;
  }>;
}

export interface AlertExportRequest {
  format: 'json' | 'csv' | 'xlsx';
  query?: AlertMetricsQuery;
  includeHistory?: boolean;
  includeNotifications?: boolean;
}

export interface AlertImportRequest {
  format: 'json' | 'csv';
  data: string;
  overwriteExisting?: boolean;
}

export interface AlertWebhookPayload {
  alertId: string;
  alertRuleId: string;
  alertRuleName: string;
  alertType: AlertType;
  severity: AlertSeverity;
  state: AlertInstanceState;
  currentValue: number;
  thresholdValue: number;
  startedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  userId?: string;
  context?: Record<string, unknown>;
  affectedResources?: string[];
}

export interface AlertSlackPayload {
  text: string;
  attachments: Array<{
    color: string;
    title: string;
    text: string;
    fields: Array<{
      title: string;
      value: string;
      short: boolean;
    }>;
    ts: number;
  }>;
}

export interface AlertEmailPayload {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  attachments?: Array<{
    name: string;
    content: string;
    contentType: string;
  }>;
}

export interface AlertSMSPayload {
  to: string;
  message: string;
}

export interface AlertCustomPayload {
  channelType: NotificationChannelType;
  configuration: Record<string, unknown>;
  payload: Record<string, unknown>;
}

export interface AlertNotificationContext {
  alert: AlertInstance;
  alertRule: AlertRule;
  user?: { id: string; email: string; username: string };
  currentValue: number;
  thresholdValue: number;
  severity: AlertSeverity;
  timestamp: string;
  context?: Record<string, unknown>;
  affectedResources?: string[];
}

export interface AlertEvaluationContext {
  alertRule: AlertRule;
  currentTimestamp: string;
  timeWindow: {
    startTime: string;
    endTime: string;
  };
  metrics: Record<string, unknown>;
  previousEvaluations: AlertEvaluation[];
  existingAlert?: AlertInstance;
}

export interface AlertSuppressionContext {
  alertRule: AlertRule;
  alertInstance?: AlertInstance;
  currentTimestamp: string;
  suppressionRules: AlertSuppressionRule[];
  userTimezone?: string;
}