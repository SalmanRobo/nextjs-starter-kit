import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SECURITY_HEADERS } from '@/lib/auth/config';

// Detect if we're in a build environment
function isBuildTime() {
  return (
    process.env.NODE_ENV === 'production' && 
    !process.env.VERCEL_ENV &&
    !process.env.NEXT_RUNTIME
  );
}

// Check if environment variables are available
function hasRequiredEnvVars() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function updateSession(request: NextRequest) {
  // During build time, skip auth middleware completely
  if (isBuildTime() || !hasRequiredEnvVars()) {
    return NextResponse.next({
      request,
    });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Optimized route patterns with Sets for O(1) lookup
  const protectedRoutesSet = new Set(['/dashboard', '/admin', '/profile', '/settings', '/upload']);
  const authRoutesSet = new Set(['/sign-in', '/sign-up', '/forgot-password', '/reset-password']);
  const emailVerificationRoutesSet = new Set(['/auth/verify-email']);
  const publicRoutesSet = new Set(['/', '/pricing', '/terms-of-service', '/privacy-policy']);
  
  const pathname = request.nextUrl.pathname;
  
  // More efficient route checking
  const isProtectedRoute = Array.from(protectedRoutesSet).some(route => pathname.startsWith(route));
  const isAuthRoute = Array.from(authRoutesSet).some(route => pathname.startsWith(route));
  const isEmailVerificationRoute = Array.from(emailVerificationRoutesSet).some(route => pathname.startsWith(route));
  const isPublicRoute = publicRoutesSet.has(pathname) || Array.from(publicRoutesSet).some(route => 
    route !== '/' && pathname.startsWith(route)
  );

  // Conditionally apply security headers for better performance
  if (isProtectedRoute || isAuthRoute) {
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
      supabaseResponse.headers.set(key, value);
    });
  }

  // Handle authentication logic
  if (user) {
    // User is authenticated
    const isEmailVerified = Boolean(user.email_confirmed_at);
    
    // Redirect authenticated users away from auth pages
    if (isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      const response = NextResponse.redirect(url);
      // Copy security headers to redirect response
      Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    // For protected routes, check email verification
    if (isProtectedRoute && !isEmailVerified && !isEmailVerificationRoute) {
      // Allow access to settings page for email verification
      if (!request.nextUrl.pathname.startsWith('/settings')) {
        const url = request.nextUrl.clone();
        url.pathname = '/auth/verify-email';
        const response = NextResponse.redirect(url);
        Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return response;
      }
    }

    // If user is verified and on email verification page, redirect to dashboard
    if (isEmailVerified && isEmailVerificationRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      const response = NextResponse.redirect(url);
      Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }
  } else {
    // User is not authenticated
    
    // Redirect unauthenticated users from protected routes to sign-in
    if (isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/sign-in';
      url.searchParams.set('redirectTo', request.nextUrl.pathname);
      const response = NextResponse.redirect(url);
      Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    // Redirect unauthenticated users from email verification to sign-in
    if (isEmailVerificationRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/sign-in';
      const response = NextResponse.redirect(url);
      Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }
  }

  // Enhanced rate limiting with better error responses
  if (isAuthRoute || pathname.startsWith('/api/auth/')) {
    const clientIP = getClientIP(request);
    const isRateLimited = await checkRateLimit(clientIP, pathname);
    
    if (isRateLimited) {
      const response = NextResponse.json(
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
            'X-RateLimit-Reset': new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          }
        }
      );
      
      // Apply security headers only to rate limited responses
      Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  return supabaseResponse;
}

// Helper function to get client IP
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

// Production-ready rate limiting with memory management
interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAccessed: number;
}

class MemoryEfficientRateLimit {
  private map = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly MAX_ENTRIES = 10000; // Prevent memory explosion
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly ENTRY_TTL = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.startCleanup();
  }

  private startCleanup() {
    if (this.cleanupInterval) return;
    
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);

    // Ensure cleanup on process exit
    if (typeof process !== 'undefined') {
      process.on('beforeExit', () => {
        if (this.cleanupInterval) {
          clearInterval(this.cleanupInterval);
        }
      });
    }
  }

  private cleanup() {
    const now = Date.now();
    let entriesRemoved = 0;

    // Remove expired entries
    for (const [key, entry] of this.map.entries()) {
      if (now > entry.resetTime || (now - entry.lastAccessed) > this.ENTRY_TTL) {
        this.map.delete(key);
        entriesRemoved++;
      }
    }

    // If still over limit, remove oldest entries
    if (this.map.size > this.MAX_ENTRIES) {
      const sortedEntries = Array.from(this.map.entries())
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      
      const toRemove = this.map.size - this.MAX_ENTRIES;
      for (let i = 0; i < toRemove; i++) {
        this.map.delete(sortedEntries[i][0]);
        entriesRemoved++;
      }
    }

    // Log cleanup in development
    if (process.env.NODE_ENV === 'development' && entriesRemoved > 0) {
      console.log(`[Rate Limit] Cleaned up ${entriesRemoved} expired entries`);
    }
  }

  check(clientIP: string, path: string): boolean {
    // Prevent DOS attacks with invalid IPs
    if (!clientIP || clientIP.length > 45) return true;
    
    const key = `${clientIP}:${path}`;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = this.getMaxRequests(path);
    
    const current = this.map.get(key);
    
    if (!current || now > current.resetTime) {
      this.map.set(key, { 
        count: 1, 
        resetTime: now + windowMs,
        lastAccessed: now
      });
      return false;
    }
    
    // Update last accessed time
    current.lastAccessed = now;
    
    if (current.count >= maxRequests) {
      return true;
    }
    
    current.count++;
    return false;
  }

  private getMaxRequests(path: string): number {
    if (path.includes('sign-in') || path.includes('password')) return 5;
    if (path.includes('sign-up')) return 3;
    if (path.includes('verify')) return 10;
    return 20; // Default for other endpoints
  }

  getStats() {
    return {
      entries: this.map.size,
      maxEntries: this.MAX_ENTRIES,
    };
  }
}

// Singleton rate limiter
const rateLimiter = new MemoryEfficientRateLimit();

async function checkRateLimit(clientIP: string, path: string): Promise<boolean> {
  return rateLimiter.check(clientIP, path);
}