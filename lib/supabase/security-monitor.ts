import { createClient } from './client'
import { logAuthActivity, checkSuspiciousActivity, lockUserAccount } from './auth-security'
import { sessionManager } from './session-security'

/**
 * Real-time Security Monitoring and Incident Response System
 * Monitors authentication events and responds to security threats
 */

interface SecurityEvent {
  id: string
  userId: string
  eventType: SecurityEventType
  severity: SecuritySeverity
  ipAddress?: string
  userAgent?: string
  timestamp: number
  metadata: Record<string, any>
  resolved: boolean
  responseActions: SecurityAction[]
}

type SecurityEventType = 
  | 'multiple_failed_logins'
  | 'suspicious_location'
  | 'device_fingerprint_mismatch'
  | 'concurrent_session_limit_exceeded'
  | 'rapid_password_changes'
  | 'unusual_oauth_activity'
  | 'token_abuse'
  | 'account_enumeration'
  | 'brute_force_attempt'
  | 'credential_stuffing'

type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical'

type SecurityAction = 
  | 'log_event'
  | 'rate_limit'
  | 'temporary_lockout'
  | 'permanent_lockout'
  | 'require_mfa'
  | 'notify_user'
  | 'alert_admin'
  | 'terminate_sessions'
  | 'block_ip'

interface SecurityRule {
  eventType: SecurityEventType
  condition: (events: SecurityEvent[]) => boolean
  severity: SecuritySeverity
  actions: SecurityAction[]
  cooldownPeriod: number // milliseconds
}

/**
 * Real-time security monitoring system
 */
class SecurityMonitor {
  private events: Map<string, SecurityEvent[]> = new Map()
  private rules: SecurityRule[] = []
  private alertCallbacks: ((event: SecurityEvent) => void)[] = []

  constructor() {
    this.initializeSecurityRules()
    this.startPeriodicCleanup()
  }

  /**
   * Initialize security rules for threat detection
   */
  private initializeSecurityRules(): void {
    this.rules = [
      // Multiple failed logins
      {
        eventType: 'multiple_failed_logins',
        condition: (events) => {
          const failedLogins = events.filter(e => 
            e.eventType === 'multiple_failed_logins' && 
            Date.now() - e.timestamp < 15 * 60 * 1000 // 15 minutes
          )
          return failedLogins.length >= 5
        },
        severity: 'high',
        actions: ['temporary_lockout', 'alert_admin', 'terminate_sessions'],
        cooldownPeriod: 30 * 60 * 1000 // 30 minutes
      },

      // Brute force attempt
      {
        eventType: 'brute_force_attempt',
        condition: (events) => {
          const attempts = events.filter(e => 
            e.eventType === 'brute_force_attempt' && 
            Date.now() - e.timestamp < 5 * 60 * 1000 // 5 minutes
          )
          return attempts.length >= 10
        },
        severity: 'critical',
        actions: ['permanent_lockout', 'block_ip', 'alert_admin', 'terminate_sessions'],
        cooldownPeriod: 60 * 60 * 1000 // 1 hour
      },

      // Device fingerprint mismatch
      {
        eventType: 'device_fingerprint_mismatch',
        condition: (events) => {
          const mismatches = events.filter(e => 
            e.eventType === 'device_fingerprint_mismatch' && 
            Date.now() - e.timestamp < 10 * 60 * 1000 // 10 minutes
          )
          return mismatches.length >= 3
        },
        severity: 'high',
        actions: ['require_mfa', 'notify_user', 'alert_admin'],
        cooldownPeriod: 60 * 60 * 1000 // 1 hour
      },

      // Suspicious location activity
      {
        eventType: 'suspicious_location',
        condition: (events) => {
          const locationEvents = events.filter(e => 
            e.eventType === 'suspicious_location' && 
            Date.now() - e.timestamp < 60 * 60 * 1000 // 1 hour
          )
          const uniqueLocations = new Set(locationEvents.map(e => e.metadata.location))
          return uniqueLocations.size >= 3 // Login from 3+ different locations in 1 hour
        },
        severity: 'medium',
        actions: ['require_mfa', 'notify_user', 'log_event'],
        cooldownPeriod: 2 * 60 * 60 * 1000 // 2 hours
      },

      // Rapid password changes
      {
        eventType: 'rapid_password_changes',
        condition: (events) => {
          const passwordChanges = events.filter(e => 
            e.eventType === 'rapid_password_changes' && 
            Date.now() - e.timestamp < 60 * 60 * 1000 // 1 hour
          )
          return passwordChanges.length >= 5
        },
        severity: 'medium',
        actions: ['temporary_lockout', 'notify_user', 'alert_admin'],
        cooldownPeriod: 4 * 60 * 60 * 1000 // 4 hours
      },

      // Token abuse
      {
        eventType: 'token_abuse',
        condition: (events) => {
          const tokenEvents = events.filter(e => 
            e.eventType === 'token_abuse' && 
            Date.now() - e.timestamp < 30 * 60 * 1000 // 30 minutes
          )
          return tokenEvents.length >= 20 // 20+ token refresh attempts in 30 minutes
        },
        severity: 'high',
        actions: ['terminate_sessions', 'temporary_lockout', 'alert_admin'],
        cooldownPeriod: 2 * 60 * 60 * 1000 // 2 hours
      }
    ]
  }

