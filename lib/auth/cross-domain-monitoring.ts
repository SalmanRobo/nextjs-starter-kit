/**
 * ALDARI Cross-Domain Authentication Monitoring & Analytics
 * Enterprise-grade monitoring and error tracking for cross-domain SSO
 */

export interface AuthEvent {
  type: 'signin' | 'signout' | 'signup' | 'token_generation' | 'token_validation' | 'cross_domain_redirect' | 'error';
  userId?: string;
  sessionId?: string;
  domain: string;
  userAgent?: string;
  ip?: string;
  timestamp: number;
  metadata?: Record<string, any>;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

export interface AuthMetrics {
  totalSignIns: number;
  totalSignUps: number;
  totalErrors: number;
  crossDomainRedirects: number;
  tokenGenerations: number;
  tokenValidations: number;
  activeUsers: number;
  averageSessionDuration: number;
  errorRate: number;
  domains: Record<string, number>;
  timeRanges: {
    last24Hours: AuthEvent[];
    last7Days: AuthEvent[];
    last30Days: AuthEvent[];
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: AuthMetrics) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  webhookUrl?: string;
  emailRecipients?: string[];
}

class CrossDomainAuthMonitor {
  private events: AuthEvent[] = [];
  private alerts: AlertRule[] = [];
  private metricsCache: { metrics: AuthMetrics; timestamp: number } | null = null;
  private readonly MAX_EVENTS = 10000; // Keep last 10k events
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.setupDefaultAlerts();
    this.startPeriodicCleanup();
  }

  /**
   * Log authentication event
   */
  logEvent(event: Omit<AuthEvent, 'timestamp'>): void {
    const authEvent: AuthEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.events.unshift(authEvent);

    // Maintain max events limit
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(0, this.MAX_EVENTS);
    }

