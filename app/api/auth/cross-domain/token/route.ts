/**
 * ALDARI Cross-Domain Token Exchange API
 * Handles secure token generation and validation for cross-domain SSO
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { crossDomainSSO, CrossDomainSecurity } from '@/lib/auth/cross-domain-sso';
import { z } from 'zod';

// Request validation schemas
const generateTokenSchema = z.object({
  redirectUrl: z.string().url().optional(),
  csrfToken: z.string().min(1),
});

const validateTokenSchema = z.object({
  token: z.string().min(1),
  domain: z.string().min(1),
});

/**
 * Generate cross-domain authentication token
 * POST /api/auth/cross-domain/token
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    const isRateLimited = await CrossDomainSecurity.checkRateLimit(clientIP, 'token-generation');
    
    if (isRateLimited) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: 'Too many token generation attempts. Please try again later.'
        },
        { status: 429 }
      );
    }

    // Origin validation
    const origin = request.headers.get('origin');
    if (!origin || !CrossDomainSecurity.validateOrigin(origin)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Invalid origin' },
        { status: 403 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validatedData = generateTokenSchema.parse(body);

    // CSRF validation
    const storedCsrfToken = request.cookies.get('csrf-token')?.value;
    if (!storedCsrfToken || !CrossDomainSecurity.validateCSRFToken(validatedData.csrfToken, storedCsrfToken)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    // Get current user session
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No valid session found' },
        { status: 401 }
      );
    }

    // Generate cross-domain token
    const crossDomainToken = await crossDomainSSO.generateCrossDomainToken(session);

    // Log token generation for monitoring
    console.log('[Cross-Domain SSO] Token generated', {
      userId: session.user.id,
      domain: origin,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        token: crossDomainToken,
        expiresIn: 5 * 60, // 5 minutes
        redirectUrl: validatedData.redirectUrl,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );

  } catch (error) {
    console.error('[Cross-Domain Token] Generation error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Validate cross-domain authentication token
 * GET /api/auth/cross-domain/token?token=xxx&domain=xxx
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    const isRateLimited = await CrossDomainSecurity.checkRateLimit(clientIP, 'token-validation');
    
    if (isRateLimited) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: 'Too many token validation attempts. Please try again later.'
        },
        { status: 429 }
      );
    }

    // Origin validation
    const origin = request.headers.get('origin');
    if (!origin || !CrossDomainSecurity.validateOrigin(origin)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Invalid origin' },
        { status: 403 }
      );
    }

    // Extract and validate parameters
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const domain = searchParams.get('domain');

    if (!token || !domain) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const validatedData = validateTokenSchema.parse({ token, domain });

    // Validate cross-domain token
    const crossDomainSession = await crossDomainSSO.validateCrossDomainToken(validatedData.token);

    if (!crossDomainSession) {
      return NextResponse.json(
        { 
          error: 'Invalid token',
          message: 'Token is invalid, expired, or has been used'
        },
        { status: 401 }
      );
    }

    // Verify domain matches
    if (crossDomainSession.domain !== validatedData.domain) {
      return NextResponse.json(
        { error: 'Domain mismatch' },
        { status: 403 }
      );
    }

    // Log token validation for monitoring
    console.log('[Cross-Domain SSO] Token validated', {
      userId: crossDomainSession.user_id,
      domain: validatedData.domain,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        valid: true,
        session: {
          access_token: crossDomainSession.access_token,
          refresh_token: crossDomainSession.refresh_token,
          expires_at: crossDomainSession.expires_at,
          user_id: crossDomainSession.user_id,
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );

  } catch (error) {
    console.error('[Cross-Domain Token] Validation error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Revoke cross-domain authentication token
 * DELETE /api/auth/cross-domain/token
 */
export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    const isRateLimited = await CrossDomainSecurity.checkRateLimit(clientIP, 'token-revocation');
    
    if (isRateLimited) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: 'Too many token revocation attempts. Please try again later.'
        },
        { status: 429 }
      );
    }

    // Origin validation
    const origin = request.headers.get('origin');
    if (!origin || !CrossDomainSecurity.validateOrigin(origin)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Invalid origin' },
        { status: 403 }
      );
    }

    // Get current user session
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No valid session found' },
        { status: 401 }
      );
    }

    // Handle cross-domain logout
    await crossDomainSSO.handleCrossDomainLogout(session.user.id);

    // Log logout for monitoring
    console.log('[Cross-Domain SSO] User logged out', {
      userId: session.user.id,
      domain: origin,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      { success: true, message: 'All cross-domain tokens revoked' },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );

  } catch (error) {
    console.error('[Cross-Domain Token] Revocation error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to extract client IP
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    const firstIP = forwarded.split(',')[0];
    return firstIP ? firstIP.trim() : 'unknown';
  }
  
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}