  /**
   * Record security event for monitoring
   */
  async recordSecurityEvent(
    userId: string,
    eventType: SecurityEventType,
    metadata: Record<string, any> = {},
    severity: SecuritySeverity = 'low',
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    const eventId = this.generateEventId()
    const event: SecurityEvent = {
      id: eventId,
      userId,
      eventType,
      severity,
      ipAddress,
      userAgent,
      timestamp: Date.now(),
      metadata,
      resolved: false,
      responseActions: []
    }

    // Store event
    if (!this.events.has(userId)) {
      this.events.set(userId, [])
    }
    this.events.get(userId)!.push(event)

    // Log to auth activity
    await logAuthActivity(userId, 'security_event', {
      success: true,
      ipAddress,
      userAgent,
      metadata: {
        securityEventType: eventType,
        severity,
        eventId,
        ...metadata
      }
    })

    // Evaluate security rules
    await this.evaluateSecurityRules(userId, event)

    return eventId
  }

  /**
   * Evaluate security rules and trigger responses
   */
  private async evaluateSecurityRules(userId: string, triggerEvent: SecurityEvent): Promise<void> {
    const userEvents = this.events.get(userId) || []
    
    for (const rule of this.rules) {
      // Check if rule applies to this event type
      if (rule.eventType !== triggerEvent.eventType) {
        continue
      }

      // Check cooldown period
      const recentRuleActivations = userEvents.filter(e => 
        e.responseActions.some(action => rule.actions.includes(action)) &&
        Date.now() - e.timestamp < rule.cooldownPeriod
      )

      if (recentRuleActivations.length > 0) {
        continue // Rule is in cooldown
      }

      // Evaluate rule condition
      if (rule.condition(userEvents)) {
        await this.executeSecurityActions(userId, rule, triggerEvent)
        triggerEvent.responseActions.push(...rule.actions)
      }
    }
  }

  /**
   * Execute security actions based on triggered rules
   */
  private async executeSecurityActions(
    userId: string,
    rule: SecurityRule,
    event: SecurityEvent
  ): Promise<void> {
    for (const action of rule.actions) {
      try {
        switch (action) {
          case 'log_event':
            await this.logSecurityEvent(userId, rule, event)
            break

          case 'rate_limit':
            await this.applyRateLimit(userId, event.ipAddress)
            break

          case 'temporary_lockout':
            await this.temporaryLockout(userId, rule.cooldownPeriod, event)
            break

          case 'permanent_lockout':
            await this.permanentLockout(userId, event)
            break

          case 'require_mfa':
            await this.requireMFA(userId, event)
            break

          case 'notify_user':
            await this.notifyUser(userId, rule, event)
            break

          case 'alert_admin':
            await this.alertAdmin(userId, rule, event)
            break

          case 'terminate_sessions':
            await this.terminateAllSessions(userId, event)
            break

          case 'block_ip':
            await this.blockIP(event.ipAddress, event)
            break
        }
      } catch (error) {
        console.error(`Failed to execute security action ${action}:`, error)
      }
    }
  }

  /**
   * Log security event with details
   */
  private async logSecurityEvent(
    userId: string,
    rule: SecurityRule,
    event: SecurityEvent
  ): Promise<void> {
    console.log(`SECURITY EVENT [${rule.severity.toUpperCase()}]:`, {
      userId,
      eventType: rule.eventType,
      eventId: event.id,
      timestamp: new Date(event.timestamp).toISOString(),
      ipAddress: event.ipAddress,
      actions: rule.actions.join(', ')
    })
  }

