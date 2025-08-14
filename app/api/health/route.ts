/**
 * Health Check API Endpoint
 * Provides comprehensive system health information for monitoring
 */

import { NextRequest } from 'next/server';
import { withProductionErrorHandling, createHealthCheckResponse } from '@/lib/auth/error-handler-production';
import { healthChecker } from '@/lib/auth/monitoring';

async function healthCheckHandler(request: NextRequest) {
  try {
    // Perform comprehensive health check
    const healthStatus = await healthChecker.performHealthCheck();
    
    // Extract individual service statuses for response
    const checks: Record<string, boolean> = {};
    healthStatus.services.forEach(service => {
      checks[service.service] = service.status === 'healthy';
    });
    
    // Determine overall health
    const overall = healthStatus.overall === 'healthy';
    
    // Add basic system information
    const systemInfo = {
      timestamp: healthStatus.timestamp,
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || 'unknown',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
    
    return createHealthCheckResponse(
      {
        ...checks,
        system: true, // System is always healthy if we can respond
      },
      overall
    );
  } catch (error) {
    console.error('Health check failed:', error);
    
    return createHealthCheckResponse(
      {
        system: false,
        supabase: false,
        redis: false,
        database: false,
        auth_service: false,
      },
      false
    );
  }
}

// Export with production error handling
export const GET = withProductionErrorHandling(healthCheckHandler);