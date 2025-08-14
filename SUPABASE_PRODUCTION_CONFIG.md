# 🔐 SUPABASE PRODUCTION CONFIGURATION

## CRITICAL: auth.aldari.app Production Setup

### **1. Supabase Dashboard Configuration**

#### **Authentication Settings**
Go to Authentication → Settings in your Supabase Dashboard:

```
Site URL: https://auth.aldari.app
Additional redirect URLs:
- https://auth.aldari.app/auth/callback
- https://auth.aldari.app/auth/confirm
- https://home.aldari.app/auth/callback
- https://home.aldari.app/auth/confirm
```

#### **Email Templates (Optional but Recommended)**
```html
<!-- Confirm signup template -->
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your account:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your mail</a></p>

<!-- Magic link template -->
<h2>Magic Link</h2>
<p>Follow this link to login:</p>
<p><a href="{{ .ConfirmationURL }}">Log In</a></p>

<!-- Reset password template -->
<h2>Reset Password</h2>
<p>Follow this link to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
```

### **2. Row Level Security (RLS) Policies**

Create these policies in your Supabase SQL Editor:

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Basic user profile access
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

-- Session management
CREATE POLICY "Users can manage own sessions" 
ON user_sessions FOR ALL 
USING (auth.uid() = user_id);
```

### **3. Environment Variables for Production**

Set these in your hosting platform (Vercel/Netlify):

```bash
# REQUIRED - Authentication
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=https://auth.aldari.app

# REQUIRED - Security
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OPTIONAL - OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# OPTIONAL - Additional Security
NEXTAUTH_SECRET=your-random-32-char-secret
NEXTAUTH_URL=https://auth.aldari.app
```

### **4. OAuth Provider Configuration**

#### **Google OAuth Setup**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create/select project
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   ```
   Authorized JavaScript origins:
   - https://auth.aldari.app
   - https://home.aldari.app
   
   Authorized redirect URIs:
   - https://auth.aldari.app/auth/callback
   - https://your-project-id.supabase.co/auth/v1/callback
   ```

#### **Enable in Supabase**
1. Go to Authentication → Providers
2. Enable Google
3. Set Client ID and Client Secret
4. Set redirect URL: `https://your-project-id.supabase.co/auth/v1/callback`

### **5. Database Security Functions**

Add these security functions to your Supabase database:

```sql
-- Function to get current user profile
CREATE OR REPLACE FUNCTION get_current_user_profile()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    au.email,
    p.full_name,
    p.avatar_url,
    p.created_at
  FROM profiles p
  JOIN auth.users au ON p.id = au.id
  WHERE p.id = auth.uid();
END;
$$;

-- Function to update user profile safely
CREATE OR REPLACE FUNCTION update_user_profile(
  full_name TEXT DEFAULT NULL,
  avatar_url TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles 
  SET 
    full_name = COALESCE(update_user_profile.full_name, profiles.full_name),
    avatar_url = COALESCE(update_user_profile.avatar_url, profiles.avatar_url),
    updated_at = NOW()
  WHERE id = auth.uid();
  
  RETURN FOUND;
END;
$$;
```

### **6. Middleware Security Headers**

The updated middleware includes these security headers:

```typescript
// Already implemented in your middleware.ts
response.headers.set('X-Content-Type-Options', 'nosniff');
response.headers.set('X-Frame-Options', 'DENY');
```

Additional headers in Next.js config:

```typescript
// Already configured in your next.config.ts
headers: [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  }
]
```

### **7. Cross-Domain Authentication Setup**

For auth.aldari.app to work with home.aldari.app:

#### **Cookie Configuration**
```typescript
// Already handled in your Supabase client
const supabase = createServerClient(url, key, {
  cookies: {
    getAll() { return request.cookies.getAll() },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, {
          ...options,
          secure: true, // HTTPS only
          sameSite: 'lax', // Allow cross-domain
          domain: '.aldari.app' // Share across subdomains
        });
      });
    }
  }
});
```

### **8. Monitoring and Alerting**

#### **Health Check Setup**
Your app now includes `/api/health/auth` endpoint:

```bash
# Monitor this endpoint
curl https://auth.aldari.app/api/health/auth

# Expected response
{
  "status": "healthy",
  "checks": {
    "environment": true,
    "supabaseConnection": true,
    "middleware": true
  }
}
```

#### **Production Validation**
Run before each deployment:

```bash
npm run auth:check
# or
npm run deploy:check
```

### **9. Error Handling and Logging**

Production error handling is built into:

- **Middleware**: Silent failures, graceful degradation
- **Client**: Timeout protection, fallback responses
- **Health checks**: Comprehensive validation

### **10. Security Checklist**

✅ Environment variables configured
✅ RLS policies enabled
✅ OAuth providers configured
✅ HTTPS enforced
✅ Secure cookies configured
✅ Cross-domain authentication setup
✅ Health monitoring implemented
✅ Error handling robust
✅ Security headers applied
✅ Production validation automated

### **DEPLOYMENT COMMAND**

```bash
# Validate everything is ready
npm run deploy:check

# If validation passes, deploy to production
vercel --prod
# or your hosting platform's deploy command
```

---

## 🚨 EMERGENCY CONTACTS

If production issues persist:

1. **Check Supabase Status**: https://status.supabase.com
2. **Vercel Status**: https://www.vercel-status.com
3. **Review Logs**: `vercel logs auth.aldari.app`
4. **Health Check**: `curl https://auth.aldari.app/api/health/auth`