  /**
   * Apply rate limiting for IP/user
   */
  private async applyRateLimit(userId: string, ipAddress?: string): Promise<void> {
    // Implementation would integrate with your rate limiting system
    await logAuthActivity(userId, 'rate_limit_applied', {
      success: true,
      metadata: { ipAddress, duration: '15 minutes' }
    })
  }

  /**
   * Apply temporary account lockout
   */
  private async temporaryLockout(
    userId: string,
    duration: number,
    event: SecurityEvent
  ): Promise<void> {
    await lockUserAccount(
      userId,
      `Temporary lockout due to ${event.eventType}`,
      {
        duration,
        eventId: event.id,
        automatic: true
      }
    )

    // Schedule unlock
    setTimeout(async () => {
      // In production, this would be handled by a job queue
      // For now, we'll just log the unlock event
      await logAuthActivity(userId, 'automatic_unlock', {
        success: true,
        metadata: { 
          reason: 'temporary_lockout_expired',
          originalEventId: event.id
        }
      })
    }, duration)
  }

  /**
   * Apply permanent account lockout
   */
  private async permanentLockout(userId: string, event: SecurityEvent): Promise<void> {
    await lockUserAccount(
      userId,
      `Permanent lockout due to severe security violations`,
      {
        permanent: true,
        eventId: event.id,
        severity: 'critical'
      }
    )
  }

  /**
   * Require multi-factor authentication
   */
  private async requireMFA(userId: string, event: SecurityEvent): Promise<void> {
    const supabase = createClient()
    
    // Mark user as requiring MFA
    await supabase
      .from('user_security_settings')
      .upsert({
        user_id: userId,
        mfa_required: true,
        mfa_required_reason: event.eventType,
        mfa_required_at: new Date().toISOString()
      })

    await logAuthActivity(userId, 'mfa_required', {
      success: true,
      metadata: {
        reason: event.eventType,
        eventId: event.id
      }
    })
  }

  /**
   * Notify user of security event
   */
  private async notifyUser(
    userId: string,
    rule: SecurityRule,
    event: SecurityEvent
  ): Promise<void> {
    // Implementation would integrate with your notification system
    console.log(`SECURITY NOTIFICATION for user ${userId}:`, {
      eventType: rule.eventType,
      severity: rule.severity,
      timestamp: new Date().toISOString()
    })

    await logAuthActivity(userId, 'security_notification_sent', {
      success: true,
      metadata: {
        eventType: rule.eventType,
        eventId: event.id,
        notificationType: 'security_alert'
      }
    })
  }

  /**
   * Alert administrators
   */
  private async alertAdmin(
    userId: string,
    rule: SecurityRule,
    event: SecurityEvent
  ): Promise<void> {
    const alertData = {
      userId,
      eventType: rule.eventType,
      severity: rule.severity,
      eventId: event.id,
      timestamp: new Date().toISOString(),
      ipAddress: event.ipAddress,
      metadata: event.metadata
    }

    // In production, integrate with your alerting system
    console.error('ADMIN SECURITY ALERT:', alertData)

    // Trigger alert callbacks
    for (const callback of this.alertCallbacks) {
      try {
        callback(event)
      } catch (error) {
        console.error('Alert callback failed:', error)
      }
    }

    await logAuthActivity(userId, 'admin_alert_sent', {
      success: true,
      metadata: alertData
    })
  }

  /**
   * Terminate all user sessions
   */
  private async terminateAllSessions(userId: string, event: SecurityEvent): Promise<void> {
    const result = await sessionManager.terminateAllUserSessions(
      userId,
      undefined,
      `Security event: ${event.eventType}`
    )

    await logAuthActivity(userId, 'bulk_session_termination', {
      success: result.success,
      metadata: {
        terminatedCount: result.terminatedCount,
        reason: event.eventType,
        eventId: event.id
      }
    })
  }

