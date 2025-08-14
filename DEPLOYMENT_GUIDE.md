# 🚀 Deployment Guide for auth.aldari.app

## ✅ DEPLOYMENT STATUS: Phase 1 Complete!

**Live URL:** https://auth.aldari.app
**Status:** ✅ Successfully deployed and accessible
**Phase:** 1/5 - Vercel deployment with custom domain completed

---

## Step 1: Vercel Deployment

### 1.1 Connect to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"New Project"**
3. Import your `nextjs-starter-kit` repository
4. Configure the project:
   - **Framework Preset:** Next.js
   - **Root Directory:** `./` (keep default)
   - **Build Command:** `npm run build` (keep default)
   - **Output Directory:** `.next` (keep default)
   - **Install Command:** `npm install` (keep default)

### 1.2 Configure Environment Variables
In Vercel Dashboard → Project Settings → Environment Variables, add:

```env
NEXT_PUBLIC_APP_URL=https://auth.aldari.app
NEXT_PUBLIC_SUPABASE_URL=https://nevmjjnsupkuocaqrhdw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ldm1qam5zdXBrdW9jYXFyaGR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1ODYwMzEsImV4cCI6MjA2MzE2MjAzMX0.x_IWY_bdgVD9HGwR0RwcRuQ6sJxkFeO7tsRtJJtN4JQ
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ldm1qam5zdXBrdW9jYXFyaGR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzU4NjAzMSwiZXhwIjoyMDYzMTYyMDMxfQ.U1hflreyyhguWW_xBGAXDfD_8DbOfZ11mJNoTA9vGpU
```

### 1.3 Add Custom Domain
1. Go to Project Settings → Domains
2. Add domain: `auth.aldari.app`
3. Configure DNS records:
   - **Type:** CNAME
   - **Name:** auth
   - **Value:** [your-vercel-domain].vercel.app (Vercel will provide this)

## Step 2: SMTP Configuration

### Option A: Resend (Recommended)

#### 2.1 Setup Resend Account
1. Go to [resend.com](https://resend.com) and create account
2. Verify your domain `aldari.app`:
   - Go to Domains → Add Domain
   - Add DNS records as instructed
3. Create API Key:
   - Go to API Keys → Create API Key
   - Copy the key (starts with `re_`)

#### 2.2 Configure in Supabase
1. Go to Supabase Dashboard → Authentication → Settings
2. Scroll to "SMTP Settings"
3. Enable "Use custom SMTP server"
4. Configure:
   ```
   SMTP Host: smtp.resend.com
   SMTP Port: 587
   SMTP User: resend
   SMTP Password: [your-resend-api-key]
   From Email: auth@aldari.app
   Sender Name: ALDARI Auth
   ```

### Option B: AWS SES (Enterprise)

#### 2.1 Setup AWS SES
1. Create AWS account and go to SES console
2. Verify domain `aldari.app`
3. Create SMTP credentials

#### 2.2 Configure in Supabase
```
SMTP Host: email-smtp.us-east-1.amazonaws.com
SMTP Port: 587
SMTP User: [your-aws-access-key]
SMTP Password: [your-aws-secret-key]
From Email: auth@aldari.app
```

## Step 3: Supabase Configuration

### 3.1 Update Auth Settings
1. Go to Supabase Dashboard → Authentication → Settings
2. **Site URL:** `https://auth.aldari.app`
3. **Redirect URLs:** Add these URLs:
   ```
   https://auth.aldari.app/auth/callback
   https://auth.aldari.app/auth/verify-email
   https://auth.aldari.app/reset-password
   https://auth.aldari.app/sign-in
   ```

### 3.2 Configure Rate Limits
1. Go to Authentication → Rate Limits
2. Recommended settings:
   ```
   Email OTP: 30 per hour
   SMS OTP: 30 per hour
   Sign Up: 30 per hour
   Sign In: 60 per hour
   Password Reset: 30 per hour
   ```

### 3.3 Email Templates
1. Go to Authentication → Email Templates
2. Customize templates with ALDARI branding:
   - **Confirmation Email**
   - **Password Reset**
   - **Magic Link**

## Step 4: DNS Configuration

### 4.1 Domain Setup
Add these DNS records to your domain provider:

```
Type: CNAME
Name: auth
Value: [your-vercel-domain].vercel.app
TTL: 300
```

### 4.2 For Email (if using custom domain)
```
Type: TXT
Name: @
Value: [SPF record from your email provider]

Type: CNAME
Name: _dmarc
Value: [DMARC record from your email provider]
```

## Step 5: Testing Checklist

### 5.1 Basic Functionality
- [ ] Visit https://auth.aldari.app
- [ ] Sign up with email
- [ ] Receive verification email
- [ ] Verify email and complete registration
- [ ] Sign in with credentials
- [ ] Test forgot password flow
- [ ] Test password reset

### 5.2 Security Testing
- [ ] Rate limiting works (try multiple failed logins)
- [ ] Account lockout after 5 failed attempts
- [ ] Session management works
- [ ] HTTPS enforced
- [ ] Security headers present

### 5.3 Mobile Compatibility
- [ ] Responsive design works on mobile
- [ ] OAuth redirects work for mobile apps
- [ ] Deep linking functional

## Step 6: Monitoring Setup

### 6.1 Vercel Analytics
- Enable Vercel Analytics in project settings
- Monitor performance and errors

### 6.2 Supabase Monitoring
- Check authentication logs in Supabase Dashboard
- Monitor rate limits and usage

## 🎉 Go Live!

Once all steps are complete:
1. Deploy from Vercel dashboard
2. Test the live site at https://auth.aldari.app
3. Monitor logs for any issues
4. Your authentication system is live! 🚀

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check Supabase logs
3. Verify DNS propagation (can take up to 24 hours)
4. Test SMTP settings with Supabase email test feature