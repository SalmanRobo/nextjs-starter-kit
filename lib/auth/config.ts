/**
 * Authentication Configuration
 * Centralized configuration for the auth system
 */

import { AuthConfig, OAuthProvider } from './types';

// Environment variables with defaults
const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  
  // During build time, provide fallback values for critical Supabase env vars
  const isBuildTime = process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === undefined;
  if (isBuildTime && (key === 'NEXT_PUBLIC_SUPABASE_URL' || key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' || key === 'SUPABASE_SERVICE_ROLE_KEY')) {
    return value || 'build-fallback-value';
  }
  
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || '';
};

// Cross-domain site configuration
export const SITE_CONFIG = {
  name: getEnvVar('NEXT_PUBLIC_APP_NAME', 'ALDARI'),
  url: getEnvVar('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
  authDomain: getEnvVar('NEXT_PUBLIC_AUTH_DOMAIN', 'auth.aldari.app'),
  appDomain: getEnvVar('NEXT_PUBLIC_APP_DOMAIN', 'home.aldari.app'),
  cookieDomain: '.aldari.app', // Allows cross-domain cookies
  description: "Saudi Arabia's premier property platform",
  supportEmail: getEnvVar('NEXT_PUBLIC_SUPPORT_EMAIL', 'support@aldari.app'),
  defaultLocale: getEnvVar('NEXT_PUBLIC_DEFAULT_LOCALE', 'en') as 'en' | 'ar',
  supportedLocales: getEnvVar('NEXT_PUBLIC_SUPPORTED_LOCALES', 'en,ar').split(',') as ('en' | 'ar')[],
};

// Supabase configuration
export const SUPABASE_CONFIG = {
  url: getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
  anonKey: getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  serviceRoleKey: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
};

// OAuth providers configuration
export const OAUTH_PROVIDERS: Record<OAuthProvider, { enabled: boolean; scopes?: string; }> = {
  google: {
    enabled: Boolean(process.env.GOOGLE_CLIENT_ID),
    scopes: 'email profile',
  },
  github: {
    enabled: Boolean(process.env.GITHUB_CLIENT_ID),
    scopes: 'user:email',
  },
  apple: {
    enabled: Boolean(process.env.APPLE_CLIENT_ID),
    scopes: 'email name',
  },
  facebook: {
    enabled: Boolean(process.env.FACEBOOK_CLIENT_ID),
    scopes: 'email public_profile',
  },
  twitter: {
    enabled: Boolean(process.env.TWITTER_CLIENT_ID),
    scopes: 'tweet.read users.read',
  },
};

// Main auth configuration
export const AUTH_CONFIG: AuthConfig = {
  // URLs
  siteUrl: SITE_CONFIG.url,
  redirectUrls: {
    signIn: '/sign-in',
    signUp: '/sign-up',
    dashboard: '/dashboard',
    error: '/auth/error',
  },
  
  // Features
  features: {
    emailVerification: true,
    passwordRecovery: true,
    oauthProviders: Object.entries(OAUTH_PROVIDERS)
      .filter(([_, config]) => config.enabled)
      .map(([provider]) => provider as OAuthProvider),
    twoFactor: false, // Will be enabled in future updates
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    maxConcurrentSessions: 5,
  },
  
  // Security settings
  security: {
    passwordMinLength: 8,
    passwordRequireSpecialChar: true,
    passwordRequireNumber: true,
    passwordRequireUppercase: true,
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    sessionCookieSecure: process.env.NODE_ENV === 'production',
    sessionCookieSameSite: 'lax',
  },
  
  // Rate limiting configuration
  rateLimiting: {
    signIn: { requests: 5, window: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
    signUp: { requests: 3, window: 60 * 60 * 1000 }, // 3 attempts per hour
    passwordReset: { requests: 3, window: 60 * 60 * 1000 }, // 3 attempts per hour
    emailVerification: { requests: 5, window: 60 * 60 * 1000 }, // 5 attempts per hour
  },
};

// Error messages
export const AUTH_ERRORS = {
  // Generic errors
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  RATE_LIMITED: 'Too many attempts. Please try again later.',
  
  // Authentication errors
  INVALID_CREDENTIALS: 'Invalid email or password. Please check your credentials and try again.',
  USER_NOT_FOUND: 'No account found with this email address.',
  ACCOUNT_LOCKED: 'Account temporarily locked due to multiple failed attempts.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  
  // Registration errors
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists.',
  WEAK_PASSWORD: 'Password is too weak. Please choose a stronger password.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  TERMS_NOT_ACCEPTED: 'You must accept the terms of service to continue.',
  
  // Email verification
  EMAIL_NOT_VERIFIED: 'Please verify your email address to continue.',
  VERIFICATION_EXPIRED: 'Email verification link has expired. Please request a new one.',
  VERIFICATION_FAILED: 'Email verification failed. Please try again.',
  
  // Password reset
  RESET_TOKEN_EXPIRED: 'Password reset link has expired. Please request a new one.',
  RESET_TOKEN_INVALID: 'Invalid password reset link. Please request a new one.',
  PASSWORD_MISMATCH: 'Passwords do not match. Please try again.',
  
  // OAuth errors
  OAUTH_ERROR: 'Authentication failed. Please try again.',
  OAUTH_CANCELLED: 'Authentication was cancelled.',
  OAUTH_ACCESS_DENIED: 'Access denied. Please grant permission to continue.',
  
  // Server errors
  SERVER_ERROR: 'Server error. Please try again later.',
  MAINTENANCE_MODE: 'System is under maintenance. Please try again later.',
  
  // Validation errors
  REQUIRED_FIELD: 'This field is required.',
  INVALID_FORMAT: 'Invalid format. Please check your input.',
  MIN_LENGTH: (min: number) => `Must be at least ${min} characters long.`,
  MAX_LENGTH: (max: number) => `Must be no more than ${max} characters long.`,
  INVALID_PHONE: 'Please enter a valid phone number.',
  INVALID_NAME: 'Please enter a valid name.',
};

// Success messages
export const AUTH_MESSAGES = {
  SIGN_IN_SUCCESS: 'Welcome back! You have been signed in successfully.',
  SIGN_UP_SUCCESS: 'Account created successfully! Please check your email for verification.',
  SIGN_OUT_SUCCESS: 'You have been signed out successfully.',
  PASSWORD_RESET_SENT: 'Password reset instructions have been sent to your email.',
  PASSWORD_RESET_SUCCESS: 'Your password has been reset successfully.',
  PASSWORD_CHANGED: 'Your password has been changed successfully.',
  EMAIL_VERIFIED: 'Your email has been verified successfully.',
  VERIFICATION_SENT: 'Verification email has been sent. Please check your inbox.',
  PROFILE_UPDATED: 'Your profile has been updated successfully.',
  OAUTH_SUCCESS: 'You have been signed in successfully.',
};

// Validation patterns
export const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  phone: /^(\+966|0)?[0-9]{9}$/, // Saudi phone number format
  name: /^[a-zA-Z\u0600-\u06FF\s]{2,50}$/, // English and Arabic names
};

// Cross-domain cookie configuration
export const COOKIE_CONFIG = {
  name: `${SITE_CONFIG.name.toLowerCase()}-auth`,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  httpOnly: true,
  maxAge: AUTH_CONFIG.features.sessionTimeout / 1000, // Convert to seconds
  path: '/',
  domain: process.env.NODE_ENV === 'production' ? SITE_CONFIG.cookieDomain : undefined,
};

// Security headers
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.supabase.co https://api.openai.com",
    "frame-src https://accounts.google.com",
  ].join('; '),
};

// Feature flags
export const FEATURE_FLAGS = {
  enableEmailVerification: AUTH_CONFIG.features.emailVerification,
  enablePasswordRecovery: AUTH_CONFIG.features.passwordRecovery,
  enableOAuth: AUTH_CONFIG.features.oauthProviders.length > 0,
  enableTwoFactor: AUTH_CONFIG.features.twoFactor,
  enableRateLimiting: true,
  enableSessionTimeout: true,
  enableSecurityHeaders: true,
  enableAnalytics: Boolean(process.env.NEXT_PUBLIC_ANALYTICS_ID),
  enableErrorReporting: Boolean(process.env.SENTRY_DSN),
};

// Development mode checks
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';
export const isTest = process.env.NODE_ENV === 'test';

// Export default configuration
export default AUTH_CONFIG;