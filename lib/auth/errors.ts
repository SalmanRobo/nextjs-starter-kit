/**
 * Authentication Error Handling System
 * Centralized error handling with user-friendly messages and retry logic
 */

import { AuthError } from '@supabase/supabase-js';
import { AuthErrorDetails } from './types';
import { AUTH_ERRORS } from './config';

// Error codes mapping from Supabase to our custom errors
const SUPABASE_ERROR_MAP: Record<string, string> = {
  // Authentication errors
  'invalid_credentials': AUTH_ERRORS.INVALID_CREDENTIALS,
  'email_not_confirmed': AUTH_ERRORS.EMAIL_NOT_VERIFIED,
  'invalid_grant': AUTH_ERRORS.INVALID_CREDENTIALS,
  'access_denied': AUTH_ERRORS.UNAUTHORIZED,
  'unauthorized': AUTH_ERRORS.UNAUTHORIZED,
  
  // Sign up errors
  'signup_disabled': 'New registrations are temporarily disabled.',
  'email_address_invalid': AUTH_ERRORS.INVALID_EMAIL,
  'password_too_short': AUTH_ERRORS.WEAK_PASSWORD,
  
  // Rate limiting
  'email_rate_limit_exceeded': 'Too many emails sent. Please wait before requesting another.',
  'sms_rate_limit_exceeded': 'Too many SMS messages sent. Please wait before requesting another.',
  'captcha_failed': 'CAPTCHA verification failed. Please try again.',
  
  // Session errors
  'session_not_found': AUTH_ERRORS.SESSION_EXPIRED,
  'token_expired': AUTH_ERRORS.SESSION_EXPIRED,
  'invalid_token': AUTH_ERRORS.SESSION_EXPIRED,
  'jwt_expired': AUTH_ERRORS.SESSION_EXPIRED,
  
  // Password reset errors
  'invalid_recovery_token': AUTH_ERRORS.RESET_TOKEN_INVALID,
  'expired_recovery_token': AUTH_ERRORS.RESET_TOKEN_EXPIRED,
  
  // Email verification errors
  'invalid_verification_token': AUTH_ERRORS.VERIFICATION_FAILED,
  'expired_verification_token': AUTH_ERRORS.VERIFICATION_EXPIRED,
  
  // Network errors
  'network_error': AUTH_ERRORS.NETWORK_ERROR,
  'timeout': 'Request timed out. Please check your connection and try again.',
  
  // Server errors
  'internal_server_error': AUTH_ERRORS.SERVER_ERROR,
  'service_unavailable': AUTH_ERRORS.MAINTENANCE_MODE,
  'database_error': AUTH_ERRORS.SERVER_ERROR,
  
  // OAuth errors
  'oauth_error': AUTH_ERRORS.OAUTH_ERROR,
  'oauth_cancelled': AUTH_ERRORS.OAUTH_CANCELLED,
  'oauth_access_denied': AUTH_ERRORS.OAUTH_ACCESS_DENIED,
  
  // User management
  'user_not_found': AUTH_ERRORS.USER_NOT_FOUND,
  'user_already_exists': AUTH_ERRORS.EMAIL_ALREADY_EXISTS,
  'email_address_already_in_use': AUTH_ERRORS.EMAIL_ALREADY_EXISTS,
  
  // Generic fallback
  'unknown_error': AUTH_ERRORS.UNKNOWN_ERROR,
};

// Error categories for different handling strategies
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  NETWORK = 'network',
  SERVER = 'server',
  RATE_LIMIT = 'rate_limit',
  OAUTH = 'oauth',
  UNKNOWN = 'unknown',
}

// Categorize errors
export const categorizeError = (error: AuthError | Error | string): ErrorCategory => {
  const errorCode = typeof error === 'string' ? error : error.message?.toLowerCase() || '';
  
  if (errorCode.includes('network') || errorCode.includes('timeout') || errorCode.includes('connection')) {
    return ErrorCategory.NETWORK;
  }
  
  if (errorCode.includes('rate_limit') || errorCode.includes('too_many')) {
    return ErrorCategory.RATE_LIMIT;
  }
  
  if (errorCode.includes('oauth') || errorCode.includes('provider')) {
    return ErrorCategory.OAUTH;
  }
  
  if (errorCode.includes('server') || errorCode.includes('internal') || errorCode.includes('database')) {
    return ErrorCategory.SERVER;
  }
  
  if (errorCode.includes('invalid') || errorCode.includes('required') || errorCode.includes('format')) {
    return ErrorCategory.VALIDATION;
  }
  
  if (errorCode.includes('credential') || errorCode.includes('unauthorized') || errorCode.includes('session')) {
    return ErrorCategory.AUTHENTICATION;
  }
  
  return ErrorCategory.UNKNOWN;
};

