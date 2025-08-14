# 🚨 EMERGENCY PRODUCTION DEPLOYMENT GUIDE

## CRITICAL: auth.aldari.app is DOWN - Immediate Actions Required

### **STEP 1: Set Environment Variables (CRITICAL)**

In your production deployment (Vercel/Netlify/hosting platform), set these environment variables **IMMEDIATELY**:

```bash
# REQUIRED - Get these from your Supabase Dashboard
NEXT_PUBLIC_SUPABASE_URL=https://yourprojectid.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anonymous-key-from-supabase-dashboard
NEXT_PUBLIC_APP_URL=https://auth.aldari.app

# RECOMMENDED (for full functionality)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-secret
```

**WHERE TO FIND SUPABASE CREDENTIALS:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings → API
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon/public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### **STEP 2: Deploy the Fixed Code**

The middleware and authentication system have been optimized for production. Deploy these changes:

1. **Ultra-minimal middleware** - Handles Edge Runtime correctly
2. **Production-safe Supabase client** - Graceful fallbacks for failures
3. **Environment validation** - Checks for missing variables
4. **Health check endpoint** - `/api/health/auth` for monitoring

### **STEP 3: Verify Deployment**

After setting environment variables and deploying:

1. **Test the health endpoint:**
   ```bash
   curl https://auth.aldari.app/api/health/auth
   ```

2. **Check authentication pages:**
   - https://auth.aldari.app/sign-in
   - https://auth.aldari.app/sign-up
   - https://auth.aldari.app/dashboard (should redirect to sign-in)

3. **Run the production validation:**
   ```bash
   cd your-project-directory
   node scripts/production-auth-check.js
   ```

### **STEP 4: Cross-Domain Configuration**

For auth.aldari.app to work with home.aldari.app:

1. **In Supabase Dashboard → Authentication → URL Configuration:**
   ```
   Site URL: https://auth.aldari.app
   Redirect URLs:
   - https://auth.aldari.app/auth/callback
   - https://home.aldari.app/auth/callback
   - https://auth.aldari.app/**
   - https://home.aldari.app/**
   ```

2. **Cookie Settings** (already handled in the middleware):
   - Secure cookies for HTTPS
   - SameSite=Lax for cross-domain
   - Proper domain configuration

### **STEP 5: Google OAuth Setup (if using)**

1. **In Google Cloud Console:**
   - Authorized JavaScript origins: `https://auth.aldari.app`
   - Authorized redirect URIs: `https://auth.aldari.app/auth/callback`

2. **In Supabase Dashboard → Authentication → Providers:**
   - Enable Google provider
   - Set Google Client ID and Secret

### **EMERGENCY TROUBLESHOOTING**

If still getting `MIDDLEWARE_INVOCATION_FAILED`:

1. **Check Vercel logs:**
   ```bash
   vercel logs auth.aldari.app
   ```

2. **Validate environment variables in deployment:**
   ```bash
   # In your hosting platform, check that env vars are set correctly
   # Make sure there are no spaces or special characters
   ```

3. **Test middleware isolation:**
   ```bash
   # Temporarily disable middleware by renaming
   mv middleware.ts middleware.ts.backup
   # Deploy and test
   ```

4. **Check Edge Runtime compatibility:**
   - Ensure no Node.js-specific APIs in middleware
   - Validate all imports are Edge Runtime compatible

### **MONITORING AND HEALTH CHECKS**

**Health Check URLs:**
- Main: `https://auth.aldari.app/api/health/auth`
- Quick: `curl -I https://auth.aldari.app/api/health/auth` (HEAD request)

**Expected Response:**
```json
{
  "status": "healthy",
  "checks": {
    "environment": true,
    "supabaseConnection": true,
    "middleware": true
  }
}
```

### **ROLLBACK PLAN**

If issues persist:

1. **Revert to minimal middleware:**
   ```typescript
   export function middleware() {
     return NextResponse.next()
   }
   ```

2. **Use client-side authentication only**
3. **Implement authentication guards in pages instead of middleware**

### **SUCCESS CRITERIA**

✅ `https://auth.aldari.app` loads without errors
✅ Sign-in page is accessible
✅ Sign-up page is accessible  
✅ Health check returns "healthy"
✅ Authentication flow works end-to-end
✅ Cross-domain sessions work with home.aldari.app

---

## PRODUCTION VALIDATION COMMAND

Run this before any deployment:
```bash
cd your-project && node scripts/production-auth-check.js
```

Only deploy when all critical checks pass!