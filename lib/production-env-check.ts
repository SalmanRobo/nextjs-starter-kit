/**
 * PRODUCTION-CRITICAL Environment Variable Validation
 * This file validates all required environment variables for auth.aldari.app
 */

export interface ProductionEnvVars {
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  NEXT_PUBLIC_APP_URL: string
}

export function validateProductionEnv(): {
  isValid: boolean
  missing: string[]
  warnings: string[]
} {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_APP_URL'
  ]

  const optional = [
    'SUPABASE_SERVICE_ROLE_KEY'
  ]

  const missing: string[] = []
  const warnings: string[] = []

  // Check required variables
  for (const key of required) {
    const value = process.env[key]
    if (!value || value.trim() === '') {
      missing.push(key)
    } else if (value.includes('your-') || value === 'placeholder') {
      warnings.push(`${key} appears to be a placeholder value`)
    }
  }

  // Check optional variables
  for (const key of optional) {
    const value = process.env[key]
    if (!value) {
      warnings.push(`${key} is not set (optional but recommended for production)`)
    }
  }

  // Validate Supabase URL format
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl && !supabaseUrl.match(/^https:\/\/[a-z0-9]+\.supabase\.co$/)) {
    warnings.push('NEXT_PUBLIC_SUPABASE_URL format appears invalid')
  }

  // Validate App URL format
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl && !appUrl.startsWith('https://')) {
    warnings.push('NEXT_PUBLIC_APP_URL should use HTTPS in production')
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings
  }
}

export function logProductionEnvStatus(): void {
  const { isValid, missing, warnings } = validateProductionEnv()
  
  if (!isValid) {
    console.error('🚨 PRODUCTION ENV ERROR: Missing required variables:', missing)
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️ PRODUCTION ENV WARNINGS:', warnings)
  }
  
  if (isValid && warnings.length === 0) {
    console.log('✅ Production environment variables validated successfully')
  }
}

// Auto-validate in production builds
if (process.env.NODE_ENV === 'production') {
  logProductionEnvStatus()
}