// Generate request ID for error tracking
export const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Create detailed error object
export const createAuthError = (
  error: AuthError | Error | string,
  context?: {
    action?: string;
    userId?: string;
    email?: string;
    requestId?: string;
    metadata?: Record<string, any>;
  }
): AuthErrorDetails => {
  const requestId = context?.requestId || generateRequestId();
  const timestamp = new Date().toISOString();
  
  let code: string;
  let message: string;
  let details: any;
  let hint: string | undefined;
  
  if (typeof error === 'string') {
    code = 'custom_error';
    message = error;
    details = null;
  } else if (error instanceof AuthError) {
    code = error.message?.toLowerCase().replace(/\s+/g, '_') || 'unknown_auth_error';
    message = SUPABASE_ERROR_MAP[code] || error.message || AUTH_ERRORS.UNKNOWN_ERROR;
    details = (error as any).details || null;
    hint = getErrorHint(code, context);
  } else {
    code = error.name?.toLowerCase() || 'unknown_error';
    message = error.message || AUTH_ERRORS.UNKNOWN_ERROR;
    details = null;
  }
  
  // Log error for monitoring (in production, send to external service)
  if (process.env.NODE_ENV === 'production') {
    console.error('Auth Error:', {
      requestId,
      code,
      message,
      details,
      context,
      timestamp,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
  
  return {
    code,
    message,
    details,
    hint,
    timestamp,
    requestId,
  };
};

// Generate helpful hints for users
export const getErrorHint = (
  errorCode: string,
  context?: {
    action?: string;
    userId?: string;
    email?: string;
    metadata?: Record<string, any>;
  }
): string | undefined => {
  const action = context?.action;
  
  switch (errorCode) {
    case 'invalid_credentials':
      return 'Double-check your email and password. Make sure Caps Lock is off.';
    
    case 'email_not_confirmed':
      return 'Check your email inbox and spam folder for the verification link.';
    
    case 'network_error':
      return 'Check your internet connection and try again.';
    
    case 'password_too_short':
      return 'Use at least 8 characters with a mix of letters, numbers, and symbols.';
    
    case 'email_rate_limit_exceeded':
      return 'Please wait a few minutes before requesting another email.';
    
    case 'oauth_error':
      return 'Try signing in with a different method or contact support.';
    
    case 'session_expired':
      return 'Please sign in again to continue.';
    
    case 'user_not_found':
      if (action === 'sign_in') {
        return 'Try signing up for a new account instead.';
      }
      return 'Please check your email address.';
    
    case 'email_address_already_in_use':
      return 'Try signing in instead, or use the password reset option.';
    
    default:
      return undefined;
  }
};

// Retry configuration for different error types
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    'network_error',
    'timeout',
    'internal_server_error',
    'service_unavailable',
    'database_error',
    'temporary_unavailable',
  ],
};

// Check if error is retryable
export const isRetryableError = (error: AuthErrorDetails, config: RetryConfig = DEFAULT_RETRY_CONFIG): boolean => {
  return config.retryableErrors.some(retryableCode => 
    error.code.includes(retryableCode) || error.message.toLowerCase().includes(retryableCode)
  );
};

// Calculate retry delay with exponential backoff
export const calculateRetryDelay = (
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number => {
  const delay = Math.min(
    config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
    config.maxDelay
  );
  
  // Add jitter to prevent thundering herd
  const jitter = delay * 0.1 * Math.random();
  
  return Math.floor(delay + jitter);
};

// Retry wrapper for async functions
export const withRetry = async <T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: AuthErrorDetails) => void
): Promise<T> => {
  let lastError: AuthErrorDetails;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = createAuthError(error as Error);
      
      // Don't retry if not retryable or max attempts reached
      if (!isRetryableError(lastError, config) || attempt === config.maxAttempts) {
        throw lastError;
      }
      
      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, lastError);
      }
      
      // Wait before retry
      const delay = calculateRetryDelay(attempt, config);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

// Error boundary for React components
export class AuthErrorBoundary extends Error {
  constructor(
    public authError: AuthErrorDetails,
    public componentStack?: string
  ) {
    super(authError.message);
    this.name = 'AuthErrorBoundary';
  }
}

// Format error for display
export const formatErrorMessage = (error: AuthErrorDetails): string => {
  // For development, show detailed error
  if (process.env.NODE_ENV === 'development') {
    return `${error.message}${error.hint ? ` Hint: ${error.hint}` : ''}`;
  }
  
  // For production, show user-friendly message only
  return error.message;
};

// Get appropriate action for error
export const getErrorAction = (error: AuthErrorDetails): {
  action: 'retry' | 'redirect' | 'contact_support' | 'none';
  actionText?: string;
  actionUrl?: string;
} => {
  const category = categorizeError(error.code);
  
  switch (category) {
    case ErrorCategory.NETWORK:
      return { action: 'retry', actionText: 'Try Again' };
    
    case ErrorCategory.RATE_LIMIT:
      return { action: 'none' };
    
    case ErrorCategory.AUTHENTICATION:
      if (error.code.includes('session')) {
        return { action: 'redirect', actionText: 'Sign In', actionUrl: '/sign-in' };
      }
      return { action: 'none' };
    
    case ErrorCategory.SERVER:
      return { action: 'contact_support', actionText: 'Contact Support' };
    
    default:
      return { action: 'none' };
  }
};

// Export error utilities
export default {
  createAuthError,
  categorizeError,
  isRetryableError,
  withRetry,
  formatErrorMessage,
  getErrorAction,
  getErrorHint,
  calculateRetryDelay,
};