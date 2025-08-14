/**
 * Authentication Service
 * Core authentication logic with comprehensive error handling and retry mechanisms
 */

import { createClient } from '@/lib/supabase/client';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { 
  SignInCredentials, 
  SignUpCredentials, 
  PasswordResetRequest, 
  PasswordResetConfirmation,
  OAuthSignInOptions,
  AuthErrorDetails,
  UserProfile,
  LoadingStates,
  DeviceInfo
} from './types';
import { 
  validateSignInForm, 
  validateSignUpForm, 
  validatePasswordResetRequest, 
  validatePasswordResetConfirmation 
} from './validation';
import { createAuthError, withRetry, DEFAULT_RETRY_CONFIG } from './errors';
import { 
  incrementRateLimit, 
  checkRateLimit, 
  getClientIdentifier 
} from './rate-limiting-redis';
import { AUTH_CONFIG, SITE_CONFIG } from './config';
import { User, Session, AuthError } from '@supabase/supabase-js';

// Device detection utility
const getDeviceInfo = (): DeviceInfo => {
  if (typeof window === 'undefined') {
    return {
      userAgent: '',
      platform: 'server',
      browser: 'server',
      version: '',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    };
  }

  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;
  
  // Simple browser detection
  let browser = 'Unknown';
  let version = '';
  
  if (userAgent.includes('Chrome')) {
    browser = 'Chrome';
    version = userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || '';
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
    version = userAgent.match(/Firefox\/([0-9.]+)/)?.[1] || '';
  } else if (userAgent.includes('Safari')) {
    browser = 'Safari';
    version = userAgent.match(/Version\/([0-9.]+)/)?.[1] || '';
  } else if (userAgent.includes('Edge')) {
    browser = 'Edge';
    version = userAgent.match(/Edge\/([0-9.]+)/)?.[1] || '';
  }

  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(userAgent);
  const isDesktop = !isMobile && !isTablet;

  return {
    userAgent,
    platform,
    browser,
    version,
    isMobile,
    isTablet,
    isDesktop,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: window.navigator.language,
  };
};

// Auth service class
export class AuthService {
  private supabase = createClient();
  private loadingStates: LoadingStates = {
    signIn: false,
    signUp: false,
    signOut: false,
    passwordReset: false,
    emailVerification: false,
    profileUpdate: false,
    sessionRefresh: false,
    oauthSignIn: false,
  };

  // Get current loading state
  isLoading = (action?: keyof LoadingStates): boolean => {
    if (action) {
      return this.loadingStates[action];
    }
    return Object.values(this.loadingStates).some(loading => loading);
  };

  // Set loading state
  private setLoading = (action: keyof LoadingStates, loading: boolean): void => {
    this.loadingStates[action] = loading;
  };

  // Get client identifier for rate limiting
  private getClientId = (): string => {
    if (typeof window === 'undefined') return 'server';
    
    // Try to get a persistent client ID from localStorage
    let clientId = localStorage.getItem('client_id');
    if (!clientId) {
      clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('client_id', clientId);
    }
    return clientId;
  };

  // Enhanced sign in with comprehensive validation and rate limiting
  signIn = async (credentials: SignInCredentials): Promise<{ 
    success: boolean; 
    user?: UserProfile; 
    session?: Session;
    error?: AuthErrorDetails;
  }> => {
    this.setLoading('signIn', true);
    
    try {
      // Validate input
      const validation = validateSignInForm(credentials);
      if (!validation.isValid) {
        throw new Error(Object.values(validation.errors).flat()[0] || 'Validation failed');
      }

      // Check rate limiting
      const clientId = this.getClientId();
      const rateLimitInfo = await checkRateLimit('signIn', clientId);
      
      if (rateLimitInfo.isBlocked) {
        throw new Error(`Too many sign-in attempts. Please try again in ${Math.ceil(rateLimitInfo.remainingTime / 1000 / 60)} minutes.`);
      }

      // Attempt sign in with retry logic
      const result = await withRetry(async () => {
        const { data, error } = await this.supabase.auth.signInWithPassword({
          email: credentials.email.toLowerCase().trim(),
          password: credentials.password,
        });

        if (error) {
          // Increment rate limit on failed attempt
          await incrementRateLimit('signIn', clientId);
          throw error;
        }

        return data;
      }, DEFAULT_RETRY_CONFIG);

      // Update user metadata with device info
      if (result.user) {
        const deviceInfo = getDeviceInfo();
        await this.updateUserMetadata({
          last_login: new Date().toISOString(),
          login_count: (result.user.user_metadata.login_count || 0) + 1,
          last_device: {
            browser: deviceInfo.browser,
            platform: deviceInfo.platform,
            isMobile: deviceInfo.isMobile,
          },
        });
      }

      return {
        success: true,
        user: result.user as UserProfile,
        session: result.session,
      };

    } catch (error) {
      const authError = createAuthError(error as Error, {
        action: 'sign_in',
        email: credentials.email,
      });

      return {
        success: false,
        error: authError,
      };
    } finally {
      this.setLoading('signIn', false);
    }
  };

