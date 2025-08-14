# Supabase Authentication Security Setup Guide

This guide provides a comprehensive, production-ready authentication security system for your Next.js application with Supabase.

## 🚀 Features Implemented

### 1. Authentication Activity Tracking
- Complete audit trail of all user authentication events
- IP address and user agent tracking
- Geolocation and device fingerprinting support
- Failed login attempt monitoring

### 2. Account Security Management
- Account locking after failed attempts
- Password history tracking
- Two-factor authentication preparation
- Suspicious activity detection and scoring

### 3. Email Verification System
- Secure token-based email verification
- Token expiration and usage tracking
- Comprehensive verification audit trail

### 4. Enhanced Row Level Security (RLS)
- Bulletproof policies for all tables
- Role-based access control
- Admin override capabilities
- User data isolation

### 5. Database Functions & Triggers
- Automatic profile creation on user signup
- Password history management
- Failed login attempt tracking
- Timestamp triggers for data integrity

## 📋 Implementation Steps

### Step 1: Apply Database Migrations

Run the complete SQL script to set up all security tables and functions:

```bash
# Connect to your Supabase project and run the SQL file
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" -f supabase-auth-security-setup.sql
```

Or copy and paste the content of `supabase-auth-security-setup.sql` into your Supabase SQL Editor.

### Step 2: Update Environment Variables

Ensure your `.env.local` file includes:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### Step 3: Update Your Middleware

Replace your existing middleware with the enhanced security middleware:

```typescript
// middleware.ts
import { NextRequest } from 'next/server'
import { enhancedAuthMiddleware } from './lib/supabase/auth-middleware'

export async function middleware(request: NextRequest) {
  return await enhancedAuthMiddleware(request, {
    requireAuth: true,
    publicPaths: ['/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/'],
    protectedPaths: ['/dashboard', '/profile', '/admin'],
    redirectTo: '/sign-in'
  })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ]
}
```

### Step 4: Integrate Security Functions in Your Auth Flow

#### Sign In Handler Example:

