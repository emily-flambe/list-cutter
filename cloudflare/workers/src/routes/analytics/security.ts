import type { Env } from '../../types';
import { SecurityLogger } from '../../services/security/logger';
import { ThreatDetector } from '../../services/security/threat-detector';
import { MetricsCollector } from '../../services/security/metrics';
import { requireAuth } from '../../middleware/auth';
import { ApiError } from '../../types/errors';

/**
 * Get comprehensive security analytics for a date range
 */
export async function getSecurityAnalytics(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // Require authentication for security analytics
    await requireAuth(request, env);
    
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '7');
    const endDate = url.searchParams.get('end_date') || new Date().toISOString().split('T')[0];
    const startDate = url.searchParams.get('start_date') || 
      new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    
    if (days > 90) {
      throw new ApiError(400, 'Maximum date range is 90 days');
    }
    
    // TODO: Re-implement SecurityAnalyticsAggregator
    // const aggregator = new SecurityAnalyticsAggregator(env);
    // For now, return basic analytics using existing services
    const metricsCollector = new MetricsCollector(env);
    const threatDetector = new ThreatDetector(env);
    
    // Basic placeholder response until SecurityAnalyticsAggregator is implemented
    const summary = {
      total_events: 0,
      threat_incidents: 0,
      auth_failures: 0,
      file_validations: 0
    };
    
    const dailyAnalytics = [];
    const trends = {
      threat_level: 'low',
      incident_trend: 'stable'
    };
    
    return new Response(JSON.stringify({
      period: {
        start: startDate,
        end: endDate,
        days
      },
      summary,
      daily_analytics: dailyAnalytics,
      trends
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    console.error('Failed to fetch security analytics:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch analytics data' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get real-time security metrics and performance data
 */
export async function getSecurityMetrics(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    await requireAuth(request, env);
    
    const url = new URL(request.url);
    const minutes = parseInt(url.searchParams.get('minutes') || '60');
    
    if (minutes > 1440) { // 24 hours max
      throw new ApiError(400, 'Maximum time range is 1440 minutes (24 hours)');
    }
    
    const metrics = new MetricsCollector(env);
    const threatDetector = new ThreatDetector(env, new SecurityLogger(env));
    
    // Get performance metrics
    const performanceSummary = await metrics.getPerformanceSummary();
    
    // Get error rates
    const errorRate = await metrics.getErrorRate(minutes);
    const avgResponseTime = await metrics.getAverageResponseTime(minutes);
    
    // Get threat detection stats
    const threatStats = await threatDetector.getThreatStats(Math.round(minutes / 60));
    
    return new Response(JSON.stringify({
      time_range_minutes: minutes,
      timestamp: new Date().toISOString(),
      performance: {
        error_rate: errorRate,
        avg_response_time: avgResponseTime,
        ...performanceSummary
      },
      security: threatStats
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    console.error('Failed to fetch security metrics:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch metrics data' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get recent security events with filtering
 */
export async function getSecurityEvents(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    await requireAuth(request, env);
    
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const eventType = url.searchParams.get('event_type');
    const ipAddress = url.searchParams.get('ip_address');
    const userId = url.searchParams.get('user_id');
    const hoursBack = parseInt(url.searchParams.get('hours') || '24');
    
    const sinceTimestamp = Date.now() - (hoursBack * 60 * 60 * 1000);
    
    let query = `
      SELECT * FROM security_events 
      WHERE timestamp > ?
    `;
    const params: any[] = [sinceTimestamp];
    
    if (eventType) {
      query += ` AND event_type = ?`;
      params.push(eventType);
    }
    
    if (ipAddress) {
      query += ` AND ip_address = ?`;
      params.push(ipAddress);
    }
    
    if (userId) {
      query += ` AND user_id = ?`;
      params.push(parseInt(userId));
    }
    
    query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const results = await env.DB.prepare(query).bind(...params).all();
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total FROM security_events 
      WHERE timestamp > ?
    `;
    const countParams: any[] = [sinceTimestamp];
    
    if (eventType) {
      countQuery += ` AND event_type = ?`;
      countParams.push(eventType);
    }
    
    if (ipAddress) {
      countQuery += ` AND ip_address = ?`;
      countParams.push(ipAddress);
    }
    
    if (userId) {
      countQuery += ` AND user_id = ?`;
      countParams.push(parseInt(userId));
    }
    
    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();
    const total = countResult?.total as number || 0;
    
    const events = results.results.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      event_type: row.event_type,
      user_id: row.user_id,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      endpoint: row.endpoint,
      method: row.method,
      success: Boolean(row.success),
      error_code: row.error_code,
      error_message: row.error_message,
      metadata: JSON.parse(row.metadata as string || '{}')
    }));
    
    return new Response(JSON.stringify({
      events,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total
      },
      filters: {
        event_type: eventType,
        ip_address: ipAddress,
        user_id: userId,
        hours_back: hoursBack
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    console.error('Failed to fetch security events:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch events data' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get blocked IPs and threat information
 */
export async function getBlockedIPs(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    await requireAuth(request, env);
    
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    
    // Get blocked IPs from KV store
    const blockedIPs: Array<{
      ip_address: string;
      blocked_at: number;
      expires_at: number;
      severity: string;
      reason: string;
      manual: boolean;
    }> = [];
    
    // Note: In a real implementation, we'd need to list KV keys or use a separate index
    // For now, we'll get recent block events from the database
    const blockEvents = await env.DB.prepare(`
      SELECT * FROM security_events 
      WHERE event_type IN ('ip_blocked_automatic', 'ip_blocked_manual')
      AND timestamp > ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).bind(Date.now() - (24 * 60 * 60 * 1000), limit).all();
    
    const threatDetector = new ThreatDetector(env, new SecurityLogger(env));
    
    for (const event of blockEvents.results) {
      if (!event.ip_address) continue;
      
      const blockInfo = await threatDetector.getIPBlockInfo(event.ip_address as string);
      if (blockInfo.blocked) {
        blockedIPs.push({
          ip_address: event.ip_address as string,
          blocked_at: event.timestamp as number,
          expires_at: blockInfo.expires_at!,
          severity: blockInfo.severity!,
          reason: blockInfo.reason!,
          manual: event.event_type === 'ip_blocked_manual'
        });
      }
    }
    
    // Remove duplicates and sort by most recent
    const uniqueBlocked = blockedIPs
      .filter((ip, index, self) => 
        index === self.findIndex(other => other.ip_address === ip.ip_address)
      )
      .sort((a, b) => b.blocked_at - a.blocked_at);
    
    return new Response(JSON.stringify({
      blocked_ips: uniqueBlocked,
      total_blocked: uniqueBlocked.length,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    console.error('Failed to fetch blocked IPs:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch blocked IPs data' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Manually block an IP address
 */
export async function blockIP(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    await requireAuth(request, env);
    
    if (request.method !== 'POST') {
      throw new ApiError(405, 'Method not allowed');
    }
    
    const body = await request.json() as {
      ip_address: string;
      reason: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      duration_seconds?: number;
    };
    
    if (!body.ip_address || !body.reason) {
      throw new ApiError(400, 'IP address and reason are required');
    }
    
    // Validate IP address format
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (!ipRegex.test(body.ip_address)) {
      throw new ApiError(400, 'Invalid IP address format');
    }
    
    const threatDetector = new ThreatDetector(env, new SecurityLogger(env));
    
    await threatDetector.blockIP(
      body.ip_address,
      body.reason,
      body.severity || 'medium',
      body.duration_seconds
    );
    
    return new Response(JSON.stringify({
      success: true,
      message: `IP ${body.ip_address} has been blocked`,
      ip_address: body.ip_address,
      reason: body.reason,
      severity: body.severity || 'medium'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    console.error('Failed to block IP:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to block IP address' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Unblock an IP address
 */
export async function unblockIP(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    await requireAuth(request, env);
    
    if (request.method !== 'POST') {
      throw new ApiError(405, 'Method not allowed');
    }
    
    const body = await request.json() as {
      ip_address: string;
      reason: string;
    };
    
    if (!body.ip_address || !body.reason) {
      throw new ApiError(400, 'IP address and reason are required');
    }
    
    const threatDetector = new ThreatDetector(env, new SecurityLogger(env));
    
    await threatDetector.unblockIP(body.ip_address, body.reason);
    
    return new Response(JSON.stringify({
      success: true,
      message: `IP ${body.ip_address} has been unblocked`,
      ip_address: body.ip_address,
      reason: body.reason
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    console.error('Failed to unblock IP:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to unblock IP address' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Trigger manual analytics aggregation
 */
export async function triggerAggregation(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    await requireAuth(request, env);
    
    if (request.method !== 'POST') {
      throw new ApiError(405, 'Method not allowed');
    }
    
    const body = await request.json() as {
      date?: string;
      start_date?: string;
      end_date?: string;
    };
    
    const aggregator = new SecurityAnalyticsAggregator(env);
    
    if (body.start_date && body.end_date) {
      // Aggregate date range
      await aggregator.aggregateDateRange(body.start_date, body.end_date);
      
      return new Response(JSON.stringify({
        success: true,
        message: `Analytics aggregated for date range ${body.start_date} to ${body.end_date}`
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } else if (body.date) {
      // Aggregate specific date
      await aggregator.aggregateDaily(body.date);
      
      return new Response(JSON.stringify({
        success: true,
        message: `Analytics aggregated for date ${body.date}`
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } else {
      // Aggregate yesterday (default)
      await aggregator.runDailyAggregation();
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateString = yesterday.toISOString().split('T')[0];
      
      return new Response(JSON.stringify({
        success: true,
        message: `Analytics aggregated for yesterday (${dateString})`
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    console.error('Failed to trigger aggregation:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to trigger analytics aggregation' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}