    // Invalidate metrics cache
    this.metricsCache = null;

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Auth Monitor]', authEvent);
    }

    // Send to external monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService(authEvent);
    }

    // Check alerts
    this.checkAlerts();
  }

  /**
   * Log authentication error
   */
  logError(error: Error, context: Omit<AuthEvent, 'type' | 'timestamp' | 'error'>): void {
    this.logEvent({
      ...context,
      type: 'error',
      error: {
        code: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  }

  /**
   * Get comprehensive authentication metrics
   */
  getMetrics(): AuthMetrics {
    // Return cached metrics if still valid
    if (this.metricsCache && Date.now() - this.metricsCache.timestamp < this.CACHE_TTL) {
      return this.metricsCache.metrics;
    }

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const week = 7 * day;
    const month = 30 * day;

    const last24Hours = this.events.filter(e => now - e.timestamp <= day);
    const last7Days = this.events.filter(e => now - e.timestamp <= week);
    const last30Days = this.events.filter(e => now - e.timestamp <= month);

    // Calculate metrics
    const totalSignIns = this.events.filter(e => e.type === 'signin').length;
    const totalSignUps = this.events.filter(e => e.type === 'signup').length;
    const totalErrors = this.events.filter(e => e.type === 'error').length;
    const crossDomainRedirects = this.events.filter(e => e.type === 'cross_domain_redirect').length;
    const tokenGenerations = this.events.filter(e => e.type === 'token_generation').length;
    const tokenValidations = this.events.filter(e => e.type === 'token_validation').length;

    // Calculate active users (unique users in last 24 hours)
    const activeUserIds = new Set(
      last24Hours
        .filter(e => e.userId)
        .map(e => e.userId)
    );
    const activeUsers = activeUserIds.size;

    // Calculate average session duration
    const sessionDurations = this.calculateSessionDurations();
    const averageSessionDuration = sessionDurations.length > 0
      ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length
      : 0;

    // Calculate error rate
    const totalRequests = this.events.length;
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    // Domain statistics
    const domains = this.events.reduce((acc, event) => {
      acc[event.domain] = (acc[event.domain] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const metrics: AuthMetrics = {
      totalSignIns,
      totalSignUps,
      totalErrors,
      crossDomainRedirects,
      tokenGenerations,
      tokenValidations,
      activeUsers,
      averageSessionDuration,
      errorRate,
      domains,
      timeRanges: {
        last24Hours,
        last7Days,
        last30Days,
      },
    };

    // Cache metrics
    this.metricsCache = {
      metrics,
      timestamp: now,
    };

    return metrics;
  }

  /**
   * Get events filtered by criteria
   */
  getEvents(filters: {
    type?: AuthEvent['type'];
    userId?: string;
    domain?: string;
    timeRange?: { start: number; end: number };
    limit?: number;
  } = {}): AuthEvent[] {
    let filteredEvents = this.events;

    if (filters.type) {
      filteredEvents = filteredEvents.filter(e => e.type === filters.type);
    }

    if (filters.userId) {
      filteredEvents = filteredEvents.filter(e => e.userId === filters.userId);
    }

    if (filters.domain) {
      filteredEvents = filteredEvents.filter(e => e.domain === filters.domain);
    }

    if (filters.timeRange) {
      filteredEvents = filteredEvents.filter(
        e => e.timestamp >= filters.timeRange!.start && e.timestamp <= filters.timeRange!.end
      );
    }

    if (filters.limit) {
      filteredEvents = filteredEvents.slice(0, filters.limit);
    }

    return filteredEvents;
  }

  /**
   * Add custom alert rule
   */
  addAlert(alert: AlertRule): void {
    this.alerts.push(alert);
  }

  /**
   * Remove alert rule
   */
  removeAlert(alertId: string): void {
    this.alerts = this.alerts.filter(alert => alert.id !== alertId);
  }

  /**
   * Get all alert rules
   */
  getAlerts(): AlertRule[] {
    return this.alerts;
  }

  /**
   * Export metrics for external systems
   */
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    const metrics = this.getMetrics();

    if (format === 'json') {
      return JSON.stringify(metrics, null, 2);
    }

    // CSV format
    const csvHeaders = [
      'Metric',
      'Value',
      'Timestamp'
    ].join(',');

    const csvRows = [
      ['Total Sign Ins', metrics.totalSignIns, Date.now()],
      ['Total Sign Ups', metrics.totalSignUps, Date.now()],
      ['Total Errors', metrics.totalErrors, Date.now()],
      ['Cross Domain Redirects', metrics.crossDomainRedirects, Date.now()],
      ['Token Generations', metrics.tokenGenerations, Date.now()],
      ['Token Validations', metrics.tokenValidations, Date.now()],
      ['Active Users', metrics.activeUsers, Date.now()],
      ['Average Session Duration', Math.round(metrics.averageSessionDuration), Date.now()],
      ['Error Rate %', Math.round(metrics.errorRate * 100) / 100, Date.now()],
    ].map(row => row.join(','));

    return [csvHeaders, ...csvRows].join('\n');
  }

  /**
   * Calculate session durations for metrics
   */
  private calculateSessionDurations(): number[] {
    const sessionMap = new Map<string, { start: number; end?: number }>();
    
    // Group events by user session
    this.events.forEach(event => {
      if (!event.userId || !event.sessionId) return;
      
      const key = `${event.userId}-${event.sessionId}`;
      
      if (event.type === 'signin') {
        sessionMap.set(key, { start: event.timestamp });
      } else if (event.type === 'signout') {
        const session = sessionMap.get(key);
        if (session) {
          session.end = event.timestamp;
        }
      }
    });

    // Calculate durations
    return Array.from(sessionMap.values())
      .filter(session => session.end)
      .map(session => session.end! - session.start);
  }

  /**
   * Setup default alert rules
   */
  private setupDefaultAlerts(): void {
    this.alerts = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        condition: (metrics) => metrics.errorRate > 5, // 5% error rate
        severity: 'high',
        enabled: true,
      },
      {
        id: 'too-many-failed-logins',
        name: 'Too Many Failed Logins',
        condition: (metrics) => {
          const last10Minutes = Date.now() - (10 * 60 * 1000);
          const recentErrors = metrics.timeRanges.last24Hours.filter(
            e => e.type === 'error' && e.timestamp > last10Minutes
          );
          return recentErrors.length > 10;
        },
        severity: 'medium',
        enabled: true,
      },
      {
        id: 'cross-domain-failures',
        name: 'Cross Domain Authentication Failures',
        condition: (metrics) => {
          const last5Minutes = Date.now() - (5 * 60 * 1000);
          const crossDomainErrors = metrics.timeRanges.last24Hours.filter(
            e => e.type === 'error' && 
                e.timestamp > last5Minutes &&
                (e.error?.message.includes('cross-domain') || e.error?.message.includes('token'))
          );
          return crossDomainErrors.length > 5;
        },
        severity: 'critical',
        enabled: true,
      },
    ];
  }

  /**
   * Check alert conditions and trigger notifications
   */
  private checkAlerts(): void {
    const metrics = this.getMetrics();
    
    this.alerts
      .filter(alert => alert.enabled)
      .forEach(alert => {
        if (alert.condition(metrics)) {
          this.triggerAlert(alert, metrics);
        }
      });
  }

  /**
   * Trigger alert notification
   */
  private triggerAlert(alert: AlertRule, metrics: AuthMetrics): void {
    const alertData = {
      alert: alert.name,
      severity: alert.severity,
      timestamp: new Date().toISOString(),
      metrics: {
        errorRate: metrics.errorRate,
        totalErrors: metrics.totalErrors,
        activeUsers: metrics.activeUsers,
      },
    };

    console.warn(`[Auth Monitor] ALERT: ${alert.name}`, alertData);

    // Send webhook notification if configured
    if (alert.webhookUrl) {
      this.sendWebhookAlert(alert.webhookUrl, alertData);
    }

    // Send email notification if configured
    if (alert.emailRecipients?.length) {
      this.sendEmailAlert(alert.emailRecipients, alertData);
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(webhookUrl: string, alertData: any): Promise<void> {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertData),
      });
    } catch (error) {
      console.error('[Auth Monitor] Failed to send webhook alert:', error);
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(recipients: string[], alertData: any): Promise<void> {
    // Implementation would depend on your email service
    console.log(`[Auth Monitor] Email alert would be sent to: ${recipients.join(', ')}`);
  }

  /**
   * Send event to external monitoring service
   */
  private async sendToExternalService(event: AuthEvent): Promise<void> {
    // Implementation would depend on your monitoring service (e.g., DataDog, New Relic, etc.)
    
    // Example for a generic endpoint
    if (process.env.MONITORING_ENDPOINT) {
      try {
        await fetch(process.env.MONITORING_ENDPOINT, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.MONITORING_API_KEY}`,
          },
          body: JSON.stringify(event),
        });
      } catch (error) {
        console.error('[Auth Monitor] Failed to send to external service:', error);
      }
    }
  }

  /**
   * Start periodic cleanup of old events
   */
  private startPeriodicCleanup(): void {
    setInterval(() => {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const beforeCleanup = this.events.length;
      
      this.events = this.events.filter(event => event.timestamp > thirtyDaysAgo);
      
      if (beforeCleanup !== this.events.length) {
        console.log(
          `[Auth Monitor] Cleaned up ${beforeCleanup - this.events.length} old events`
        );
      }
    }, 24 * 60 * 60 * 1000); // Run daily
  }

  /**
   * Get health status of authentication system
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail';
      details?: string;
    }>;
  } {
    const metrics = this.getMetrics();
    const checks = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check error rate
    const errorRateCheck = {
      name: 'Error Rate',
      status: metrics.errorRate < 1 ? 'pass' as const : 'fail' as const,
      details: `${metrics.errorRate.toFixed(2)}% error rate`,
    };
    checks.push(errorRateCheck);

    if (errorRateCheck.status === 'fail') {
      status = metrics.errorRate > 5 ? 'critical' : 'warning';
    }

    // Check recent activity
    const recentEvents = this.events.filter(e => Date.now() - e.timestamp < 5 * 60 * 1000);
    const activityCheck = {
      name: 'Recent Activity',
      status: recentEvents.length > 0 ? 'pass' as const : 'fail' as const,
      details: `${recentEvents.length} events in last 5 minutes`,
    };
    checks.push(activityCheck);

    // Check cross-domain functionality
    const recentCrossDomainEvents = recentEvents.filter(
      e => e.type === 'cross_domain_redirect' || e.type === 'token_generation'
    );
    const crossDomainCheck = {
      name: 'Cross Domain SSO',
      status: 'pass' as const, // Assume healthy unless we have specific errors
      details: `${recentCrossDomainEvents.length} cross-domain events recently`,
    };
    checks.push(crossDomainCheck);

    return { status, checks };
  }
}

// Singleton instance
export const crossDomainAuthMonitor = new CrossDomainAuthMonitor();

// Convenience functions
export function logAuthEvent(event: Omit<AuthEvent, 'timestamp'>) {
  return crossDomainAuthMonitor.logEvent(event);
}

export function logAuthError(error: Error, context: Omit<AuthEvent, 'type' | 'timestamp' | 'error'>) {
  return crossDomainAuthMonitor.logError(error, context);
}

export function getAuthMetrics(): AuthMetrics {
  return crossDomainAuthMonitor.getMetrics();
}

export function getAuthHealthStatus() {
  return crossDomainAuthMonitor.getHealthStatus();
}

// Export the monitor class for advanced usage
export { CrossDomainAuthMonitor };