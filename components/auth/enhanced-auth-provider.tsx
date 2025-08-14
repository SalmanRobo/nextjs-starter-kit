'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { authService } from '@/lib/supabase/enhanced-auth-service'
import { sessionManager } from '@/lib/supabase/session-security'
import { securityMonitor } from '@/lib/supabase/security-monitor'
import { logAuthActivity } from '@/lib/supabase/auth-security'

/**
 * Enhanced Authentication Provider with Security Features
 * Provides secure authentication context with monitoring and session management
 */

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  sessionId: string | null
  securityLevel: 'low' | 'medium' | 'high' | 'critical'
  requiresMFA: boolean
  lastActivity: number
  activeSessions: number
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{
    success: boolean
    error?: string
    requiresAction?: string
  }>
  signUp: (email: string, password: string, fullName?: string) => Promise<{
    success: boolean
    error?: string
    requiresAction?: string
  }>
  signInWithOAuth: (provider: 'google' | 'apple', redirectTo?: string) => Promise<{
    success: boolean
    url?: string
    error?: string
  }>
  signOut: (allSessions?: boolean) => Promise<{ success: boolean; error?: string }>
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>
  refreshSession: () => Promise<{ success: boolean; error?: string }>
  getSecurityOverview: () => Promise<any>
  terminateSession: (sessionId: string) => Promise<{ success: boolean }>
  updateLastActivity: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
  enableActivityTracking?: boolean
  sessionTimeout?: number // minutes
}

