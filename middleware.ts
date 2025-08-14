import { NextRequest, NextResponse } from 'next/server'

/**
 * Simplified Production Middleware for auth.aldari.app
 * Minimal overhead for production deployment
 */
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

  // Create response with basic security headers
  const response = NextResponse.next()
  
  // Essential security headers
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  }

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and API routes
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}