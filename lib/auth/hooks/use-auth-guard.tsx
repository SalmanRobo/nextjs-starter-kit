'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { toast } from 'sonner';

interface AuthGuardOptions {
  redirectTo?: string;
  requireEmailVerification?: boolean;
  requireOnboarding?: boolean;
  allowedRoles?: string[];
  onAuthRequired?: () => void;
  onAccessDenied?: (reason: string) => void;
  silent?: boolean; // Don't show toast messages
}

interface AuthGuardReturn {
  isLoading: boolean;
  isAuthenticated: boolean;
  isAuthorized: boolean;
  user: any;
  error: string | null;
}

/**
 * Production-ready authentication guard hook
 * Provides comprehensive auth checking with role-based access control
 */
export function useAuthGuard(options: AuthGuardOptions = {}): AuthGuardReturn {
  const {
    redirectTo = '/sign-in',
    requireEmailVerification = false,
    requireOnboarding = false,
    allowedRoles = [],
    onAuthRequired,
    onAccessDenied,
    silent = false
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  const { 
    user, 
    loading, 
    isAuthenticated, 
    isEmailVerified, 
    hasCompletedOnboarding 
  } = useAuth();

  const hasCheckedRef = useRef(false);
  const redirectingRef = useRef(false);

  // Check user roles
  const hasRequiredRole = useCallback(() => {
    if (allowedRoles.length === 0) return true;
    
    // Check both user_metadata.roles and app_metadata.role for compatibility
    const userMetadataRoles = user?.user_metadata?.roles;
    const appMetadataRole = user?.app_metadata?.role;
    
    if (!userMetadataRoles && !appMetadataRole) return false;
    
    const userRoles = userMetadataRoles 
      ? (Array.isArray(userMetadataRoles) ? userMetadataRoles : [userMetadataRoles])
      : appMetadataRole 
      ? [appMetadataRole]
      : [];
    
    return allowedRoles.some(role => userRoles.includes(role));
  }, [user, allowedRoles]);

  // Handle authentication redirect
  const handleAuthRedirect = useCallback((reason: string) => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;

    if (onAuthRequired) {
      onAuthRequired();
      return;
    }

    const currentPath = pathname;
    const searchParams = new URLSearchParams();
    
    if (currentPath !== '/') {
      searchParams.set('redirectTo', currentPath);
    }
    
    if (reason && !silent) {
      searchParams.set('reason', reason);
    }

    const redirectUrl = `${redirectTo}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    
    if (!silent) {
      toast.error(getErrorMessage(reason));
    }

    router.push(redirectUrl);
  }, [redirectTo, pathname, onAuthRequired, silent, router]);

  // Handle access denied
  const handleAccessDenied = useCallback((reason: string) => {
    if (onAccessDenied) {
      onAccessDenied(reason);
      return;
    }

    if (!silent) {
      toast.error(getErrorMessage(reason));
    }

    // Redirect to appropriate page based on the issue
    switch (reason) {
      case 'email_not_verified':
        router.push('/auth/verify-email');
        break;
      case 'onboarding_incomplete':
        router.push('/onboarding');
        break;
      case 'insufficient_role':
        router.push('/dashboard?error=access_denied');
        break;
      default:
        router.push('/dashboard');
    }
  }, [onAccessDenied, silent, router]);

  // Main auth check effect
  useEffect(() => {
    // Skip if still loading or already checked
    if (loading || hasCheckedRef.current) return;

    // Mark as checked to prevent loops
    hasCheckedRef.current = true;

    // Check authentication
    if (!isAuthenticated) {
      handleAuthRedirect('not_authenticated');
      return;
    }

    // Check email verification
    if (requireEmailVerification && !isEmailVerified) {
      handleAccessDenied('email_not_verified');
      return;
    }

    // Check onboarding completion
    if (requireOnboarding && !hasCompletedOnboarding) {
      handleAccessDenied('onboarding_incomplete');
      return;
    }

    // Check role-based access
    if (!hasRequiredRole()) {
      handleAccessDenied('insufficient_role');
      return;
    }

    // Reset redirect flag if all checks pass
    redirectingRef.current = false;
  }, [
    loading,
    isAuthenticated,
    isEmailVerified,
    hasCompletedOnboarding,
    requireEmailVerification,
    requireOnboarding,
    hasRequiredRole,
    handleAuthRedirect,
    handleAccessDenied
  ]);

  // Reset check flag when auth state changes
  useEffect(() => {
    hasCheckedRef.current = false;
  }, [isAuthenticated, user]);

  // Determine current auth status
  const getAuthStatus = (): AuthGuardReturn => {
    if (loading) {
      return {
        isLoading: true,
        isAuthenticated: false,
        isAuthorized: false,
        user: null,
        error: null
      };
    }

    if (!isAuthenticated) {
      return {
        isLoading: false,
        isAuthenticated: false,
        isAuthorized: false,
        user: null,
        error: 'not_authenticated'
      };
    }

    if (requireEmailVerification && !isEmailVerified) {
      return {
        isLoading: false,
        isAuthenticated: true,
        isAuthorized: false,
        user,
        error: 'email_not_verified'
      };
    }

    if (requireOnboarding && !hasCompletedOnboarding) {
      return {
        isLoading: false,
        isAuthenticated: true,
        isAuthorized: false,
        user,
        error: 'onboarding_incomplete'
      };
    }

    if (!hasRequiredRole()) {
      return {
        isLoading: false,
        isAuthenticated: true,
        isAuthorized: false,
        user,
        error: 'insufficient_role'
      };
    }

    return {
      isLoading: false,
      isAuthenticated: true,
      isAuthorized: true,
      user,
      error: null
    };
  };

  return getAuthStatus();
}

/**
 * Get user-friendly error messages
 */
function getErrorMessage(reason: string): string {
  const messages: Record<string, string> = {
    not_authenticated: 'Please sign in to access this page',
    email_not_verified: 'Please verify your email address to continue',
    onboarding_incomplete: 'Please complete your profile setup',
    insufficient_role: 'You do not have permission to access this page'
  };

  return messages[reason] || 'Access denied';
}

/**
 * Higher-order component for route protection
 */
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>,
  options: AuthGuardOptions = {}
) {
  const WrappedComponent = (props: P) => {
    const authStatus = useAuthGuard(options);

    // Show loading state
    if (authStatus.isLoading) {
      return <div>Loading...</div>; // You can customize this
    }

    // Show error state
    if (!authStatus.isAuthorized) {
      return null; // Component handles redirect
    }

    return <Component {...props} />;
  };

  WrappedComponent.displayName = `withAuthGuard(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

/**
 * Role-based access control hook
 */
export function useRoleGuard(allowedRoles: string[]) {
  const { user } = useAuth();

  const hasRole = useCallback((role: string) => {
    // Check both user_metadata.roles and app_metadata.role for compatibility
    const userMetadataRoles = user?.user_metadata?.roles;
    const appMetadataRole = user?.app_metadata?.role;
    
    if (!userMetadataRoles && !appMetadataRole) return false;
    
    const userRoles = userMetadataRoles 
      ? (Array.isArray(userMetadataRoles) ? userMetadataRoles : [userMetadataRoles])
      : appMetadataRole 
      ? [appMetadataRole]
      : [];
    
    return userRoles.includes(role);
  }, [user]);

  const hasAnyRole = useCallback((roles: string[]) => {
    return roles.some(role => hasRole(role));
  }, [hasRole]);

  const hasAllRoles = useCallback((roles: string[]) => {
    return roles.every(role => hasRole(role));
  }, [hasRole]);

  const isAuthorized = hasAnyRole(allowedRoles);

  return {
    hasRole,
    hasAnyRole,
    hasAllRoles,
    isAuthorized,
    userRoles: user?.user_metadata?.roles || []
  };
}