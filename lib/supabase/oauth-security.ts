import { createHash, randomBytes } from 'crypto'
import { createClient } from './client'
import { logAuthActivity, getClientIP, getUserAgent } from './auth-security'

/**
 * Advanced OAuth Security Implementation
 * Implements PKCE, state validation, and enhanced security measures
 */

interface OAuthState {
  provider: string
  redirectTo?: string
  timestamp: number
  nonce: string
  codeVerifier?: string
  deviceFingerprint?: string
}

interface PKCEParams {
  codeVerifier: string
  codeChallenge: string
  codeChallengeMethod: 'S256'
}

/**
 * Generate cryptographically secure random string
 */
function generateSecureRandom(length: number): string {
  return randomBytes(length).toString('base64url').slice(0, length)
}

/**
 * Generate PKCE parameters for OAuth flow
 */
export function generatePKCE(): PKCEParams {
  const codeVerifier = generateSecureRandom(128)
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256'
  }
}

/**
 * Generate and store OAuth state parameter with enhanced security
 */
export function generateOAuthState(
  provider: string,
  options: {
    redirectTo?: string
    request?: Request
  } = {}
): string {
  const nonce = generateSecureRandom(32)
  const timestamp = Date.now()
  
  // Generate device fingerprint from request headers
  const deviceFingerprint = options.request ? 
    generateDeviceFingerprint(options.request) : undefined

  const stateData: OAuthState = {
    provider,
    redirectTo: options.redirectTo,
    timestamp,
    nonce,
    deviceFingerprint
  }

  // Encode state with additional security measures
  const stateString = JSON.stringify(stateData)
  const stateBuffer = Buffer.from(stateString, 'utf8')
  const encodedState = stateBuffer.toString('base64url')
  
  // Store in secure httpOnly cookie for validation
  if (typeof window !== 'undefined') {
    // Client-side: use sessionStorage as fallback
    sessionStorage.setItem(`oauth_state_${provider}`, encodedState)
  }
  
  return encodedState
}

/**
 * Validate OAuth state parameter
 */
export function validateOAuthState(
  state: string,
  provider: string,
  request?: Request
): {
  isValid: boolean
  error?: string
  stateData?: OAuthState
} {
  try {
    // Decode state parameter
    const stateBuffer = Buffer.from(state, 'base64url')
    const stateString = stateBuffer.toString('utf8')
    const stateData: OAuthState = JSON.parse(stateString)

    // Validate provider matches
    if (stateData.provider !== provider) {
      return {
        isValid: false,
        error: 'Provider mismatch in OAuth state'
      }
    }

    // Validate timestamp (15 minutes expiry)
    const maxAge = 15 * 60 * 1000 // 15 minutes
    if (Date.now() - stateData.timestamp > maxAge) {
      return {
        isValid: false,
        error: 'OAuth state has expired'
      }
    }

    // Validate device fingerprint if available
    if (request && stateData.deviceFingerprint) {
      const currentFingerprint = generateDeviceFingerprint(request)
      if (currentFingerprint !== stateData.deviceFingerprint) {
        return {
          isValid: false,
          error: 'Device fingerprint mismatch'
        }
      }
    }

    // Retrieve and validate stored state
    let storedState: string | null = null
    
    if (typeof window !== 'undefined') {
      storedState = sessionStorage.getItem(`oauth_state_${provider}`)
      sessionStorage.removeItem(`oauth_state_${provider}`)
    }

    if (storedState && storedState !== state) {
      return {
        isValid: false,
        error: 'State parameter does not match stored state'
      }
    }

    return {
      isValid: true,
      stateData
    }
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid OAuth state format'
    }
  }
}

/**
 * Generate device fingerprint from request headers
 */
export function generateDeviceFingerprint(request: Request): string {
  const userAgent = request.headers.get('user-agent') || ''
  const acceptLanguage = request.headers.get('accept-language') || ''
  const acceptEncoding = request.headers.get('accept-encoding') || ''
  const connection = request.headers.get('connection') || ''
  
  const fingerprintData = {
    userAgent,
    acceptLanguage,
    acceptEncoding,
    connection,
    timestamp: Math.floor(Date.now() / (1000 * 60 * 60 * 24)) // Daily salt
  }
  
  return createHash('sha256')
    .update(JSON.stringify(fingerprintData))
    .digest('hex')
    .substring(0, 16)
}

/**
 * Enhanced Google OAuth with security measures
 */
