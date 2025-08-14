'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';

interface PerformanceMetrics {
  authInitTime: number;
  signInTime: number;
  signOutTime: number;
  sessionRefreshTime: number;
  totalAuthOperations: number;
  lastOperationTime: number;
}

interface AuthPerformanceData {
  timestamp: string;
  operation: string;
  duration: number;
  success: boolean;
  error?: string;
  userAgent: string;
  sessionId: string;
}

/**
 * Production-ready auth performance monitoring
 * Tracks authentication operation performance and provides insights
 */
export function useAuthPerformance() {
  const metricsRef = useRef<PerformanceMetrics>({
    authInitTime: 0,
    signInTime: 0,
    signOutTime: 0,
    sessionRefreshTime: 0,
    totalAuthOperations: 0,
    lastOperationTime: 0,
  });

  const performanceDataRef = useRef<AuthPerformanceData[]>([]);
  const { user, loading } = useAuth();

  // Generate session ID for tracking
  const getSessionId = useCallback(() => {
    let sessionId = sessionStorage.getItem('auth-session-id');
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('auth-session-id', sessionId);
    }
    return sessionId;
  }, []);

  // Track performance metrics
  const trackOperation = useCallback((
    operation: string,
    startTime: number,
    success: boolean,
    error?: string
  ) => {
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Update metrics
    metricsRef.current.totalAuthOperations++;
    metricsRef.current.lastOperationTime = duration;

    switch (operation) {
      case 'auth-init':
        metricsRef.current.authInitTime = duration;
        break;
      case 'sign-in':
        metricsRef.current.signInTime = duration;
        break;
      case 'sign-out':
        metricsRef.current.signOutTime = duration;
        break;
      case 'session-refresh':
        metricsRef.current.sessionRefreshTime = duration;
        break;
    }

    // Record detailed performance data
    const performanceData: AuthPerformanceData = {
      timestamp: new Date().toISOString(),
      operation,
      duration,
      success,
      error,
      userAgent: navigator.userAgent,
      sessionId: getSessionId(),
    };

    performanceDataRef.current.push(performanceData);

    // Keep only last 100 operations to prevent memory issues
    if (performanceDataRef.current.length > 100) {
      performanceDataRef.current = performanceDataRef.current.slice(-50);
    }

    // Log performance in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚀 Auth Performance: ${operation}`);
      console.log(`Duration: ${duration.toFixed(2)}ms`);
      console.log(`Success: ${success}`);
      if (error) console.error(`Error: ${error}`);
      console.log(`Session ID: ${performanceData.sessionId}`);
      console.groupEnd();
    }

    // Send to analytics in production (implement as needed)
    if (process.env.NODE_ENV === 'production' && duration > 5000) {
      console.warn(`Slow auth operation detected: ${operation} took ${duration.toFixed(2)}ms`);
      // Here you could send to your analytics service
      // analytics.track('auth_performance_issue', performanceData);
    }
  }, [getSessionId]);

  // Monitor auth initialization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initStartTime = performance.now();
    
    // Track when auth initialization completes
    if (!loading && user !== undefined) {
      trackOperation('auth-init', initStartTime, user !== null);
    }
  }, [loading, user, trackOperation]);

  // Get performance summary
  const getPerformanceSummary = useCallback(() => {
    const data = performanceDataRef.current;
    const metrics = metricsRef.current;

    if (data.length === 0) {
      return null;
    }

    const successfulOperations = data.filter(d => d.success).length;
    const averageDuration = data.reduce((sum, d) => sum + d.duration, 0) / data.length;
    const slowOperations = data.filter(d => d.duration > 3000).length;

    return {
      totalOperations: metrics.totalAuthOperations,
      successRate: (successfulOperations / data.length) * 100,
      averageDuration: Number(averageDuration.toFixed(2)),
      slowOperations,
      lastOperation: data[data.length - 1],
      metrics: {
        authInitTime: Number(metrics.authInitTime.toFixed(2)),
        signInTime: Number(metrics.signInTime.toFixed(2)),
        signOutTime: Number(metrics.signOutTime.toFixed(2)),
        sessionRefreshTime: Number(metrics.sessionRefreshTime.toFixed(2)),
      }
    };
  }, []);

  // Export performance data
  const exportPerformanceData = useCallback(() => {
    const summary = getPerformanceSummary();
    const data = {
      summary,
      detailedData: performanceDataRef.current,
      browserInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
      },
      timestamp: new Date().toISOString(),
    };

    // Create downloadable JSON file
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auth-performance-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [getPerformanceSummary]);

  // Clear performance data
  const clearPerformanceData = useCallback(() => {
    performanceDataRef.current = [];
    metricsRef.current = {
      authInitTime: 0,
      signInTime: 0,
      signOutTime: 0,
      sessionRefreshTime: 0,
      totalAuthOperations: 0,
      lastOperationTime: 0,
    };
  }, []);

  return {
    trackOperation,
    getPerformanceSummary,
    exportPerformanceData,
    clearPerformanceData,
    metrics: metricsRef.current,
  };
}

/**
 * Auth Performance Monitor Component
 * Shows performance metrics in development mode
 */
export function AuthPerformanceMonitor() {
  const { getPerformanceSummary } = useAuthPerformance();

  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const summary = getPerformanceSummary();

  if (!summary) {
    return (
      <div className="fixed bottom-4 right-4 bg-gray-900 text-white text-xs p-3 rounded-lg shadow-lg">
        <div className="font-semibold mb-1">Auth Performance</div>
        <div>Initializing...</div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white text-xs p-3 rounded-lg shadow-lg max-w-xs">
      <div className="font-semibold mb-2">🚀 Auth Performance</div>
      <div className="space-y-1">
        <div>Operations: {summary.totalOperations}</div>
        <div>Success Rate: {summary.successRate.toFixed(1)}%</div>
        <div>Avg Duration: {summary.averageDuration}ms</div>
        <div>Slow Ops: {summary.slowOperations}</div>
        <div className="border-t border-gray-600 pt-1 mt-1">
          <div>Init: {summary.metrics.authInitTime}ms</div>
          <div>Sign In: {summary.metrics.signInTime}ms</div>
          <div>Sign Out: {summary.metrics.signOutTime}ms</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Performance warning component for slow operations
 */
export function AuthPerformanceWarning({ 
  threshold = 5000,
  onWarning 
}: { 
  threshold?: number;
  onWarning?: (operation: string, duration: number) => void;
}) {
  const { metrics } = useAuthPerformance();

  useEffect(() => {
    const slowOperations = [];
    
    if (metrics.authInitTime > threshold) {
      slowOperations.push({ operation: 'Auth Init', duration: metrics.authInitTime });
    }
    if (metrics.signInTime > threshold) {
      slowOperations.push({ operation: 'Sign In', duration: metrics.signInTime });
    }
    if (metrics.sessionRefreshTime > threshold) {
      slowOperations.push({ operation: 'Session Refresh', duration: metrics.sessionRefreshTime });
    }

    slowOperations.forEach(({ operation, duration }) => {
      if (onWarning) {
        onWarning(operation, duration);
      } else {
        console.warn(`🐌 Slow auth operation detected: ${operation} took ${duration.toFixed(2)}ms`);
      }
    });
  }, [metrics, threshold, onWarning]);

  return null;
}