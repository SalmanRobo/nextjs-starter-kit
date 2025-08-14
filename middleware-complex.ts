import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { crossDomainSSO, CrossDomainSecurity, CROSS_DOMAIN_CONFIG } from '@/lib/auth/cross-domain-sso'

/**
 * ALDARI Enterprise Cross-Domain Authentication Middleware
 * Handles seamless authentication between auth.aldari.app and home.aldari.app
 */
export async function middleware(request: NextRequest) {
  const { pathname, hostname, searchParams } = request.nextUrl
  
  // Skip static files and API routes immediately
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_vercel') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Create response with enhanced security headers
  const response = NextResponse.next()
  
  // Enhanced security headers for cross-domain setup
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  }

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  try {
    // CRITICAL: Environment validation
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('PROD ERROR: Missing Supabase environment variables')
      return response
    }

    // Handle cross-domain authentication token
    const authToken = searchParams.get('auth_token')
    let crossDomainSession = null

    if (authToken) {
      crossDomainSession = await crossDomainSSO.validateCrossDomainToken(authToken)
      
      // Remove token from URL for security
      const cleanUrl = new URL(request.url)
      cleanUrl.searchParams.delete('auth_token')
      cleanUrl.searchParams.delete('timestamp')
      
      if (crossDomainSession) {
        // Create redirect response with session cookies
        const redirectResponse = NextResponse.redirect(cleanUrl)
        
        // Set session cookies for the new domain
        redirectResponse.cookies.set('supabase-auth-token', JSON.stringify({
          access_token: crossDomainSession.access_token,
          refresh_token: crossDomainSession.refresh_token,
          expires_at: crossDomainSession.expires_at,
        }), {
          domain: CROSS_DOMAIN_CONFIG.cookieDomain,
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 24 * 60 * 60, // 24 hours
        })

        // Apply security headers to redirect
        Object.entries(securityHeaders).forEach(([key, value]) => {
          redirectResponse.headers.set(key, value)
        })

        return redirectResponse
      }
    }

    // PRODUCTION-OPTIMIZED: Enhanced Supabase client with cross-domain support
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          const cookies = request.cookies.getAll()
          
          // Check for cross-domain session cookie
          const authCookie = request.cookies.get('supabase-auth-token')
          if (authCookie && crossDomainSession) {
            // Merge cross-domain session data
            const sessionData = JSON.parse(authCookie.value)
            cookies.push({
              name: 'sb-access-token',
              value: sessionData.access_token
            })
            cookies.push({
              name: 'sb-refresh-token',
              value: sessionData.refresh_token
            })
          }
          
          return cookies
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Ensure cross-domain cookies use the correct domain
            const enhancedOptions = {
              ...options,
              domain: hostname.includes('aldari.app') ? CROSS_DOMAIN_CONFIG.cookieDomain : undefined,
              secure: true,
              sameSite: 'lax' as const,
            }
            response.cookies.set(name, value, enhancedOptions)
          })
        },
      },
    })

    // CRITICAL: Fast auth check with timeout and cross-domain fallback
    let user = null
    
    try {
      const authPromise = supabase.auth.getUser()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Auth timeout')), 2500)
      )

      const { data: { user: supabaseUser } } = await Promise.race([authPromise, timeoutPromise])
      user = supabaseUser

      // If no user found but we have cross-domain session, try to restore
      if (!user && crossDomainSession) {
        await supabase.auth.setSession({
          access_token: crossDomainSession.access_token,
          refresh_token: crossDomainSession.refresh_token,
        })
        
        const { data: { user: restoredUser } } = await supabase.auth.getUser()
        user = restoredUser
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      // Continue without user
    }

    // Domain-specific route configurations
    const isAuthDomain = hostname === 'auth.aldari.app' || hostname === 'localhost'
    const isAppDomain = hostname === 'home.aldari.app'
    
    // Enhanced route protection logic
    const protectedRoutes = ['/dashboard', '/admin', '/settings', '/upload', '/profile']
    const authRoutes = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password']
    const publicRoutes = ['/', '/pricing', '/terms-of-service', '/privacy-policy']
    
    const isProtected = protectedRoutes.some(route => pathname.startsWith(route))
    const isAuth = authRoutes.some(route => pathname.startsWith(route))
    const isPublic = publicRoutes.includes(pathname)

    // Cross-domain authentication flow logic
    if (user && isAuth) {
      // Authenticated user trying to access auth pages
      if (isAuthDomain) {
        // On auth domain, create cross-domain token and redirect to app domain
        const token = await crossDomainSSO.generateCrossDomainToken({
          access_token: (await supabase.auth.getSession()).data.session?.access_token,
          refresh_token: (await supabase.auth.getSession()).data.session?.refresh_token,
          expires_at: (await supabase.auth.getSession()).data.session?.expires_at,
          user
        })
        
        const redirectUrl = crossDomainSSO.createAuthenticatedRedirectUrl(
          CROSS_DOMAIN_CONFIG.appDomain,
          '/dashboard',
          token
        )
        
        const redirectResponse = NextResponse.redirect(redirectUrl)
        Object.entries(securityHeaders).forEach(([key, value]) => {
          redirectResponse.headers.set(key, value)
        })
        
        return redirectResponse
      } else {
        // On other domains, redirect to dashboard
        const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url))
        Object.entries(securityHeaders).forEach(([key, value]) => {
          redirectResponse.headers.set(key, value)
        })
        return redirectResponse
      }
    }

    if (!user && isProtected) {
      // Unauthenticated user trying to access protected content
      if (isAppDomain) {
        // On app domain, redirect to auth domain
        const authUrl = new URL('/sign-in', `https://${CROSS_DOMAIN_CONFIG.authDomain}`)
        authUrl.searchParams.set('redirectTo', encodeURIComponent(request.url))
        
        const redirectResponse = NextResponse.redirect(authUrl)
        Object.entries(securityHeaders).forEach(([key, value]) => {
          redirectResponse.headers.set(key, value)
        })
        return redirectResponse
      } else {
        // On auth domain or other domains
        const signInUrl = new URL('/sign-in', request.url)
        signInUrl.searchParams.set('redirectTo', pathname)
        
        const redirectResponse = NextResponse.redirect(signInUrl)
        Object.entries(securityHeaders).forEach(([key, value]) => {
          redirectResponse.headers.set(key, value)
        })
        return redirectResponse
      }
    }

    // Rate limiting for authentication routes
    if (isAuth || pathname.startsWith('/api/auth/')) {
      const clientIP = getClientIP(request)
      const isRateLimited = await CrossDomainSecurity.checkRateLimit(clientIP, pathname)
      
      if (isRateLimited) {
        return NextResponse.json(
          { 
            error: 'Too Many Requests', 
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: 60
          }, 
          { 
            status: 429,
            headers: {
              'Retry-After': '60',
              'X-RateLimit-Limit': '5',
              'X-RateLimit-Remaining': '0',
              ...securityHeaders
            }
          }
        )
      }
    }

    // Origin validation for sensitive operations
    const origin = request.headers.get('origin')
    if (origin && !CrossDomainSecurity.validateOrigin(origin)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Invalid origin' },
        { 
          status: 403,
          headers: securityHeaders
        }
      )
    }

    return response
    
  } catch (error) {
    // PRODUCTION: Enhanced error handling with monitoring
    console.error('PROD MIDDLEWARE ERROR:', {
      error: error.message,
      pathname,
      hostname,
      timestamp: new Date().toISOString()
    })
    
    // Fallback response with security headers
    const fallbackResponse = NextResponse.next()
    Object.entries(securityHeaders).forEach(([key, value]) => {
      fallbackResponse.headers.set(key, value)
    })
    
    return fallbackResponse
  }
}

// Helper function to extract client IP
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  return 'unknown'
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and API routes
     * This is the most compatible matcher pattern for Edge Runtime
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