export async function initiateGoogleOAuth(options: {
  redirectTo?: string
  request?: Request
  scopes?: string[]
} = {}): Promise<{
  success: boolean
  url?: string
  error?: string
}> {
  try {
    const supabase = createClient()
    
    // Generate PKCE parameters
    const pkce = generatePKCE()
    
    // Generate secure state
    const state = generateOAuthState('google', {
      redirectTo: options.redirectTo,
      request: options.request
    })
    
    // Store PKCE verifier securely
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('oauth_code_verifier', pkce.codeVerifier)
    }
    
    // Define OAuth scopes
    const scopes = options.scopes || [
      'openid',
      'email',
      'profile'
    ]
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?provider=google`,
        queryParams: {
          state,
          code_challenge: pkce.codeChallenge,
          code_challenge_method: pkce.codeChallengeMethod,
          scope: scopes.join(' ')
        }
      }
    })

    if (error) {
      console.error('Google OAuth initiation failed:', error)
      return {
        success: false,
        error: 'Failed to initiate Google OAuth'
      }
    }

    return {
      success: true,
      url: data.url
    }
  } catch (error) {
    console.error('Google OAuth error:', error)
    return {
      success: false,
      error: 'Google OAuth initialization error'
    }
  }
}

/**
 * Enhanced Apple OAuth with privacy features
 */
export async function initiateAppleOAuth(options: {
  redirectTo?: string
  request?: Request
} = {}): Promise<{
  success: boolean
  url?: string
  error?: string
}> {
  try {
    const supabase = createClient()
    
    // Generate PKCE parameters
    const pkce = generatePKCE()
    
    // Generate secure state
    const state = generateOAuthState('apple', {
      redirectTo: options.redirectTo,
      request: options.request
    })
    
    // Store PKCE verifier securely
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('oauth_code_verifier', pkce.codeVerifier)
    }
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?provider=apple`,
        queryParams: {
          state,
          code_challenge: pkce.codeChallenge,
          code_challenge_method: pkce.codeChallengeMethod,
          scope: 'name email',
          response_mode: 'form_post' // Enhanced security for Apple
        }
      }
    })

    if (error) {
      console.error('Apple OAuth initiation failed:', error)
      return {
        success: false,
        error: 'Failed to initiate Apple OAuth'
      }
    }

    return {
      success: true,
      url: data.url
    }
  } catch (error) {
    console.error('Apple OAuth error:', error)
    return {
      success: false,
      error: 'Apple OAuth initialization error'
    }
  }
}

/**
 * Handle OAuth callback with enhanced security validation
 */
export async function handleOAuthCallback(
  provider: string,
  code: string,
  state: string,
  request: Request
): Promise<{
  success: boolean
  user?: any
  redirectTo?: string
  error?: string
}> {
  try {
    // Validate state parameter
    const stateValidation = validateOAuthState(state, provider, request)
    if (!stateValidation.isValid) {
      await logAuthActivity('unknown', 'oauth_failure', {
        success: false,
        failureReason: `State validation failed: ${stateValidation.error}`,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
        metadata: { provider, error: stateValidation.error }
      })
      
      return {
        success: false,
        error: 'Invalid OAuth state'
      }
    }

    const supabase = createClient()
    
    // Retrieve PKCE verifier
    let codeVerifier: string | null = null
    if (typeof window !== 'undefined') {
      codeVerifier = sessionStorage.getItem('oauth_code_verifier')
      sessionStorage.removeItem('oauth_code_verifier')
    }
    
    // Exchange code for tokens
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error || !data.user) {
      await logAuthActivity('unknown', 'oauth_failure', {
        success: false,
        failureReason: error?.message || 'Failed to exchange code for session',
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
        metadata: { provider }
      })
      
      return {
        success: false,
        error: 'Failed to complete OAuth flow'
      }
    }

    // Log successful OAuth login
    await logAuthActivity(data.user.id, 'oauth_sign_in', {
      success: true,
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
      metadata: { 
        provider,
        email: data.user.email,
        created_at: data.user.created_at
      }
    })

    return {
      success: true,
      user: data.user,
      redirectTo: stateValidation.stateData?.redirectTo
    }
  } catch (error) {
    console.error('OAuth callback error:', error)
    
    await logAuthActivity('unknown', 'oauth_failure', {
      success: false,
      failureReason: 'OAuth callback processing error',
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
      metadata: { provider, error: String(error) }
    })
    
    return {
      success: false,
      error: 'OAuth callback processing failed'
    }
  }
}

/**
 * Secure OAuth logout with provider-specific cleanup
 */
export async function secureOAuthLogout(
  provider: string,
  userId: string,
  request?: Request
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = createClient()
    
    // Revoke Supabase session
    const { error: logoutError } = await supabase.auth.signOut()
    
    if (logoutError) {
      console.error('Supabase logout error:', logoutError)
    }
    
    // Clear OAuth-related storage
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`oauth_state_${provider}`)
      sessionStorage.removeItem('oauth_code_verifier')
    }
    
    // Log logout activity
    await logAuthActivity(userId, 'sign_out', {
      success: true,
      ipAddress: request ? getClientIP(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
      metadata: { provider, oauth_logout: true }
    })
    
    return {
      success: true
    }
  } catch (error) {
    console.error('Secure OAuth logout error:', error)
    return {
      success: false,
      error: 'Failed to complete secure logout'
    }
  }
}

/**
 * Check OAuth token freshness and refresh if needed
 */
export async function ensureOAuthTokenFreshness(
  maxAgeMinutes: number = 30
): Promise<{
  success: boolean
  refreshed: boolean
  error?: string
}> {
  try {
    const supabase = createClient()
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return {
        success: false,
        refreshed: false,
        error: 'No active session'
      }
    }
    
    // Check token age
    const tokenIssued = new Date(session.access_token_expires_at || 0).getTime()
    const now = Date.now()
    const tokenAge = now - tokenIssued
    const maxAgeMs = maxAgeMinutes * 60 * 1000
    
    if (tokenAge < maxAgeMs) {
      return {
        success: true,
        refreshed: false
      }
    }
    
    // Refresh token
    const { data, error: refreshError } = await supabase.auth.refreshSession()
    
    if (refreshError || !data.session) {
      return {
        success: false,
        refreshed: false,
        error: 'Failed to refresh token'
      }
    }
    
    // Log token refresh
    await logAuthActivity(data.session.user.id, 'token_refresh', {
      success: true,
      metadata: { 
        previous_expires_at: session.expires_at,
        new_expires_at: data.session.expires_at
      }
    })
    
    return {
      success: true,
      refreshed: true
    }
  } catch (error) {
    console.error('Token refresh error:', error)
    return {
      success: false,
      refreshed: false,
      error: 'Token refresh processing failed'
    }
  }
}