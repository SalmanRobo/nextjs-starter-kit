/**
 * ALDARI Cross-Domain Authentication Monitoring API
 * Provides monitoring endpoints for authentication system health
 */

import { NextRequest, NextResponse } from 'next/server';
import { crossDomainAuthMonitor } from '@/lib/auth/cross-domain-monitoring';

/**
 * Get authentication metrics and health status
 * GET /api/auth/monitoring
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    switch (type) {
      case 'health':
        const healthStatus = crossDomainAuthMonitor.getHealthStatus();
        return NextResponse.json(healthStatus, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });

      case 'metrics':
        const metrics = crossDomainAuthMonitor.getMetrics();
        return NextResponse.json(metrics, {
          headers: {
            'Cache-Control': 'private, max-age=60', // Cache for 1 minute
          },
        });

      case 'events':
        const filters = {
          type: searchParams.get('eventType') as any,
          userId: searchParams.get('userId') || undefined,
          domain: searchParams.get('domain') || undefined,
          limit: parseInt(searchParams.get('limit') || '100'),
        };

        const events = crossDomainAuthMonitor.getEvents(filters);
        return NextResponse.json({ events }, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });

      case 'export':
        const format = searchParams.get('format') as 'json' | 'csv' || 'json';
        const exportData = crossDomainAuthMonitor.exportMetrics(format);
        
        const contentType = format === 'csv' ? 'text/csv' : 'application/json';
        const filename = `auth-metrics-${new Date().toISOString().split('T')[0]}.${format}`;
        
        return new NextResponse(exportData, {
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });

      default:
        // Return both health and basic metrics by default
        return NextResponse.json({
          health: crossDomainAuthMonitor.getHealthStatus(),
          metrics: {
            totalSignIns: crossDomainAuthMonitor.getMetrics().totalSignIns,
            totalSignUps: crossDomainAuthMonitor.getMetrics().totalSignUps,
            totalErrors: crossDomainAuthMonitor.getMetrics().totalErrors,
            errorRate: crossDomainAuthMonitor.getMetrics().errorRate,
            activeUsers: crossDomainAuthMonitor.getMetrics().activeUsers,
          },
        });
    }
  } catch (error) {
    console.error('[Monitoring API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Update monitoring configuration
 * POST /api/auth/monitoring
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development or with proper authentication
    if (process.env.NODE_ENV === 'production') {
      const authHeader = request.headers.get('authorization');
      const adminToken = process.env.MONITORING_ADMIN_TOKEN;
      
      if (!authHeader || !adminToken || authHeader !== `Bearer ${adminToken}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'add_alert':
        if (!data.alert || typeof data.alert !== 'object') {
          return NextResponse.json(
            { error: 'Invalid alert configuration' },
            { status: 400 }
          );
        }
        
        crossDomainAuthMonitor.addAlert(data.alert);
        return NextResponse.json({ success: true });

      case 'remove_alert':
        if (!data.alertId || typeof data.alertId !== 'string') {
          return NextResponse.json(
            { error: 'Alert ID is required' },
            { status: 400 }
          );
        }
        
        crossDomainAuthMonitor.removeAlert(data.alertId);
        return NextResponse.json({ success: true });

      case 'get_alerts':
        const alerts = crossDomainAuthMonitor.getAlerts();
        return NextResponse.json({ alerts });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Monitoring API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}