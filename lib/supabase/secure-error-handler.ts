import { logAuthActivity } from './auth-security'

/**
 * Secure Error Handler for Supabase Authentication
 * Prevents information disclosure while maintaining security logging
 */

interface AuthError {
  code: string
  message: string
  details?: any
}

interface SecureErrorResponse {
  error: string
  code?: string
  canRetry: boolean
  requiresAction?: 'verify_email' | 'reset_password' | 'contact_support' | 'wait'
  metadata?: Record<string, any>
}

/**
 * Production-safe error messages that don't reveal sensitive information
 */
const SECURE_ERROR_MESSAGES = {
  // Authentication errors
  'invalid_credentials': 'Invalid email or password. Please try again.',
  'email_not_confirmed': 'Please check your email and click the verification link to activate your account.',
  'too_many_requests': 'Too many login attempts. Please wait a few minutes before trying again.',
  'signup_disabled': 'Account registration is currently disabled. Please contact support.',
  'user_not_found': 'Invalid email or password. Please try again.',
  'weak_password': 'Password must be at least 8 characters long and include a mix of letters, numbers, and symbols.',
  'email_address_invalid': 'Please enter a valid email address.',
  'password_reset_limit_exceeded': 'Too many password reset requests. Please wait before trying again.',
  
  // OAuth errors
  'oauth_callback_error': 'Sign-in with external provider failed. Please try again.',
  'oauth_state_invalid': 'Security verification failed. Please try signing in again.',
  'oauth_cancelled': 'Sign-in was cancelled. You can try again anytime.',
  'oauth_access_denied': 'Access was denied by the external provider. Please try again.',
  
  // Session errors
  'session_expired': 'Your session has expired. Please sign in again.',
  'invalid_token': 'Your session is invalid. Please sign in again.',
  'token_refresh_failed': 'Session could not be renewed. Please sign in again.',
  
  // Account security errors
  'account_locked': 'Your account has been temporarily locked for security reasons. Please contact support.',
  'account_suspended': 'Your account has been suspended. Please contact support.',
  'device_not_recognized': 'Sign-in from unrecognized device detected. Please verify your identity.',
  
  // Network and service errors
  'network_error': 'Connection problem. Please check your internet connection and try again.',
  'service_unavailable': 'Authentication service is temporarily unavailable. Please try again in a few minutes.',
  'timeout': 'Request timed out. Please try again.',
  
  // Generic fallback
  'unknown_error': 'Something went wrong. Please try again or contact support if the problem persists.'
} as const

type ErrorCode = keyof typeof SECURE_ERROR_MESSAGES

/**
 * Maps internal error codes to secure error codes
 */
const ERROR_CODE_MAPPING: Record<string, ErrorCode> = {
  // Supabase Auth errors
  'invalid_credentials': 'invalid_credentials',
  'email_not_confirmed': 'email_not_confirmed',
  'signup_disabled': 'signup_disabled',
  'user_not_found': 'user_not_found',
  'weak_password': 'weak_password',
  'invalid_email': 'email_address_invalid',
  'rate_limit_exceeded': 'too_many_requests',
  'over_email_send_rate_limit': 'password_reset_limit_exceeded',
  
  // Session errors
  'refresh_token_not_found': 'session_expired',
  'invalid_refresh_token': 'invalid_token',
  'token_expired': 'session_expired',
  
  // OAuth errors
  'oauth_error': 'oauth_callback_error',
  'access_denied': 'oauth_access_denied',
  
  // Network errors
  'fetch_error': 'network_error',
  'timeout': 'timeout',
  
  // Custom application errors
  'account_locked': 'account_locked',
  'account_suspended': 'account_suspended',
  'device_not_recognized': 'device_not_recognized',
  'concurrent_session_limit': 'session_expired',
  'device_fingerprint_mismatch': 'device_not_recognized'
}

/**
 * Enhanced error handler that logs detailed errors while returning secure responses
 */
export class SecureAuthErrorHandler {
  /**
   * Process authentication error with security logging
   */
  static async handleAuthError(
    error: any,
    context: {
      userId?: string
      operation: string
      ipAddress?: string
      userAgent?: string
      metadata?: Record<string, any>
    }
  ): Promise<SecureErrorResponse> {
    // Extract error information
    const errorInfo = this.extractErrorInfo(error)
    
    // Log detailed error for security monitoring
    await this.logSecurityEvent(errorInfo, context)
    
    // Return secure error response
    return this.createSecureResponse(errorInfo, context)
  }

