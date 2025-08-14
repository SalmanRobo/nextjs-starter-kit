'use client';

/**
 * ALDARI Cross-Domain Authentication Provider
 * Global authentication state management for auth.aldari.app and home.aldari.app
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useRouter, useSearchParams } from 'next/navigation';
import { createCrossDomainSupabaseClient, crossDomainAuthEvents, CrossDomainCookies } from '@/lib/auth/cross-domain-sso';
import { logAuthEvent, logAuthError } from '@/lib/auth/cross-domain-monitoring';
import { toast } from 'sonner';

// Types
interface CrossDomainAuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  isAuthDomain: boolean;
  isAppDomain: boolean;
  domain: string;
}

interface CrossDomainAuthContextValue extends CrossDomainAuthState {
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  handleCrossDomainRedirect: (targetDomain: string, path?: string) => Promise<void>;
  clearError: () => void;
}

// Context
const CrossDomainAuthContext = createContext<CrossDomainAuthContextValue | undefined>(undefined);

// Provider component
interface CrossDomainAuthProviderProps {
  children: React.ReactNode;
  initialUser?: User | null;
  initialSession?: Session | null;
}

export function CrossDomainAuthProvider({ 
  children, 
  initialUser = null, 
  initialSession = null 
}: CrossDomainAuthProviderProps) {
  // State
  const [state, setState] = useState<CrossDomainAuthState>({
    user: initialUser,
    session: initialSession,
    loading: true,
    error: null,
    isAuthDomain: false,
    isAppDomain: false,
    domain: '',
  });

  // Refs
  const supabaseRef = useRef<ReturnType<typeof createCrossDomainSupabaseClient>>(null);
  const authCheckRef = useRef<boolean>(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hooks
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize domain detection
  useEffect(() => {
    const hostname = window.location.hostname;
    setState(prev => ({
      ...prev,
      domain: hostname,
      isAuthDomain: hostname === 'auth.aldari.app' || hostname === 'localhost',
      isAppDomain: hostname === 'home.aldari.app',
    }));
  }, []);

  // Initialize Supabase client
  useEffect(() => {
    if (typeof window !== 'undefined') {
      supabaseRef.current = createCrossDomainSupabaseClient(state.domain);
    }
  }, [state.domain]);

  // Handle cross-domain token on initial load
  useEffect(() => {
    const handleCrossDomainToken = async () => {
      const authToken = searchParams?.get('auth_token');
      
      if (authToken && !authCheckRef.current) {
        authCheckRef.current = true;
        
        try {
          setState(prev => ({ ...prev, loading: true, error: null }));
          
          // Validate token with backend
          const response = await fetch(`/api/auth/cross-domain/token?token=${authToken}&domain=${state.domain}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.session) {
              // Set session in Supabase client
              if (supabaseRef.current) {
                await supabaseRef.current.auth.setSession({
                  access_token: data.session.access_token,
                  refresh_token: data.session.refresh_token,
                });

                // Get user data
                const { data: { user }, error } = await supabaseRef.current.auth.getUser();
                
                if (user && !error) {
                  setState(prev => ({
                    ...prev,
                    user,
                    session: data.session,
                    loading: false,
                    error: null,
                  }));

                  // Store session in cross-domain cookies
                  CrossDomainCookies.setSecureCookie('auth-session', JSON.stringify({
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token,
                    expires_at: data.session.expires_at,
                    user_id: data.session.user_id,
                  }), {
                    maxAge: 24 * 60 * 60, // 24 hours
                  });

                  // Clean URL
                  const url = new URL(window.location.href);
                  url.searchParams.delete('auth_token');
                  url.searchParams.delete('timestamp');
                  router.replace(url.pathname + url.search);

                  // Emit sign-in event
                  crossDomainAuthEvents.emit('signin', { user, session: data.session });
                  
                  toast.success('Successfully signed in!');
                } else {
                  throw new Error('Failed to get user data');
                }
              }
            }
          } else {
            throw new Error('Invalid authentication token');
          }
        } catch (error) {
          console.error('[Cross-Domain Auth] Token validation failed:', error);
          setState(prev => ({
            ...prev,
            loading: false,
            error: 'Authentication failed. Please try signing in again.',
          }));
          
          // Redirect to sign-in on auth domain
          if (!state.isAuthDomain) {
            window.location.href = `https://auth.aldari.app/sign-in?redirectTo=${encodeURIComponent(window.location.href)}`;
          }
        }
      }
    };

    if (searchParams && state.domain) {
      handleCrossDomainToken();
    }
  }, [searchParams, state.domain, state.isAuthDomain, router]);

  // Initialize authentication state
  useEffect(() => {
    const initializeAuth = async () => {
      if (!supabaseRef.current || authCheckRef.current) return;
      
      try {
        setState(prev => ({ ...prev, loading: true }));

        // Try to restore session from cookies
        const sessionCookie = CrossDomainCookies.getCookie('auth-session');
        
        if (sessionCookie) {
          const sessionData = JSON.parse(sessionCookie);
          
          // Set session in Supabase
          await supabaseRef.current.auth.setSession({
            access_token: sessionData.access_token,
            refresh_token: sessionData.refresh_token,
          });
        }

        // Get current session
        const { data: { session } } = await supabaseRef.current.auth.getSession();
        const { data: { user } } = await supabaseRef.current.auth.getUser();

        setState(prev => ({
          ...prev,
          user,
          session,
          loading: false,
          error: null,
        }));

        // Set up auth state change listener
        const {
          data: { subscription },
        } = supabaseRef.current.auth.onAuthStateChange(async (event, session) => {
          console.log('[Cross-Domain Auth] Auth state changed:', event);
          
          setState(prev => ({
            ...prev,
            user: session?.user || null,
            session,
            loading: false,
          }));

          // Update cross-domain cookies
          if (session) {
            CrossDomainCookies.setSecureCookie('auth-session', JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              expires_at: session.expires_at,
              user_id: session.user.id,
            }), {
              maxAge: 24 * 60 * 60, // 24 hours
            });
          } else {
            CrossDomainCookies.removeCookie('auth-session');
          }

          // Emit events
          if (event === 'SIGNED_IN') {
            crossDomainAuthEvents.emit('signin', { user: session?.user, session });
          } else if (event === 'SIGNED_OUT') {
            crossDomainAuthEvents.emit('signout', {});
          } else if (event === 'TOKEN_REFRESHED') {
            crossDomainAuthEvents.emit('token_refresh', { session });
          }
        });

        return () => subscription.unsubscribe();
        
      } catch (error) {
        console.error('[Cross-Domain Auth] Initialization failed:', error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to initialize authentication',
        }));
      }
    };

    if (supabaseRef.current && state.domain) {
      initializeAuth();
    }
  }, [supabaseRef.current, state.domain]);

  // Set up automatic token refresh
  useEffect(() => {
    if (state.session?.expires_at) {
      const expiresAt = new Date(state.session.expires_at * 1000);
      const refreshAt = new Date(expiresAt.getTime() - 5 * 60 * 1000); // 5 minutes before expiry
      const msUntilRefresh = refreshAt.getTime() - Date.now();

      if (msUntilRefresh > 0) {
        refreshTimeoutRef.current = setTimeout(() => {
          refreshSession();
        }, msUntilRefresh);
      }
    }

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [state.session?.expires_at]);

  // Methods
  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabaseRef.current) {
      return { success: false, error: 'Authentication service not available' };
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const { data, error } = await supabaseRef.current.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Log successful sign-in
      logAuthEvent({
        type: 'signin',
        userId: data.user?.id,
        sessionId: data.session?.access_token?.substring(0, 8),
        domain: state.domain,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
        metadata: {
          email: email,
          loginMethod: 'password',
        }
      });

      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || 'Sign in failed';
      
      // Log authentication error
      logAuthError(error, {
        type: 'error',
        domain: state.domain,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
        metadata: {
          operation: 'signIn',
          email: email,
          loginMethod: 'password',
        }
      });

      setState(prev => ({ ...prev, error: errorMessage, loading: false }));
      return { success: false, error: errorMessage };
    }
  }, [state.domain]);

  const signUp = useCallback(async (email: string, password: string, metadata?: any) => {
    if (!supabaseRef.current) {
      return { success: false, error: 'Authentication service not available' };
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const { data, error } = await supabaseRef.current.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || 'Sign up failed';
      setState(prev => ({ ...prev, error: errorMessage, loading: false }));
      return { success: false, error: errorMessage };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabaseRef.current) return;

    const userId = state.user?.id;

    try {
      setState(prev => ({ ...prev, loading: true }));

      // Sign out from Supabase
      await supabaseRef.current.auth.signOut();

      // Clear cross-domain cookies
      CrossDomainCookies.removeCookie('auth-session');

      // Revoke cross-domain tokens
      try {
        await fetch('/api/auth/cross-domain/token', {
          method: 'DELETE',
        });
      } catch (error) {
        console.error('[Cross-Domain Auth] Token revocation failed:', error);
      }

      // Log successful sign-out
      logAuthEvent({
        type: 'signout',
        userId: userId,
        domain: state.domain,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
        metadata: {
          signoutMethod: 'manual',
        }
      });

      // Emit signout event
      crossDomainAuthEvents.emit('signout', {});

      setState(prev => ({
        ...prev,
        user: null,
        session: null,
        loading: false,
        error: null,
      }));

      toast.success('Successfully signed out');
    } catch (error: any) {
      console.error('[Cross-Domain Auth] Sign out failed:', error);
      
      // Log signout error
      logAuthError(error, {
        type: 'error',
        userId: userId,
        domain: state.domain,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
        metadata: {
          operation: 'signOut',
        }
      });

      setState(prev => ({ ...prev, error: error.message, loading: false }));
    }
  }, [state.user?.id, state.domain]);

  const refreshSession = useCallback(async () => {
    if (!supabaseRef.current) return;

    try {
      const { data, error } = await supabaseRef.current.auth.refreshSession();
      
      if (error) throw error;

      setState(prev => ({
        ...prev,
        session: data.session,
        user: data.user,
      }));

    } catch (error: any) {
      console.error('[Cross-Domain Auth] Session refresh failed:', error);
      setState(prev => ({ ...prev, error: error.message }));
    }
  }, []);

  const handleCrossDomainRedirect = useCallback(async (targetDomain: string, path = '/dashboard') => {
    if (!state.session || !supabaseRef.current) {
      throw new Error('No active session');
    }

    try {
      // Generate CSRF token
      const csrfResponse = await fetch('/api/auth/cross-domain/csrf');
      const csrfData = await csrfResponse.json();

      if (!csrfData.success) {
        throw new Error('Failed to get CSRF token');
      }

      // Generate cross-domain token
      const tokenResponse = await fetch('/api/auth/cross-domain/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          redirectUrl: `https://${targetDomain}${path}`,
          csrfToken: csrfData.csrfToken,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenData.success) {
        throw new Error(tokenData.error || 'Failed to generate cross-domain token');
      }

      // Redirect to target domain with token
      const redirectUrl = new URL(path, `https://${targetDomain}`);
      redirectUrl.searchParams.set('auth_token', tokenData.token);
      redirectUrl.searchParams.set('timestamp', Date.now().toString());

      window.location.href = redirectUrl.toString();

    } catch (error: any) {
      console.error('[Cross-Domain Auth] Redirect failed:', error);
      throw error;
    }
  }, [state.session]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Context value
  const contextValue: CrossDomainAuthContextValue = {
    ...state,
    signIn,
    signUp,
    signOut,
    refreshSession,
    handleCrossDomainRedirect,
    clearError,
  };

  return (
    <CrossDomainAuthContext.Provider value={contextValue}>
      {children}
    </CrossDomainAuthContext.Provider>
  );
}

// Hook to use the auth context
export function useCrossDomainAuth() {
  const context = useContext(CrossDomainAuthContext);
  
  if (context === undefined) {
    throw new Error('useCrossDomainAuth must be used within a CrossDomainAuthProvider');
  }
  
  return context;
}

// Hook for auth guards
export function useAuthGuard(redirectTo?: string) {
  const { user, loading, isAuthDomain } = useCrossDomainAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      if (isAuthDomain) {
        router.push(redirectTo || '/sign-in');
      } else {
        // Redirect to auth domain
        const authUrl = new URL('/sign-in', 'https://auth.aldari.app');
        authUrl.searchParams.set('redirectTo', encodeURIComponent(window.location.href));
        window.location.href = authUrl.toString();
      }
    }
  }, [user, loading, isAuthDomain, router, redirectTo]);

  return { user, loading };
}

// Hook for guest guards (redirect authenticated users)
export function useGuestGuard(redirectTo?: string) {
  const { user, loading, isAuthDomain, handleCrossDomainRedirect } = useCrossDomainAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (isAuthDomain && redirectTo) {
        // Extract domain from redirectTo URL
        try {
          const url = new URL(redirectTo);
          const targetDomain = url.hostname;
          const path = url.pathname + url.search;
          
          if (targetDomain !== window.location.hostname) {
            handleCrossDomainRedirect(targetDomain, path);
          } else {
            router.push(redirectTo);
          }
        } catch {
          router.push(redirectTo);
        }
      } else {
        router.push(redirectTo || '/dashboard');
      }
    }
  }, [user, loading, isAuthDomain, router, redirectTo, handleCrossDomainRedirect]);

  return { user, loading };
}