import { createClient } from './server'
import type { Database } from '../database.types'

type SupabaseClient = ReturnType<typeof createClient>
type AuthActivity = Database['public']['Tables']['auth_activity']['Insert']
type AccountSecurity = Database['public']['Tables']['account_security']['Row']

/**
 * Authentication Security Helper Functions
 * Production-ready security utilities for Supabase auth
 */

/**
 * Clean options for exactOptionalPropertyTypes compliance
 */
export function cleanLogOptions(options: {
  ipAddress?: string | undefined
  userAgent?: string | undefined
  success?: boolean
  failureReason?: string
  metadata?: Record<string, any>
}): {
  ipAddress?: string
  userAgent?: string
  success?: boolean
  failureReason?: string
  metadata?: Record<string, any>
} {
  const cleaned: any = {}
  
  if (options.ipAddress) cleaned.ipAddress = options.ipAddress
  if (options.userAgent) cleaned.userAgent = options.userAgent
  if (options.success !== undefined) cleaned.success = options.success
  if (options.failureReason) cleaned.failureReason = options.failureReason
  if (options.metadata) cleaned.metadata = options.metadata
  
  return cleaned
}

/**
 * Log authentication activity with comprehensive tracking
 */
export async function logAuthActivity(
  userId: string,
  activityType: AuthActivity['activity_type'],
  options: {
    ipAddress?: string
    userAgent?: string
    success?: boolean
    failureReason?: string
    metadata?: Record<string, any>
  } = {}
) {
  const supabase = createClient()
  
  // Filter out undefined values for exactOptionalPropertyTypes compliance
  const cleanOptions = cleanLogOptions(options)
  
  try {
    const { data, error } = await supabase
      .rpc('log_auth_activity', {
      p_user_id: userId,
      p_activity_type: activityType,
      p_ip_address: cleanOptions.ipAddress || null,
      p_user_agent: cleanOptions.userAgent || null,
      p_success: cleanOptions.success ?? true,
      p_failure_reason: cleanOptions.failureReason || null,
      p_metadata: cleanOptions.metadata || {}
    })

    if (error) {
      console.error('Failed to log auth activity:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error logging auth activity:', error)
    return null
  }
}

/**
 * Check if user account is locked
 */
export async function isAccountLocked(userId: string): Promise<boolean> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase.rpc('is_account_locked', {
      p_user_id: userId
    })

    if (error) {
      console.error('Failed to check account lock status:', error)
      return false
    }

    return data || false
  } catch (error) {
    console.error('Error checking account lock status:', error)
    return false
  }
}

/**
 * Increment failed login attempts and potentially lock account
 */
export async function incrementFailedLoginAttempts(userId: string): Promise<number> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase.rpc('increment_failed_login_attempts', {
      p_user_id: userId
    })

    if (error) {
      console.error('Failed to increment failed login attempts:', error)
      return 0
    }

    // Log the failed login attempt
    await logAuthActivity(userId, 'failed_login', {
      success: false,
      failureReason: 'Invalid credentials'
    })

    return data || 0
  } catch (error) {
    console.error('Error incrementing failed login attempts:', error)
    return 0
  }
}

/**
 * Reset failed login attempts on successful login
 */
export async function resetFailedLoginAttempts(userId: string): Promise<void> {
  const supabase = createClient()
  
  try {
    const { error } = await supabase.rpc('reset_failed_login_attempts', {
      p_user_id: userId
    })

    if (error) {
      console.error('Failed to reset failed login attempts:', error)
    }

    // Log successful login
    await logAuthActivity(userId, 'sign_in', {
      success: true
    })
  } catch (error) {
    console.error('Error resetting failed login attempts:', error)
  }
}

/**
 * Check if password was recently used (password history)
 */
export async function checkPasswordHistory(
  userId: string,
  passwordHash: string,
  historyLimit: number = 5
): Promise<boolean> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase.rpc('check_password_history', {
      p_user_id: userId,
      p_password_hash: passwordHash,
      p_history_limit: historyLimit
    })

    if (error) {
      console.error('Failed to check password history:', error)
      return false
    }

    return data || false
  } catch (error) {
    console.error('Error checking password history:', error)
    return false
  }
}

/**
 * Add password to history after successful change
 */
export async function addPasswordToHistory(
  userId: string,
  passwordHash: string,
  options: {
    ipAddress?: string
    userAgent?: string
  } = {}
): Promise<string | null> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase.rpc('add_password_to_history', {
      p_user_id: userId,
      p_password_hash: passwordHash,
      p_ip_address: options.ipAddress || null,
      p_user_agent: options.userAgent || null
    })

    if (error) {
      console.error('Failed to add password to history:', error)
      return null
    }

    // Log password change activity
    await logAuthActivity(userId, 'password_change', {
      success: true,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent
    })

    return data
  } catch (error) {
    console.error('Error adding password to history:', error)
    return null
  }
}

