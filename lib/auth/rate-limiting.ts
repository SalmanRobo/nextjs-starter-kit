/**
 * Rate Limiting Utilities
 * Implements rate limiting for authentication endpoints
 */

import { NextRequest } from 'next/server';
import { AUTH_CONFIG } from './config';
import { RateLimitInfo } from './types';

// In-memory store for rate limiting (use Redis in production)
class RateLimitStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (now > value.resetTime) {
        this.store.delete(key);
      }
    }
  }

  get(key: string): { count: number; resetTime: number } | undefined {
    const entry = this.store.get(key);
    if (entry && Date.now() > entry.resetTime) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key: string, count: number, windowMs: number) {
    this.store.set(key, {
      count,
      resetTime: Date.now() + windowMs,
    });
  }

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const existing = this.get(key);
    if (existing) {
      existing.count++;
      this.store.set(key, existing);
      return existing;
    } else {
      const entry = { count: 1, resetTime: Date.now() + windowMs };
      this.store.set(key, entry);
      return entry;
    }
  }

  delete(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.clear();
  }
}

// Global rate limit store
const rateLimitStore = new RateLimitStore();

// Rate limit types
export type RateLimitType = 'signIn' | 'signUp' | 'passwordReset' | 'emailVerification';

// Get client identifier from request
export const getClientIdentifier = (request: NextRequest): string => {
  // Try to get IP address from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const clientIp = forwarded?.split(',')[0].trim() || realIp || 'unknown';
  
  // In development, use a consistent identifier
  if (process.env.NODE_ENV === 'development') {
    return 'dev-client';
  }
  
  return clientIp;
};

// Get user-specific identifier
export const getUserIdentifier = (userId?: string, email?: string): string => {
  return userId || email || 'anonymous';
};

// Create rate limit key
export const createRateLimitKey = (
  type: RateLimitType,
  identifier: string,
  context?: string
): string => {
  return `rate_limit:${type}:${identifier}${context ? `:${context}` : ''}`;
};

// Check rate limit
export const checkRateLimit = (
  type: RateLimitType,
  identifier: string,
  context?: string
): RateLimitInfo => {
  const key = createRateLimitKey(type, identifier, context);
  const config = AUTH_CONFIG.rateLimiting[type];
  
  const entry = rateLimitStore.get(key);
  
  if (!entry) {
    return {
      attempts: 0,
      maxAttempts: config.requests,
      resetTime: new Date(Date.now() + config.window),
      isBlocked: false,
      remainingTime: 0,
    };
  }

  const isBlocked = entry.count >= config.requests;
  const remainingTime = Math.max(0, entry.resetTime - Date.now());

  return {
    attempts: entry.count,
    maxAttempts: config.requests,
    resetTime: new Date(entry.resetTime),
    isBlocked,
    remainingTime,
  };
};

// Increment rate limit
export const incrementRateLimit = (
  type: RateLimitType,
  identifier: string,
  context?: string
): RateLimitInfo => {
  const key = createRateLimitKey(type, identifier, context);
  const config = AUTH_CONFIG.rateLimiting[type];
  
  const entry = rateLimitStore.increment(key, config.window);
  const isBlocked = entry.count > config.requests;
  const remainingTime = Math.max(0, entry.resetTime - Date.now());

  return {
    attempts: entry.count,
    maxAttempts: config.requests,
    resetTime: new Date(entry.resetTime),
    isBlocked,
    remainingTime,
  };
};

// Reset rate limit
export const resetRateLimit = (
  type: RateLimitType,
  identifier: string,
  context?: string
): void => {
  const key = createRateLimitKey(type, identifier, context);
  rateLimitStore.delete(key);
};

