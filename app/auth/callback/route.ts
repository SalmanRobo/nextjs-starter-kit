import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { handleOAuthCallback } from '@/lib/supabase/oauth-security'
import { logAuthActivity, getClientIP, getUserAgent, cleanLogOptions } from '@/lib/supabase/auth-security'
import { securityMonitor } from '@/lib/supabase/security-monitor'

/**
 * Enhanced OAuth Callback Handler
 * Handles OAuth callbacks with advanced security validation
 */
export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const state = requestUrl.searchParams.get('state')
    const error = requestUrl.searchParams.get('error')
    const provider = requestUrl.searchParams.get('provider') || 'unknown'

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error)
      
      // Log OAuth failure
      await logAuthActivity('unknown', 'oauth_failure', cleanLogOptions({
        success: false,
        failureReason: `OAuth error: ${error}`,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
        metadata: { 
          provider,
          error,
          error_description: requestUrl.searchParams.get('error_description')
        }
      }))

      // Redirect to sign-in with error
      return NextResponse.redirect(
        new URL(`/sign-in?error=oauth_${error}&provider=${provider}`, request.url)
      )
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('Missing OAuth parameters:', { code: !!code, state: !!state })
      
      await logAuthActivity('unknown', 'oauth_failure', {
        success: false,
        failureReason: 'Missing OAuth parameters',
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
        metadata: { provider, missingCode: !code, missingState: !state }
      })

      return NextResponse.redirect(
        new URL(`/sign-in?error=oauth_invalid_request&provider=${provider}`, request.url)
      )
    }

    // Handle OAuth callback with enhanced security
    const callbackResult = await handleOAuthCallback(
      provider,
      code,
      state,
      request
    )

    if (!callbackResult.success) {
      console.error('OAuth callback failed:', callbackResult.error)

      // Report security event if suspicious
      if (callbackResult.error?.includes('State validation failed') || 
          callbackResult.error?.includes('Device fingerprint mismatch')) {
        await securityMonitor.recordSecurityEvent(
          'unknown',
          'unusual_oauth_activity',
          {
            provider,
            error: callbackResult.error,
            stateProvided: !!state,
            codeProvided: !!code
          },
          'high',
          getClientIP(request),
          getUserAgent(request)
        )
      }

      return NextResponse.redirect(
        new URL(`/sign-in?error=oauth_callback_failed&provider=${provider}`, request.url)
      )
    }

    // Create Supabase session
    const supabase = await createClient()

    if (callbackResult.user) {
      // Log successful OAuth login
      await logAuthActivity(callbackResult.user.id, 'oauth_sign_in', {
        success: true,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
        metadata: {
          provider,
          email: callbackResult.user.email,
          user_id: callbackResult.user.id,
          created_at: callbackResult.user.created_at
        }
      })

      // Check for suspicious activity patterns
      try {
        await securityMonitor.recordSecurityEvent(
          callbackResult.user.id,
          'unusual_oauth_activity',
          {
            provider,
            success: true,
            newUser: !callbackResult.user.email_confirmed_at
          },
          'low', // Start with low severity for successful OAuth
          getClientIP(request),
          getUserAgent(request)
        )
      } catch (error) {
        console.warn('Failed to record OAuth security event:', error)
      }
    }

    // Determine redirect URL
    const redirectTo = callbackResult.redirectTo || '/dashboard'
    const redirectUrl = new URL(redirectTo, request.url)

    // Add success parameter
    redirectUrl.searchParams.set('oauth_success', 'true')
    redirectUrl.searchParams.set('provider', provider)

    return NextResponse.redirect(redirectUrl)

  } catch (error) {
    console.error('OAuth callback handler error:', error)

    // Log critical OAuth error
    await logAuthActivity('unknown', 'oauth_failure', {
      success: false,
      failureReason: 'OAuth callback handler error',
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
      metadata: {
        error: String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    })

    // Redirect to sign-in with generic error
    return NextResponse.redirect(
      new URL('/sign-in?error=oauth_server_error', request.url)
    )
  }
}

/**
 * Handle POST requests for Apple Sign-In (form_post response mode)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const code = formData.get('code') as string
    const state = formData.get('state') as string
    const error = formData.get('error') as string

    // Convert to GET-like handling
    const url = new URL(request.url)
    if (code) url.searchParams.set('code', code)
    if (state) url.searchParams.set('state', state)
    if (error) url.searchParams.set('error', error)
    url.searchParams.set('provider', 'apple')

    // Create a new request object for the GET handler
    const getRequest = new NextRequest(url.toString(), {
      method: 'GET',
      headers: request.headers
    })

    return GET(getRequest)

  } catch (error) {
    console.error('OAuth POST callback error:', error)

    await logAuthActivity('unknown', 'oauth_failure', {
      success: false,
      failureReason: 'OAuth POST callback error',
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
      metadata: {
        error: String(error),
        method: 'POST'
      }
    })

    return NextResponse.redirect(
      new URL('/sign-in?error=oauth_server_error', request.url)
    )
  }
}

/**
 * Enhanced error handling for OAuth flows
 */
function getOAuthErrorMessage(error: string): string {
  const errorMessages: Record<string, string> = {
    'access_denied': 'You cancelled the sign-in process',
    'invalid_request': 'Invalid OAuth request',
    'invalid_client': 'OAuth configuration error',
    'invalid_grant': 'OAuth authorization expired',
    'unauthorized_client': 'OAuth client not authorized',
    'unsupported_response_type': 'OAuth configuration error',
    'invalid_scope': 'Insufficient permissions requested',
    'server_error': 'OAuth provider error',
    'temporarily_unavailable': 'OAuth provider temporarily unavailable'
  }

  return errorMessages[error] || 'OAuth authentication failed'
}

/**
 * Security validation for OAuth state parameter
 */
async function validateOAuthSecurity(
  provider: string,
  state: string,
  request: NextRequest
): Promise<{
  valid: boolean
  error?: string
  suspiciousActivity?: boolean
}> {
  try {
    // Check for common OAuth attack patterns
    const userAgent = getUserAgent(request)
    const ipAddress = getClientIP(request)

    // Suspicious patterns
    const suspiciousUserAgents = [
      'curl/', 'wget/', 'python-requests/', 'node-fetch/', 'axios/'
    ]

    const isSuspiciousUserAgent = suspiciousUserAgents.some(pattern => 
      userAgent?.toLowerCase().includes(pattern.toLowerCase())
    )

    if (isSuspiciousUserAgent) {
      return {
        valid: false,
        error: 'Suspicious user agent detected',
        suspiciousActivity: true
      }
    }

    // Additional state validation could be added here
    return { valid: true }

  } catch (error) {
    console.error('OAuth security validation error:', error)
    return {
      valid: false,
      error: 'Security validation failed'
    }
  }
}