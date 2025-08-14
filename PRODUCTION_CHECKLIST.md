# ✅ Production Deployment Checklist for auth.aldari.app

## 📋 **Pre-Deployment Checklist**

### ✅ **Code Preparation**
- [x] Authentication system implemented and tested locally
- [x] Environment variables configured
- [x] Database migrations applied
- [x] Build passes successfully (`npm run build`)
- [x] Vercel configuration file created
- [ ] All TODO comments addressed
- [ ] Security headers configured

### ✅ **Vercel Setup**
- [ ] Vercel account created and connected to GitHub
- [ ] Repository imported to Vercel
- [ ] Environment variables added to Vercel dashboard
- [ ] Custom domain `auth.aldari.app` configured
- [ ] DNS records updated for custom domain
- [ ] SSL certificate verified (automatic with Vercel)

### ✅ **Supabase Configuration**
- [x] Database migration executed successfully
- [ ] Site URL updated to `https://auth.aldari.app`
- [ ] Redirect URLs configured for production
- [ ] Rate limits configured appropriately
- [ ] RLS policies tested and working

### ✅ **SMTP Configuration**
- [ ] Email provider chosen (Resend recommended)
- [ ] Domain verified with email provider
- [ ] SMTP settings configured in Supabase
- [ ] DNS records added (SPF, DKIM, DMARC)
- [ ] Email templates customized with ALDARI branding
- [ ] Test email sent successfully

## 🚀 **Deployment Steps**

### Step 1: Vercel Deployment
1. **Import Project:**
   ```
   1. Go to vercel.com → New Project
   2. Import from GitHub: nextjs-starter-kit
   3. Configure build settings (auto-detected)
   4. Deploy
   ```

2. **Add Environment Variables:**
   ```env
   NEXT_PUBLIC_APP_URL=https://auth.aldari.app
   NEXT_PUBLIC_SUPABASE_URL=https://nevmjjnsupkuocaqrhdw.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **Configure Custom Domain:**
   ```
   1. Project Settings → Domains
   2. Add: auth.aldari.app
   3. Update DNS: CNAME auth → [vercel-domain].vercel.app
   ```

### Step 2: SMTP Setup (Resend)
1. **Create Resend Account:**
   - Sign up at resend.com
   - Verify domain: aldari.app
   - Create API key

2. **Configure Supabase SMTP:**
   ```
   Host: smtp.resend.com
   Port: 587
   User: resend
   Password: [resend-api-key]
   From: auth@aldari.app
   ```

### Step 3: Supabase Updates
1. **Auth Settings:**
   ```
   Site URL: https://auth.aldari.app
   Redirect URLs:
   - https://auth.aldari.app/auth/callback
   - https://auth.aldari.app/auth/verify-email
   - https://auth.aldari.app/reset-password
   ```

2. **Rate Limits:**
   ```
   Email OTP: 30/hour
   Sign Up: 30/hour
   Sign In: 60/hour
   Password Reset: 30/hour
   ```

## 🧪 **Testing Checklist**

### ✅ **Basic Functionality**
- [ ] Site loads at https://auth.aldari.app
- [ ] Sign-up form works
- [ ] Email verification sent and received
- [ ] Email verification link works
- [ ] Sign-in form works
- [ ] Password reset flow works
- [ ] Responsive design on mobile

### ✅ **Security Testing**
- [ ] HTTPS enforced (no HTTP access)
- [ ] Rate limiting active (test multiple failed logins)
- [ ] Account lockout after 5 failed attempts
- [ ] CSRF protection working
- [ ] Security headers present
- [ ] Session management working

### ✅ **Email Testing**
- [ ] Confirmation emails delivered
- [ ] Password reset emails delivered
- [ ] Emails not going to spam
- [ ] Email templates display correctly
- [ ] Unsubscribe links work (if applicable)

### ✅ **Performance Testing**
- [ ] Page load times < 3 seconds
- [ ] Forms submit quickly
- [ ] Database queries optimized
- [ ] Error handling works gracefully

## 🔧 **Post-Deployment Tasks**

### ✅ **Monitoring Setup**
- [ ] Vercel Analytics enabled
- [ ] Supabase logs monitored
- [ ] Error tracking configured
- [ ] Uptime monitoring setup

### ✅ **Documentation**
- [ ] Deployment guide documented
- [ ] API endpoints documented
- [ ] Environment variables documented
- [ ] Troubleshooting guide created

### ✅ **Team Access**
- [ ] Vercel project access granted
- [ ] Supabase project access granted
- [ ] Environment secrets secured
- [ ] Deployment process documented

## 🚨 **Rollback Plan**

### If Issues Occur:
1. **Revert Vercel Deployment:**
   - Go to Vercel Dashboard → Deployments
   - Find last working deployment
   - Click "Promote to Production"

2. **Database Issues:**
   - Supabase automatically backs up
   - Restore from Supabase Dashboard if needed

3. **DNS Issues:**
   - Revert DNS changes
   - Use Vercel default domain temporarily

## 📞 **Support Contacts**

### **Services Used:**
- **Vercel Support:** help@vercel.com
- **Supabase Support:** support@supabase.io
- **Resend Support:** support@resend.com (if using Resend)

### **Important URLs:**
- **Production Site:** https://auth.aldari.app
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase Dashboard:** https://supabase.com/dashboard
- **Domain Provider:** [Your domain registrar]

## 🎉 **Go-Live Announcement**

### When Ready:
1. **Internal Testing Complete:** ✅
2. **All Systems Green:** ✅
3. **Team Notified:** ✅
4. **Documentation Complete:** ✅

### Announcement Message:
```
🚀 ALDARI Authentication System is now LIVE!

✅ Production URL: https://auth.aldari.app
✅ Full authentication flow implemented
✅ Email verification working
✅ Password reset functional
✅ Mobile-ready for app integration

Ready for user registration and secure authentication! 🎉
```

---

**Next Steps:** Follow the detailed guides in DEPLOYMENT_GUIDE.md and SMTP_SETUP_GUIDE.md to complete your deployment!