// Rate limit middleware
export const rateLimitMiddleware = (
  type: RateLimitType,
  getIdentifier: (request: NextRequest) => string = getClientIdentifier
) => {
  return (request: NextRequest) => {
    const identifier = getIdentifier(request);
    const rateLimitInfo = checkRateLimit(type, identifier);
    
    if (rateLimitInfo.isBlocked) {
      return {
        isBlocked: true,
        rateLimitInfo,
        error: {
          code: 'RATE_LIMITED',
          message: `Too many ${type} attempts. Please try again in ${Math.ceil(rateLimitInfo.remainingTime / 1000 / 60)} minutes.`,
          details: rateLimitInfo,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Increment for this request
    const updatedInfo = incrementRateLimit(type, identifier);

    return {
      isBlocked: false,
      rateLimitInfo: updatedInfo,
      error: null,
    };
  };
};

// Express-style middleware for API routes
export const createRateLimitHandler = (type: RateLimitType) => {
  return async (request: NextRequest) => {
    const identifier = getClientIdentifier(request);
    const middleware = rateLimitMiddleware(type);
    const result = middleware(request);
    
    if (result.isBlocked) {
      return new Response(
        JSON.stringify({
          error: result.error,
          rateLimitInfo: result.rateLimitInfo,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(result.rateLimitInfo.remainingTime / 1000).toString(),
            'X-RateLimit-Limit': result.rateLimitInfo.maxAttempts.toString(),
            'X-RateLimit-Remaining': Math.max(0, result.rateLimitInfo.maxAttempts - result.rateLimitInfo.attempts).toString(),
            'X-RateLimit-Reset': Math.ceil(result.rateLimitInfo.resetTime.getTime() / 1000).toString(),
          },
        }
      );
    }

    // Add rate limit headers to response
    return {
      headers: {
        'X-RateLimit-Limit': result.rateLimitInfo.maxAttempts.toString(),
        'X-RateLimit-Remaining': Math.max(0, result.rateLimitInfo.maxAttempts - result.rateLimitInfo.attempts).toString(),
        'X-RateLimit-Reset': Math.ceil(result.rateLimitInfo.resetTime.getTime() / 1000).toString(),
      },
    };
  };
};

// Progressive rate limiting (increases penalties for repeat offenders)
export const progressiveRateLimit = (
  type: RateLimitType,
  identifier: string,
  context?: string
): RateLimitInfo => {
  const baseKey = createRateLimitKey(type, identifier, context);
  const violationKey = `violations:${baseKey}`;
  
  // Check for past violations
  const violations = rateLimitStore.get(violationKey);
  const violationCount = violations?.count || 0;
  
  // Increase penalty based on violations
  const config = AUTH_CONFIG.rateLimiting[type];
  const penaltyMultiplier = Math.min(5, 1 + violationCount * 0.5);
  const adjustedWindow = config.window * penaltyMultiplier;
  const adjustedRequests = Math.max(1, Math.floor(config.requests / penaltyMultiplier));
  
  // Check rate limit with adjusted values
  const entry = rateLimitStore.get(baseKey);
  
  if (!entry) {
    return {
      attempts: 0,
      maxAttempts: adjustedRequests,
      resetTime: new Date(Date.now() + adjustedWindow),
      isBlocked: false,
      remainingTime: 0,
    };
  }

  const isBlocked = entry.count >= adjustedRequests;
  const remainingTime = Math.max(0, entry.resetTime - Date.now());

  // If blocked, record a violation
  if (isBlocked && violationCount === 0) {
    rateLimitStore.set(violationKey, 1, 24 * 60 * 60 * 1000); // 24 hours
  }

  return {
    attempts: entry.count,
    maxAttempts: adjustedRequests,
    resetTime: new Date(entry.resetTime),
    isBlocked,
    remainingTime,
  };
};

// Trusted client bypass (for testing or specific clients)
const trustedClients = new Set([
  '127.0.0.1',
  '::1',
  'localhost',
]);

export const isTrustedClient = (identifier: string): boolean => {
  return trustedClients.has(identifier) || process.env.NODE_ENV === 'development';
};

// Rate limit with trusted client bypass
export const checkRateLimitWithBypass = (
  type: RateLimitType,
  identifier: string,
  context?: string
): RateLimitInfo => {
  if (isTrustedClient(identifier)) {
    const config = AUTH_CONFIG.rateLimiting[type];
    return {
      attempts: 0,
      maxAttempts: config.requests,
      resetTime: new Date(Date.now() + config.window),
      isBlocked: false,
      remainingTime: 0,
    };
  }

  return checkRateLimit(type, identifier, context);
};

// Format time remaining for user display
export const formatTimeRemaining = (milliseconds: number): string => {
  const seconds = Math.ceil(milliseconds / 1000);
  
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours !== 1 ? 's' : ''}`;
};

// Get rate limit status for display
export const getRateLimitStatus = (
  type: RateLimitType,
  identifier: string,
  context?: string
): {
  canProceed: boolean;
  attemptsRemaining: number;
  timeUntilReset: string;
  message?: string;
} => {
  const info = checkRateLimit(type, identifier, context);
  const attemptsRemaining = Math.max(0, info.maxAttempts - info.attempts);
  const timeUntilReset = formatTimeRemaining(info.remainingTime);
  
  return {
    canProceed: !info.isBlocked,
    attemptsRemaining,
    timeUntilReset,
    message: info.isBlocked 
      ? `Too many attempts. Please try again in ${timeUntilReset}.`
      : undefined,
  };
};

// Cleanup function for graceful shutdown
export const cleanupRateLimit = (): void => {
  rateLimitStore.destroy();
};

// Export the store for testing
export { rateLimitStore };

export default {
  checkRateLimit,
  incrementRateLimit,
  resetRateLimit,
  rateLimitMiddleware,
  createRateLimitHandler,
  progressiveRateLimit,
  getRateLimitStatus,
  formatTimeRemaining,
  cleanupRateLimit,
};