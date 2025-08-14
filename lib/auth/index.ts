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

// Enhanced utility types
export type {
  ExactOptional,
  StrictPartial,
  KeysOfType,
  DeepPartial,
  NestedKeys,
  NestedPath,
  PartialBy,
  RequiredBy,
  FormState,
  ApiResponse,
  CrossDomainMessage,
  CrossDomainAuthToken,
} from './types-utils';

// API types
export type {
  ApiRequest,
  EnhancedApiResponse,
  ApiErrorResponse,
  SignInRequest,
  SignInResponse,
  SignUpRequest,
  SignUpResponse,
  OAuthSignInRequest,
  OAuthSignInResponse,
  AuthApiRequest,
  AuthApiResponse,
  ApiHandler,
  ApiMiddleware,
  ApiRouteConfig,
} from './api-types';

// Cross-domain types
export type {
  DomainConfig,
  CrossDomainConfig,
  CrossDomainAuthFlow,
  CrossDomainAuthResult,
  CrossDomainTokenMessage,
  CrossDomainErrorMessage,
  CrossDomainSuccessMessage,
  CrossDomainLogoutMessage,
  CrossDomainRefreshMessage,
  CrossDomainAuthMessage,
  SecureCrossDomainMessage,
  CrossDomainSession,
  CrossDomainSecurityEvent,
  CrossDomainError,
} from './cross-domain-types';

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

// Enhanced type utilities and runtime validation
export {
  TypeUtils,
  createTypeGuard,
  UserProfileGuard,
  SessionGuard,
  AuthErrorGuard,
  CrossDomainMessageGuard,
  isUserProfile,
  isSession,
  isAuthError,
  isCrossDomainMessage,
  assertUserProfile,
  assertSession,
  assertAuthError,
  assertCrossDomainMessage,
  validateUserProfile,
  validateSession,
  validateAuthError,
  validateCrossDomainMessage,
  deepMerge,
  getNestedValue,
  filterObjectKeys,
  TypePerformanceMonitor,
  TypeSafeFormState,
  validateFormField,
} from './types-utils';

// Type testing framework (development only)
export {
  TypeTestSuite,
  AuthTypeTests,
  TypeAssertions,
  TypeBenchmark,
  testSupabaseCompatibility,
} from './type-tests';

// API and cross-domain types collections
export {
  ApiTypes,
} from './api-types';

export {
  CrossDomainTypes,
} from './cross-domain-types';

// Main service instance for convenience
export default authService;