  /**
   * Block IP address
   */
  private async blockIP(ipAddress: string | undefined, event: SecurityEvent): Promise<void> {
    if (!ipAddress) return

    // Implementation would integrate with your IP blocking system
    console.log(`IP BLOCKED: ${ipAddress}`, {
      reason: event.eventType,
      eventId: event.id,
      timestamp: new Date().toISOString()
    })

    await logAuthActivity('system', 'ip_blocked', {
      success: true,
      ipAddress,
      metadata: {
        reason: event.eventType,
        eventId: event.id
      }
    })
  }

  /**
   * Get security events for a user
   */
  getSecurityEvents(userId: string, limit: number = 50): SecurityEvent[] {
    const events = this.events.get(userId) || []
    return events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
  }

  /**
   * Add alert callback for real-time monitoring
   */
  addAlertCallback(callback: (event: SecurityEvent) => void): void {
    this.alertCallbacks.push(callback)
  }

  /**
   * Remove alert callback
   */
  removeAlertCallback(callback: (event: SecurityEvent) => void): void {
    const index = this.alertCallbacks.indexOf(callback)
    if (index > -1) {
      this.alertCallbacks.splice(index, 1)
    }
  }

  /**
   * Analyze user security posture
   */
  async analyzeUserSecurity(userId: string): Promise<{
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
    events: SecurityEvent[]
    recommendations: string[]
    lastIncident?: SecurityEvent
  }> {
    const events = this.getSecurityEvents(userId, 100)
    const recentEvents = events.filter(e => Date.now() - e.timestamp < 7 * 24 * 60 * 60 * 1000) // Last 7 days

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    const recommendations: string[] = []

    // Analyze risk level
    const criticalEvents = recentEvents.filter(e => e.severity === 'critical')
    const highEvents = recentEvents.filter(e => e.severity === 'high')
    const mediumEvents = recentEvents.filter(e => e.severity === 'medium')

    if (criticalEvents.length > 0) {
      riskLevel = 'critical'
      recommendations.push('Immediate security review required')
      recommendations.push('Consider permanent account restrictions')
    } else if (highEvents.length >= 2) {
      riskLevel = 'high'
      recommendations.push('Require multi-factor authentication')
      recommendations.push('Monitor account activity closely')
    } else if (mediumEvents.length >= 3 || highEvents.length >= 1) {
      riskLevel = 'medium'
      recommendations.push('Enable additional security notifications')
      recommendations.push('Review recent login activity')
    } else {
      recommendations.push('Maintain current security practices')
    }

    const lastIncident = recentEvents.find(e => e.severity === 'high' || e.severity === 'critical')

    return {
      riskLevel,
      events: recentEvents,
      recommendations,
      lastIncident
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  }

  /**
   * Clean up old events periodically
   */
  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupOldEvents()
    }, 60 * 60 * 1000) // Every hour
  }

  /**
   * Clean up events older than 30 days
   */
  private cleanupOldEvents(): void {
    const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days
    const now = Date.now()

    for (const [userId, events] of this.events.entries()) {
      const recentEvents = events.filter(e => now - e.timestamp < maxAge)
      
      if (recentEvents.length !== events.length) {
        this.events.set(userId, recentEvents)
      }

      if (recentEvents.length === 0) {
        this.events.delete(userId)
      }
    }
  }
}

// Export singleton instance
export const securityMonitor = new SecurityMonitor()

// Convenience functions for common security events
export async function reportFailedLogin(
  userId: string,
  ipAddress?: string,
  userAgent?: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  await securityMonitor.recordSecurityEvent(
    userId,
    'multiple_failed_logins',
    metadata,
    'medium',
    ipAddress,
    userAgent
  )
}

export async function reportSuspiciousLocation(
  userId: string,
  location: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await securityMonitor.recordSecurityEvent(
    userId,
    'suspicious_location',
    { location },
    'medium',
    ipAddress,
    userAgent
  )
}

export async function reportDeviceFingerprintMismatch(
  userId: string,
  expectedFingerprint: string,
  actualFingerprint: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await securityMonitor.recordSecurityEvent(
    userId,
    'device_fingerprint_mismatch',
    { expectedFingerprint, actualFingerprint },
    'high',
    ipAddress,
    userAgent
  )
}

export async function reportBruteForceAttempt(
  userId: string,
  attemptCount: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await securityMonitor.recordSecurityEvent(
    userId,
    'brute_force_attempt',
    { attemptCount },
    'critical',
    ipAddress,
    userAgent
  )
}

// Export types for external use
export type { SecurityEvent, SecurityEventType, SecuritySeverity, SecurityAction }