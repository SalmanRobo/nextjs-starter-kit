import { createClient } from './client'
// Client-side only imports to avoid build errors
import { logAuthActivityClient, getClientIPClient, getUserAgentClient } from './auth-security-client'

const logAuthActivity = logAuthActivityClient
const getClientIP = getClientIPClient  
const getUserAgent = getUserAgentClient
import { generateDeviceFingerprint } from './oauth-security'

/**
 * Advanced Session Security Management
 * Handles JWT refresh token rotation, concurrent sessions, and timeouts
 */

interface SessionConfig {
  maxAge: number // Maximum session age in milliseconds
  refreshThreshold: number // Refresh when this much time is left (milliseconds)
  maxConcurrentSessions: number // Maximum concurrent sessions per user
  deviceTrackingEnabled: boolean
}

interface SessionMetadata {
  deviceFingerprint: string
  ipAddress?: string
  userAgent?: string
  loginTimestamp: number
  lastActivity: number
  sessionId: string
}

interface ActiveSession {
  userId: string
  sessionId: string
  metadata: SessionMetadata
  expiresAt: number
  refreshCount: number
}

// Default session configuration
const DEFAULT_SESSION_CONFIG: SessionConfig = {
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  refreshThreshold: 10 * 60 * 1000, // Refresh when 10 minutes left
  maxConcurrentSessions: 3, // Allow 3 concurrent sessions
  deviceTrackingEnabled: true
}

/**
 * Enhanced session manager with security features
 */
class SessionSecurityManager {
  private config: SessionConfig
  private activeSessions: Map<string, ActiveSession> = new Map()

  constructor(config: Partial<SessionConfig> = {}) {
    this.config = { ...DEFAULT_SESSION_CONFIG, ...config }
  }

  /**
   * Create new session with enhanced security tracking
   */
  async createSession(
    userId: string,
    request?: Request,
    options: {
      rememberMe?: boolean
      deviceInfo?: Record<string, any>
    } = {}
  ): Promise<{
    success: boolean
    sessionId?: string
    expiresAt?: number
    error?: string
  }> {
    try {
      const supabase = createClient()
      
      // Generate session metadata
      const sessionId = this.generateSessionId()
      const deviceFingerprint = request ? generateDeviceFingerprint(request) : this.generateFallbackFingerprint()
      const ipAddress = request ? getClientIP(request) : undefined
      const userAgent = request ? getUserAgent(request) : undefined
      const now = Date.now()
      
      // Adjust session duration for "remember me"
      const maxAge = options.rememberMe ? 30 * 24 * 60 * 60 * 1000 : this.config.maxAge // 30 days vs 24 hours
      const expiresAt = now + maxAge
      
      const metadata: SessionMetadata = {
        deviceFingerprint,
        ipAddress,
        userAgent,
        loginTimestamp: now,
        lastActivity: now,
        sessionId
      }

      // Check concurrent session limit
      const userSessions = Array.from(this.activeSessions.values())
        .filter(session => session.userId === userId)
      
      if (userSessions.length >= this.config.maxConcurrentSessions) {
        // Remove oldest session
        const oldestSession = userSessions.reduce((oldest, current) => 
          current.metadata.loginTimestamp < oldest.metadata.loginTimestamp ? current : oldest
        )
        
        await this.terminateSession(oldestSession.sessionId, 'concurrent_limit_exceeded')
      }

      // Store active session
      const activeSession: ActiveSession = {
        userId,
        sessionId,
        metadata,
        expiresAt,
        refreshCount: 0
      }
      
      this.activeSessions.set(sessionId, activeSession)

      // Log session creation
      await logAuthActivity(userId, 'session_created', {
        success: true,
        ipAddress,
        userAgent,
        metadata: {
          sessionId,
          deviceFingerprint,
          rememberMe: options.rememberMe,
          deviceInfo: options.deviceInfo
        }
      })

      return {
        success: true,
        sessionId,
        expiresAt
      }
    } catch (error) {
      console.error('Session creation error:', error)
      return {
        success: false,
        error: 'Failed to create secure session'
      }
    }
  }

