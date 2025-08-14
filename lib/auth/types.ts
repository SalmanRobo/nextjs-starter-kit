/**
 * Authentication Types and Interfaces
 * Production-ready type definitions for auth system
 */

import { User, Session, AuthError } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

// User role type from database
export type UserRole = Database['public']['Tables']['profiles']['Row']['role'];

// User profile extended from Supabase User with proper typing
export interface UserProfile extends User {
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
    phone?: string;
    display_name?: string;
    preferred_language?: 'en' | 'ar';
    onboarding_completed?: boolean;
    last_login?: string;
    login_count?: number;
    roles?: UserRole[];
    signup_device?: {
      browser?: string;
      platform?: string;
      isMobile?: boolean;
    };
    last_device?: {
      browser?: string;
      platform?: string;
      isMobile?: boolean;
    };
    signup_date?: string;
    newsletter_subscription?: boolean;
    invite_code?: string;
  };
  app_metadata: {
    provider?: string;
    providers?: string[];
    role?: UserRole;
    subscription_status?: 'free' | 'premium' | 'enterprise';
    verified?: boolean;
    created_via?: 'web' | 'mobile' | 'api';
  };
}

// Authentication state
export interface AuthState {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  error: AuthError | null;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  hasCompletedOnboarding: boolean;
}

// Sign in credentials
export interface SignInCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
  captchaToken?: string;
}

// Sign up credentials
export interface SignUpCredentials {
  email: string;
  password: string;
  confirmPassword: string;
  fullName?: string;
  phone?: string;
  acceptTerms: boolean;
  subscribeNewsletter?: boolean;
  captchaToken?: string;
  inviteCode?: string;
}

// Password reset request
export interface PasswordResetRequest {
  email: string;
  captchaToken?: string;
}

// Password reset confirmation
export interface PasswordResetConfirmation {
  password: string;
  confirmPassword: string;
  accessToken: string;
  refreshToken: string;
}

// OAuth providers
export type OAuthProvider = 'google' | 'github' | 'apple' | 'facebook' | 'twitter';

// OAuth options
export interface OAuthSignInOptions {
  provider: OAuthProvider;
  redirectTo?: string;
  scopes?: string;
  queryParams?: Record<string, string>;
}

// Auth error types - Compatible with Supabase AuthError
export interface AuthErrorDetails extends Omit<AuthError, 'status' | '__isAuthError' | 'name'> {
  code: string;
  message: string;
  details?: unknown;
  hint?: string;
  timestamp: string;
  requestId?: string;
  // Supabase compatibility
  status?: number;
  __isAuthError?: boolean;
  name?: string;
}

// Form validation errors - Complete interface
export interface FormErrors {
  email?: string[];
  password?: string[];
  confirmPassword?: string[];
  fullName?: string[];
  phone?: string[];
  acceptTerms?: string[];
  general?: string[];
  [key: string]: string[] | undefined;
}

// Rate limiting
export interface RateLimitInfo {
  attempts: number;
  maxAttempts: number;
  resetTime: Date;
  isBlocked: boolean;
  remainingTime: number;
}

// Session management
export interface SessionInfo {
  sessionId: string;
  userId: string;
  createdAt: string;
  lastActivity: string;
  ipAddress: string;
  userAgent: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  isActive: boolean;
  expiresAt: string;
}

// Security settings
export interface SecuritySettings {
  twoFactorEnabled: boolean;
  recoveryCodesGenerated: boolean;
  lastPasswordChange: string;
  loginNotificationsEnabled: boolean;
  suspiciousActivityAlerts: boolean;
  trustedDevices: TrustedDevice[];
}

// Trusted device
export interface TrustedDevice {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  lastUsed: string;
  ipAddress: string;
  location?: string;
  isCurrent: boolean;
}

// Email verification
export interface EmailVerificationState {
  isVerified: boolean;
  verificationSent: boolean;
  canResend: boolean;
  resendCooldown: number;
  lastSentAt?: string;
}

// Onboarding step
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  isRequired: boolean;
  order: number;
}