  // Enhanced sign up with validation and email verification
  signUp = async (credentials: SignUpCredentials): Promise<{ 
    success: boolean; 
    user?: UserProfile; 
    session?: Session;
    error?: AuthErrorDetails;
    needsVerification?: boolean;
  }> => {
    this.setLoading('signUp', true);
    
    try {
      // Validate input
      const validation = validateSignUpForm(credentials);
      if (!validation.isValid) {
        throw new Error(Object.values(validation.errors).flat()[0] || 'Validation failed');
      }

      // Check rate limiting
      const clientId = this.getClientId();
      const rateLimitInfo = await checkRateLimit('signUp', clientId);
      
      if (rateLimitInfo.isBlocked) {
        throw new Error(`Too many sign-up attempts. Please try again in ${Math.ceil(rateLimitInfo.remainingTime / 1000 / 60)} minutes.`);
      }

      // Prepare user metadata
      const deviceInfo = getDeviceInfo();
      const userMetadata: Record<string, any> = {
        full_name: credentials.fullName?.trim(),
        phone: credentials.phone?.replace(/\s+/g, ''),
        preferred_language: SITE_CONFIG.defaultLocale,
        onboarding_completed: false,
        signup_device: {
          browser: deviceInfo.browser,
          platform: deviceInfo.platform,
          isMobile: deviceInfo.isMobile,
        },
        signup_date: new Date().toISOString(),
        newsletter_subscription: credentials.subscribeNewsletter || false,
        invite_code: credentials.inviteCode,
      };

      // Attempt sign up with retry logic
      const result = await withRetry(async () => {
        const { data, error } = await this.supabase.auth.signUp({
          email: credentials.email.toLowerCase().trim(),
          password: credentials.password,
          options: {
            data: userMetadata,
            emailRedirectTo: `${SITE_CONFIG.url}/auth/callback?type=signup`,
          },
        });

        if (error) {
          // Increment rate limit on failed attempt
          await incrementRateLimit('signUp', clientId);
          throw error;
        }

        return data;
      }, DEFAULT_RETRY_CONFIG);

      const needsVerification = !result.session && result.user && !result.user.email_confirmed_at;

      return {
        success: true,
        user: result.user as UserProfile,
        session: result.session,
        needsVerification,
      };

    } catch (error) {
      const authError = createAuthError(error as Error, {
        action: 'sign_up',
        email: credentials.email,
      });

      return {
        success: false,
        error: authError,
      };
    } finally {
      this.setLoading('signUp', false);
    }
  };

  // OAuth sign in with provider-specific handling
  signInWithOAuth = async (options: OAuthSignInOptions): Promise<{ 
    success: boolean; 
    error?: AuthErrorDetails;
  }> => {
    this.setLoading('oauthSignIn', true);
    
    try {
      // Check rate limiting
      const clientId = this.getClientId();
      const rateLimitInfo = await checkRateLimit('signIn', clientId, options.provider);
      
      if (rateLimitInfo.isBlocked) {
        throw new Error(`Too many ${options.provider} sign-in attempts. Please try again later.`);
      }

      const redirectTo = options.redirectTo || AUTH_CONFIG.redirectUrls.dashboard;
      
      const { error } = await this.supabase.auth.signInWithOAuth({
        provider: options.provider,
        options: {
          redirectTo: `${SITE_CONFIG.url}/auth/callback?provider=${options.provider}&redirectTo=${encodeURIComponent(redirectTo)}`,
          scopes: options.scopes,
          queryParams: options.queryParams,
        },
      });

      if (error) {
        await incrementRateLimit('signIn', clientId, options.provider);
        throw error;
      }

      return { success: true };

    } catch (error) {
      const authError = createAuthError(error as Error, {
        action: 'oauth_sign_in',
        metadata: { provider: options.provider },
      });

      return {
        success: false,
        error: authError,
      };
    } finally {
      this.setLoading('oauthSignIn', false);
    }
  };

