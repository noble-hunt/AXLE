# AXLE Production Deployment Guide

## Overview

This guide explains how to deploy AXLE to production on Vercel. Follow these steps carefully to avoid data loading failures.

## Critical Environment Variables

AXLE requires the following environment variables to function in production:

### 🔴 **CRITICAL** (App won't start without these)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (secret)

### ⚠️ **REQUIRED** (Core features won't work without these)
- `VITE_SUPABASE_URL` - Supabase URL for frontend
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key for frontend  
- `SUPABASE_ANON_KEY` - Supabase anon key for backend

### 💡 **IMPORTANT** (Advanced features require these)
- `DATABASE_URL` - PostgreSQL connection string (required for Groups, Analytics, and direct database operations)
- `OPENAI_API_KEY` - OpenAI API key for AI-powered workout generation

**Note:** Most core features (workouts, PRs, profiles) work with just Supabase credentials. Add `DATABASE_URL` only if you need Groups functionality or advanced analytics.

---

## Step-by-Step Vercel Deployment

### Step 1: Get Your Supabase Credentials

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your AXLE project
3. Navigate to: **Settings** → **API**
4. Copy the following values:
   - **Project URL** → This is your `SUPABASE_URL` and `VITE_SUPABASE_URL`
   - **anon public** key → This is your `SUPABASE_ANON_KEY` and `VITE_SUPABASE_ANON_KEY`
   - **service_role** key (click reveal) → This is your `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **KEEP SECRET**

### Step 2: Get Your Database Connection String (Optional - For Groups & Advanced Features)

**Skip this step if you don't need Groups functionality or advanced analytics.**

1. In Supabase Dashboard, go to: **Settings** → **Database**
2. Scroll to **Connection string** section
3. Select **Connection Pooling** → **Transaction Mode**
4. Copy the connection string
5. Replace `[YOUR-PASSWORD]` with your actual database password
6. **Important:** Add `?sslmode=require` at the end for production SSL
7. This is your `DATABASE_URL`

**Example format:**
```
postgresql://postgres.[project-ref]:[password]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?sslmode=require
```

**Why SSL mode?** Vercel serverless functions require SSL connections to PostgreSQL databases for security.

### Step 3: Add Environment Variables to Vercel

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your AXLE project
3. Click **Settings** → **Environment Variables**
4. Add each variable one by one:

#### Add Critical Variables (Required for all deployments)

| **Variable Name** | **Value** | **Environment** |
|------------------|-----------|----------------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhb...` (service_role key) | Production |
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` | Production |
| `VITE_SUPABASE_ANON_KEY` | `eyJhb...` (anon public key) | Production |
| `SUPABASE_ANON_KEY` | `eyJhb...` (anon public key) | Production |

#### Add Important Variables (For Groups & Advanced Features)

| **Variable Name** | **Value** | **Environment** |
|------------------|-----------|----------------|
| `DATABASE_URL` | `postgresql://postgres...[password]@...?sslmode=require` | Production |

#### Add Optional Variables (For enhanced features)

| **Variable Name** | **Value** | **Environment** |
|------------------|-----------|----------------|
| `OPENAI_API_KEY` | `sk-...` (for AI workouts) | Production |
| `RESEND_API_KEY` | For email features | Production |
| `SENTRY_DSN_SERVER` | For error tracking | Production |

**Important Notes:**
- ✅ Select **Production** for the environment
- ✅ Click **Save** after adding each variable
- ⚠️ **Never commit secrets to git** - Always use environment variables
- ⚠️ The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security - keep it secret!

### Step 4: Redeploy Your Application

After adding all environment variables:

1. Go to the **Deployments** tab in Vercel
2. Click the **three dots (...)** on the latest deployment
3. Select **Redeploy**
4. ✅ **Check "Use existing Build Cache"** is UNCHECKED
5. Click **Redeploy**

### Step 5: Verify Deployment

Once deployment completes:

1. Visit your production URL: `https://your-app.vercel.app`
2. Check the health endpoint: `https://your-app.vercel.app/api/healthz`
3. Verify the response shows:
   ```json
   {
     "ok": true,
     "environment": {
       "status": "healthy",
       "missing": {
         "critical": [],
         "required": []
       }
     },
     "database": {
       "status": "healthy"
     }
   }
   ```

