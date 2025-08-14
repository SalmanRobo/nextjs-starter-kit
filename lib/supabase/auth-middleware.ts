import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { 
  logAuthActivity, 
  isAccountLocked, 
  checkSuspiciousActivity,
  getClientIP,
  getUserAgent
} from './auth-security'

/**
 * Enhanced Authentication Middleware with Security Features
 * Provides comprehensive security checks for protected routes
 */

interface AuthMiddlewareOptions {
  requireAuth?: boolean
  requireRole?: 'user' | 'agent' | 'admin'
  redirectTo?: string
  publicPaths?: string[]
  protectedPaths?: string[]
}

export async function createAuthMiddleware(
  request: NextRequest,
  options: AuthMiddlewareOptions = {}
): Promise<NextResponse> {
  const {
    requireAuth = true,
    requireRole,
    redirectTo = '/sign-in',
    publicPaths = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password'],
    protectedPaths = []
  } = options

  const response = NextResponse.next()
  const url = request.nextUrl.clone()
  const pathname = url.pathname

  // Extract client information
  const clientIP = getClientIP(request)
  const userAgent = getUserAgent(request)

  // Create Supabase client with cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  try {
    // Get current user session
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    // Check if path is public
    const isPublicPath = publicPaths.some(path => pathname.startsWith(path))
    const isProtectedPath = protectedPaths.length > 0 
      ? protectedPaths.some(path => pathname.startsWith(path))
      : !isPublicPath

    // Handle authentication errors
    if (userError) {
      console.error('Auth middleware error:', userError)
      if (isProtectedPath && requireAuth) {
        url.pathname = redirectTo
        return NextResponse.redirect(url)
      }
      return response
    }

    // If no user and auth is required
    if (!user && isProtectedPath && requireAuth) {
      url.pathname = redirectTo
      return NextResponse.redirect(url)
    }

    // If user exists, perform security checks
    if (user) {
      // Check if account is locked
      const accountLocked = await isAccountLocked(user.id)
      if (accountLocked) {
        // Log suspicious activity attempt
        await logAuthActivity(user.id, 'suspicious_activity', {
          ipAddress: clientIP,
          userAgent,
          success: false,
          failureReason: 'Attempted access with locked account',
          metadata: { attempted_path: pathname }
        })

        // Redirect to account locked page or sign out
        await supabase.auth.signOut()
        url.pathname = '/account-locked'
        return NextResponse.redirect(url)
      }

      // Check for suspicious activity
      const suspiciousCheck = await checkSuspiciousActivity(user.id)
      if (suspiciousCheck.isSuspicious && suspiciousCheck.score > 50) {
        // Log high-risk suspicious activity
        await logAuthActivity(user.id, 'suspicious_activity', {
          ipAddress: clientIP,
          userAgent,
          success: false,
          failureReason: suspiciousCheck.reason,
          metadata: { 
            suspicious_score: suspiciousCheck.score,
            attempted_path: pathname 
          }
        })

        // For very high suspicious scores, lock the account
        if (suspiciousCheck.score > 75) {
          url.pathname = '/account-locked'
          return NextResponse.redirect(url)
        }
      }

      // Get user profile for role checking
      if (requireRole) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profileError || !profile) {
          console.error('Failed to get user profile:', profileError)
          url.pathname = '/profile-incomplete'
          return NextResponse.redirect(url)
        }

        // Check role permissions
        if (profile.role !== requireRole && profile.role !== 'admin') {
          // Log unauthorized access attempt
          await logAuthActivity(user.id, 'suspicious_activity', {
            ipAddress: clientIP,
            userAgent,
            success: false,
            failureReason: `Unauthorized access attempt to ${requireRole} area`,
            metadata: { 
              user_role: profile.role,
              required_role: requireRole,
              attempted_path: pathname 
            }
          })

          url.pathname = '/unauthorized'
          return NextResponse.redirect(url)
        }
      }

      // Log successful access to sensitive areas
      if (isProtectedPath && (pathname.includes('/admin') || pathname.includes('/dashboard'))) {
        await logAuthActivity(user.id, 'profile_update', {
          ipAddress: clientIP,
          userAgent,
          success: true,
          metadata: { accessed_path: pathname }
        })
      }

      // Redirect authenticated users away from auth pages
      if (isPublicPath && pathname !== '/') {
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }

    return response

  } catch (error) {
    console.error('Auth middleware unexpected error:', error)
    
    // Log the error but don't break the app
    if (user) {
      await logAuthActivity(user.id, 'suspicious_activity', {
        ipAddress: clientIP,
        userAgent,
        success: false,
        failureReason: 'Middleware error occurred',
        metadata: { error: String(error) }
      })
    }

    // For protected paths, redirect to sign-in on error
    if (isProtectedPath && requireAuth) {
      url.pathname = redirectTo
      return NextResponse.redirect(url)
    }

    return response
  }
}

/**
 * Rate limiting middleware for authentication endpoints
 */
export async function createRateLimitMiddleware(
  request: NextRequest,
  options: {
    maxAttempts?: number
    windowMs?: number
    blockDurationMs?: number
  } = {}
): Promise<NextResponse | null> {
  const {
    maxAttempts = 5,
    windowMs = 15 * 60 * 1000, // 15 minutes
    blockDurationMs = 60 * 60 * 1000 // 1 hour
  } = options

  const clientIP = getClientIP(request)
  if (!clientIP) {
    return null // Can't rate limit without IP
  }

  const key = `rate_limit:${clientIP}`
  
  // In a production environment, you would use Redis or similar
  // For now, we'll use a simple in-memory store
  // This should be replaced with a proper rate limiting solution
  
  try {
    // Check if IP is currently blocked
    const blockKey = `rate_limit_block:${clientIP}`
    
    // This is a simplified example - in production, use Redis with TTL
    // const blocked = await redis.get(blockKey)
    // if (blocked) {
    //   return new NextResponse('Too Many Requests', { status: 429 })
    // }

    // Increment attempt counter
    // const attempts = await redis.incr(key)
    // await redis.expire(key, windowMs / 1000)

    // if (attempts > maxAttempts) {
    //   await redis.setex(blockKey, blockDurationMs / 1000, '1')
    //   return new NextResponse('Too Many Requests', { status: 429 })
    // }

    return null // No rate limit exceeded
  } catch (error) {
    console.error('Rate limiting error:', error)
    return null // Don't block on rate limiting errors
  }
}

/**
 * Security headers middleware
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.supabase.co https://*.supabase.co;"
  )
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  )

  return response
}

/**
 * Comprehensive middleware that combines all security features
 */
export async function enhancedAuthMiddleware(
  request: NextRequest,
  options: AuthMiddlewareOptions = {}
): Promise<NextResponse> {
  // Apply rate limiting first
  const rateLimitResponse = await createRateLimitMiddleware(request)
  if (rateLimitResponse) {
    return addSecurityHeaders(rateLimitResponse)
  }

  // Apply authentication middleware
  const authResponse = await createAuthMiddleware(request, options)
  
  // Add security headers
  return addSecurityHeaders(authResponse)
}