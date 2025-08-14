/**
 * Enterprise API Types for Authentication System
 * Comprehensive type definitions for all authentication-related API communications
 */

import { 
  UserProfile, 
  AuthErrorDetails, 
  SignInCredentials, 
  SignUpCredentials,
  PasswordResetRequest,
  PasswordResetConfirmation,
  OAuthSignInOptions
} from './types';
import { ApiResponse, CrossDomainAuthToken } from './types-utils';

// === BASE API TYPES ===

// Generic API request structure
export interface ApiRequest<T = unknown> {
  data?: T;
  headers?: Record<string, string>;
  timestamp: number;
  requestId: string;
  sessionId?: string;
}

// Enhanced API response with metadata
export interface EnhancedApiResponse<T = unknown> extends ApiResponse<T> {
  metadata: {
    requestId: string;
    timestamp: number;
    duration: number;
    version: string;
    rateLimit?: {
      limit: number;
      remaining: number;
      reset: number;
    };
  };
}

// API error response with detailed information
export interface ApiErrorResponse {
  success: false;
  error: AuthErrorDetails & {
    statusCode: number;
    path: string;
    method: string;
  };
  metadata: {
    requestId: string;
    timestamp: number;
    userAgent?: string;
    ipAddress?: string;
  };
}

// === AUTHENTICATION API TYPES ===

// Sign-in API types
export interface SignInRequest extends ApiRequest<SignInCredentials> {
  deviceInfo?: {
    userAgent: string;
    platform: string;
    isMobile: boolean;
  };
  captchaToken?: string;
  rememberDevice?: boolean;
}

export interface SignInResponse extends EnhancedApiResponse<{
  user: UserProfile;
  session: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
  redirectUrl?: string;
  requiresMfa?: boolean;
}> {}

// Sign-up API types
export interface SignUpRequest extends ApiRequest<SignUpCredentials> {
  deviceInfo?: {
    userAgent: string;
    platform: string;
    isMobile: boolean;
  };
  inviteCode?: string;
  marketingConsent?: boolean;
}

export interface SignUpResponse extends EnhancedApiResponse<{
  user: UserProfile;
  session?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
  requiresEmailVerification: boolean;
  verificationEmailSent: boolean;
}> {}

// OAuth API types
export interface OAuthSignInRequest extends ApiRequest<{
  provider: 'google' | 'apple' | 'github' | 'facebook' | 'twitter';
  redirectUrl?: string;
  state?: string;
}> {}

export interface OAuthSignInResponse extends EnhancedApiResponse<{
  authUrl: string;
  state: string;
  codeChallenge?: string;
}> {}

export interface OAuthCallbackRequest extends ApiRequest<{
  code: string;
  state: string;
  provider: string;
}> {}

export interface OAuthCallbackResponse extends EnhancedApiResponse<{
  user: UserProfile;
  session: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
  isNewUser: boolean;
}> {}

// === PASSWORD MANAGEMENT API TYPES ===

export interface PasswordResetRequest extends ApiRequest<{
  email: string;
  captchaToken?: string;
}> {}

export interface PasswordResetResponse extends EnhancedApiResponse<{
  emailSent: boolean;
  resetToken?: string; // Only in development
}> {}

export interface PasswordResetConfirmRequest extends ApiRequest<{
  token: string;
  password: string;
  confirmPassword: string;
}> {}

export interface PasswordResetConfirmResponse extends EnhancedApiResponse<{
  success: boolean;
  user: Pick<UserProfile, 'id' | 'email'>;
}> {}

export interface PasswordChangeRequest extends ApiRequest<{
  currentPassword: string;
  newPassword: string;
}> {}

export interface PasswordChangeResponse extends EnhancedApiResponse<{
  success: boolean;
  sessionInvalidated: boolean;
}> {}

// === SESSION MANAGEMENT API TYPES ===

export interface SessionRefreshRequest extends ApiRequest<{
  refreshToken: string;
}> {}

export interface SessionRefreshResponse extends EnhancedApiResponse<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: UserProfile;
}> {}

export interface SessionValidationRequest extends ApiRequest<{
  accessToken: string;
}> {}

export interface SessionValidationResponse extends EnhancedApiResponse<{
  valid: boolean;
  user?: UserProfile;
  expiresAt?: number;
}> {}

export interface SessionListRequest extends ApiRequest {}

export interface SessionListResponse extends EnhancedApiResponse<{
  sessions: Array<{
    id: string;
    deviceInfo: {
      userAgent: string;
      platform: string;
      isMobile: boolean;
    };
    ipAddress: string;
    location?: {
      country: string;
      city: string;
    };
    lastActivity: string;
    isCurrent: boolean;
  }>;
}> {}

export interface SessionRevokeRequest extends ApiRequest<{
  sessionId?: string; // If not provided, revokes current session
  revokeAll?: boolean;
}> {}

export interface SessionRevokeResponse extends EnhancedApiResponse<{
  revokedCount: number;
  remainingCount: number;
}> {}

// === PROFILE MANAGEMENT API TYPES ===

export interface ProfileUpdateRequest extends ApiRequest<{
  updates: Partial<UserProfile['user_metadata']>;
}> {}

export interface ProfileUpdateResponse extends EnhancedApiResponse<{
  user: UserProfile;
}> {}

export interface ProfileDeleteRequest extends ApiRequest<{
  confirmationCode: string;
  reason?: string;
}> {}

export interface ProfileDeleteResponse extends EnhancedApiResponse<{
  success: boolean;
  deletionId: string;
}> {}

// === EMAIL VERIFICATION API TYPES ===

export interface EmailVerificationSendRequest extends ApiRequest<{
  email?: string; // If not provided, uses current user's email
}> {}

