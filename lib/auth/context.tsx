/**
 * Authentication Context and Provider
 * Provides authentication state and methods throughout the app
 */

'use client';

import React, { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  useCallback, 
  useMemo,
  useRef,
  startTransition
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { 
  AuthContextType, 
  AuthState, 
  UserProfile, 
  SignInCredentials, 
  SignUpCredentials, 
  PasswordResetRequest, 
  PasswordResetConfirmation,
  OAuthSignInOptions,
  AuthErrorDetails,
  AuthEvent,
  AuthEventType,
  EmailVerificationState
} from './types';
import { authService } from './service';
import { AUTH_CONFIG, AUTH_MESSAGES } from './config';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';

// Create auth context
const AuthContext = createContext<AuthContextType | null>(null);

// Auth provider props
interface AuthProviderProps {
  children: React.ReactNode;
}

// Auth provider component
export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const initializingRef = useRef(false);
  const mountedRef = useRef(true);

  // Auth state with optimized initial state
  const [state, setState] = useState<AuthState>(() => ({
    user: null,
    session: null,
    loading: true,
    error: null,
    isAuthenticated: false,
    isEmailVerified: false,
    hasCompletedOnboarding: false,
  }));

  // Email verification state
  const [emailVerificationState, setEmailVerificationState] = useState<EmailVerificationState>({
    isVerified: false,
    verificationSent: false,
    canResend: true,
    resendCooldown: 0,
  });

  // Auth event listeners
  const [authEventListeners, setAuthEventListeners] = useState<Set<(event: AuthEvent) => void>>(new Set());

  // Emit auth event
  const emitAuthEvent = useCallback((type: AuthEventType, data?: any) => {
    const event: AuthEvent = {
      type,
      session: state.session,
      user: state.user,
      timestamp: new Date().toISOString(),
      metadata: data,
    };

    authEventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Auth event listener error:', error);
      }
    });
  }, [state.session, state.user, authEventListeners]);

  // Subscribe to auth event
  const subscribeToAuthEvents = useCallback((listener: (event: AuthEvent) => void) => {
    setAuthEventListeners(prev => new Set([...prev, listener]));
    
    return () => {
      setAuthEventListeners(prev => {
        const newSet = new Set(prev);
        newSet.delete(listener);
        return newSet;
      });
    };
  }, []);

  // Optimized state updates to prevent unnecessary re-renders
  const updateAuthState = useCallback((updates: Partial<AuthState>) => {
    if (!mountedRef.current) return;
    
    startTransition(() => {
      setState(prev => {
        // Shallow comparison to prevent unnecessary updates
        const hasChanges = Object.keys(updates).some(key => {
          const typedKey = key as keyof AuthState;
          return prev[typedKey] !== updates[typedKey];
        });
        
        if (!hasChanges) return prev;
        
        const newState = { ...prev, ...updates };
        
        // Update derived states efficiently
        newState.isAuthenticated = Boolean(newState.user && newState.session);
        newState.isEmailVerified = Boolean(newState.user?.email_confirmed_at);
        newState.hasCompletedOnboarding = Boolean(newState.user?.user_metadata?.onboarding_completed);
        
        return newState;
      });
    });
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    updateAuthState({ error: null });
  }, [updateAuthState]);

  // Handle auth state change
  const handleAuthStateChange = useCallback(async (event: AuthChangeEvent, session: Session | null) => {
    try {
      updateAuthState({ loading: true });

      if (session?.user) {
        const user = session.user as UserProfile;
        updateAuthState({
          user,
          session,
          loading: false,
          error: null,
        });

        // Update email verification state
        setEmailVerificationState(prev => ({
          ...prev,
          isVerified: Boolean(user.email_confirmed_at),
        }));

        // Emit appropriate event
        switch (event) {
          case 'SIGNED_IN':
            emitAuthEvent('SIGNED_IN', { provider: user.app_metadata?.provider });
            break;
          case 'TOKEN_REFRESHED':
            emitAuthEvent('TOKEN_REFRESHED');
            break;
          default:
            break;
        }
      } else {
        updateAuthState({
          user: null,
          session: null,
          loading: false,
          error: null,
        });

        setEmailVerificationState({
          isVerified: false,
          verificationSent: false,
          canResend: true,
          resendCooldown: 0,
        });

        if (event === 'SIGNED_OUT') {
          emitAuthEvent('SIGNED_OUT');
        }
      }
    } catch (error) {
      console.error('Auth state change error:', error);
      updateAuthState({
        loading: false,
        error: {
          code: 'auth_state_error',
          message: 'Failed to update authentication state',
          timestamp: new Date().toISOString(),
          details: undefined,
          hint: undefined,
          requestId: undefined,
        } as AuthErrorDetails,
      });
    }
  }, [updateAuthState, emitAuthEvent]);

  // Optimized auth initialization with better error handling
  useEffect(() => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    let subscription: any;

    const initializeAuth = async () => {
      try {
        // Get initial session with timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Session timeout')), 10000)
        );
        
        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]);
        
        if (error) {
          console.error('Error getting initial session:', error);
          throw error;
        }

        if (mountedRef.current) {
          await handleAuthStateChange('SIGNED_IN', session);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mountedRef.current) {
          updateAuthState({
            loading: false,
            error: {
              code: 'auth_init_error',
              message: 'Failed to initialize authentication',
              timestamp: new Date().toISOString(),
              details: error instanceof Error ? error.message : 'Unknown error',
              hint: undefined,
              requestId: undefined,
            } as AuthErrorDetails,
          });
        }
      }
    };

    // Start initialization
    initializeAuth();

    // Subscribe to auth changes with error handling
    try {
      const { data } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
        if (mountedRef.current) {
          handleAuthStateChange(event as AuthChangeEvent, session).catch(error => {
            console.error('Auth state change error:', error);
          });
        }
      });
      subscription = data.subscription;
    } catch (error) {
      console.error('Auth subscription error:', error);
    }

    return () => {
      mountedRef.current = false;
      initializingRef.current = false;
      try {
        subscription?.unsubscribe?.();
      } catch (error) {
        console.error('Error unsubscribing from auth:', error);
      }
    };
  }, [supabase.auth, handleAuthStateChange, updateAuthState]);

  // Sign in
  const signIn = useCallback(async (credentials: SignInCredentials) => {
    clearError();
    
    const result = await authService.signIn(credentials);
    
    if (result.success) {
      toast.success(AUTH_MESSAGES.SIGN_IN_SUCCESS);
      
      // Navigate to intended destination
      const returnTo = new URLSearchParams(window.location.search).get('redirectTo') || AUTH_CONFIG.redirectUrls.dashboard;
      router.push(returnTo);
    } else if (result.error) {
      updateAuthState({ error: result.error });
      toast.error(result.error.message);
    }
    
    return result;
  }, [clearError, updateAuthState, router]);

  // Sign up
  const signUp = useCallback(async (credentials: SignUpCredentials) => {
    clearError();
    
    const result = await authService.signUp(credentials);
    
    if (result.success) {
      if (result.needsVerification) {
        toast.success(AUTH_MESSAGES.SIGN_UP_SUCCESS);
        setEmailVerificationState(prev => ({
          ...prev,
          verificationSent: true,
          canResend: false,
          resendCooldown: 60, // 60 seconds cooldown
        }));
        
        // Start cooldown timer
        const cooldownTimer = setInterval(() => {
          setEmailVerificationState(prev => {
            if (prev.resendCooldown <= 1) {
              clearInterval(cooldownTimer);
              return { ...prev, resendCooldown: 0, canResend: true };
            }
            return { ...prev, resendCooldown: prev.resendCooldown - 1 };
          });
        }, 1000);
        
        router.push('/auth/verify-email');
      } else {
        toast.success(AUTH_MESSAGES.SIGN_IN_SUCCESS);
        router.push(AUTH_CONFIG.redirectUrls.dashboard);
      }
      
      emitAuthEvent('SIGNED_UP', { needsVerification: result.needsVerification });
    } else if (result.error) {
      updateAuthState({ error: result.error });
      toast.error(result.error.message);
    }
    
    return result;
  }, [clearError, updateAuthState, router, emitAuthEvent]);

  // Sign out
  const signOut = useCallback(async () => {
    clearError();
    
    const result = await authService.signOut();
    
    if (result.success) {
      toast.success(AUTH_MESSAGES.SIGN_OUT_SUCCESS);
      router.push('/');
    } else if (result.error) {
      updateAuthState({ error: result.error });
      toast.error(result.error.message);
    }
    
    // Return void for compatibility with AuthContextType
    return;
  }, [clearError, updateAuthState, router]);

  // OAuth sign in
  const signInWithOAuth = useCallback(async (options: OAuthSignInOptions) => {
    clearError();
    
    const result = await authService.signInWithOAuth(options);
    
    if (!result.success && result.error) {
      updateAuthState({ error: result.error });
      toast.error(result.error.message);
    }
    
    return result;
  }, [clearError, updateAuthState]);

  // Request password reset
  const requestPasswordReset = useCallback(async (request: PasswordResetRequest) => {
    clearError();
    
    const result = await authService.requestPasswordReset(request);
    
    if (result.success) {
      toast.success(AUTH_MESSAGES.PASSWORD_RESET_SENT);
      emitAuthEvent('PASSWORD_RECOVERY', { email: request.email });
    } else if (result.error) {
      updateAuthState({ error: result.error });
      toast.error(result.error.message);
    }
    
    return result;
  }, [clearError, updateAuthState, emitAuthEvent]);

  // Confirm password reset
  const confirmPasswordReset = useCallback(async (confirmation: PasswordResetConfirmation) => {
    clearError();
    
    const result = await authService.confirmPasswordReset(confirmation);
    
    if (result.success) {
      toast.success(AUTH_MESSAGES.PASSWORD_RESET_SUCCESS);
      router.push(AUTH_CONFIG.redirectUrls.signIn);
    } else if (result.error) {
      updateAuthState({ error: result.error });
      toast.error(result.error.message);
    }
    
    return result;
  }, [clearError, updateAuthState, router]);

  // Change password
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    clearError();
    
    const result = await authService.changePassword(currentPassword, newPassword);
    
    if (result.success) {
      toast.success(AUTH_MESSAGES.PASSWORD_CHANGED);
      emitAuthEvent('PASSWORD_CHANGED');
    } else if (result.error) {
      updateAuthState({ error: result.error });
      toast.error(result.error.message);
    }
    
    return result;
  }, [clearError, updateAuthState, emitAuthEvent]);

  // Send email verification
  const sendEmailVerification = useCallback(async () => {
    clearError();
    
    if (!emailVerificationState.canResend) {
      toast.error(`Please wait ${emailVerificationState.resendCooldown} seconds before resending.`);
      return { success: false, error: { code: 'cooldown_active', message: 'Please wait before resending.' } as AuthErrorDetails };
    }
    
    const result = await authService.sendEmailVerification();
    
    if (result.success) {
      toast.success(AUTH_MESSAGES.VERIFICATION_SENT);
      
      setEmailVerificationState(prev => ({
        ...prev,
        verificationSent: true,
        canResend: false,
        resendCooldown: 60,
        lastSentAt: new Date().toISOString(),
      }));
      
      // Start cooldown timer
      const cooldownTimer = setInterval(() => {
        setEmailVerificationState(prev => {
          if (prev.resendCooldown <= 1) {
            clearInterval(cooldownTimer);
            return { ...prev, resendCooldown: 0, canResend: true };
          }
          return { ...prev, resendCooldown: prev.resendCooldown - 1 };
        });
      }, 1000);
    } else if (result.error) {
      updateAuthState({ error: result.error });
      toast.error(result.error.message);
    }
    
    return result;
  }, [clearError, updateAuthState, emailVerificationState.canResend, emailVerificationState.resendCooldown]);

  // Verify email
  const verifyEmail = useCallback(async (token: string) => {
    clearError();
    
    try {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email',
      });

      if (error) {
        throw error;
      }

      toast.success(AUTH_MESSAGES.EMAIL_VERIFIED);
      setEmailVerificationState(prev => ({ ...prev, isVerified: true }));
      
      // Refresh user data
      await refreshUser();
      
      return { success: true };
    } catch (error) {
      const authError = {
        code: 'email_verification_failed',
        message: 'Email verification failed. Please try again.',
        timestamp: new Date().toISOString(),
        details: undefined,
        hint: undefined,
        requestId: undefined,
      } as AuthErrorDetails;
      
      updateAuthState({ error: authError });
      toast.error(authError.message);
      
      return { success: false, error: authError };
    }
  }, [clearError, updateAuthState, supabase.auth]);

  // Update profile
  const updateProfile = useCallback(async (updates: Partial<UserProfile['user_metadata']>) => {
    clearError();
    
    const result = await authService.updateUserMetadata(updates);
    
    if (result.success) {
      toast.success(AUTH_MESSAGES.PROFILE_UPDATED);
      
      // Refresh user data
      await refreshUser();
      
      emitAuthEvent('USER_UPDATED', { updates });
    } else if (result.error) {
      updateAuthState({ error: result.error });
      toast.error(result.error.message);
    }
    
    return result;
  }, [clearError, updateAuthState, emitAuthEvent]);

  // Refresh user
  const refreshUser = useCallback(async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        throw error;
      }
      
      if (user) {
        updateAuthState({ user: user as UserProfile });
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  }, [supabase.auth, updateAuthState]);

  // Refresh session
  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        throw error;
      }
      
      if (data.session) {
        updateAuthState({ session: data.session });
        emitAuthEvent('TOKEN_REFRESHED');
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
    }
  }, [supabase.auth, updateAuthState, emitAuthEvent]);

  // Get session
  const getSession = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }, [supabase.auth]);

  // Check if action is loading
  const isLoading = useCallback((action?: string) => {
    if (action) {
      return authService.isLoading(action as any);
    }
    return state.loading || authService.isLoading();
  }, [state.loading]);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue: AuthContextType = useMemo(() => ({
    // State
    ...state,
    
    // Auth methods
    signIn,
    signUp,
    signOut,
    signInWithOAuth,
    
    // Password management
    requestPasswordReset,
    confirmPasswordReset,
    changePassword,
    
    // Email verification
    sendEmailVerification,
    verifyEmail,
    
    // Profile management
    updateProfile,
    refreshUser,
    
    // Session management
    refreshSession,
    getSession,
    
    // Utility
    clearError,
    isLoading,
  }), [
    state,
    signIn,
    signUp,
    signOut,
    signInWithOAuth,
    requestPasswordReset,
    confirmPasswordReset,
    changePassword,
    sendEmailVerification,
    verifyEmail,
    updateProfile,
    refreshUser,
    refreshSession,
    getSession,
    clearError,
    isLoading,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Performance monitoring hook for auth operations
export function useAuthPerformance() {
  const performanceRef = useRef({
    signInTime: 0,
    signUpTime: 0,
    sessionLoadTime: 0,
  });
  
  const trackPerformance = useCallback((operation: string, duration: number) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Auth Performance] ${operation}: ${duration}ms`);
    }
  }, []);
  
  return { trackPerformance };
}

// Auth hook
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

// Auth guard hook
export function useAuthGuard(options?: {
  redirectTo?: string;
  requireEmailVerification?: boolean;
  requireOnboarding?: boolean;
}) {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.loading) {
      if (!auth.isAuthenticated) {
        const redirectTo = options?.redirectTo || AUTH_CONFIG.redirectUrls.signIn;
        const currentPath = window.location.pathname;
        const searchParams = new URLSearchParams({ redirectTo: currentPath });
        router.push(`${redirectTo}?${searchParams.toString()}`);
        return;
      }

      if (options?.requireEmailVerification && !auth.isEmailVerified) {
        router.push('/auth/verify-email');
        return;
      }

      if (options?.requireOnboarding && !auth.hasCompletedOnboarding) {
        router.push('/onboarding');
        return;
      }
    }
  }, [auth.loading, auth.isAuthenticated, auth.isEmailVerified, auth.hasCompletedOnboarding, router, options]);

  return {
    isLoading: auth.loading,
    isAuthenticated: auth.isAuthenticated,
    isEmailVerified: auth.isEmailVerified,
    hasCompletedOnboarding: auth.hasCompletedOnboarding,
  };
}

// Optimized email verification hook with proper context access
export function useEmailVerification() {
  const { user, isEmailVerified } = useAuth();
  
  return useMemo(() => ({
    isVerified: isEmailVerified,
    email: user?.email,
    needsVerification: user && !isEmailVerified,
  }), [user, isEmailVerified]);
}

// Enhanced auth events hook with cleanup
export function useAuthEvents(listener: (event: AuthEvent) => void) {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;
  
  useEffect(() => {
    const stableListener = (event: AuthEvent) => {
      listenerRef.current(event);
    };
    
    // TODO: Implement actual event subscription in provider
    // For now, return cleanup function
    return () => {
      // Cleanup logic here
    };
  }, []);
}

// Performance-optimized auth components
export const MemoizedAuthProvider = React.memo(AuthProvider);

export default AuthProvider;