4. If status is NOT healthy:
   - Check the `missing` arrays for missing variables
   - Check the `warnings` array for specific issues
   - Review the `database.status` - should be `healthy`

---

## Troubleshooting Common Issues

### Issue: "Failed to load groups" or "Unable to fetch your groups"

**Cause:** Missing `DATABASE_URL` or database connection failed

**Fix:**
1. Check `/api/healthz` endpoint - look for `database.status`
2. Ensure `DATABASE_URL` is configured in Vercel with `?sslmode=require` suffix
3. Verify database password is correct
4. Redeploy the application

### Issue: Workout history not populating

**Cause:** Missing `DATABASE_URL` or database connection failed

**Fix:**
1. Verify `DATABASE_URL` is correct and password is accurate
2. Test database connection: Visit `/api/healthz` and check `database.status`
3. Ensure your IP is allowed in Supabase (usually not needed with connection pooler)

### Issue: Profile picture and name not showing

**Cause:** Missing `DATABASE_URL` or profile API failing

**Fix:**
1. Check browser console for API errors
2. Visit `/api/healthz` to verify database connectivity
3. Ensure `DATABASE_URL` is configured in Vercel

### Issue: PR stats not loading

**Cause:** Database connection issue or missing environment variables

**Fix:**
1. Verify all critical environment variables are set
2. Check `/api/healthz` for database connectivity
3. Review Vercel deployment logs for errors

---

## Vercel Deployment Logs

To view deployment logs:

1. Go to **Deployments** tab
2. Click on the latest deployment
3. Click **View Function Logs** or **Build Logs**
4. Look for error messages about missing environment variables

**Common error messages to look for:**
```
Missing required server env: SUPABASE_URL
Missing required server env: SUPABASE_SERVICE_ROLE_KEY
Missing required server env: DATABASE_URL
```

---

## Quick Checklist

Before deploying to production:

### Critical (Required for all deployments)
- [ ] Added `SUPABASE_URL` to Vercel Production environment
- [ ] Added `SUPABASE_SERVICE_ROLE_KEY` to Vercel Production environment
- [ ] Added `VITE_SUPABASE_URL` to Vercel Production environment
- [ ] Added `VITE_SUPABASE_ANON_KEY` to Vercel Production environment
- [ ] Added `SUPABASE_ANON_KEY` to Vercel Production environment

### Important (For Groups & Advanced Features)
- [ ] Added `DATABASE_URL` with `?sslmode=require` suffix (if using Groups)

### Optional (Enhanced features)
- [ ] Added `OPENAI_API_KEY` if using AI workout generation
- [ ] Configured error tracking with `SENTRY_DSN_SERVER`

### Post-Deployment
- [ ] Redeployed application after adding variables
- [ ] Verified `/api/healthz` shows `"status": "healthy"`
- [ ] Confirmed `database.status` shows `"healthy"` (if using DATABASE_URL)
- [ ] Tested critical features: workouts, profile, PRs
- [ ] Tested Groups (if DATABASE_URL configured)

---

## Security Best Practices

1. **Never share your `SUPABASE_SERVICE_ROLE_KEY`**
   - This key bypasses Row Level Security
   - Keep it secret and secure

2. **Use environment variables, not hardcoded values**
   - Never commit secrets to git
   - Use Vercel's environment variable system

3. **Rotate keys regularly**
   - If a key is compromised, rotate it immediately
   - Update Vercel environment variables after rotation

4. **Monitor error logs**
   - Check Vercel logs regularly
   - Set up Sentry for production error tracking

---

## Need Help?

If you continue to experience issues after following this guide:

1. Check `/api/healthz` endpoint for detailed status
2. Review Vercel deployment logs
3. Verify all environment variables are set correctly
4. Ensure database password in `DATABASE_URL` is correct
5. Check browser console for frontend errors

For persistent issues, create a support ticket with:
- `/api/healthz` response
- Vercel deployment logs (remove sensitive data)
- Description of the issue
- Steps already attempted
