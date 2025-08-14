import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Edge Runtime compatible middleware - minimal and fast
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip static files and internal paths
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/_vercel') ||
    pathname.includes('.') // Skip all files with extensions
  ) {
    return NextResponse.next()
  }

  // Create minimal response first
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  try {
    // Only proceed if we have required environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return response
    }

    // Create Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Get user session
    const { data: { user } } = await supabase.auth.getUser()

    // Simple route protection
    const isProtectedRoute = pathname.startsWith('/dashboard') || 
                           pathname.startsWith('/admin') || 
                           pathname.startsWith('/settings')
    const isAuthRoute = pathname.startsWith('/sign-in') || 
                       pathname.startsWith('/sign-up')

    if (user) {
      // Redirect authenticated users away from auth pages
      if (isAuthRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    } else {
      // Redirect unauthenticated users from protected routes
      if (isProtectedRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/sign-in'
        url.searchParams.set('redirectTo', pathname)
        return NextResponse.redirect(url)
      }
    }

    return response
  } catch (error) {
    // Fail gracefully - allow request to continue
    console.error('Middleware error:', error)
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
