import { createBrowserClient } from '@supabase/ssr';

// PRODUCTION-OPTIMIZED: Create reliable Supabase client
export function createClient() {
  // Get environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Check for required environment variables
  if (!supabaseUrl || !supabaseKey) {
    const missing = [];
    if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    
    console.error('🚨 SUPABASE CLIENT ERROR: Missing environment variables:', missing);
    
    // Only use mock client during build time (when window is undefined AND we're not in Vercel runtime)
    if (typeof window === 'undefined' && !process.env.VERCEL_URL) {
      console.log('Using mock client for build time');
      return createMockClient();
    }
    
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  try {
    // Create real Supabase client
    const client = createBrowserClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      }
    );

    return client;
  } catch (error) {
    console.error('CRITICAL: Failed to create Supabase client:', error);
    throw error;
  }
}

// BUILD-TIME ONLY: Mock client for static generation
function createMockClient() {
  console.log('🔧 Using mock Supabase client for build time');
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signUp: async () => ({ data: null, error: { message: 'Build-time mock client' } }),
      signInWithPassword: async () => ({ data: null, error: { message: 'Build-time mock client' } }),
      signInWithOAuth: async () => ({ data: null, error: { message: 'Build-time mock client' } }),
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
  } as any;
}