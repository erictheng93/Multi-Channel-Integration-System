# 🎯 Quick Start Guide - Deploy Your CRM in 5 Minutes

**For Small Business Owners & Non-Technical Users**

This guide will help you deploy your own Multi-Channel CRM system without any coding knowledge.

---

## What You'll Get

After following this guide, you'll have:

✅ Your own CRM system running 24/7
✅ LINE OA integration ready
✅ Real-time chat interface
✅ Team management features
✅ File upload & storage
✅ Complete control over your data

**Cost:** Starts at $0/month (Cloudflare Free tier)

---

## Before You Start

### What You Need

1. **Cloudflare Account** (Free)
   - If you don't have one: https://dash.cloudflare.com/sign-up
   - Takes 2 minutes to create

2. **Email Address**
   - You'll receive your admin login credentials here

3. **5 Minutes of Time**
   - The deployment is mostly automatic

### Optional

- **Custom Domain** (e.g., crm.yourcompany.com)
  - You can use the free Cloudflare domain or add your own

---

## Step-by-Step Instructions

### Step 1: Visit the Installer

Go to: **https://installer.yourcompany.com**

You'll see a page that looks like this:

```
┌─────────────────────────────────────────────┐
│    🚀 Deploy Your CRM System               │
│                                             │
│    One-click deployment to Cloudflare      │
│    No coding required                       │
│                                             │
│    [Deploy to Cloudflare]                  │
└─────────────────────────────────────────────┘
```

Click the big **"Deploy to Cloudflare"** button.

---

### Step 2: Authorize Cloudflare Access

You'll be redirected to Cloudflare's website to log in.

**What you'll see:**
```
┌─────────────────────────────────────────────┐
│    Cloudflare Authorization                │
│                                             │
│    CRM Installer wants to access:          │
│    ✓ Create Workers                        │
│    ✓ Create Databases                      │
│    ✓ Create Storage                        │
│                                             │
│    [Cancel]  [Authorize]                   │
└─────────────────────────────────────────────┘
```

**Click "Authorize"**

📝 **Note:** This is safe - the installer only gets temporary access to create your CRM resources.

---

### Step 3: Fill in Your Details

You'll return to the installer and see a form:

```
┌─────────────────────────────────────────────┐
│    Configure Your Deployment               │
│                                             │
│    Project Name *                          │
│    [my-crm-system          ]               │
│    Use lowercase letters, numbers, hyphens │
│                                             │
│    Admin Email *                           │
│    [admin@yourcompany.com  ]               │
│    You'll receive credentials here         │
│                                             │
│    Custom Domain (Optional)                │
│    [crm.yourcompany.com    ]               │
│    Leave empty for free domain             │
│                                             │
│    [Start Deployment]                      │
└─────────────────────────────────────────────┘
```

**Fill in:**

1. **Project Name**
   - Example: `my-crm` or `acme-support`
   - Must be 3-50 characters
   - Only lowercase letters, numbers, and hyphens
   - This becomes part of your URL

2. **Admin Email**
   - Your email address
   - You'll receive login credentials here
   - Make sure it's correct!

3. **Custom Domain** (Optional)
   - If you have your own domain: `crm.yourcompany.com`
   - If not, leave empty - you'll get: `my-crm.pages.dev`

**Click "Start Deployment"**

---

### Step 4: Wait for Deployment

You'll see a progress screen like this:

