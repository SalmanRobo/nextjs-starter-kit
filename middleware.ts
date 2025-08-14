import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// PRODUCTION-CRITICAL: Ultra-minimal Edge Runtime middleware
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip static files and API routes immediately
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_vercel') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Create response with essential security headers
  const response = NextResponse.next()
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')

  try {
    // CRITICAL: Check environment variables exist
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('PROD ERROR: Missing Supabase environment variables')
      return response // Allow through without auth check
    }

    // PRODUCTION-OPTIMIZED: Minimal Supabase client
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    // CRITICAL: Fast auth check with timeout
    const authPromise = supabase.auth.getUser()
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Auth timeout')), 3000)
    )

    const { data: { user } } = await Promise.race([authPromise, timeoutPromise])

    // SIMPLIFIED: Route protection logic
    const protectedRoutes = ['/dashboard', '/admin', '/settings']
    const authRoutes = ['/sign-in', '/sign-up']
    
    const isProtected = protectedRoutes.some(route => pathname.startsWith(route))
    const isAuth = authRoutes.some(route => pathname.startsWith(route))

    if (user && isAuth) {
      // Redirect authenticated users away from auth pages
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    if (!user && isProtected) {
      // Redirect unauthenticated users to sign in
      const signInUrl = new URL('/sign-in', request.url)
      signInUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(signInUrl)
    }

    return response
    
  } catch (error) {
    // PRODUCTION: Silent fallback - don't break the app
    console.error('PROD MIDDLEWARE ERROR:', error)
    return response
  }
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
