/**
 * Authentication Module - Main Entry Point
 * Production-ready TypeScript exports for the auth system
 */

// Core types
export type {
  UserProfile,
  UserRole,
  AuthState,
  AuthContextType,
  SignInCredentials,
  SignUpCredentials,
  PasswordResetRequest,
  PasswordResetConfirmation,
  OAuthSignInOptions,
  OAuthProvider,
  AuthErrorDetails,
  FormErrors,
  ValidationResult,
  LoadingStates,
  DeviceInfo,
  AuthConfig,
  AuthEvent,
  AuthEventType,
} from './types';

// Context and hooks
export {
  AuthProvider,
  MemoizedAuthProvider,
  useAuth,
  useAuthGuard,
  useEmailVerification,
  useAuthEvents,
  useAuthPerformance,
} from './context';

// Service
export {
  AuthService,
  authService,
} from './service';

// Configuration
export {
  AUTH_CONFIG,
  AUTH_ERRORS,
  AUTH_MESSAGES,
  SITE_CONFIG,
  OAUTH_PROVIDERS,
  VALIDATION_PATTERNS,
  FEATURE_FLAGS,
  SECURITY_HEADERS,
} from './config';

// Validation utilities
export {
  validateSignInForm,
  validateSignUpForm,
  validatePasswordResetRequest,
  validatePasswordResetConfirmation,
  validateEmail,
  validatePhone,
  validateName,
  getPasswordStrength,
  sanitizeInput,
  validateEmailRealTime,
  validatePasswordRealTime,
  validateNameRealTime,
  validatePhoneRealTime,
} from './validation';

// Error handling
export {
  createAuthError,
  categorizeError,
  ErrorCategory,
  isRetryableError,
  withRetry,
  formatErrorMessage,
  getErrorAction,
  getErrorHint,
  calculateRetryDelay,
  AuthErrorBoundary,
  DEFAULT_RETRY_CONFIG,
} from './errors';

// Rate limiting
export {
  checkRateLimit,
  incrementRateLimit,
  resetRateLimit,
  formatTimeRemaining,
} from './rate-limiting';

// Diagnostics
export {
  createDebugClient,
  logAuthDiagnostics,
} from './diagnostics';

// Convenience utilities
export const authUtils = {
  // Validation helpers
  validateEmail: (email: string) => {
    const { errors } = require('./validation').validateEmail(email);
    return { isValid: errors.length === 0, errors };
  },
  
  // Password strength checker
  checkPasswordStrength: (password: string) => {
    const { getPasswordStrength } = require('./validation');
    return getPasswordStrength(password);
  },
  
  // Error formatting
  formatError: (error: AuthErrorDetails) => {
    const { formatErrorMessage } = require('./errors');
    return formatErrorMessage(error);
  },
  
  // Rate limit checker
  checkRateLimit: (action: string, clientId: string) => {
    const { checkRateLimit } = require('./rate-limiting');
    return checkRateLimit(action, clientId);
  },
  
  // Time formatting
  formatTimeRemaining: (milliseconds: number) => {
    const { formatTimeRemaining } = require('./rate-limiting');
    return formatTimeRemaining(milliseconds);
  },
  
  // Input sanitization
  sanitizeInput: (input: string) => {
    const { sanitizeInput } = require('./validation');
    return sanitizeInput(input);
  },
};

// Configuration getters
export const authConfig = {
  getRedirectUrl: (type: 'signIn' | 'signUp' | 'dashboard' | 'error') => 
    AUTH_CONFIG.redirectUrls[type],
  
  getOAuthProviders: () => 
    AUTH_CONFIG.features.oauthProviders,
  
  getSecuritySettings: () => 
    AUTH_CONFIG.security,
  
  getRateLimits: () => 
    AUTH_CONFIG.rateLimiting,
  
  isFeatureEnabled: (feature: keyof typeof FEATURE_FLAGS) => 
    FEATURE_FLAGS[feature],
};

// Main service instance for convenience
export default authService;