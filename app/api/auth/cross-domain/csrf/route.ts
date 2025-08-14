/**
 * ALDARI Cross-Domain CSRF Token API
 * Provides CSRF tokens for secure cross-domain authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { CrossDomainSecurity } from '@/lib/auth/cross-domain-sso';

/**
 * Generate CSRF token for cross-domain authentication
 * GET /api/auth/cross-domain/csrf
 */
export async function GET(request: NextRequest) {
  try {
    // Origin validation
    const origin = request.headers.get('origin');
    if (!origin || !CrossDomainSecurity.validateOrigin(origin)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Invalid origin' },
        { status: 403 }
      );
    }

    // Generate CSRF token
    const csrfToken = CrossDomainSecurity.generateCSRFToken();

    // Create response with CSRF token cookie
    const response = NextResponse.json(
      { 
        success: true,
        csrfToken,
        expiresIn: 15 * 60, // 15 minutes
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );

    // Set CSRF token cookie
    response.cookies.set('csrf-token', csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60, // 15 minutes
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('[Cross-Domain CSRF] Generation error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}