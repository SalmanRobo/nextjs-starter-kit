/**
 * Authentication Diagnostics
 * Debug utilities for authentication issues
 */

export function diagnoseAuthSetup() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      nextRuntime: process.env.NEXT_RUNTIME,
      hasWindow: typeof window !== 'undefined',
    },
    supabaseConfig: {
      hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      urlLength: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
      anonKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
    },
    buildDetection: {
      isBuildTime: (
        typeof window === 'undefined' && 
        process.env.NODE_ENV === 'production' && 
        !process.env.VERCEL_ENV &&
        !process.env.NEXT_RUNTIME
      ),
      isServer: typeof window === 'undefined',
      isProduction: process.env.NODE_ENV === 'production',
      hasVercelEnv: Boolean(process.env.VERCEL_ENV),
      hasNextRuntime: Boolean(process.env.NEXT_RUNTIME),
    },
    recommendations: [] as string[],
  };

  // Generate recommendations
  if (!diagnostics.supabaseConfig.hasUrl) {
    diagnostics.recommendations.push('Set NEXT_PUBLIC_SUPABASE_URL environment variable');
  }
  
  if (!diagnostics.supabaseConfig.hasAnonKey) {
    diagnostics.recommendations.push('Set NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  }

  if (diagnostics.supabaseConfig.urlLength > 0 && diagnostics.supabaseConfig.urlLength < 20) {
    diagnostics.recommendations.push('Verify NEXT_PUBLIC_SUPABASE_URL is complete');
  }

  if (diagnostics.supabaseConfig.anonKeyLength > 0 && diagnostics.supabaseConfig.anonKeyLength < 50) {
    diagnostics.recommendations.push('Verify NEXT_PUBLIC_SUPABASE_ANON_KEY is complete');
  }

  if (diagnostics.buildDetection.isBuildTime) {
    diagnostics.recommendations.push('Using mock client during build time (this is normal)');
  }

  return diagnostics;
}

export function logAuthDiagnostics() {
  if (process.env.NODE_ENV === 'development') {
    const diagnostics = diagnoseAuthSetup();
    console.group('🔍 Auth Diagnostics');
    console.log('Environment:', diagnostics.environment);
    console.log('Supabase Config:', diagnostics.supabaseConfig);
    console.log('Build Detection:', diagnostics.buildDetection);
    if (diagnostics.recommendations.length > 0) {
      console.log('Recommendations:', diagnostics.recommendations);
    }
    console.groupEnd();
    return diagnostics;
  }
  return null;
}

export function createDebugClient() {
  const diagnostics = diagnoseAuthSetup();
  
  if (process.env.NODE_ENV === 'development') {
    console.warn('🚨 Using debug Supabase client:', diagnostics);
  }

  return {
    auth: {
      getUser: async () => {
        console.log('🔍 Debug: getUser called');
        return { data: { user: null }, error: null };
      },
      getSession: async () => {
        console.log('🔍 Debug: getSession called');
        return { data: { session: null }, error: null };
      },
      signUp: async () => {
        console.log('🔍 Debug: signUp called');
        return { data: null, error: null };
      },
      signInWithPassword: async () => {
        console.log('🔍 Debug: signInWithPassword called');
        return { data: null, error: null };
      },
      signInWithOAuth: async () => {
        console.log('🔍 Debug: signInWithOAuth called');
        return { data: null, error: null };
      },
      signOut: async () => {
        console.log('🔍 Debug: signOut called');
        return { error: null };
      },
      resetPasswordForEmail: async () => {
        console.log('🔍 Debug: resetPasswordForEmail called');
        return { data: null, error: null };
      },
      updateUser: async () => {
        console.log('🔍 Debug: updateUser called');
        return { data: null, error: null };
      },
      refreshSession: async () => {
        console.log('🔍 Debug: refreshSession called');
        return { data: { session: null }, error: null };
      },
      resend: async () => {
        console.log('🔍 Debug: resend called');
        return { data: null, error: null };
      },
      verifyOtp: async () => {
        console.log('🔍 Debug: verifyOtp called');
        return { data: null, error: null };
      },
      onAuthStateChange: () => {
        console.log('🔍 Debug: onAuthStateChange called');
        return { 
          data: { 
            subscription: {
              unsubscribe: () => console.log('🔍 Debug: subscription unsubscribed')
            } 
          }, 
          error: null 
        };
      }
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => {
            console.log('🔍 Debug: database query called');
            return { data: null, error: null };
          }
        })
      })
    }),
    __debug: diagnostics,
  } as any;
}