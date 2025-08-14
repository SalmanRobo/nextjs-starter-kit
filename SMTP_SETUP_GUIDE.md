# 📧 SMTP Setup Guide for Production Emails

## 🚀 **Recommended: Resend (Easiest Setup)**

### Why Resend?
- ✅ **Simple setup** - Just one API key needed
- ✅ **Great deliverability** - Built by email experts
- ✅ **Developer friendly** - Modern API and dashboard
- ✅ **Free tier** - 3,000 emails/month free
- ✅ **Saudi Arabia support** - Works internationally

### Step-by-Step Resend Setup:

#### 1. Create Resend Account
1. Go to [resend.com](https://resend.com)
2. Sign up with your email
3. Verify your account

#### 2. Add Your Domain
1. In Resend Dashboard → **Domains** → **Add Domain**
2. Enter: `aldari.app`
3. Add these DNS records to your domain provider:

```dns
Type: TXT
Name: @
Value: [Resend will provide the SPF record]

Type: TXT  
Name: resend._domainkey
Value: [Resend will provide the DKIM record]

Type: TXT
Name: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@aldari.app
```

#### 3. Create API Key
1. Go to **API Keys** → **Create API Key**
2. Name: `ALDARI Auth Production`
3. Domain: `aldari.app`
4. Copy the API key (starts with `re_`)

#### 4. Configure in Supabase
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project → **Authentication** → **Settings**
3. Scroll to **SMTP Settings**
4. Enable "Use custom SMTP server"
5. Enter these settings:

```
SMTP Host: smtp.resend.com
SMTP Port: 587
SMTP User: resend
SMTP Password: [your-resend-api-key]
From Email: auth@aldari.app
Sender Name: ALDARI Authentication
```

---

## 🏢 **Alternative: AWS SES (Enterprise Grade)**

### Why AWS SES?
- ✅ **Ultra reliable** - Amazon's email service
- ✅ **Scalable** - Handle millions of emails
- ✅ **Cost effective** - $0.10 per 1,000 emails
- ✅ **Advanced features** - Detailed analytics

### Step-by-Step AWS SES Setup:

#### 1. Create AWS Account
1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Create account and verify payment method

#### 2. Setup SES
1. Go to AWS Console → **Simple Email Service**
2. Select region: **US East (N. Virginia)**
3. Go to **Verified identities** → **Create identity**
4. Choose **Domain** and enter `aldari.app`

#### 3. Verify Domain
Add these DNS records:
```dns
Type: TXT
Name: _amazonses.aldari.app
Value: [AWS will provide verification token]

Type: MX
Name: aldari.app  
Value: 10 feedback-smtp.us-east-1.amazonses.com

Type: TXT
Name: [AWS will provide]
Value: [AWS DKIM record]
```

#### 4. Create SMTP Credentials
1. Go to **SMTP settings** → **Create SMTP credentials**
2. Save username and password

#### 5. Configure in Supabase
```
SMTP Host: email-smtp.us-east-1.amazonaws.com
SMTP Port: 587
SMTP User: [your-aws-smtp-username]
SMTP Password: [your-aws-smtp-password]
From Email: auth@aldari.app
Sender Name: ALDARI Authentication
```

---

## 📨 **Email Template Customization**

### 1. Update Supabase Email Templates
Go to Supabase → **Authentication** → **Email Templates**

#### Confirmation Email Template:
```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .header { text-align: center; margin-bottom: 40px; }
        .logo { font-size: 24px; font-weight: bold; color: #1a1a1a; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 8px; text-align: center; }
        .button { display: inline-block; padding: 12px 24px; background: #000; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 40px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🏠 ALDARI</div>
            <p>Saudi Arabia's Premier Property Platform</p>
        </div>
        
        <div class="content">
            <h2>Welcome to ALDARI!</h2>
            <p>Please confirm your email address to complete your registration.</p>
            <a href="{{ .ConfirmationURL }}" class="button">Confirm Email Address</a>
            <p><small>This link expires in 24 hours</small></p>
        </div>
        
        <div class="footer">
            <p>ALDARI - Connecting you to premium Saudi properties</p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
        </div>
    </div>
</body>
</html>
```

#### Password Reset Template:
```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .header { text-align: center; margin-bottom: 40px; }
        .logo { font-size: 24px; font-weight: bold; color: #1a1a1a; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 8px; text-align: center; }
        .button { display: inline-block; padding: 12px 24px; background: #000; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 40px; color: #666; font-size: 14px; }
        .security { background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🏠 ALDARI</div>
        </div>
        
        <div class="content">
            <h2>Reset Your Password</h2>
            <p>We received a request to reset your ALDARI account password.</p>
            <a href="{{ .ConfirmationURL }}" class="button">Reset Password</a>
            <p><small>This link expires in 1 hour</small></p>
            
            <div class="security">
                <strong>Security Notice:</strong> If you didn't request this, please ignore this email. Your password won't be changed.
            </div>
        </div>
        
        <div class="footer">
            <p>ALDARI - Your trusted property platform</p>
        </div>
    </div>
</body>
</html>
```

---

## ✅ **Testing Your SMTP Setup**

### 1. Test Email Delivery
1. Go to Supabase → **Authentication** → **Settings**
2. Scroll to **SMTP Settings**
3. Click **Send Test Email**
4. Enter your email and send

### 2. Test Authentication Flow
1. Go to your deployed site: `https://auth.aldari.app`
2. Try signing up with a new email
3. Check if you receive the confirmation email
4. Test password reset flow

### 3. Monitor Email Delivery
- **Resend:** Check dashboard for delivery stats
- **AWS SES:** Monitor in CloudWatch
- **Supabase:** Check authentication logs

---

## 🚨 **Common Issues & Solutions**

### Issue: Emails going to spam
**Solution:**
- Verify SPF, DKIM, and DMARC records
- Use a consistent "From" email address
- Avoid spam-trigger words in subject lines

### Issue: DNS records not propagating
**Solution:**
- Wait 24-48 hours for full propagation
- Use online DNS checker tools
- Clear DNS cache locally

### Issue: SMTP authentication failed
**Solution:**
- Double-check API keys/passwords
- Ensure correct SMTP host and port
- Verify domain is properly verified

---

## 📞 **Support Resources**

- **Resend Support:** [resend.com/docs](https://resend.com/docs)
- **AWS SES Docs:** [AWS SES Documentation](https://docs.aws.amazon.com/ses/)
- **Supabase Auth:** [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)

## 🎯 **Recommendation**

**Start with Resend** - it's the easiest to set up and works great for most applications. You can always migrate to AWS SES later if you need more advanced features.