  /**
   * Validate session with security checks
   */
  async validateSession(
    sessionId: string,
    request?: Request
  ): Promise<{
    valid: boolean
    userId?: string
    needsRefresh?: boolean
    error?: string
  }> {
    try {
      const session = this.activeSessions.get(sessionId)
      
      if (!session) {
        return {
          valid: false,
          error: 'Session not found'
        }
      }

      const now = Date.now()
      
      // Check if session has expired
      if (now > session.expiresAt) {
        await this.terminateSession(sessionId, 'session_expired')
        return {
          valid: false,
          error: 'Session expired'
        }
      }

      // Device fingerprint validation
      if (request && this.config.deviceTrackingEnabled) {
        const currentFingerprint = generateDeviceFingerprint(request)
        if (currentFingerprint !== session.metadata.deviceFingerprint) {
          await this.terminateSession(sessionId, 'device_fingerprint_mismatch')
          await logAuthActivity(session.userId, 'security_violation', {
            success: false,
            failureReason: 'Device fingerprint mismatch',
            ipAddress: getClientIP(request),
            userAgent: getUserAgent(request),
            metadata: {
              sessionId,
              expectedFingerprint: session.metadata.deviceFingerprint,
              actualFingerprint: currentFingerprint
            }
          })
          
          return {
            valid: false,
            error: 'Security validation failed'
          }
        }
      }

      // Update last activity
      session.metadata.lastActivity = now
      
      // Check if refresh is needed
      const timeUntilExpiry = session.expiresAt - now
      const needsRefresh = timeUntilExpiry < this.config.refreshThreshold

      return {
        valid: true,
        userId: session.userId,
        needsRefresh
      }
    } catch (error) {
      console.error('Session validation error:', error)
      return {
        valid: false,
        error: 'Session validation failed'
      }
    }
  }

  /**
   * Refresh session with token rotation
   */
  async refreshSession(
    sessionId: string,
    request?: Request
  ): Promise<{
    success: boolean
    newSessionId?: string
    expiresAt?: number
    error?: string
  }> {
    try {
      const session = this.activeSessions.get(sessionId)
      
      if (!session) {
        return {
          success: false,
          error: 'Session not found for refresh'
        }
      }

      const supabase = createClient()
      
      // Get current Supabase session
      const { data: { session: currentSession }, error: sessionError } = 
        await supabase.auth.getSession()

      if (sessionError || !currentSession) {
        await this.terminateSession(sessionId, 'supabase_session_invalid')
        return {
          success: false,
          error: 'Invalid Supabase session'
        }
      }

      // Refresh Supabase session
      const { data, error: refreshError } = await supabase.auth.refreshSession()
      
      if (refreshError || !data.session) {
        await this.terminateSession(sessionId, 'refresh_failed')
        return {
          success: false,
          error: 'Failed to refresh session'
        }
      }

      // Create new session ID for enhanced security
      const newSessionId = this.generateSessionId()
      const now = Date.now()
      const newExpiresAt = now + this.config.maxAge
      
      // Update session with rotation
      const updatedSession: ActiveSession = {
        ...session,
        sessionId: newSessionId,
        expiresAt: newExpiresAt,
        refreshCount: session.refreshCount + 1,
        metadata: {
          ...session.metadata,
          lastActivity: now
        }
      }

      // Replace old session with new one
      this.activeSessions.delete(sessionId)
      this.activeSessions.set(newSessionId, updatedSession)

      // Log session refresh
      await logAuthActivity(session.userId, 'session_refreshed', {
        success: true,
        ipAddress: request ? getClientIP(request) : undefined,
        userAgent: request ? getUserAgent(request) : undefined,
        metadata: {
          oldSessionId: sessionId,
          newSessionId,
          refreshCount: updatedSession.refreshCount,
          supabaseExpiresAt: data.session.expires_at
        }
      })

      return {
        success: true,
        newSessionId,
        expiresAt: newExpiresAt
      }
    } catch (error) {
      console.error('Session refresh error:', error)
      return {
        success: false,
        error: 'Session refresh failed'
      }
    }
  }

  /**
   * Terminate session securely
   */
  async terminateSession(
    sessionId: string,
    reason: string,
    request?: Request
  ): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const session = this.activeSessions.get(sessionId)
      
      if (session) {
        // Log session termination
        await logAuthActivity(session.userId, 'session_terminated', {
          success: true,
          ipAddress: request ? getClientIP(request) : undefined,
          userAgent: request ? getUserAgent(request) : undefined,
          metadata: {
            sessionId,
            reason,
            duration: Date.now() - session.metadata.loginTimestamp,
            refreshCount: session.refreshCount
          }
        })
      }

      // Remove session
      this.activeSessions.delete(sessionId)

