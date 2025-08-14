/**
 * Production-Grade Error Handler for Authentication System
 * Prevents sensitive information disclosure and provides secure error logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthErrorDetails } from './types';
import { createAuthError, categorizeError, ErrorCategory } from './errors';

// Sensitive patterns that should never be exposed
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /credential/i,
  /jwt/i,
  /session/i,
  /database/i,
  /connection/i,
  /internal/i,
  /stack trace/i,
  /file path/i,
  /sql/i,
  /query/i,
  /env/i,
  /config/i,
  /debug/i,
];

// Production-safe error messages
const PRODUCTION_ERROR_MESSAGES: Record<string, string> = {
  // Authentication errors (safe to expose)
  'invalid_credentials': 'Invalid email or password',
  'email_not_verified': 'Please verify your email address',
  'account_locked': 'Account temporarily locked for security',
  'weak_password': 'Password does not meet security requirements',
  'invalid_email': 'Please enter a valid email address',
  
  // Rate limiting (safe to expose)
  'rate_limited': 'Too many attempts. Please try again later',
  'email_rate_limit': 'Too many emails sent. Please wait before requesting another',
  
  // Generic safe messages (hide implementation details)
  'server_error': 'Service temporarily unavailable. Please try again later',
  'database_error': 'Service temporarily unavailable. Please try again later',
  'network_error': 'Connection failed. Please check your internet connection',
  'timeout_error': 'Request timed out. Please try again',
  'maintenance_mode': 'Service under maintenance. Please try again later',
  'unknown_error': 'An error occurred. Please try again',
  
  // OAuth (minimal exposure)
  'oauth_error': 'Authentication provider error. Please try again',
  'oauth_cancelled': 'Authentication was cancelled',
  
  // Session errors (safe to expose)
  'session_expired': 'Your session has expired. Please sign in again',
  'unauthorized': 'Please sign in to continue',
  
  // Validation errors (safe to expose)
  'validation_error': 'Please check your input and try again',
  'invalid_format': 'Invalid input format',
  'required_field': 'Required field is missing',
};

// Error codes that are safe to expose to clients
const SAFE_ERROR_CODES = new Set([
  'invalid_credentials',
  'email_not_verified',
  'account_locked',
  'weak_password',
  'invalid_email',
  'rate_limited',
  'email_rate_limit',
  'oauth_cancelled',
  'session_expired',
  'unauthorized',
  'validation_error',
  'invalid_format',
  'required_field',
]);

// Sanitize error message for production
export const sanitizeErrorMessage = (message: string): string => {
  // Check for sensitive patterns
  const hasSensitiveInfo = SENSITIVE_PATTERNS.some(pattern => pattern.test(message));
  
  if (hasSensitiveInfo) {
    return 'An error occurred. Please try again later';
  }
  
  // Remove any potential stack traces or file paths
  const cleanMessage = message
    .split('\n')[0] // Take only first line
    .replace(/at\s+\S+/g, '') // Remove "at filename" references
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  return cleanMessage || 'An error occurred. Please try again later';
};

// Sanitize error code for production
export const sanitizeErrorCode = (code: string): string => {
  if (SAFE_ERROR_CODES.has(code)) {
    return code;
  }
  
  // Map dangerous codes to safe ones
  if (code.includes('database') || code.includes('sql') || code.includes('connection')) {
    return 'server_error';
  }
  
  if (code.includes('timeout') || code.includes('network')) {
    return 'network_error';
  }
  
  if (code.includes('rate') || code.includes('limit') || code.includes('throttle')) {
    return 'rate_limited';
  }
  
  if (code.includes('oauth') || code.includes('provider')) {
    return 'oauth_error';
  }
  
  if (code.includes('session') || code.includes('token') || code.includes('jwt')) {
    return 'session_expired';
  }
  
  // Default to generic error
  return 'unknown_error';
};

// Create production-safe error response
export const createProductionErrorResponse = (
  error: Error | AuthErrorDetails | string,
  context?: {
    requestId?: string;
    userId?: string;
    action?: string;
    statusCode?: number;
  }
): NextResponse => {
  const requestId = context?.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = new Date().toISOString();
  
  let authError: AuthErrorDetails;
  
  if (typeof error === 'string') {
    authError = createAuthError(error, { requestId, ...context });
  } else if ('code' in error) {
    authError = error as AuthErrorDetails;
  } else {
    authError = createAuthError(error, { requestId, ...context });
  }
  
  // Sanitize for production
  const safeCode = sanitizeErrorCode(authError.code);
  const safeMessage = PRODUCTION_ERROR_MESSAGES[safeCode] || sanitizeErrorMessage(authError.message);
  
  // Log full error details securely (for internal monitoring)
  if (process.env.NODE_ENV === 'production') {
    // In production, you would send this to your monitoring service
    console.error('Auth Error [INTERNAL]:', {
      requestId,
      originalCode: authError.code,
      originalMessage: authError.message,
      sanitizedCode: safeCode,
      sanitizedMessage: safeMessage,
      context,
      timestamp,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
  
  // Determine status code
  let statusCode = context?.statusCode || 400;
  const category = categorizeError(safeCode);
  
  switch (category) {
    case ErrorCategory.AUTHENTICATION:
      statusCode = 401;
      break;
    case ErrorCategory.RATE_LIMIT:
      statusCode = 429;
      break;
    case ErrorCategory.SERVER:
    case ErrorCategory.NETWORK:
      statusCode = 500;
      break;
    case ErrorCategory.VALIDATION:
      statusCode = 400;
      break;
  }
  
  // Create safe response payload
  const responsePayload = {
    error: {
      code: safeCode,
      message: safeMessage,
      timestamp,
      requestId,
      // Only include hint if it's safe
      ...(authError.hint && !SENSITIVE_PATTERNS.some(pattern => pattern.test(authError.hint!)) && {
        hint: authError.hint
      }),
    },
  };
  
  return NextResponse.json(responsePayload, {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
};

// Middleware wrapper for API routes
export const withProductionErrorHandling = (
  handler: (request: NextRequest) => Promise<NextResponse>
) => {
  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const response = await handler(request);
      
      // Add request ID to successful responses
      response.headers.set('X-Request-ID', requestId);
      
      return response;
    } catch (error) {
      // Log the error securely
      console.error('API Error:', {
        requestId,
        path: request.nextUrl.pathname,
        method: request.method,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : error,
        timestamp: new Date().toISOString(),
      });
      
      // Return safe error response
      return createProductionErrorResponse(error as Error, { requestId });
    }
  };
};

// Client-side error sanitization
export const sanitizeClientError = (error: any): {
  message: string;
  code: string;
  canRetry: boolean;
} => {
  let code = 'unknown_error';
  let message = 'An error occurred. Please try again later';
  let canRetry = false;
  
  if (error && typeof error === 'object') {
    if (error.code && SAFE_ERROR_CODES.has(error.code)) {
      code = error.code;
      message = PRODUCTION_ERROR_MESSAGES[code] || message;
    }
    
    // Determine if retry is appropriate
    canRetry = [
      'network_error',
      'timeout_error',
      'server_error',
    ].includes(code);
  }
  
  return { message, code, canRetry };
};

// Secure logging function for production
export const secureLog = (
  level: 'info' | 'warn' | 'error',
  message: string,
  data?: Record<string, any>
) => {
  const logEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    // Sanitize data to prevent sensitive information leakage
    data: data ? sanitizeLogData(data) : undefined,
  };
  
  // In production, you would send this to your logging service
  // (e.g., CloudWatch, Datadog, Sentry)
  console.log(JSON.stringify(logEntry));
};

// Sanitize log data to remove sensitive information
const sanitizeLogData = (data: Record<string, any>): Record<string, any> => {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase();
    
    // Skip sensitive keys
    if (SENSITIVE_PATTERNS.some(pattern => pattern.test(keyLower))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }
    
    // Sanitize string values
    if (typeof value === 'string') {
      const hasSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(value));
      sanitized[key] = hasSensitive ? '[REDACTED]' : value;
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize objects
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

// Health check endpoint error handler
export const createHealthCheckResponse = (
  checks: Record<string, boolean>,
  overall: boolean
) => {
  return NextResponse.json({
    status: overall ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || 'unknown',
  }, {
    status: overall ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};

export default {
  sanitizeErrorMessage,
  sanitizeErrorCode,
  createProductionErrorResponse,
  withProductionErrorHandling,
  sanitizeClientError,
  secureLog,
  createHealthCheckResponse,
};