```
┌─────────────────────────────────────────────┐
│    Deploying Your CRM System               │
│                                             │
│    [████████████░░░░░░░░] 65%             │
│                                             │
│    ✅ Creating database                     │
│    ✅ Setting up storage                    │
│    ⚙️  Deploying backend...                │
│    ⏳ Deploying frontend...                 │
│    ⏳ Sending credentials...                │
│                                             │
│    📋 Deployment Logs:                     │
│    ┌─────────────────────────────────────┐│
│    │ [10:30:15] Created D1 database      ││
│    │ [10:30:45] Created storage bucket   ││
│    │ [10:31:20] Deploying Worker...      ││
│    └─────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

**This takes 2-3 minutes.**

☕ Grab a coffee while you wait!

❌ **Don't close this window** - you'll lose progress tracking.

---

### Step 5: Get Your Credentials

When deployment completes, you'll see:

```
┌─────────────────────────────────────────────┐
│    🎉 Deployment Successful!               │
│                                             │
│    🌐 Your Application URLs:               │
│    Frontend: https://my-crm.pages.dev      │
│    Backend:  https://my-crm.workers.dev    │
│                                             │
│    🔐 Admin Credentials:                   │
│    ┌─────────────────────────────────────┐│
│    │ Username: admin                     ││
│    │ Password: [shown here]              ││
│    │ Email:    admin@yourcompany.com     ││
│    │                                     ││
│    │ [📋 Copy] [💾 Download]            ││
│    └─────────────────────────────────────┘│
│                                             │
│    [Open Admin Panel]                      │
└─────────────────────────────────────────────┘
```

**Important:**

1. **Save your credentials!**
   - Click "Download" to save them
   - Or copy them to a password manager
   - You won't see the password again

2. **Check your email**
   - You'll receive the same credentials via email
   - Check spam folder if you don't see it

3. **Click "Open Admin Panel"**
   - This opens your new CRM system
   - Use the credentials to log in

---

## What's Next?

### 1. First Login

Visit your CRM URL (e.g., `https://my-crm.pages.dev`)

```
┌─────────────────────────────────────────────┐
│           Your CRM Login                    │
│                                             │
│    Username: [admin            ]           │
│    Password: [••••••••••        ]           │
│                                             │
│    [Login]                                  │
└─────────────────────────────────────────────┘
```

**Login with your credentials**

⚠️ **Change your password immediately** after first login!

---

### 2. Set Up LINE OA Integration

**In your CRM:**

1. Go to **Settings** → **Channels** → **LINE OA**
2. You'll need from LINE Developers Console:
   - Channel ID
   - Channel Secret
   - Channel Access Token

**In LINE Developers Console:**

1. Go to your LINE OA settings
2. Set Webhook URL to: `https://your-backend.workers.dev/api/webhooks/line`
3. Enable webhooks

**Back in your CRM:**

1. Paste the credentials
2. Click "Test Connection"
3. Click "Save"

✅ Your LINE OA is now connected!

---

### 3. Create Team Members

**To add agents:**

1. Go to **Team Management**
2. Click **"Add Member"**
3. Fill in:
   - Name
   - Email
   - Role (Admin or Agent)
4. Click **"Send Invitation"**

The team member will receive an email with login instructions.

---

### 4. Customize Settings

**Recommended settings to configure:**

1. **Working Hours**
   - Set your business hours
   - Define auto-responses for off-hours

2. **Notifications**
   - Configure email notifications
   - Set up desktop notifications

3. **Branding** (if available)
   - Add your company logo
   - Customize colors

---

## Troubleshooting

### Problem: "Invalid project name" error

**Solution:**
- Use only lowercase letters, numbers, and hyphens
- Must be 3-50 characters
- Examples: `my-crm`, `acme-support-2024`
- Bad examples: `My CRM`, `support@acme`, `A`

---

### Problem: Deployment stuck at 40%

**Solution:**
1. Wait 2 more minutes (database creation can be slow)
2. If still stuck, click "Cancel"
3. Try again with a different project name

---

### Problem: Didn't receive email

**Solution:**
1. Check spam folder
2. Wait 5 minutes (emails can be delayed)
3. Check the email address you entered
4. Contact support if still not received

---

### Problem: OAuth authorization failed

**Solution:**
1. Make sure you're logged into Cloudflare
2. Try clicking "Deploy to Cloudflare" again
3. Clear browser cache and cookies
4. Try a different browser