  // Sign out with session cleanup
  signOut = async (): Promise<{ success: boolean; error?: AuthErrorDetails }> => {
    this.setLoading('signOut', true);
    
    try {
      const { error } = await this.supabase.auth.signOut();
      
      if (error) {
        throw error;
      }

      // Clear client-side storage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.clear();
      }

      return { success: true };

    } catch (error) {
      const authError = createAuthError(error as Error, {
        action: 'sign_out',
      });

      return {
        success: false,
        error: authError,
      };
    } finally {
      this.setLoading('signOut', false);
    }
  };

  // Request password reset
  requestPasswordReset = async (request: PasswordResetRequest): Promise<{ 
    success: boolean; 
    error?: AuthErrorDetails;
  }> => {
    this.setLoading('passwordReset', true);
    
    try {
      // Validate input
      const validation = validatePasswordResetRequest(request);
      if (!validation.isValid) {
        throw new Error(Object.values(validation.errors).flat()[0] || 'Validation failed');
      }

      // Check rate limiting
      const clientId = this.getClientId();
      const rateLimitInfo = await checkRateLimit('passwordReset', clientId);
      
      if (rateLimitInfo.isBlocked) {
        throw new Error(`Too many password reset attempts. Please try again in ${Math.ceil(rateLimitInfo.remainingTime / 1000 / 60)} minutes.`);
      }

      const { error } = await this.supabase.auth.resetPasswordForEmail(
        request.email.toLowerCase().trim(),
        {
          redirectTo: `${SITE_CONFIG.url}/reset-password`,
        }
      );

      if (error) {
        await incrementRateLimit('passwordReset', clientId);
        throw error;
      }

      return { success: true };

    } catch (error) {
      const authError = createAuthError(error as Error, {
        action: 'password_reset_request',
        email: request.email,
      });

      return {
        success: false,
        error: authError,
      };
    } finally {
      this.setLoading('passwordReset', false);
    }
  };

  // Confirm password reset
  confirmPasswordReset = async (confirmation: PasswordResetConfirmation): Promise<{ 
    success: boolean; 
    error?: AuthErrorDetails;
  }> => {
    this.setLoading('passwordReset', true);
    
    try {
      // Validate input
      const validation = validatePasswordResetConfirmation(confirmation);
      if (!validation.isValid) {
        throw new Error(Object.values(validation.errors).flat()[0] || 'Validation failed');
      }

      const { error } = await this.supabase.auth.updateUser({
        password: confirmation.password,
      });

      if (error) {
        throw error;
      }

      return { success: true };

    } catch (error) {
      const authError = createAuthError(error as Error, {
        action: 'password_reset_confirm',
      });

      return {
        success: false,
        error: authError,
      };
    } finally {
      this.setLoading('passwordReset', false);
    }
  };

  // Send email verification
  sendEmailVerification = async (): Promise<{ 
    success: boolean; 
    error?: AuthErrorDetails;
  }> => {
    this.setLoading('emailVerification', true);
    
    try {
      // Check rate limiting
      const clientId = this.getClientId();
      const rateLimitInfo = await checkRateLimit('emailVerification', clientId);
      
      if (rateLimitInfo.isBlocked) {
        throw new Error(`Too many verification emails sent. Please try again in ${Math.ceil(rateLimitInfo.remainingTime / 1000 / 60)} minutes.`);
      }

      const { error } = await this.supabase.auth.resend({
        type: 'signup',
        email: '', // Will use current user's email
        options: {
          emailRedirectTo: `${SITE_CONFIG.url}/auth/callback?type=email_verification`,
        },
      });

      if (error) {
        await incrementRateLimit('emailVerification', clientId);
        throw error;
      }

      return { success: true };

    } catch (error) {
      const authError = createAuthError(error as Error, {
        action: 'email_verification',
      });

      return {
        success: false,
        error: authError,
      };
    } finally {
      this.setLoading('emailVerification', false);
    }
  };

  // Get current session
  getSession = async (): Promise<Session | null> => {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  };

  // Get current user
  getUser = async (): Promise<UserProfile | null> => {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      return user as UserProfile;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  };

  // Update user metadata
  updateUserMetadata = async (metadata: Record<string, any>): Promise<{ 
    success: boolean; 
    error?: AuthErrorDetails;
  }> => {
    this.setLoading('profileUpdate', true);
    
    try {
      const { error } = await this.supabase.auth.updateUser({
        data: metadata,
      });

      if (error) {
        throw error;
      }

      return { success: true };

    } catch (error) {
      const authError = createAuthError(error as Error, {
        action: 'profile_update',
      });

      return {
        success: false,
        error: authError,
      };
    } finally {
      this.setLoading('profileUpdate', false);
    }
  };

  // Refresh session
  refreshSession = async (): Promise<{ 
    success: boolean; 
    session?: Session;
    error?: AuthErrorDetails;
  }> => {
    this.setLoading('sessionRefresh', true);
    
    try {
      const { data, error } = await this.supabase.auth.refreshSession();

      if (error) {
        throw error;
      }

      return {
        success: true,
        session: data.session,
      };

    } catch (error) {
      const authError = createAuthError(error as Error, {
        action: 'session_refresh',
      });

      return {
        success: false,
        error: authError,
      };
    } finally {
      this.setLoading('sessionRefresh', false);
    }
  };

  // Change password
  changePassword = async (currentPassword: string, newPassword: string): Promise<{ 
    success: boolean; 
    error?: AuthErrorDetails;
  }> => {
    this.setLoading('profileUpdate', true);
    
    try {
      // First verify current password by attempting to sign in
      const user = await this.getUser();
      if (!user?.email) {
        throw new Error('User not found');
      }

      const signInResult = await this.supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInResult.error) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      const { error } = await this.supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      // Update metadata
      await this.updateUserMetadata({
        last_password_change: new Date().toISOString(),
      });

      return { success: true };

    } catch (error) {
      const authError = createAuthError(error as Error, {
        action: 'password_change',
      });

      return {
        success: false,
        error: authError,
      };
    } finally {
      this.setLoading('profileUpdate', false);
    }
  };
}

// Create singleton instance
export const authService = new AuthService();

// Export default
export default authService;