// Device info
export interface DeviceInfo {
  userAgent: string;
  platform: string;
  browser: string;
  version: string;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenResolution?: string;
  timezone?: string;
  language?: string;
}

// Auth context
export interface AuthContextType extends AuthState {
  // State properties inherited from AuthState
  
  // Auth actions - Consistent return types
  signIn: (credentials: SignInCredentials) => Promise<{ success: boolean; user?: UserProfile; session?: Session; error?: AuthErrorDetails }>;
  signUp: (credentials: SignUpCredentials) => Promise<{ success: boolean; user?: UserProfile; session?: Session; error?: AuthErrorDetails; needsVerification?: boolean }>;
  signOut: () => Promise<{ success: boolean; error?: AuthErrorDetails }>;
  signInWithOAuth: (options: OAuthSignInOptions) => Promise<{ success: boolean; error?: AuthErrorDetails }>;
  
  // Password management
  requestPasswordReset: (request: PasswordResetRequest) => Promise<{ success: boolean; error?: AuthErrorDetails }>;
  confirmPasswordReset: (confirmation: PasswordResetConfirmation) => Promise<{ success: boolean; error?: AuthErrorDetails }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: AuthErrorDetails }>;
  
  // Email verification
  sendEmailVerification: () => Promise<{ success: boolean; error?: AuthErrorDetails }>;
  verifyEmail: (token: string) => Promise<{ success: boolean; error?: AuthErrorDetails }>;
  
  // Profile management
  updateProfile: (updates: Partial<UserProfile['user_metadata']>) => Promise<{ success: boolean; error?: AuthErrorDetails }>;
  refreshUser: () => Promise<void>;
  
  // Session management
  refreshSession: () => Promise<void>;
  getSession: () => Promise<Session | null>;
  
  // Utility
  clearError: () => void;
  isLoading: (action?: string) => boolean;
}

// API Response types
export interface AuthApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: AuthErrorDetails;
  metadata?: {
    requestId: string;
    timestamp: string;
    duration: number;
  };
}

// Loading states
export interface LoadingStates {
  signIn: boolean;
  signUp: boolean;
  signOut: boolean;
  passwordReset: boolean;
  emailVerification: boolean;
  profileUpdate: boolean;
  sessionRefresh: boolean;
  oauthSignIn: boolean;
}

// Validation schema types
export interface ValidationResult {
  isValid: boolean;
  errors: FormErrors;
  warnings?: string[];
}

// Auth event types
export type AuthEventType = 
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'SIGNED_UP'
  | 'PASSWORD_RECOVERY'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'MFA_CHALLENGE_INITIATED'
  | 'MFA_CHALLENGE_VERIFIED'
  | 'PASSWORD_CHANGED'
  | 'EMAIL_VERIFIED';

export interface AuthEvent {
  type: AuthEventType;
  session: Session | null;
  user: UserProfile | null;
  timestamp: string;
  metadata?: Record<string, any>;
}

// Auth configuration
export interface AuthConfig {
  // URLs
  siteUrl: string;
  redirectUrls: {
    signIn: string;
    signUp: string;
    dashboard: string;
    error: string;
  };
  
  // Features
  features: {
    emailVerification: boolean;
    passwordRecovery: boolean;
    oauthProviders: OAuthProvider[];
    twoFactor: boolean;
    sessionTimeout: number;
    maxConcurrentSessions: number;
  };
  
  // Security
  security: {
    passwordMinLength: number;
    passwordRequireSpecialChar: boolean;
    passwordRequireNumber: boolean;
    passwordRequireUppercase: boolean;
    maxLoginAttempts: number;
    lockoutDuration: number;
    sessionCookieSecure: boolean;
    sessionCookieSameSite: 'strict' | 'lax' | 'none';
  };
  
  // Rate limiting
  rateLimiting: {
    signIn: { requests: number; window: number };
    signUp: { requests: number; window: number };
    passwordReset: { requests: number; window: number };
    emailVerification: { requests: number; window: number };
  };
}