---

### Problem: Custom domain not working

**Solution:**
1. Wait 5-10 minutes for DNS propagation
2. Make sure you added the DNS record:
   - Type: CNAME
   - Name: crm (or subdomain)
   - Target: [shown in dashboard]
3. Check Cloudflare Dashboard → DNS settings

---

## Getting Help

### Documentation

- **User Guide:** https://docs.yourcompany.com/user-guide
- **Video Tutorials:** https://docs.yourcompany.com/videos
- **FAQ:** https://docs.yourcompany.com/faq

### Support Channels

- **Email:** support@yourcompany.com
- **Live Chat:** https://yourcompany.com/chat
- **Discord Community:** https://discord.gg/yourcompany
- **Phone:** +1-XXX-XXX-XXXX (Business hours)

### Response Times

- **Email:** Within 24 hours
- **Live Chat:** Instant (business hours)
- **Discord:** Community support
- **Phone:** Immediate (emergencies)

---

## Cost Information

### Free Tier (Most Small Businesses)

**Included:**
- 100,000 requests/day
- 5GB database storage
- 10GB file storage
- Unlimited frontend hosting

**Cost:** **$0/month**

**Good for:**
- Up to 500 customers
- Up to 10 team members
- Up to 10,000 messages/day

---

### Paid Tier (Growing Businesses)

**When you need:**
- More than 100,000 requests/day
- More than 5GB database storage
- More than 10GB file storage

**Cost:** $10-30/month typically

**Cloudflare automatically scales** - you only pay for what you use.

---

## Security & Privacy

### Your Data is Safe

- ✅ All data stored in **your** Cloudflare account
- ✅ HTTPS encryption for all traffic
- ✅ Regular automatic backups
- ✅ SOC 2 Type II compliant infrastructure
- ✅ GDPR compliant

### We Don't Have Access

- ❌ We **cannot** see your data
- ❌ We **cannot** access your CRM
- ❌ We **cannot** read your messages

**You own and control everything.**

---

## Frequently Asked Questions

### Q: Do I need coding knowledge?

**A:** No! The entire deployment is automated. Just click buttons and fill in forms.

---

### Q: Can I cancel anytime?

**A:** Yes! Since it's in your Cloudflare account, you have full control. Delete resources anytime from Cloudflare Dashboard.

---

### Q: What if I need help?

**A:** We offer email support, live chat, and video tutorials. Plus an active community on Discord.

---

### Q: Can I customize the CRM?

**A:** Yes! You have full access to the code. Hire a developer to customize it for you, or contact us for custom development.

---

### Q: Is my data backed up?

**A:** Yes! Cloudflare automatically backs up your data. You can also export your data anytime.

---

### Q: Can I use my own domain?

**A:** Yes! Enter it during setup or add it later in Cloudflare Dashboard.

---

### Q: What happens if I exceed free tier?

**A:** Cloudflare sends you an email notification. You can upgrade to paid tier or optimize usage.

---

## Success Stories

> "Deployed in 3 minutes! Now handling 50+ customer conversations daily."
> **- Sarah, Small Business Owner**

> "No technical knowledge required. The installer did everything for me."
> **- Mike, Startup Founder**

> "Saved $500/month compared to hosted CRM solutions."
> **- Lisa, Freelancer**

---

## Next Steps

1. ✅ **Complete deployment** (you just did this!)
2. 🔐 **Change your password**
3. 📱 **Connect LINE OA**
4. 👥 **Add team members**
5. ⚙️ **Customize settings**
6. 🎉 **Start serving customers!**

---

**Congratulations! You now have your own CRM system! 🎉**

If you found this guide helpful, please:
- ⭐ Star our project on GitHub
- 📧 Share with other business owners
- 💬 Join our community

**Need help?** support@yourcompany.com

---

**Last Updated:** 2025-01-28
**Version:** 1.0.0