  /**
   * Extract error information from various error types
   */
  private static extractErrorInfo(error: any): {
    originalCode: string
    originalMessage: string
    details?: any
    severity: 'low' | 'medium' | 'high' | 'critical'
  } {
    let originalCode = 'unknown_error'
    let originalMessage = 'Unknown error occurred'
    let details = null
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low'

    if (error?.error?.message) {
      // Supabase error format
      originalMessage = error.error.message
      originalCode = error.error.code || this.inferErrorCode(originalMessage)
    } else if (error?.message) {
      // Standard error format
      originalMessage = error.message
      originalCode = error.code || this.inferErrorCode(originalMessage)
    } else if (typeof error === 'string') {
      // String error
      originalMessage = error
      originalCode = this.inferErrorCode(error)
    }

    // Determine severity
    severity = this.determineSeverity(originalCode, originalMessage)

    // Extract additional details (safely)
    if (error?.details || error?.error?.details) {
      details = error.details || error.error.details
    }

    return {
      originalCode,
      originalMessage,
      details,
      severity
    }
  }

  /**
   * Infer error code from error message
   */
  private static inferErrorCode(message: string): string {
    const lowerMessage = message.toLowerCase()
    
    if (lowerMessage.includes('invalid') && lowerMessage.includes('password')) {
      return 'invalid_credentials'
    }
    if (lowerMessage.includes('email') && lowerMessage.includes('confirm')) {
      return 'email_not_confirmed'
    }
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many')) {
      return 'rate_limit_exceeded'
    }
    if (lowerMessage.includes('weak password')) {
      return 'weak_password'
    }
    if (lowerMessage.includes('invalid email')) {
      return 'invalid_email'
    }
    if (lowerMessage.includes('timeout')) {
      return 'timeout'
    }
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
      return 'network_error'
    }
    if (lowerMessage.includes('oauth')) {
      return 'oauth_error'
    }
    if (lowerMessage.includes('session') && lowerMessage.includes('expire')) {
      return 'session_expired'
    }
    
    return 'unknown_error'
  }

  /**
   * Determine error severity for monitoring
   */
  private static determineSeverity(
    code: string, 
    message: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical security events
    if (code.includes('account_locked') || 
        code.includes('account_suspended') ||
        code.includes('device_fingerprint_mismatch')) {
      return 'critical'
    }

    // High security events
    if (code.includes('rate_limit') ||
        code.includes('too_many_requests') ||
        code.includes('device_not_recognized')) {
      return 'high'
    }

    // Medium security events
    if (code.includes('invalid_credentials') ||
        code.includes('oauth') ||
        code.includes('session_expired')) {
      return 'medium'
    }

    // Low severity events
    return 'low'
  }

  /**
   * Log security event with appropriate detail level
   */
  private static async logSecurityEvent(
    errorInfo: {
      originalCode: string
      originalMessage: string
      details?: any
      severity: 'low' | 'medium' | 'high' | 'critical'
    },
    context: {
      userId?: string
      operation: string
      ipAddress?: string
      userAgent?: string
      metadata?: Record<string, any>
    }
  ): Promise<void> {
    try {
      // Determine activity type based on operation
      let activityType: string = 'auth_error'
      
      if (context.operation.includes('login') || context.operation.includes('sign_in')) {
        activityType = 'failed_login'
      } else if (context.operation.includes('signup') || context.operation.includes('register')) {
        activityType = 'failed_registration'
      } else if (context.operation.includes('reset')) {
        activityType = 'failed_password_reset'
      } else if (context.operation.includes('oauth')) {
        activityType = 'oauth_failure'
      }

      // Log to auth activity system
      await logAuthActivity(
        context.userId || 'unknown',
        activityType as any,
        {
          success: false,
          failureReason: errorInfo.originalMessage,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: {
            ...context.metadata,
            errorCode: errorInfo.originalCode,
            severity: errorInfo.severity,
            operation: context.operation,
            timestamp: new Date().toISOString()
          }
        }
      )

      // Additional logging for high/critical severity events
      if (errorInfo.severity === 'high' || errorInfo.severity === 'critical') {
        console.error(`SECURITY ALERT [${errorInfo.severity.toUpperCase()}]:`, {
          errorCode: errorInfo.originalCode,
          operation: context.operation,
          userId: context.userId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          timestamp: new Date().toISOString()
        })

        // In production, this could trigger alerts to security team
        if (process.env.NODE_ENV === 'production' && process.env.SECURITY_WEBHOOK_URL) {
          // Send security alert (implementation would depend on your alerting system)
          this.sendSecurityAlert(errorInfo, context)
        }
      }
    } catch (loggingError) {
      console.error('Failed to log security event:', loggingError)
    }
  }

  /**
   * Send security alert for high/critical events
   */
  private static async sendSecurityAlert(
    errorInfo: any,
    context: any
  ): Promise<void> {
    // Implementation would depend on your alerting system
    // This is a placeholder for security team notifications
    console.log('SECURITY ALERT TRIGGERED:', {
      severity: errorInfo.severity,
      errorCode: errorInfo.originalCode,
      operation: context.operation,
      userId: context.userId,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Create secure response that doesn't leak sensitive information
   */
  private static createSecureResponse(
    errorInfo: {
      originalCode: string
      originalMessage: string
      details?: any
      severity: 'low' | 'medium' | 'high' | 'critical'
    },
    context: {
      operation: string
      metadata?: Record<string, any>
    }
  ): SecureErrorResponse {
    // Map to secure error code
    const secureCode = ERROR_CODE_MAPPING[errorInfo.originalCode] || 'unknown_error'
    const secureMessage = SECURE_ERROR_MESSAGES[secureCode]

    // Determine if operation can be retried
    const canRetry = this.canRetryOperation(secureCode, errorInfo.severity)

    // Determine required action
    const requiresAction = this.getRequiredAction(secureCode)

    // Safe metadata (no sensitive information)
    const safeMetadata = this.createSafeMetadata(secureCode, context)

    return {
      error: secureMessage,
      code: secureCode,
      canRetry,
      requiresAction,
      metadata: safeMetadata
    }
  }

  /**
   * Determine if operation can be retried
   */
  private static canRetryOperation(
    secureCode: ErrorCode,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): boolean {
    // Never retry critical security events
    if (severity === 'critical') {
      return false
    }

    // Don't retry certain error types
    const nonRetryableErrors: ErrorCode[] = [
      'email_not_confirmed',
      'account_locked',
      'account_suspended',
      'weak_password',
      'email_address_invalid',
      'signup_disabled'
    ]

    return !nonRetryableErrors.includes(secureCode)
  }

  /**
   * Get required action for error resolution
   */
  private static getRequiredAction(
    secureCode: ErrorCode
  ): SecureErrorResponse['requiresAction'] {
    const actionMap: Record<ErrorCode, SecureErrorResponse['requiresAction']> = {
      'email_not_confirmed': 'verify_email',
      'account_locked': 'contact_support',
      'account_suspended': 'contact_support',
      'device_not_recognized': 'verify_email',
      'weak_password': 'reset_password',
      'too_many_requests': 'wait',
      'password_reset_limit_exceeded': 'wait',
      'service_unavailable': 'wait'
    }

    return actionMap[secureCode]
  }

  /**
   * Create safe metadata without sensitive information
   */
  private static createSafeMetadata(
    secureCode: ErrorCode,
    context: { operation: string; metadata?: Record<string, any> }
  ): Record<string, any> | undefined {
    const metadata: Record<string, any> = {
      operation: context.operation,
      timestamp: new Date().toISOString()
    }

    // Add specific guidance based on error type
    switch (secureCode) {
      case 'too_many_requests':
        metadata.retryAfter = '5 minutes'
        break
      case 'email_not_confirmed':
        metadata.helpText = 'Check your email inbox and spam folder'
        break
      case 'weak_password':
        metadata.requirements = [
          'At least 8 characters long',
          'Include uppercase and lowercase letters',
          'Include at least one number',
          'Include at least one special character'
        ]
        break
    }

    return Object.keys(metadata).length > 2 ? metadata : undefined
  }
}

/**
 * Convenience functions for common error handling scenarios
 */

export async function handleLoginError(
  error: any,
  context: {
    email?: string
    ipAddress?: string
    userAgent?: string
  }
): Promise<SecureErrorResponse> {
  return SecureAuthErrorHandler.handleAuthError(error, {
    operation: 'login',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: { email: context.email }
  })
}

export async function handleSignupError(
  error: any,
  context: {
    email?: string
    ipAddress?: string
    userAgent?: string
  }
): Promise<SecureErrorResponse> {
  return SecureAuthErrorHandler.handleAuthError(error, {
    operation: 'signup',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: { email: context.email }
  })
}

export async function handleOAuthError(
  error: any,
  context: {
    provider: string
    userId?: string
    ipAddress?: string
    userAgent?: string
  }
): Promise<SecureErrorResponse> {
  return SecureAuthErrorHandler.handleAuthError(error, {
    userId: context.userId,
    operation: `oauth_${context.provider}`,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: { provider: context.provider }
  })
}

export async function handleSessionError(
  error: any,
  context: {
    userId: string
    sessionId?: string
    ipAddress?: string
    userAgent?: string
  }
): Promise<SecureErrorResponse> {
  return SecureAuthErrorHandler.handleAuthError(error, {
    userId: context.userId,
    operation: 'session_validation',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: { sessionId: context.sessionId }
  })
}