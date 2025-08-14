/**
 * ALDARI Cross-Domain SSO Architecture
 * Enterprise-grade authentication flow between auth.aldari.app and home.aldari.app
 */

import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { SUPABASE_CONFIG, SITE_CONFIG } from './config';
import { logAuthEvent, logAuthError } from './cross-domain-monitoring';

export interface CrossDomainAuthConfig {
  authDomain: string;
  appDomain: string;
  cookieDomain: string;
  tokenTTL: number;
  refreshTokenTTL: number;
}

export interface AuthState {
  user: any;
  session: any;
  isAuthenticated: boolean;
  isLoading: boolean;
  error?: string;
}

export interface CrossDomainToken {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user_id: string;
  domain: string;
  timestamp: number;
}

export class CrossDomainSSO {
  private config: CrossDomainAuthConfig;
  private tokenStorage: Map<string, CrossDomainToken> = new Map();
  
  constructor(config: CrossDomainAuthConfig) {
    this.config = config;
    this.startTokenCleanup();
  }

  /**
   * Generate secure cross-domain authentication token
   */
  async generateCrossDomainToken(session: any): Promise<string> {
    try {
      const token: CrossDomainToken = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        user_id: session.user.id,
        domain: this.config.authDomain,
        timestamp: Date.now()
      };

      const tokenId = this.generateSecureTokenId();
      
      // Store token with TTL
      this.tokenStorage.set(tokenId, token);
      
      // Set expiration cleanup
      setTimeout(() => {
        this.tokenStorage.delete(tokenId);
      }, this.config.tokenTTL);

      // Log successful token generation
      logAuthEvent({
        type: 'token_generation',
        userId: session.user.id,
        sessionId: session.access_token?.substring(0, 8),
        domain: this.config.authDomain,
        metadata: {
          tokenId: tokenId.substring(0, 8), // Log partial token for tracking
          expiresAt: token.expires_at,
        }
      });

      return tokenId;
    } catch (error: any) {
      logAuthError(error, {
        type: 'error',
        userId: session?.user?.id,
        domain: this.config.authDomain,
        metadata: { operation: 'generateCrossDomainToken' }
      });
      throw error;
    }
  }

  /**
   * Validate and retrieve cross-domain token
   */
  async validateCrossDomainToken(tokenId: string): Promise<CrossDomainToken | null> {
    try {
      const token = this.tokenStorage.get(tokenId);
      
      if (!token) {
        logAuthEvent({
          type: 'error',
          domain: this.config.authDomain,
          metadata: { 
            operation: 'validateCrossDomainToken',
            error: 'Token not found',
            tokenId: tokenId.substring(0, 8)
          }
        });
        return null;
      }

      // Check expiration
      if (Date.now() - token.timestamp > this.config.tokenTTL) {
        this.tokenStorage.delete(tokenId);
        logAuthEvent({
          type: 'error',
          userId: token.user_id,
          domain: this.config.authDomain,
          metadata: { 
            operation: 'validateCrossDomainToken',
            error: 'Token expired (TTL)',
            tokenId: tokenId.substring(0, 8)
          }
        });
        return null;
      }

      // Check session expiration
      if (Date.now() > token.expires_at * 1000) {
        this.tokenStorage.delete(tokenId);
        logAuthEvent({
          type: 'error',
          userId: token.user_id,
          domain: this.config.authDomain,
          metadata: { 
            operation: 'validateCrossDomainToken',
            error: 'Session expired',
            tokenId: tokenId.substring(0, 8)
          }
        });
        return null;
      }

      // Log successful token validation
      logAuthEvent({
        type: 'token_validation',
        userId: token.user_id,
        domain: this.config.authDomain,
        metadata: {
          tokenId: tokenId.substring(0, 8),
          validatedAt: Date.now()
        }
      });

      return token;
    } catch (error: any) {
      logAuthError(error, {
        type: 'error',
        domain: this.config.authDomain,
        metadata: { 
          operation: 'validateCrossDomainToken',
          tokenId: tokenId?.substring(0, 8)
        }
      });
      return null;
    }
  }

  /**
   * Create authenticated redirect URL with secure token
   */
  createAuthenticatedRedirectUrl(
    targetDomain: string,
    redirectPath: string = '/',
    token: string
  ): string {
    const url = new URL(redirectPath, `https://${targetDomain}`);
    url.searchParams.set('auth_token', token);
    url.searchParams.set('timestamp', Date.now().toString());
    return url.toString();
  }

  /**
   * Handle cross-domain logout
   */
  async handleCrossDomainLogout(userId: string): Promise<void> {
    // Remove all tokens for this user
    for (const [tokenId, token] of this.tokenStorage.entries()) {
      if (token.user_id === userId) {
        this.tokenStorage.delete(tokenId);
      }
    }
  }

  /**
   * Generate secure token ID
   */
  private generateSecureTokenId(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Periodic cleanup of expired tokens
   */
  private startTokenCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [tokenId, token] of this.tokenStorage.entries()) {
        if (now - token.timestamp > this.config.tokenTTL || 
            now > token.expires_at * 1000) {
          this.tokenStorage.delete(tokenId);
        }
      }
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  /**
   * Get storage statistics
   */
  getStats() {
    return {
      activeTokens: this.tokenStorage.size,
      config: this.config
    };
  }
}

