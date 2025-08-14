/**
 * Production Authentication Monitoring System
 * Provides comprehensive monitoring, alerting, and health checks
 */

import { NextRequest } from 'next/server';
import { AuthErrorDetails } from './types';
import { getRateLimitConfig, healthCheck as redisHealthCheck } from './rate-limiting-redis';
import { createClient } from '@/lib/supabase/server';

// Monitoring event types
export type MonitoringEvent = 
  | 'auth_success' 
  | 'auth_failure' 
  | 'rate_limit_hit' 
  | 'security_incident' 
  | 'performance_issue' 
  | 'system_error';

// Monitoring configuration
export interface MonitoringConfig {
  enableMetrics: boolean;
  enableAlerts: boolean;
  enableHealthChecks: boolean;
  alertThresholds: {
    errorRate: number; // percentage
    responseTime: number; // milliseconds
    rateLimitHits: number; // per minute
    failedLogins: number; // per minute
  };
  retentionDays: number;
}

const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  enableMetrics: process.env.NODE_ENV === 'production',
  enableAlerts: process.env.NODE_ENV === 'production',
  enableHealthChecks: true,
  alertThresholds: {
    errorRate: 5, // 5%
    responseTime: 2000, // 2 seconds
    rateLimitHits: 100, // 100 per minute
    failedLogins: 50, // 50 per minute
  },
  retentionDays: 30,
};

// Metrics collection
class AuthMetrics {
  private metrics: Map<string, any> = new Map();
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig = DEFAULT_MONITORING_CONFIG) {
    this.config = config;
    this.initializeMetrics();
  }

  private initializeMetrics() {
    this.metrics.set('auth_attempts', { count: 0, successes: 0, failures: 0 });
    this.metrics.set('response_times', []);
    this.metrics.set('rate_limit_hits', { count: 0, lastReset: Date.now() });
    this.metrics.set('error_counts', new Map());
    this.metrics.set('user_activity', { signUps: 0, signIns: 0, signOuts: 0 });
  }

  // Record authentication attempt
  recordAuthAttempt(success: boolean, responseTime: number, event: MonitoringEvent) {
    if (!this.config.enableMetrics) return;

    const authAttempts = this.metrics.get('auth_attempts');
    authAttempts.count++;
    
    if (success) {
      authAttempts.successes++;
    } else {
      authAttempts.failures++;
    }

    // Record response time
    const responseTimes = this.metrics.get('response_times');
    responseTimes.push({ time: responseTime, timestamp: Date.now() });
    
    // Keep only last 100 entries
    if (responseTimes.length > 100) {
      responseTimes.shift();
    }

    // Record event
    this.recordEvent(event, { success, responseTime });
  }

  // Record rate limit hit
  recordRateLimitHit(identifier: string, limitType: string) {
    if (!this.config.enableMetrics) return;

    const rateLimits = this.metrics.get('rate_limit_hits');
    const now = Date.now();
    
    // Reset counter every minute
    if (now - rateLimits.lastReset > 60000) {
      rateLimits.count = 0;
      rateLimits.lastReset = now;
    }
    
    rateLimits.count++;

    this.recordEvent('rate_limit_hit', { identifier, limitType });
    this.checkRateLimitAlert(rateLimits.count);
  }

  // Record error
  recordError(error: AuthErrorDetails, context?: Record<string, any>) {
    if (!this.config.enableMetrics) return;

    const errorCounts = this.metrics.get('error_counts');
    const errorCode = error.code;
    const currentCount = errorCounts.get(errorCode) || 0;
    errorCounts.set(errorCode, currentCount + 1);

    this.recordEvent('auth_failure', { error: error.code, context });
  }

  // Record user activity
  recordUserActivity(activityType: 'signUp' | 'signIn' | 'signOut') {
    if (!this.config.enableMetrics) return;

    const userActivity = this.metrics.get('user_activity');
    userActivity[activityType + 's']++;

    this.recordEvent('auth_success', { activity: activityType });
  }

  // Get current metrics
  getMetrics() {
    const authAttempts = this.metrics.get('auth_attempts');
    const responseTimes = this.metrics.get('response_times');
    const rateLimitHits = this.metrics.get('rate_limit_hits');
    const errorCounts = this.metrics.get('error_counts');
    const userActivity = this.metrics.get('user_activity');

    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum: number, entry: any) => sum + entry.time, 0) / responseTimes.length 
      : 0;

    const errorRate = authAttempts.count > 0 
      ? (authAttempts.failures / authAttempts.count) * 100 
      : 0;

    return {
      authAttempts: {
        total: authAttempts.count,
        successes: authAttempts.successes,
        failures: authAttempts.failures,
        successRate: authAttempts.count > 0 ? (authAttempts.successes / authAttempts.count) * 100 : 0,
        errorRate,
      },
      performance: {
        averageResponseTime: Math.round(avgResponseTime),
        responseTimeP95: this.calculatePercentile(responseTimes, 95),
        responseTimeP99: this.calculatePercentile(responseTimes, 99),
      },
      rateLimiting: {
        hitsPerMinute: rateLimitHits.count,
      },
      errors: Object.fromEntries(errorCounts),
      userActivity,
      timestamp: new Date().toISOString(),
    };
  }

  // Calculate percentile
  private calculatePercentile(values: any[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const times = values.map(v => v.time).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * times.length) - 1;
    return times[index] || 0;
  }

  // Record monitoring event
  private recordEvent(event: MonitoringEvent, data: Record<string, any>) {
    const logEntry = {
      event,
      timestamp: new Date().toISOString(),
      data,
      environment: process.env.NODE_ENV,
    };

    // In production, send to monitoring service (e.g., DataDog, New Relic, CloudWatch)
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to external monitoring service
      this.sendToMonitoringService(logEntry);
    } else {
      console.log('[AUTH_MONITORING]', logEntry);
    }
  }

  // Check for rate limit alerts
  private checkRateLimitAlert(currentCount: number) {
    if (this.config.enableAlerts && currentCount > this.config.alertThresholds.rateLimitHits) {
      this.sendAlert('rate_limit_threshold_exceeded', {
        currentCount,
        threshold: this.config.alertThresholds.rateLimitHits,
        severity: 'warning',
      });
    }
  }

  // Send alert
  private sendAlert(alertType: string, data: Record<string, any>) {
    const alert = {
      type: alertType,
      severity: data.severity || 'warning',
      timestamp: new Date().toISOString(),
      data,
      service: 'authentication',
    };

    // In production, send to alerting service (e.g., PagerDuty, Slack, Email)
    console.error('[AUTH_ALERT]', alert);
    
    // Example: Send to Slack webhook, email, etc.
    this.sendToAlertingService(alert);
  }

  // Placeholder for external monitoring service
  private async sendToMonitoringService(logEntry: any) {
    // Example integrations:
    // - DataDog: await datadogClient.send(logEntry);
    // - New Relic: await newRelicClient.recordEvent(logEntry);
    // - CloudWatch: await cloudwatchClient.putMetricData(logEntry);
  }

  // Placeholder for alerting service
  private async sendToAlertingService(alert: any) {
    // Example integrations:
    // - Slack: await slackWebhook.send(alert);
    // - PagerDuty: await pagerDutyClient.createIncident(alert);
    // - Email: await emailService.sendAlert(alert);
  }
}