export function EnhancedAuthProvider({ 
  children, 
  enableActivityTracking = true,
  sessionTimeout = 30 
}: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    sessionId: null,
    securityLevel: 'low',
    requiresMFA: false,
    lastActivity: Date.now(),
    activeSessions: 0
  })

  const supabase = createClient()

  // Update last activity
  const updateLastActivity = useCallback(() => {
    setAuthState(prev => ({ ...prev, lastActivity: Date.now() }))
  }, [])

  // Initialize authentication state
  const initializeAuth = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Error getting session:', error)
        setAuthState(prev => ({ ...prev, loading: false }))
        return
      }

      if (session?.user) {
        // Get security overview
        const securityOverview = await authService.getUserSecurityOverview(session.user.id)
        
        setAuthState(prev => ({
          ...prev,
          user: session.user,
          session,
          loading: false,
          securityLevel: securityOverview.success ? securityOverview.data.riskLevel : 'low',
          activeSessions: securityOverview.success ? securityOverview.data.activeSessions : 1
        }))

        // Start activity tracking
        if (enableActivityTracking) {
          startActivityTracking(session.user.id)
        }
      } else {
        setAuthState(prev => ({ ...prev, loading: false }))
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
      setAuthState(prev => ({ ...prev, loading: false }))
    }
  }, [supabase.auth, enableActivityTracking])

  // Start activity tracking
  const startActivityTracking = useCallback((userId: string) => {
    // Track user activity
    const activityEvents = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 
      'touchstart', 'click', 'focus', 'blur'
    ]

    const handleActivity = () => updateLastActivity()
    
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    // Periodic activity check
    const activityInterval = setInterval(() => {
      const timeSinceActivity = Date.now() - authState.lastActivity
      const timeoutMs = sessionTimeout * 60 * 1000

      if (timeSinceActivity > timeoutMs) {
        console.warn('Session timeout due to inactivity')
        handleSignOut(false)
      }
    }, 60000) // Check every minute

    // Cleanup function
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
      clearInterval(activityInterval)
    }
  }, [sessionTimeout, authState.lastActivity])

  // Enhanced sign in
  const handleSignIn = useCallback(async (
    email: string, 
    password: string, 
    rememberMe: boolean = false
  ) => {
    try {
      updateLastActivity()
      
      const result = await authService.signIn(
        { email, password, rememberMe },
        {
          userAgent: navigator.userAgent,
          deviceFingerprint: await generateDeviceFingerprint()
        }
      )

      if (result.success && result.data) {
        setAuthState(prev => ({
          ...prev,
          user: result.data.user,
          session: result.data.session,
          sessionId: result.data.sessionId,
          lastActivity: Date.now()
        }))

        // Update security level
        const securityOverview = await authService.getUserSecurityOverview(result.data.user.id)
        if (securityOverview.success) {
          setAuthState(prev => ({
            ...prev,
            securityLevel: securityOverview.data.riskLevel,
            activeSessions: securityOverview.data.activeSessions
          }))
        }

        if (enableActivityTracking) {
          startActivityTracking(result.data.user.id)
        }
      }

      return {
        success: result.success,
        error: result.error,
        requiresAction: result.requiresAction
      }
    } catch (error) {
      console.error('Sign in error:', error)
      return {
        success: false,
        error: 'Sign in failed. Please try again.'
      }
    }
  }, [enableActivityTracking, startActivityTracking, updateLastActivity])

  // Enhanced sign up
  const handleSignUp = useCallback(async (
    email: string,
    password: string,
    fullName?: string
  ) => {
    try {
      const result = await authService.signUp(
        { email, password, fullName },
        {
          userAgent: navigator.userAgent,
          deviceFingerprint: await generateDeviceFingerprint()
        }
      )

      if (result.success && result.data?.user) {
        setAuthState(prev => ({
          ...prev,
          user: result.data.user,
          session: result.data.session,
          lastActivity: Date.now()
        }))
      }

      return {
        success: result.success,
        error: result.error,
        requiresAction: result.requiresAction
      }
    } catch (error) {
      console.error('Sign up error:', error)
      return {
        success: false,
        error: 'Sign up failed. Please try again.'
      }
    }
  }, [])

  // Enhanced OAuth sign in
  const handleOAuthSignIn = useCallback(async (
    provider: 'google' | 'apple',
    redirectTo?: string
  ) => {
    try {
      const result = await authService.signInWithOAuth(
        provider,
        { redirectTo },
        {
          userAgent: navigator.userAgent,
          deviceFingerprint: await generateDeviceFingerprint()
        }
      )

      if (result.success && result.data?.url) {
        // Redirect to OAuth provider
        window.location.href = result.data.url
      }

      return {
        success: result.success,
        url: result.data?.url,
        error: result.error
      }
    } catch (error) {
      console.error('OAuth sign in error:', error)
      return {
        success: false,
        error: 'OAuth sign in failed. Please try again.'
      }
    }
  }, [])

  // Enhanced sign out
  const handleSignOut = useCallback(async (allSessions: boolean = false) => {
    try {
      const sessionId = allSessions ? undefined : authState.sessionId || undefined
      
      const result = await authService.signOut(sessionId, {
        userAgent: navigator.userAgent
      })

      if (result.success) {
        setAuthState({
          user: null,
          session: null,
          loading: false,
          sessionId: null,
          securityLevel: 'low',
          requiresMFA: false,
          lastActivity: Date.now(),
          activeSessions: 0
        })
      }

      return {
        success: result.success,
        error: result.error
      }
    } catch (error) {
      console.error('Sign out error:', error)
      return {
        success: false,
        error: 'Sign out failed. Please try again.'
      }
    }
  }, [authState.sessionId])

  // Reset password
  const handleResetPassword = useCallback(async (email: string) => {
    try {
      const result = await authService.resetPassword(
        { email },
        { userAgent: navigator.userAgent }
      )

      return {
        success: result.success,
        error: result.error
      }
    } catch (error) {
      console.error('Reset password error:', error)
      return {
        success: false,
        error: 'Password reset failed. Please try again.'
      }
    }
  }, [])

  // Refresh session
  const handleRefreshSession = useCallback(async () => {
    try {
      if (!authState.sessionId) {
        return { success: false, error: 'No active session' }
      }

      const result = await authService.validateSession(
        authState.sessionId,
        { userAgent: navigator.userAgent }
      )

      if (result.success && result.data?.refreshed) {
        setAuthState(prev => ({
          ...prev,
          sessionId: result.data.sessionId,
          lastActivity: Date.now()
        }))
      }

      return {
        success: result.success,
        error: result.error
      }
    } catch (error) {
      console.error('Refresh session error:', error)
      return {
        success: false,
        error: 'Session refresh failed.'
      }
    }
  }, [authState.sessionId])

  // Get security overview
  const getSecurityOverview = useCallback(async () => {
    if (!authState.user) return null

    try {
      const result = await authService.getUserSecurityOverview(authState.user.id)
      return result.success ? result.data : null
    } catch (error) {
      console.error('Security overview error:', error)
      return null
    }
  }, [authState.user])

  // Terminate specific session
  const terminateSession = useCallback(async (sessionId: string) => {
    try {
      const result = await sessionManager.terminateSession(
        sessionId, 
        'user_requested'
      )

      if (result.success) {
        // Update active sessions count
        const securityOverview = await getSecurityOverview()
        if (securityOverview) {
          setAuthState(prev => ({
            ...prev,
            activeSessions: securityOverview.activeSessions
          }))
        }
      }

      return { success: result.success }
    } catch (error) {
      console.error('Terminate session error:', error)
      return { success: false }
    }
  }, [getSecurityOverview])

  // Generate device fingerprint
  const generateDeviceFingerprint = useCallback(async () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx?.fillText('Device fingerprint', 10, 10)
    
    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screen: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvas: canvas.toDataURL()
    }

    return btoa(JSON.stringify(fingerprint)).substring(0, 16)
  }, [])

  // Listen to auth state changes
  useEffect(() => {
    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event)
        
        if (event === 'SIGNED_IN' && session?.user) {
          const securityOverview = await authService.getUserSecurityOverview(session.user.id)
          
          setAuthState(prev => ({
            ...prev,
            user: session.user,
            session,
            loading: false,
            securityLevel: securityOverview.success ? securityOverview.data.riskLevel : 'low',
            activeSessions: securityOverview.success ? securityOverview.data.activeSessions : 1,
            lastActivity: Date.now()
          }))

          if (enableActivityTracking) {
            startActivityTracking(session.user.id)
          }
        } else if (event === 'SIGNED_OUT') {
          setAuthState({
            user: null,
            session: null,
            loading: false,
            sessionId: null,
            securityLevel: 'low',
            requiresMFA: false,
            lastActivity: Date.now(),
            activeSessions: 0
          })
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [initializeAuth, enableActivityTracking, startActivityTracking, supabase.auth])

  const contextValue: AuthContextValue = {
    ...authState,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signInWithOAuth: handleOAuthSignIn,
    signOut: handleSignOut,
    resetPassword: handleResetPassword,
    refreshSession: handleRefreshSession,
    getSecurityOverview,
    terminateSession,
    updateLastActivity
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an EnhancedAuthProvider')
  }
  return context
}

// Security status indicator component
export function SecurityStatusIndicator() {
  const { securityLevel, activeSessions } = useAuth()

  const getStatusColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'high': return 'text-orange-600 bg-orange-100'
      case 'critical': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="flex items-center space-x-2">
      <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(securityLevel)}`}>
        Security: {securityLevel.toUpperCase()}
      </div>
      <div className="text-xs text-gray-600">
        {activeSessions} active session{activeSessions !== 1 ? 's' : ''}
      </div>
    </div>
  )
}