import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Detect if we're in a build environment
function isBuildTime() {
  return process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === undefined
}

export async function createClient() {
  // During build time, return a mock client to prevent errors
  if (isBuildTime() || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('Supabase client unavailable during build or missing environment variables')
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null })
      }
    } as any
  }

  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Service role client for admin operations
export function createServiceClient() {
  // During build time, return a mock client to prevent errors
  if (isBuildTime() || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('Supabase service client unavailable during build or missing environment variables')
    return {
      auth: {
        admin: {
          createUser: async () => ({ data: null, error: null }),
          deleteUser: async () => ({ data: null, error: null }),
          updateUserById: async () => ({ data: null, error: null })
        }
      }
    } as any
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // No-op for service role client
        },
      },
    }
  )
}