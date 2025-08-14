/**
 * Redis Health Check API Endpoint
 * Specific health check for Redis rate limiting service
 */

import { NextRequest, NextResponse } from 'next/server';
import { withProductionErrorHandling } from '@/lib/auth/error-handler-production';
import { healthCheck, getRateLimitConfig } from '@/lib/auth/rate-limiting-redis';

async function redisHealthHandler(request: NextRequest) {
  try {
    const startTime = Date.now();
    const healthResult = await healthCheck();
    const responseTime = Date.now() - startTime;
    const config = getRateLimitConfig();
    
    const status = healthResult.redis ? 'healthy' : (healthResult.fallback ? 'degraded' : 'unhealthy');
    
    return NextResponse.json({
      status,
      redis: healthResult.redis,
      fallback: healthResult.fallback,
      error: healthResult.error,
      responseTime: `${responseTime}ms`,
      configuration: {
        useRedis: config.useRedis,
        redisUrl: config.redisUrl ? '[CONFIGURED]' : null,
        namespace: config.namespace,
        fallbackToMemory: config.fallbackToMemory,
      },
      timestamp: new Date().toISOString(),
    }, {
      status: status === 'unhealthy' ? 503 : 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Redis health check failed:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      redis: false,
      fallback: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }
}

// Export with production error handling
export const GET = withProductionErrorHandling(redisHealthHandler);