/**
 * Get user's account security information
 */
export async function getAccountSecurity(userId: string): Promise<AccountSecurity | null> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase
      .from('account_security')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('Failed to get account security:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error getting account security:', error)
    return null
  }
}

/**
 * Get recent auth activity for a user
 */
export async function getRecentAuthActivity(
  userId: string,
  limit: number = 10
): Promise<Database['public']['Tables']['auth_activity']['Row'][]> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase
      .from('auth_activity')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Failed to get recent auth activity:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error getting recent auth activity:', error)
    return []
  }
}

/**
 * Check for suspicious activity patterns
 */
export async function checkSuspiciousActivity(userId: string): Promise<{
  isSuspicious: boolean
  reason?: string
  score: number
}> {
  const supabase = createClient()
  
  try {
    // Get recent failed login attempts
    const { data: failedAttempts, error: failedError } = await supabase
      .from('auth_activity')
      .select('*')
      .eq('user_id', userId)
      .eq('activity_type', 'failed_login')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
      .order('created_at', { ascending: false })

    if (failedError) {
      console.error('Failed to check suspicious activity:', failedError)
      return { isSuspicious: false, score: 0 }
    }

    const failedCount = failedAttempts?.length || 0
    let suspiciousScore = 0
    let reason = ''

    // Check for multiple failed attempts
    if (failedCount >= 5) {
      suspiciousScore += 50
      reason = 'Multiple failed login attempts in short period'
    } else if (failedCount >= 3) {
      suspiciousScore += 25
      reason = 'Several failed login attempts'
    }

    // Check for different IP addresses
    const uniqueIPs = new Set(failedAttempts?.map(attempt => attempt.ip_address))
    if (uniqueIPs.size > 2) {
      suspiciousScore += 30
      reason += reason ? '; Multiple IP addresses' : 'Multiple IP addresses'
    }

    return {
      isSuspicious: suspiciousScore >= 25,
      reason: reason || undefined,
      score: suspiciousScore
    }
  } catch (error) {
    console.error('Error checking suspicious activity:', error)
    return { isSuspicious: false, score: 0 }
  }
}

/**
 * Lock user account for security reasons
 */
export async function lockUserAccount(
  userId: string,
  reason: string,
  metadata: Record<string, any> = {}
): Promise<boolean> {
  const supabase = createClient()
  
  try {
    const { error } = await supabase
      .from('account_security')
      .upsert({
        user_id: userId,
        is_locked: true,
        locked_at: new Date().toISOString(),
        locked_reason: reason,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Failed to lock user account:', error)
      return false
    }

    // Log account lock activity
    await logAuthActivity(userId, 'account_locked', {
      success: true,
      metadata: { reason, ...metadata }
    })

    return true
  } catch (error) {
    console.error('Error locking user account:', error)
    return false
  }
}

/**
 * Unlock user account
 */
export async function unlockUserAccount(
  userId: string,
  metadata: Record<string, any> = {}
): Promise<boolean> {
  const supabase = createClient()
  
  try {
    const { error } = await supabase
      .from('account_security')
      .update({
        is_locked: false,
        locked_at: null,
        locked_reason: null,
        failed_login_attempts: 0,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (error) {
      console.error('Failed to unlock user account:', error)
      return false
    }

    // Log account unlock activity
    await logAuthActivity(userId, 'account_unlocked', {
      success: true,
      metadata
    })

    return true
  } catch (error) {
    console.error('Error unlocking user account:', error)
    return false
  }
}

/**
 * Clean up old authentication data (run periodically)
 */
export async function cleanupOldAuthData(): Promise<number> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase.rpc('cleanup_old_auth_data')

    if (error) {
      console.error('Failed to cleanup old auth data:', error)
      return 0
    }

    return data || 0
  } catch (error) {
    console.error('Error cleaning up old auth data:', error)
    return 0
  }
}

/**
 * Utility function to extract IP address from request
 */
export function getClientIP(request: Request): string | undefined {
  const xForwardedFor = request.headers.get('x-forwarded-for')
  const xRealIP = request.headers.get('x-real-ip')
  const connectionRemoteAddr = request.headers.get('x-vercel-forwarded-for')
  
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim()
  }
  
  if (xRealIP) {
    return xRealIP
  }
  
  if (connectionRemoteAddr) {
    return connectionRemoteAddr
  }
  
  return undefined
}

/**
 * Utility function to extract user agent from request
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined
}