```typescript
// app/api/auth/sign-in/route.ts
import { createClient } from '@/lib/supabase/server'
import { 
  logAuthActivity, 
  isAccountLocked, 
  incrementFailedLoginAttempts,
  resetFailedLoginAttempts,
  getClientIP,
  getUserAgent 
} from '@/lib/supabase/auth-security'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    const supabase = createClient()
    
    const clientIP = getClientIP(request)
    const userAgent = getUserAgent(request)

    // First, get user by email to check if account is locked
    const { data: userData } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (userData) {
      // Check if account is locked
      const locked = await isAccountLocked(userData.id)
      if (locked) {
        await logAuthActivity(userData.id, 'failed_login', {
          ipAddress: clientIP,
          userAgent,
          success: false,
          failureReason: 'Account is locked'
        })
        
        return NextResponse.json(
          { error: 'Account is locked due to security reasons' },
          { status: 423 }
        )
      }
    }

    // Attempt sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error || !data.user) {
      // Handle failed login
      if (userData) {
        const attempts = await incrementFailedLoginAttempts(userData.id)
        
        return NextResponse.json(
          { 
            error: 'Invalid credentials',
            remainingAttempts: Math.max(0, 5 - attempts)
          },
          { status: 401 }
        )
      }
      
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Successful login - reset failed attempts
    await resetFailedLoginAttempts(data.user.id)

    return NextResponse.json({ user: data.user })

  } catch (error) {
    console.error('Sign-in error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

#### Password Change Handler Example:

```typescript
// app/api/auth/change-password/route.ts
import { createClient } from '@/lib/supabase/server'
import { 
  checkPasswordHistory,
  addPasswordToHistory,
  logAuthActivity,
  getClientIP,
  getUserAgent 
} from '@/lib/supabase/auth-security'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { currentPassword, newPassword } = await request.json()
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientIP = getClientIP(request)
    const userAgent = getUserAgent(request)

    // Hash the new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12)

    // Check password history
    const wasUsedBefore = await checkPasswordHistory(user.id, newPasswordHash)
    if (wasUsedBefore) {
      await logAuthActivity(user.id, 'password_change', {
        ipAddress: clientIP,
        userAgent,
        success: false,
        failureReason: 'Password was recently used'
      })

      return NextResponse.json(
        { error: 'Password was recently used. Please choose a different password.' },
        { status: 400 }
      )
    }

    // Update password in Supabase Auth
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) {
      await logAuthActivity(user.id, 'password_change', {
        ipAddress: clientIP,
        userAgent,
        success: false,
        failureReason: error.message
      })

      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Add to password history
    await addPasswordToHistory(user.id, newPasswordHash, {
      ipAddress: clientIP,
      userAgent
    })

    return NextResponse.json({ message: 'Password updated successfully' })

  } catch (error) {
    console.error('Password change error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Step 5: Create Admin Dashboard for Security Monitoring

```typescript
// app/admin/security/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getRecentAuthActivity, checkSuspiciousActivity } from '@/lib/supabase/auth-security'

export default async function SecurityDashboard() {
  const supabase = createClient()
  
  // Get recent suspicious activity
  const { data: suspiciousUsers } = await supabase
    .from('suspicious_activity')
    .select('*')
    .limit(10)

  // Get recent auth activity
  const { data: recentActivity } = await supabase
    .from('recent_auth_activity')
    .select('*')
    .limit(50)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Security Dashboard</h1>
      
      {/* Suspicious Activity Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Suspicious Activity</h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          {suspiciousUsers?.map((user, index) => (
            <div key={index} className="mb-2">
              <p className="font-medium">User ID: {user.user_id}</p>
              <p className="text-sm text-gray-600">
                Failed attempts: {user.failed_attempts} | 
                IPs: {user.ip_addresses?.join(', ')}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Authentication Activity</h2>
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">User</th>
                <th className="px-4 py-2 text-left">Activity</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">IP Address</th>
                <th className="px-4 py-2 text-left">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity?.map((activity, index) => (
                <tr key={index} className="border-t">
                  <td className="px-4 py-2">{activity.email}</td>
                  <td className="px-4 py-2">{activity.activity_type}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      activity.success 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {activity.success ? 'Success' : 'Failed'}
                    </span>
                  </td>
                  <td className="px-4 py-2">{activity.ip_address}</td>
                  <td className="px-4 py-2">
                    {new Date(activity.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

## 🔧 Configuration Options

### Security Settings

You can customize the security behavior by modifying these settings in the SQL functions:

```sql
-- Maximum failed login attempts before account lock
INTEGER := 5

-- Password history limit
INTEGER := 5

-- Suspicious activity threshold
INTEGER := 25

-- Data retention periods
INTERVAL '1 year'  -- Auth activity
INTERVAL '2 years' -- Password history
```

### Rate Limiting

For production, implement proper rate limiting using Redis:

```typescript
// lib/rate-limit.ts
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function rateLimit(identifier: string, limit: number = 10, window: number = 60) {
  const key = `rate_limit:${identifier}`
  const current = await redis.incr(key)
  
  if (current === 1) {
    await redis.expire(key, window)
  }
  
  return {
    success: current <= limit,
    remaining: Math.max(0, limit - current),
    reset: Date.now() + (window * 1000)
  }
}
```

## 📊 Monitoring and Maintenance

### Regular Cleanup

Set up a cron job to clean old data:

```typescript
// app/api/cron/cleanup/route.ts
import { cleanupOldAuthData } from '@/lib/supabase/auth-security'

export async function GET() {
  const deletedCount = await cleanupOldAuthData()
  return Response.json({ deletedRecords: deletedCount })
}
```

### Health Checks

Monitor your security system:

```typescript
// app/api/health/security/route.ts
export async function GET() {
  const supabase = createClient()
  
  // Check if RLS is enabled on all tables
  const { data: tables } = await supabase.rpc('check_rls_status')
  
  // Check for recent suspicious activity
  const { data: suspicious } = await supabase
    .from('suspicious_activity')
    .select('count')
    .single()
  
  return Response.json({
    rls_enabled: tables?.all_enabled || false,
    suspicious_activity_count: suspicious?.count || 0,
    timestamp: new Date().toISOString()
  })
}
```

## 🛡️ Security Best Practices

1. **Regular Security Audits**: Review auth activity logs weekly
2. **Update Dependencies**: Keep Supabase and security packages updated
3. **Monitor Failed Attempts**: Set up alerts for unusual activity patterns
4. **Backup Security Data**: Include auth tables in backup strategies
5. **Test Security Features**: Regularly test account locking and recovery flows
6. **Rate Limiting**: Implement proper rate limiting for all auth endpoints
7. **HTTPS Only**: Ensure all authentication flows use HTTPS
8. **Session Management**: Implement proper session timeout and refresh

## 🚨 Incident Response

When suspicious activity is detected:

1. **Immediate**: Account is automatically locked after 5 failed attempts
2. **Investigation**: Review auth activity logs for the user
3. **Communication**: Notify user via email about security event
4. **Recovery**: Provide secure account recovery process
5. **Analysis**: Update security rules based on incident findings

## 📞 Support

For issues with this security implementation:

1. Check Supabase logs for database errors
2. Review browser console for client-side issues
3. Monitor server logs for middleware errors
4. Test with different user roles and scenarios

This comprehensive security system provides enterprise-level protection for your authentication flow while maintaining usability and performance.