// Global metrics instance
const authMetrics = new AuthMetrics();

// Health check system
export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export class HealthChecker {
  async performHealthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: HealthCheckResult[];
    timestamp: string;
  }> {
    const checks = await Promise.allSettled([
      this.checkSupabaseHealth(),
      this.checkRedisHealth(),
      this.checkDatabaseHealth(),
      this.checkAuthServiceHealth(),
    ]);

    const services: HealthCheckResult[] = checks.map((result, index) => {
      const serviceNames = ['supabase', 'redis', 'database', 'auth_service'];
      
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          service: serviceNames[index],
          status: 'unhealthy',
          error: result.reason?.message || 'Unknown error',
        };
      }
    });

    // Determine overall health
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;
    const degradedCount = services.filter(s => s.status === 'degraded').length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    return {
      overall,
      services,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkSupabaseHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const supabase = createClient();
      const { error } = await supabase.from('profiles').select('id').limit(1);
      
      const responseTime = Date.now() - startTime;
      
      if (error) {
        return {
          service: 'supabase',
          status: 'unhealthy',
          responseTime,
          error: error.message,
        };
      }

      return {
        service: 'supabase',
        status: responseTime > 1000 ? 'degraded' : 'healthy',
        responseTime,
      };
    } catch (error) {
      return {
        service: 'supabase',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkRedisHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const result = await redisHealthCheck();
      const responseTime = Date.now() - startTime;
      
      if (!result.redis && !result.fallback) {
        return {
          service: 'redis',
          status: 'unhealthy',
          responseTime,
          error: result.error || 'Redis unavailable and no fallback',
        };
      }

      return {
        service: 'redis',
        status: result.redis ? 'healthy' : 'degraded',
        responseTime,
        metadata: { usingFallback: result.fallback, config: getRateLimitConfig() },
      };
    } catch (error) {
      return {
        service: 'redis',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('check_connection');
      
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'database',
        status: error ? 'unhealthy' : (responseTime > 500 ? 'degraded' : 'healthy'),
        responseTime,
        error: error?.message,
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkAuthServiceHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Check if we can create a Supabase client and basic auth operations work
      const supabase = createClient();
      const { error } = await supabase.auth.getSession();
      
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'auth_service',
        status: error ? 'degraded' : 'healthy',
        responseTime,
        metadata: { metrics: authMetrics.getMetrics() },
      };
    } catch (error) {
      return {
        service: 'auth_service',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Performance monitoring middleware
export const withPerformanceMonitoring = (
  handler: (request: NextRequest) => Promise<Response>
) => {
  return async (request: NextRequest): Promise<Response> => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const response = await handler(request);
      const responseTime = Date.now() - startTime;
      
      // Record successful request
      authMetrics.recordAuthAttempt(
        response.status < 400, 
        responseTime, 
        response.status < 400 ? 'auth_success' : 'auth_failure'
      );
      
      // Add performance headers
      response.headers.set('X-Response-Time', `${responseTime}ms`);
      response.headers.set('X-Request-ID', requestId);
      
      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Record failed request
      authMetrics.recordAuthAttempt(false, responseTime, 'system_error');
      
      throw error;
    }
  };
};

// Global instances
const healthChecker = new HealthChecker();

// Export utilities
export {
  authMetrics,
  healthChecker,
  MonitoringConfig,
  DEFAULT_MONITORING_CONFIG,
};

export default {
  authMetrics,
  healthChecker,
  withPerformanceMonitoring,
};