// Production configuration
export const CROSS_DOMAIN_CONFIG: CrossDomainAuthConfig = {
  authDomain: 'auth.aldari.app',
  appDomain: 'home.aldari.app',
  cookieDomain: '.aldari.app',
  tokenTTL: 5 * 60 * 1000, // 5 minutes for cross-domain token
  refreshTokenTTL: 24 * 60 * 60 * 1000, // 24 hours for session
};

// Singleton instance
export const crossDomainSSO = new CrossDomainSSO(CROSS_DOMAIN_CONFIG);

/**
 * Enhanced Supabase client factory for cross-domain auth
 */
export function createCrossDomainSupabaseClient(
  domain: string,
  token?: CrossDomainToken
) {
  if (typeof window !== 'undefined') {
    // Browser client
    const client = createBrowserClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.anonKey,
      {
        cookies: {
          get: (name) => {
            const cookies = document.cookie.split(';');
            const cookie = cookies.find(c => c.trim().startsWith(`${name}=`));
            return cookie?.split('=')[1];
          },
          set: (name, value, options) => {
            const cookieOptions = {
              ...options,
              domain: CROSS_DOMAIN_CONFIG.cookieDomain,
              secure: true,
              sameSite: 'lax' as const,
            };
            
            const cookieString = `${name}=${value}; ${Object.entries(cookieOptions)
              .map(([k, v]) => `${k}=${v}`)
              .join('; ')}`;
            
            document.cookie = cookieString;
          },
          remove: (name, options) => {
            const cookieOptions = {
              ...options,
              domain: CROSS_DOMAIN_CONFIG.cookieDomain,
              expires: new Date(0),
            };
            
            const cookieString = `${name}=; ${Object.entries(cookieOptions)
              .map(([k, v]) => `${k}=${v}`)
              .join('; ')}`;
            
            document.cookie = cookieString;
          },
        },
      }
    );

    // Set session from cross-domain token if available
    if (token) {
      client.auth.setSession({
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: token.expires_at,
        token_type: 'bearer',
        user: null, // Will be populated by Supabase
      });
    }

    return client;
  }

  // Server client (handled in middleware/API routes)
  return null;
}

/**
 * Cross-domain authentication event handlers
 */
export class CrossDomainAuthEvents {
  private listeners: Map<string, Function[]> = new Map();

  /**
   * Subscribe to authentication events
   */
  on(event: 'signin' | 'signout' | 'token_refresh' | 'error', callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  /**
   * Emit authentication event
   */
  emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} event handler:`, error);
      }
    });
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }
}

// Global event emitter instance
export const crossDomainAuthEvents = new CrossDomainAuthEvents();

/**
 * Security utilities for cross-domain auth
 */
export class CrossDomainSecurity {
  /**
   * Validate origin for cross-domain requests
   */
  static validateOrigin(origin: string): boolean {
    const allowedOrigins = [
      'https://auth.aldari.app',
      'https://home.aldari.app',
      ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000', 'http://localhost:3001'] : [])
    ];
    
    return allowedOrigins.includes(origin);
  }

  /**
   * Generate CSRF token
   */
  static generateCSRFToken(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  }

  /**
   * Validate CSRF token
   */
  static validateCSRFToken(token: string, stored: string): boolean {
    return token === stored && token.length > 0;
  }

  /**
   * Rate limiting for cross-domain auth
   */
  static async checkRateLimit(clientIP: string, action: string): Promise<boolean> {
    // Implementation would depend on your rate limiting strategy
    // This is a placeholder for the actual rate limiting logic
    return false; // Not rate limited
  }
}

/**
 * Cross-domain cookie management
 */
export class CrossDomainCookies {
  /**
   * Set secure cross-domain cookie
   */
  static setSecureCookie(
    name: string,
    value: string,
    options: {
      maxAge?: number;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: 'strict' | 'lax' | 'none';
    } = {}
  ) {
    const cookieOptions = {
      domain: CROSS_DOMAIN_CONFIG.cookieDomain,
      maxAge: options.maxAge || 24 * 60 * 60, // 24 hours
      httpOnly: options.httpOnly ?? true,
      secure: options.secure ?? true,
      sameSite: options.sameSite || 'lax',
      path: '/',
    };

    if (typeof document !== 'undefined') {
      const cookieString = `${name}=${value}; ${Object.entries(cookieOptions)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')}`;
      
      document.cookie = cookieString;
    }
  }

  /**
   * Get cookie value
   */
  static getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    
    const cookies = document.cookie.split(';');
    const cookie = cookies.find(c => c.trim().startsWith(`${name}=`));
    return cookie ? cookie.split('=')[1] : null;
  }

  /**
   * Remove cookie
   */
  static removeCookie(name: string) {
    this.setSecureCookie(name, '', { maxAge: 0 });
  }
}