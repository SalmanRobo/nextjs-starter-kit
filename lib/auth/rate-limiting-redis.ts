/**
 * Production-Grade Redis Rate Limiting for Authentication
 * Replaces in-memory rate limiting for scalable production deployment
 */

import { NextRequest } from 'next/server';
import { AUTH_CONFIG } from './config';
import { RateLimitInfo } from './types';

// Redis client interface (works with various Redis providers)
interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ex?: number): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<number>;
  multi(): RedisMulti;
}

interface RedisMulti {
  incr(key: string): RedisMulti;
  expire(key: string, seconds: number): RedisMulti;
  exec(): Promise<Array<[Error | null, any]>>;
}

// Redis client setup - works with Upstash, Redis Cloud, or self-hosted
let redisClient: RedisClient | null = null;

// Initialize Redis client (lazy loading) - server side only
const getRedisClient = async (): Promise<RedisClient> => {
  if (redisClient) return redisClient;
  
  // Only run on server side
  if (typeof window !== 'undefined') {
    throw new Error('Redis client cannot be used on client side');
  }
  
  // Check for Redis configuration
  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!redisUrl) {
    throw new Error('Redis configuration missing. Set REDIS_URL or UPSTASH_REDIS_REST_URL');
  }

  // Upstash Redis REST client (dynamic import)
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const { Redis } = await import('@upstash/redis');
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
    });
  } 
  // Standard Redis client (ioredis) - dynamic import
  else {
    const Redis = (await import('ioredis')).default;
    redisClient = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  return redisClient!;
};

// Fallback to in-memory for development
const useRedis = process.env.NODE_ENV === 'production' && (
  process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL
);

// In-memory fallback store
const memoryStore = new Map<string, { count: number; resetTime: number }>();

export type RateLimitType = 'signIn' | 'signUp' | 'passwordReset' | 'emailVerification';

// Get client identifier with enhanced detection
export const getClientIdentifier = (request: NextRequest): string => {
  // Production: Use real IP detection
  if (process.env.NODE_ENV === 'production') {
    // Try multiple headers for IP detection
    const headers = [
      'cf-connecting-ip',      // Cloudflare
      'x-forwarded-for',       // Load balancers
      'x-real-ip',             // Nginx
      'x-client-ip',           // Apache
      'x-forwarded',           // General
      'forwarded-for',         // RFC 7239
      'forwarded',             // RFC 7239
    ];
    
    for (const header of headers) {
      const value = request.headers.get(header);
      if (value) {
        const ip = value.split(',')[0].trim();
        if (ip && ip !== 'unknown') return ip;
      }
    }
    
    // Fallback to connection remote address
    return request.ip || 'unknown';
  }
  
  // Development: Use consistent identifier
  return 'dev-client';
};

// Create rate limit key with namespace
export const createRateLimitKey = (
  type: RateLimitType,
  identifier: string,
  context?: string
): string => {
  const namespace = process.env.REDIS_NAMESPACE || 'auth_rate_limit';
  return `${namespace}:${type}:${identifier}${context ? `:${context}` : ''}`;
};

// Redis-based rate limit check
export const checkRateLimitRedis = async (
  type: RateLimitType,
  identifier: string,
  context?: string
): Promise<RateLimitInfo> => {
  const key = createRateLimitKey(type, identifier, context);
  const config = AUTH_CONFIG.rateLimiting[type];
  const windowSeconds = Math.floor(config.window / 1000);
  
  try {
    const redis = await getRedisClient();
    const current = await redis.get(key);
    const count = current ? parseInt(current, 10) : 0;
    
    const isBlocked = count >= config.requests;
    const ttl = current ? await redis.exists(key) : 0;
    const resetTime = new Date(Date.now() + (ttl > 0 ? ttl * 1000 : config.window));
    
    return {
      attempts: count,
      maxAttempts: config.requests,
      resetTime,
      isBlocked,
      remainingTime: isBlocked ? Math.max(0, resetTime.getTime() - Date.now()) : 0,
    };
  } catch (error) {
    console.error('Redis rate limit check failed:', error);
    // Fallback to memory store
    return checkRateLimitMemory(type, identifier, context);
  }
};

