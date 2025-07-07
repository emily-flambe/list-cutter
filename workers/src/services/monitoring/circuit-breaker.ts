import type { Env } from '../../types';

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number; // milliseconds
  monitoringWindow: number; // milliseconds
  slowCallThreshold: number; // milliseconds
  serviceName: string;
}

export interface CircuitBreakerMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  slowCalls: number;
  averageResponseTime: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
}

export interface CircuitBreakerEvent {
  timestamp: string;
  state: CircuitBreakerState;
  previousState?: CircuitBreakerState;
  reason: string;
  failureCount: number;
  successCount: number;
  metrics: CircuitBreakerMetrics;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private lastSuccessTime: number = 0;
  private nextAttempt: number = 0;
  private metrics: CircuitBreakerMetrics;
  private readonly config: CircuitBreakerConfig;
  private readonly env: Env;

  constructor(config: CircuitBreakerConfig, env: Env) {
    this.config = config;
    this.env = env;
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      slowCalls: 0,
      averageResponseTime: 0,
      lastFailureTime: undefined,
      lastSuccessTime: undefined
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.checkAndUpdateState();

    if (this.state === CircuitBreakerState.OPEN) {
      throw new Error(`Circuit breaker is OPEN for ${this.config.serviceName}. Service unavailable.`);
    }

    const startTime = Date.now();
    this.metrics.totalCalls++;

    try {
      const result = await fn();
      const responseTime = Date.now() - startTime;
      await this.onSuccess(responseTime);
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.onFailure(error, responseTime);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private async onSuccess(responseTime: number): Promise<void> {
    this.successCount++;
    this.metrics.successfulCalls++;
    this.lastSuccessTime = Date.now();
    
    // Track slow calls
    if (responseTime > this.config.slowCallThreshold) {
      this.metrics.slowCalls++;
    }

    // Update average response time
    this.updateAverageResponseTime(responseTime);

    // Transition from HALF_OPEN to CLOSED if we have enough successful calls
    if (this.state === CircuitBreakerState.HALF_OPEN && this.successCount >= 3) {
      await this.transitionToState(CircuitBreakerState.CLOSED, 'Successful recovery after half-open state');
    }
  }

  /**
   * Handle failed execution
   */
  private async onFailure(error: unknown, responseTime: number): Promise<void> {
    this.failureCount++;
    this.metrics.failedCalls++;
    this.lastFailureTime = Date.now();
    this.metrics.lastFailureTime = this.lastFailureTime;

    // Update average response time
    this.updateAverageResponseTime(responseTime);

    // Check if we should transition to OPEN state
    if (this.state === CircuitBreakerState.CLOSED && this.failureCount >= this.config.failureThreshold) {
      await this.transitionToState(CircuitBreakerState.OPEN, `Failure threshold exceeded: ${this.failureCount} failures`);
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      await this.transitionToState(CircuitBreakerState.OPEN, 'Failed during half-open state');
    }
  }

  /**
   * Check current state and update if necessary
   */
  private async checkAndUpdateState(): Promise<void> {
    const now = Date.now();

    // Transition from OPEN to HALF_OPEN after recovery timeout
    if (this.state === CircuitBreakerState.OPEN && now >= this.nextAttempt) {
      await this.transitionToState(CircuitBreakerState.HALF_OPEN, 'Recovery timeout reached');
    }
  }

  /**
   * Transition to a new state
   */
  private async transitionToState(newState: CircuitBreakerState, reason: string): Promise<void> {
    const previousState = this.state;
    this.state = newState;

    // Reset counters on state transitions
    if (newState === CircuitBreakerState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
    } else if (newState === CircuitBreakerState.HALF_OPEN) {
      this.successCount = 0;
    } else if (newState === CircuitBreakerState.OPEN) {
      this.nextAttempt = Date.now() + this.config.recoveryTimeout;
    }

    // Log the state transition
    await this.logStateTransition(previousState, newState, reason);
  }

  /**
   * Log state transition to database
   */
  private async logStateTransition(
    previousState: CircuitBreakerState,
    newState: CircuitBreakerState,
    reason: string
  ): Promise<void> {
    try {
      const event: CircuitBreakerEvent = {
        timestamp: new Date().toISOString(),
        state: newState,
        previousState,
        reason,
        failureCount: this.failureCount,
        successCount: this.successCount,
        metrics: { ...this.metrics }
      };

      await this.env.DB.prepare(`
        INSERT INTO circuit_breaker_events (
          timestamp, state, previous_state, reason, failure_count, 
          success_count, failure_threshold, recovery_timeout_ms, 
          service_name, metrics
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        event.timestamp,
        event.state,
        event.previousState,
        event.reason,
        event.failureCount,
        event.successCount,
        this.config.failureThreshold,
        this.config.recoveryTimeout,
        this.config.serviceName,
        JSON.stringify(event.metrics)
      ).run();

      console.log(`Circuit breaker state transition: ${previousState} -> ${newState} (${reason})`);
    } catch (error) {
      console.error('Failed to log circuit breaker state transition:', error);
    }
  }

  /**
   * Update average response time using exponential moving average
   */
  private updateAverageResponseTime(responseTime: number): void {
    if (this.metrics.averageResponseTime === 0) {
      this.metrics.averageResponseTime = responseTime;
    } else {
      // Use exponential moving average with alpha = 0.1
      this.metrics.averageResponseTime = 0.1 * responseTime + 0.9 * this.metrics.averageResponseTime;
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  /**
   * Get circuit breaker configuration
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * Check if circuit breaker allows calls
   */
  isCallAllowed(): boolean {
    return this.state !== CircuitBreakerState.OPEN;
  }

  /**
   * Get failure rate percentage
   */
  getFailureRate(): number {
    if (this.metrics.totalCalls === 0) return 0;
    return (this.metrics.failedCalls / this.metrics.totalCalls) * 100;
  }

  /**
   * Get success rate percentage
   */
  getSuccessRate(): number {
    if (this.metrics.totalCalls === 0) return 0;
    return (this.metrics.successfulCalls / this.metrics.totalCalls) * 100;
  }

  /**
   * Get time until next attempt (for OPEN state)
   */
  getTimeUntilNextAttempt(): number {
    if (this.state !== CircuitBreakerState.OPEN) return 0;
    return Math.max(0, this.nextAttempt - Date.now());
  }

  /**
   * Reset circuit breaker to initial state (for testing/admin purposes)
   */
  async reset(): Promise<void> {
    const previousState = this.state;
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = 0;
    this.nextAttempt = 0;
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      slowCalls: 0,
      averageResponseTime: 0,
      lastFailureTime: undefined,
      lastSuccessTime: undefined
    };

    await this.logStateTransition(previousState, CircuitBreakerState.CLOSED, 'Manual reset');
  }

  /**
   * Get circuit breaker health status
   */
  getHealthStatus(): {
    state: CircuitBreakerState;
    isHealthy: boolean;
    failureRate: number;
    successRate: number;
    averageResponseTime: number;
    totalCalls: number;
    timeUntilNextAttempt?: number;
  } {
    return {
      state: this.state,
      isHealthy: this.state === CircuitBreakerState.CLOSED,
      failureRate: this.getFailureRate(),
      successRate: this.getSuccessRate(),
      averageResponseTime: this.metrics.averageResponseTime,
      totalCalls: this.metrics.totalCalls,
      timeUntilNextAttempt: this.state === CircuitBreakerState.OPEN ? this.getTimeUntilNextAttempt() : undefined
    };
  }
}

/**
 * Factory function to create circuit breaker with default R2 configuration
 */
export function createR2CircuitBreaker(env: Env, customConfig?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  const defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    recoveryTimeout: 60000, // 1 minute
    monitoringWindow: 300000, // 5 minutes
    slowCallThreshold: 2000, // 2 seconds
    serviceName: 'r2'
  };

  const config = { ...defaultConfig, ...customConfig };
  return new CircuitBreaker(config, env);
}