export interface EmailVerificationSendResponse extends EnhancedApiResponse<{
  emailSent: boolean;
  nextAllowedAt: number;
}> {}

export interface EmailVerificationConfirmRequest extends ApiRequest<{
  token: string;
}> {}

export interface EmailVerificationConfirmResponse extends EnhancedApiResponse<{
  verified: boolean;
  user: UserProfile;
}> {}

// === CROSS-DOMAIN SSO API TYPES ===

export interface CrossDomainTokenRequest extends ApiRequest<{
  targetDomain: string;
  returnUrl?: string;
}> {}

export interface CrossDomainTokenResponse extends EnhancedApiResponse<{
  token: string;
  expiresAt: number;
  redirectUrl: string;
}> {}

export interface CrossDomainTokenValidateRequest extends ApiRequest<{
  token: string;
  sourceDomain: string;
}> {}

export interface CrossDomainTokenValidateResponse extends EnhancedApiResponse<{
  authToken: CrossDomainAuthToken;
  user: UserProfile;
}> {}

// === MONITORING & ANALYTICS API TYPES ===

export interface AuthActivityRequest extends ApiRequest<{
  startDate?: string;
  endDate?: string;
  eventTypes?: string[];
  limit?: number;
  offset?: number;
}> {}

export interface AuthActivityResponse extends EnhancedApiResponse<{
  activities: Array<{
    id: string;
    type: string;
    timestamp: string;
    success: boolean;
    ipAddress: string;
    userAgent: string;
    details?: Record<string, any>;
  }>;
  total: number;
  hasMore: boolean;
}> {}

export interface SecuritySettingsRequest extends ApiRequest {}

export interface SecuritySettingsResponse extends EnhancedApiResponse<{
  twoFactorEnabled: boolean;
  trustedDevices: number;
  recentActivity: Array<{
    type: string;
    timestamp: string;
    location?: string;
  }>;
  securityScore: number;
  recommendations: string[];
}> {}

// === HEALTH CHECK API TYPES ===

export interface HealthCheckRequest extends ApiRequest {}

export interface HealthCheckResponse extends EnhancedApiResponse<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    email: 'up' | 'down';
  };
  version: string;
  uptime: number;
}> {}

// === TYPE UNIONS FOR EASIER USAGE ===

export type AuthApiRequest = 
  | SignInRequest
  | SignUpRequest
  | OAuthSignInRequest
  | OAuthCallbackRequest
  | PasswordResetRequest
  | PasswordResetConfirmRequest
  | PasswordChangeRequest
  | SessionRefreshRequest
  | SessionValidationRequest
  | SessionListRequest
  | SessionRevokeRequest
  | ProfileUpdateRequest
  | ProfileDeleteRequest
  | EmailVerificationSendRequest
  | EmailVerificationConfirmRequest
  | CrossDomainTokenRequest
  | CrossDomainTokenValidateRequest
  | AuthActivityRequest
  | SecuritySettingsRequest
  | HealthCheckRequest;

export type AuthApiResponse = 
  | SignInResponse
  | SignUpResponse
  | OAuthSignInResponse
  | OAuthCallbackResponse
  | PasswordResetResponse
  | PasswordResetConfirmResponse
  | PasswordChangeResponse
  | SessionRefreshResponse
  | SessionValidationResponse
  | SessionListResponse
  | SessionRevokeResponse
  | ProfileUpdateResponse
  | ProfileDeleteResponse
  | EmailVerificationSendResponse
  | EmailVerificationConfirmResponse
  | CrossDomainTokenResponse
  | CrossDomainTokenValidateResponse
  | AuthActivityResponse
  | SecuritySettingsResponse
  | HealthCheckResponse
  | ApiErrorResponse;

// === UTILITY TYPES FOR API HANDLERS ===

// Generic API handler type
export type ApiHandler<TRequest extends ApiRequest, TResponse extends EnhancedApiResponse> = (
  request: TRequest
) => Promise<TResponse>;

// API middleware type
export type ApiMiddleware<TContext = {}> = (
  request: ApiRequest,
  context: TContext
) => Promise<void | ApiErrorResponse>;

// API route configuration
export interface ApiRouteConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  requiresAuth: boolean;
  rateLimiting?: {
    windowMs: number;
    maxRequests: number;
  };
  validation?: {
    body?: any; // Zod schema
    query?: any; // Zod schema
    headers?: any; // Zod schema
  };
  middleware?: ApiMiddleware[];
}

// === VALIDATION HELPERS ===

// Request validation result
export interface RequestValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

// Request validator function type
export type RequestValidator<T> = (data: unknown) => RequestValidationResult<T>;

// === DEVELOPMENT UTILITIES ===

// API request/response logger for development
export interface ApiLogger {
  logRequest<T>(request: ApiRequest<T>): void;
  logResponse<T>(response: EnhancedApiResponse<T>): void;
  logError(error: ApiErrorResponse): void;
}

// Mock API response generator
export type MockApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: AuthErrorDetails;
  delay?: number;
};

export type MockApiGenerator<TRequest, TResponse> = (
  request: TRequest
) => MockApiResponse<TResponse> | Promise<MockApiResponse<TResponse>>;

// === EXPORT COLLECTIONS ===

export const ApiTypes = {
  // Request types
  SignInRequest,
  SignUpRequest,
  OAuthSignInRequest,
  PasswordResetRequest,
  SessionRefreshRequest,
  ProfileUpdateRequest,
  
  // Response types
  SignInResponse,
  SignUpResponse,
  OAuthSignInResponse,
  PasswordResetResponse,
  SessionRefreshResponse,
  ProfileUpdateResponse,
  
  // Utility types
  ApiErrorResponse,
  EnhancedApiResponse,
  RequestValidationResult,
} as const;

export default ApiTypes;