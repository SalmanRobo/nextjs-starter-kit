import { createBrowserClient } from '@supabase/ssr';
import { validateProductionEnv } from '@/lib/production-env-check';

// PRODUCTION-CRITICAL: Detect if we're in a build environment
function isBuildTime() {
  return (
    typeof window === 'undefined' && 
    process.env.NODE_ENV === 'production' && 
    !process.env.VERCEL_ENV
  );
}

// PRODUCTION-CRITICAL: Create production-ready Supabase client
export function createClient() {
  // Validate environment variables first
  const { isValid, missing } = validateProductionEnv();
  
  // During build time, return a safe mock client
  if (isBuildTime()) {
    return createMockClient();
  }

  // If environment variables are missing, log error and return mock
  if (!isValid) {
    console.error('🚨 SUPABASE CLIENT ERROR: Missing environment variables:', missing);
    if (process.env.NODE_ENV === 'production') {
      // In production, fail gracefully
      return createMockClient();
    }
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  try {
    // PRODUCTION-OPTIMIZED: Create real Supabase client
    const client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: 'pkce', // More secure for production
        },
      }
    );

    // PRODUCTION: Add timeout wrapper for auth methods
    if (process.env.NODE_ENV === 'production') {
      const originalGetUser = client.auth.getUser;
      client.auth.getUser = async () => {
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Auth timeout')), 5000)
        );
        
        try {
          return await Promise.race([originalGetUser.call(client.auth), timeoutPromise]);
        } catch (error) {
          console.error('getUser timeout or error:', error);
          return { data: { user: null }, error: { message: 'Authentication timeout' } };
        }
      };
    }

    return client;
  } catch (error) {
    console.error('CRITICAL: Failed to create Supabase client:', error);
    
    // PRODUCTION: Return mock client to prevent app crash
    if (process.env.NODE_ENV === 'production') {
      return createMockClient();
    }
    
    throw error;
  }
}

// PRODUCTION-SAFE: Mock client for build time or errors
function createMockClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signUp: async () => ({ data: null, error: { message: 'Authentication service unavailable' } }),
      signInWithPassword: async () => ({ data: null, error: { message: 'Authentication service unavailable' } }),
      signInWithOAuth: async () => ({ data: null, error: { message: 'Authentication service unavailable' } }),
      signOut: async () => ({ error: null }),
      resetPasswordForEmail: async () => ({ data: null, error: null }),
      updateUser: async () => ({ data: null, error: null }),
      refreshSession: async () => ({ data: { session: null }, error: null }),
      resend: async () => ({ data: null, error: null }),
      verifyOtp: async () => ({ data: null, error: null }),
      onAuthStateChange: () => ({ 
        data: { 
          subscription: {
            unsubscribe: () => {}
          } 
        }, 
        error: null 
      })
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: null })
        })
      })
    }),
    // Add any other methods your app uses
  } as any;
}