      return {
        success: true
      }
    } catch (error) {
      console.error('Session termination error:', error)
      return {
        success: false,
        error: 'Failed to terminate session'
      }
    }
  }

  /**
   * Get active sessions for a user
   */
  async getUserActiveSessions(userId: string): Promise<SessionMetadata[]> {
    const userSessions = Array.from(this.activeSessions.values())
      .filter(session => session.userId === userId)
      .map(session => session.metadata)

    return userSessions
  }

  /**
   * Terminate all sessions for a user
   */
  async terminateAllUserSessions(
    userId: string,
    exceptSessionId?: string,
    reason: string = 'user_requested'
  ): Promise<{
    success: boolean
    terminatedCount: number
    error?: string
  }> {
    try {
      const userSessions = Array.from(this.activeSessions.entries())
        .filter(([sessionId, session]) => 
          session.userId === userId && sessionId !== exceptSessionId
        )

      let terminatedCount = 0
      
      for (const [sessionId] of userSessions) {
        const result = await this.terminateSession(sessionId, reason)
        if (result.success) {
          terminatedCount++
        }
      }

      // Log bulk session termination
      await logAuthActivity(userId, 'bulk_session_termination', {
        success: true,
        metadata: {
          terminatedCount,
          reason,
          exceptSessionId
        }
      })

      return {
        success: true,
        terminatedCount
      }
    } catch (error) {
      console.error('Bulk session termination error:', error)
      return {
        success: false,
        terminatedCount: 0,
        error: 'Failed to terminate sessions'
      }
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<{
    cleanedCount: number
    error?: string
  }> {
    try {
      const now = Date.now()
      const expiredSessions = Array.from(this.activeSessions.entries())
        .filter(([_, session]) => now > session.expiresAt)

      let cleanedCount = 0
      
      for (const [sessionId] of expiredSessions) {
        await this.terminateSession(sessionId, 'automatic_cleanup')
        cleanedCount++
      }

      return { cleanedCount }
    } catch (error) {
      console.error('Session cleanup error:', error)
      return {
        cleanedCount: 0,
        error: 'Failed to clean up sessions'
      }
    }
  }

  /**
   * Generate secure session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString()
    const random = Math.random().toString(36).substring(2, 15)
    return `sess_${timestamp}_${random}`
  }

  /**
   * Generate fallback device fingerprint when request is not available
   */
  private generateFallbackFingerprint(): string {
    const timestamp = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) // Daily salt
    return `fallback_${timestamp}_${Math.random().toString(36).substring(2, 10)}`
  }
}

// Export singleton instance
export const sessionManager = new SessionSecurityManager()

/**
 * Cross-domain session synchronization for auth.aldari.app → home.aldari.app
 */
export async function synchronizeCrossDomainSession(
  sessionData: {
    userId: string
    sessionId: string
    expiresAt: number
  },
  targetDomain: string
): Promise<{
  success: boolean
  syncToken?: string
  error?: string
}> {
  try {
    // Generate sync token with limited lifetime
    const syncToken = Buffer.from(JSON.stringify({
      ...sessionData,
      syncTimestamp: Date.now(),
      targetDomain
    })).toString('base64url')

    // In production, this would use secure cross-domain communication
    // For now, we'll use postMessage or a secure API endpoint
    
    return {
      success: true,
      syncToken
    }
  } catch (error) {
    console.error('Cross-domain sync error:', error)
    return {
      success: false,
      error: 'Failed to synchronize session'
    }
  }
}

/**
 * Validate cross-domain sync token
 */
export async function validateCrossDomainSync(
  syncToken: string,
  expectedDomain: string
): Promise<{
  valid: boolean
  sessionData?: any
  error?: string
}> {
  try {
    const tokenData = JSON.parse(Buffer.from(syncToken, 'base64url').toString())
    
    // Validate domain
    if (tokenData.targetDomain !== expectedDomain) {
      return {
        valid: false,
        error: 'Domain mismatch'
      }
    }

    // Validate timestamp (5 minutes max)
    const maxAge = 5 * 60 * 1000 // 5 minutes
    if (Date.now() - tokenData.syncTimestamp > maxAge) {
      return {
        valid: false,
        error: 'Sync token expired'
      }
    }

    return {
      valid: true,
      sessionData: tokenData
    }
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid sync token'
    }
  }
}

// Export session configuration for customization
export { type SessionConfig, type SessionMetadata, type ActiveSession }