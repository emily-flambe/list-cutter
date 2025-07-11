/**
 * Security monitoring services index
 * 
 * This module provides comprehensive security monitoring capabilities including:
 * - Event logging and audit trails
 * - Threat detection and response
 * - Performance metrics collection
 * - Analytics and reporting
 */

export { SecurityLogger, type SecurityEvent } from './logger';
export { ThreatDetector, THREAT_RULES, type ThreatRule } from './threats';
export { MetricsCollector, RequestTimer, withMetrics, type PerformanceMetric, type MetricAggregation } from './metrics';
export { SecurityAnalyticsAggregator, type DailyAnalytics, type SecuritySummary } from './aggregator';