// Redis-based rate limit increment
export const incrementRateLimitRedis = async (
  type: RateLimitType,
  identifier: string,
  context?: string
): Promise<RateLimitInfo> => {
  const key = createRateLimitKey(type, identifier, context);
  const config = AUTH_CONFIG.rateLimiting[type];
  const windowSeconds = Math.floor(config.window / 1000);
  
  try {
    const redis = await getRedisClient();
    const multi = redis.multi();
    const results = await multi
      .incr(key)
      .expire(key, windowSeconds)
      .exec();
    
    const count = results[0][1] as number;
    const isBlocked = count > config.requests;
    const resetTime = new Date(Date.now() + config.window);
    
    return {
      attempts: count,
      maxAttempts: config.requests,
      resetTime,
      isBlocked,
      remainingTime: isBlocked ? config.window : 0,
    };
  } catch (error) {
    console.error('Redis rate limit increment failed:', error);
    // Fallback to memory store
    return incrementRateLimitMemory(type, identifier, context);
  }
};

// Memory fallback functions
const checkRateLimitMemory = (
  type: RateLimitType,
  identifier: string,
  context?: string
): RateLimitInfo => {
  const key = createRateLimitKey(type, identifier, context);
  const config = AUTH_CONFIG.rateLimiting[type];
  const entry = memoryStore.get(key);
  
  if (!entry || Date.now() > entry.resetTime) {
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

const incrementRateLimitMemory = (
  type: RateLimitType,
  identifier: string,
  context?: string
): RateLimitInfo => {
  const key = createRateLimitKey(type, identifier, context);
  const config = AUTH_CONFIG.rateLimiting[type];
  const existing = memoryStore.get(key);
  
  if (existing && Date.now() <= existing.resetTime) {
    existing.count++;
    memoryStore.set(key, existing);
    
    return {
      attempts: existing.count,
      maxAttempts: config.requests,
      resetTime: new Date(existing.resetTime),
      isBlocked: existing.count > config.requests,
      remainingTime: existing.count > config.requests ? existing.resetTime - Date.now() : 0,
    };
  } else {
    const entry = {
      count: 1,
      resetTime: Date.now() + config.window,
    };
    memoryStore.set(key, entry);
    
    return {
      attempts: 1,
      maxAttempts: config.requests,
      resetTime: new Date(entry.resetTime),
      isBlocked: false,
      remainingTime: 0,
    };
  }
};

// Main rate limiting functions (auto-detect Redis or fallback)
export const checkRateLimit = async (
  type: RateLimitType,
  identifier: string,
  context?: string
): Promise<RateLimitInfo> => {
  if (useRedis) {
    return checkRateLimitRedis(type, identifier, context);
  }
  return checkRateLimitMemory(type, identifier, context);
};

export const incrementRateLimit = async (
  type: RateLimitType,
  identifier: string,
  context?: string
): Promise<RateLimitInfo> => {
  if (useRedis) {
    return incrementRateLimitRedis(type, identifier, context);
  }
  return incrementRateLimitMemory(type, identifier, context);
};

// Reset rate limit
export const resetRateLimit = async (
  type: RateLimitType,
  identifier: string,
  context?: string
): Promise<void> => {
  const key = createRateLimitKey(type, identifier, context);
  
  if (useRedis) {
    try {
      const redis = await getRedisClient();
      await redis.del(key);
    } catch (error) {
      console.error('Redis rate limit reset failed:', error);
    }
  }
  
  memoryStore.delete(key);
};

// Progressive rate limiting with Redis
export const progressiveRateLimit = async (
  type: RateLimitType,
  identifier: string,
  context?: string
): Promise<RateLimitInfo> => {
  const baseKey = createRateLimitKey(type, identifier, context);
  const violationKey = `violations:${baseKey}`;
  
  // Get violation count
  let violationCount = 0;
  if (useRedis) {
    try {
      const redis = await getRedisClient();
      const violations = await redis.get(violationKey);
      violationCount = violations ? parseInt(violations, 10) : 0;
    } catch (error) {
      console.error('Redis violation check failed:', error);
    }
  }
  
  // Calculate progressive penalty
  const config = AUTH_CONFIG.rateLimiting[type];
  const penaltyMultiplier = Math.min(5, 1 + violationCount * 0.5);
  const adjustedRequests = Math.max(1, Math.floor(config.requests / penaltyMultiplier));
  
  // Check current rate limit
  const rateLimitInfo = await checkRateLimit(type, identifier, context);
  const isBlocked = rateLimitInfo.attempts >= adjustedRequests;
  
  // Record violation if newly blocked
  if (isBlocked && violationCount === 0 && useRedis) {
    try {
      const redis = await getRedisClient();
      await redis.set(violationKey, '1', 24 * 60 * 60); // 24 hours
    } catch (error) {
      console.error('Redis violation recording failed:', error);
    }
  }
  
  return {
    ...rateLimitInfo,
    maxAttempts: adjustedRequests,
    isBlocked,
    remainingTime: isBlocked ? rateLimitInfo.remainingTime * penaltyMultiplier : 0,
  };
};

// Rate limit middleware for API routes
export const createRateLimitHandler = (type: RateLimitType) => {
  return async (request: NextRequest) => {
    const identifier = getClientIdentifier(request);
    const rateLimitInfo = await checkRateLimit(type, identifier);
    
    if (rateLimitInfo.isBlocked) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'RATE_LIMITED',
            message: `Too many ${type} attempts. Please try again in ${Math.ceil(rateLimitInfo.remainingTime / 1000 / 60)} minutes.`,
            details: rateLimitInfo,
            timestamp: new Date().toISOString(),
          },
          rateLimitInfo,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(rateLimitInfo.remainingTime / 1000).toString(),
            'X-RateLimit-Limit': rateLimitInfo.maxAttempts.toString(),
            'X-RateLimit-Remaining': Math.max(0, rateLimitInfo.maxAttempts - rateLimitInfo.attempts).toString(),
            'X-RateLimit-Reset': Math.ceil(rateLimitInfo.resetTime.getTime() / 1000).toString(),
          },
        }
      );
    }

    // Increment for this request
    const updatedInfo = await incrementRateLimit(type, identifier);

    // Return headers for successful request
    return {
      headers: {
        'X-RateLimit-Limit': updatedInfo.maxAttempts.toString(),
        'X-RateLimit-Remaining': Math.max(0, updatedInfo.maxAttempts - updatedInfo.attempts).toString(),
        'X-RateLimit-Reset': Math.ceil(updatedInfo.resetTime.getTime() / 1000).toString(),
      },
    };
  };
};

// Health check for Redis connection
export const healthCheck = async (): Promise<{
  redis: boolean;
  fallback: boolean;
  error?: string;
}> => {
  if (!useRedis) {
    return { redis: false, fallback: true };
  }
  
  try {
    const redis = await getRedisClient();
    const testKey = 'health_check';
    await redis.set(testKey, '1', 10);
    await redis.del(testKey);
    
    return { redis: true, fallback: false };
  } catch (error) {
    return { 
      redis: false, 
      fallback: true, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

// Export configuration info
export const getRateLimitConfig = () => ({
  useRedis,
  redisUrl: useRedis ? (process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL) : null,
  fallbackToMemory: true,
  namespace: process.env.REDIS_NAMESPACE || 'auth_rate_limit',
});

export default {
  checkRateLimit,
  incrementRateLimit,
  resetRateLimit,
  progressiveRateLimit,
  createRateLimitHandler,
  healthCheck,
  getRateLimitConfig,
};