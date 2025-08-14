/**
 * Client-side Authentication Service
 * Handles authentication operations that run in the browser
 * Excludes server-only functionality like Redis rate limiting
 */

import { createClient } from '../supabase/client';
import { AuthError, User, Session } from '@supabase/supabase-js';
import { 
  SignUpData, 
  SignInData, 
  PasswordResetRequest, 
  PasswordResetConfirmation,
  AuthResult,
  EmailVerificationData,
  EmailVerificationState
} from './types';
import { AUTH_CONFIG, AUTH_MESSAGES, SITE_CONFIG } from './config';
import { validateEmailRealTime, validatePasswordRealTime, getPasswordStrength } from './validation';
import { logAuthActivityClient } from '../supabase/auth-security-client';

// Create Supabase client instance
const supabase = createClient();

// Client-side auth service class
class ClientAuthService {
  /**
   * Sign up new user with enhanced validation and security
   */
  async signUp(data: SignUpData): Promise<AuthResult> {
    try {
      // Client-side validation
      const emailErrors = validateEmailRealTime(data.email);
      const { errors: passwordErrors } = validatePasswordRealTime(data.password);
      
      if (emailErrors.length > 0 || passwordErrors.length > 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: emailErrors[0] || passwordErrors[0] || 'Validation failed',
            timestamp: new Date().toISOString(),
          },
        };
      }

      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            phone: data.phone,
            terms_accepted: true,
            privacy_accepted: true,
            marketing_consent: data.marketingConsent || false,
            signup_ip: 'client', // Will be set properly server-side
            signup_user_agent: navigator.userAgent,
            email_verified: false,
          },
          emailRedirectTo: `${SITE_CONFIG.appUrl}/auth/callback`,
        },
      });

      if (error) {
        // Check if this is an email delivery error but account was still created
        const isEmailDeliveryError = error.message?.includes('Error sending confirmation email') || 
                                   error.message?.includes('500') ||
                                   error.message?.includes('email');
        
        await logAuthActivityClient({
          user_id: authData?.user?.id || null,
          activity_type: isEmailDeliveryError ? 'signup_email_delivery_failed' : 'signup_failed',
          details: {
            email: data.email,
            error_code: error.message,
            error_message: error.message,
            account_created: !!authData?.user,
            is_email_error: isEmailDeliveryError,
          },
          ip_address: 'client',
          user_agent: navigator.userAgent,
        });

        // For email delivery errors, provide more specific messaging
        const mappedError = this.mapSupabaseError(error);
        if (isEmailDeliveryError) {
          mappedError.hint = 'Your account may have been created. Try signing in or contact support if you need help.';
        }

        return {
          success: false,
          error: mappedError,
        };
      }

      // Log successful signup attempt
      await logAuthActivityClient({
        user_id: authData.user?.id || null,
        activity_type: 'signup_success',
        details: {
          email: data.email,
          email_confirmed: authData.user?.email_confirmed_at ? true : false,
        },
        ip_address: 'client',
        user_agent: navigator.userAgent,
      });

      return {
        success: true,
        data: {
          user: authData.user,
          session: authData.session,
          needsEmailVerification: !authData.user?.email_confirmed_at,
        },
      };

    } catch (error) {
      console.error('Sign up error:', error);
      return {
        success: false,
        error: {
          code: 'SIGNUP_ERROR',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Sign in user with enhanced security
   */
  async signIn(data: SignInData): Promise<AuthResult> {
    try {
      // Client-side validation
      const emailErrors = validateEmailRealTime(data.email);
      
      if (emailErrors.length > 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: emailErrors[0],
            timestamp: new Date().toISOString(),
          },
        };
      }

      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
        options: {
          data: {
            login_ip: 'client',
            login_user_agent: navigator.userAgent,
          },
        },
      });

      if (error) {
        await logAuthActivityClient({
          user_id: null,
          activity_type: 'signin_failed',
          details: {
            email: data.email,
            error_code: error.message,
            error_message: error.message,
          },
          ip_address: 'client',
          user_agent: navigator.userAgent,
        });

        return {
          success: false,
          error: this.mapSupabaseError(error),
        };
      }

      // Log successful sign in
      await logAuthActivityClient({
        user_id: authData.user?.id || null,
        activity_type: 'signin_success',
        details: {
          email: data.email,
          session_id: authData.session?.access_token.substring(0, 10),
        },
        ip_address: 'client',
        user_agent: navigator.userAgent,
      });

      return {
        success: true,
        data: {
          user: authData.user,
          session: authData.session,
          needsEmailVerification: !authData.user?.email_confirmed_at,
        },
      };

    } catch (error) {
      console.error('Sign in error:', error);
      return {
        success: false,
        error: {
          code: 'SIGNIN_ERROR',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<AuthResult> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return {
          success: false,
          error: this.mapSupabaseError(error),
        };
      }

      return {
        success: true,
        data: null,
      };

    } catch (error) {
      console.error('Sign out error:', error);
      return {
        success: false,
        error: {
          code: 'SIGNOUT_ERROR',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(data: PasswordResetRequest): Promise<AuthResult> {
    try {
      // Client-side validation
      const emailErrors = validateEmailRealTime(data.email);
      
      if (emailErrors.length > 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: emailErrors[0],
            timestamp: new Date().toISOString(),
          },
        };
      }

      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${SITE_CONFIG.authUrl}/reset-password`,
      });

      if (error) {
        await logAuthActivityClient({
          user_id: null,
          activity_type: 'password_reset_failed',
          details: {
            email: data.email,
            error_code: error.message,
            error_message: error.message,
          },
          ip_address: 'client',
          user_agent: navigator.userAgent,
        });

        return {
          success: false,
          error: this.mapSupabaseError(error),
        };
      }

      // Log successful password reset request
      await logAuthActivityClient({
        user_id: null,
        activity_type: 'password_reset_requested',
        details: {
          email: data.email,
        },
        ip_address: 'client',
        user_agent: navigator.userAgent,
      });

      return {
        success: true,
        data: { message: 'Password reset email sent' },
      };

    } catch (error) {
      console.error('Password reset request error:', error);
      return {
        success: false,
        error: {
          code: 'PASSWORD_RESET_ERROR',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Confirm password reset
   */
  async confirmPasswordReset(data: PasswordResetConfirmation): Promise<AuthResult> {
    try {
      // Client-side validation
      const { errors: passwordErrors } = validatePasswordRealTime(data.password);
      
      if (passwordErrors.length > 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: passwordErrors[0],
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (data.password !== data.confirmPassword) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Passwords do not match',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Set session from tokens
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.accessToken,
        refresh_token: data.refreshToken,
      });

      if (sessionError) {
        return {
          success: false,
          error: this.mapSupabaseError(sessionError),
        };
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        await logAuthActivityClient({
          user_id: null,
          activity_type: 'password_reset_failed',
          details: {
            error_code: error.message,
            error_message: error.message,
          },
          ip_address: 'client',
          user_agent: navigator.userAgent,
        });

        return {
          success: false,
          error: this.mapSupabaseError(error),
        };
      }

      // Log successful password reset
      await logAuthActivityClient({
        user_id: null,
        activity_type: 'password_reset_success',
        details: {},
        ip_address: 'client',
        user_agent: navigator.userAgent,
      });

      return {
        success: true,
        data: { message: 'Password updated successfully' },
      };

    } catch (error) {
      console.error('Password reset confirmation error:', error);
      return {
        success: false,
        error: {
          code: 'PASSWORD_RESET_ERROR',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Get current session
   */
  async getSession(): Promise<{ session: Session | null; user: User | null }> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Get session error:', error);
        return { session: null, user: null };
      }
      
      return { session, user: session?.user || null };
    } catch (error) {
      console.error('Get session error:', error);
      return { session: null, user: null };
    }
  }

  /**
   * Refresh current session
   */
  async refreshSession(): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        return {
          success: false,
          error: this.mapSupabaseError(error),
        };
      }
      
      return {
        success: true,
        data: {
          user: data.user,
          session: data.session,
        },
      };
    } catch (error) {
      console.error('Refresh session error:', error);
      return {
        success: false,
        error: {
          code: 'REFRESH_ERROR',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Map Supabase errors to our error format
   */
  private mapSupabaseError(error: AuthError): AuthResult['error'] {
    // Map common Supabase errors to user-friendly messages
    const errorMap: Record<string, { message: string; hint?: string }> = {
      'Invalid login credentials': {
        message: 'Invalid email or password',
        hint: 'Please check your credentials and try again',
      },
      'Email not confirmed': {
        message: 'Please verify your email address',
        hint: 'Check your inbox for a verification link',
      },
      'Too many requests': {
        message: 'Too many attempts. Please try again later',
        hint: 'Wait a few minutes before attempting again',
      },
      'User already registered': {
        message: 'An account with this email already exists',
        hint: 'Try signing in or use the password reset option',
      },
      'Password should be at least 6 characters': {
        message: 'Password must be at least 6 characters',
        hint: 'Choose a stronger password with letters, numbers, and symbols',
      },
      'Error sending confirmation email': {
        message: 'Account created, but confirmation email failed to send',
        hint: 'Your account was created successfully. You can try signing in or contact support for assistance',
      },
      '500': {
        message: 'Email delivery service temporarily unavailable',
        hint: 'Your account may have been created. Please try signing in or contact support if you need assistance',
      },
      'gomail: could not send email': {
        message: 'Email delivery failed due to server issues',
        hint: 'Your account may have been created. Please try signing in or contact support',
      },
      'short response: 450': {
        message: 'Email server temporarily unavailable',
        hint: 'This is usually temporary. Your account may have been created - please try signing in',
      },
      'SMTP error 450': {
        message: 'Email delivery temporarily blocked',
        hint: 'The email server is experiencing issues. Your account may have been created successfully',
      },
    };

    // Try exact match first, then check for partial matches for complex error messages
    let mapped = errorMap[error.message];
    
    if (!mapped && error.message) {
      // Check for partial matches
      for (const [key, value] of Object.entries(errorMap)) {
        if (error.message.includes(key)) {
          mapped = value;
          break;
        }
      }
    }
    
    // Fallback to default
    if (!mapped) {
      mapped = {
        message: error.message || 'An unexpected error occurred',
      };
    }

    return {
      code: error.message?.toUpperCase().replace(/\s+/g, '_') || 'UNKNOWN_ERROR',
      message: mapped.message,
      hint: mapped.hint,
      timestamp: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const clientAuthService = new ClientAuthService();
export default clientAuthService;