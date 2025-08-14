import { createClient } from './client'
import type { Database } from '../database.types'

type AuthActivity = Database['public']['Tables']['auth_activity']['Insert']

/**
 * Client-side Authentication Security Helper Functions
 * Production-ready security utilities for Supabase auth (client-side)
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
 * Log authentication activity with comprehensive tracking (client-side)
 */
export async function logAuthActivityClient(
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
      // Handle 404 errors gracefully (RPC function not deployed yet)
      if (error.code === 'PGRST202' || error.message?.includes('function public.log_auth_activity')) {
        console.warn('Auth activity logging RPC function not available - logging silently disabled')
        return null
      }
      console.error('Failed to log auth activity:', error)
      return null
    }

    return data
  } catch (error: any) {
    // Graceful degradation for missing database functions
    if (error?.code === 'PGRST202' || error?.message?.includes('404')) {
      console.warn('Auth activity logging temporarily unavailable - authentication will continue normally')
      return null
    }
    console.error('Error logging auth activity:', error)
    return null
  }
}

/**
 * Get client IP (client-side approximation)
 */
export function getClientIPClient(): string {
  // Client-side IP detection is limited for security reasons
  // This is a fallback that should be enhanced server-side
  return 'client-unknown'
}

/**
 * Get client user agent
 */
export function getUserAgentClient(): string {
  if (typeof window !== 'undefined') {
    return navigator.userAgent
  }
  return 'unknown'
}

/**
 * Client-side stubs for server functions
 * These functions need server-side implementation for full functionality
 */

export async function incrementFailedLoginAttempts(userId: string): Promise<number> {
  console.warn('incrementFailedLoginAttempts called on client-side - implement via API route')
  return 0
}

export async function resetFailedLoginAttempts(userId: string): Promise<void> {
  console.warn('resetFailedLoginAttempts called on client-side - implement via API route')
}

export async function checkPasswordHistory(userId: string, passwordHash: string): Promise<boolean> {
  console.warn('checkPasswordHistory called on client-side - implement via API route')
  return false
}

export async function addPasswordToHistory(userId: string, passwordHash: string): Promise<void> {
  console.warn('addPasswordToHistory called on client-side - implement via API route')
}

export async function checkSuspiciousActivity(userId: string): Promise<boolean> {
  console.warn('checkSuspiciousActivity called on client-side - implement via API route')
  return false
}

export async function lockUserAccount(userId: string, reason: string): Promise<void> {
  console.warn('lockUserAccount called on client-side - implement via API route')
}