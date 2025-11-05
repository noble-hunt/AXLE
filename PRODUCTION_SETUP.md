# 🚀 Vercel Production Deployment Guide

## ❌ Current Issues

Your Vercel production app is experiencing database connection failures:
- ❌ Profile name/picture not loading (shows username only)
- ❌ Workout history empty (shows "No completed workouts yet")
- ❌ Groups failing to load (shows "Failed to load groups")

**Root Cause:** Missing or misconfigured environment variables in Vercel production environment.

---

## ✅ Required Environment Variables

Your app needs these environment variables configured in Vercel:

### 1. **CRITICAL** - App will crash without these
```bash
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```
- **Where to get it:** 
  - `DATABASE_URL`: From your Neon/Postgres dashboard
  - Supabase vars: Supabase Project Settings → API → Service Role Key
- **Critical:** App will not start without these

### 2. **REQUIRED** - For frontend/client functionality
```bash
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```
- **Where to get it:** Supabase Project Settings → API → Anon Public Key
- **Note:** `VITE_*` variables are exposed to browser, use anon key only

### 3. **IMPORTANT** - For core features
```bash
OPENAI_API_KEY="sk-..."
```
- **Where to get it:** [OpenAI API Dashboard](https://platform.openai.com/api-keys)
- **Required for:** AI-powered workout generation
- **Fallback Behavior:** 
  - ✅ **WITH** OPENAI_API_KEY: Generates creative, unique workouts using AI
  - ⚠️ **WITHOUT** OPENAI_API_KEY: Falls back to template-based mock workouts
  - The app will work in production without this key, but workout quality will be reduced
  - For production use, setting this key is **highly recommended**

### 4. **OPTIONAL** - For enhanced features

#### Email Sending (for notifications, invites)
```bash
RESEND_API_KEY="re_..."
```

#### Error Tracking (Sentry)
```bash
SENTRY_DSN_SERVER="https://...@sentry.io/..."
SENTRY_ENV="production"
```

#### Wearable/Health Integrations
All health providers require BOTH client_id AND client_secret:

```bash
# Oura Ring
OURA_CLIENT_ID="..."
OURA_CLIENT_SECRET="..."

# Fitbit
FITBIT_CLIENT_ID="..."
FITBIT_CLIENT_SECRET="..."

# Garmin
GARMIN_CLIENT_ID="..."
GARMIN_CLIENT_SECRET="..."
GARMIN_REDIRECT_URL="https://your-app.vercel.app/api/garmin/callback"

# WHOOP
WHOOP_CLIENT_ID="..."
WHOOP_CLIENT_SECRET="..."
```
**Note:** Each provider requires BOTH the ID and SECRET. Missing the SECRET will cause integration to fail.

#### Site Configuration
```bash
VITE_SITE_URL="https://your-app.vercel.app"
# OR
SITE_URL="https://your-app.vercel.app"
```
- Used for OAuth callbacks and email links

#### Admin Access
```bash
ADMIN_EMAILS="admin@example.com,user@example.com"
```
- Comma-separated list of admin email addresses

### 5. **FEATURE FLAGS** - For development/testing

These control workout generation behavior:

```bash
# Force premium generator (default: true in dev)
HOBH_FORCE_PREMIUM="true"

# Disable simple generator fallback
AXLE_DISABLE_SIMPLE="1"

# Disable mock generator fallback
AXLE_DISABLE_MOCK="1"

# Use notes-only mode (no OpenAI calls)
HOBH_PREMIUM_NOTES_MODE="local"

# Strict premium mode (fail if OpenAI unavailable)
HOBH_PREMIUM_STRICT="1"
```

**Note:** In production, you typically want:
- `HOBH_FORCE_PREMIUM="true"` - Use best quality generation
- `AXLE_DISABLE_SIMPLE="1"` - Don't fall back to simple generator
- Other flags optional based on your needs

### 6. **ALTERNATIVE AI PROVIDERS** (Optional)

```bash
# Azure OpenAI (alternative to OpenAI)
AZURE_OPENAI_API_KEY="..."

# Generic model API key (fallback for OpenAI)
MODEL_API_KEY="sk-..."
```
**Note:** The app will use OpenAI → Azure OpenAI → MODEL_API_KEY in that order

---

## 📝 Step-by-Step Setup

### Step 1: Get Your Environment Variables from Replit

1. In Replit, click the **Secrets** tab (lock icon)
2. Copy the values for:
   - `DATABASE_URL`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY` (optional)

### Step 2: Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - **Key:** Variable name (e.g., `DATABASE_URL`)
   - **Value:** Copy from Replit Secrets
   - **Environment:** Select "Production" (or All)
4. Click **Save** for each variable

### Step 3: Create Production Database Tables

Your production database needs the same schema as development:

**Option A: Use Drizzle Push (Recommended)**
```bash
# Set DATABASE_URL to your production database
export DATABASE_URL="postgresql://..."
npm run db:push
```

**Option B: Manual Migration**
1. Export development database schema:
   ```bash
   pg_dump -s $DATABASE_URL > schema.sql
   ```
2. Import to production database:
   ```bash
   psql $PROD_DATABASE_URL < schema.sql
   ```

### Step 4: Redeploy on Vercel

After setting environment variables:
1. Go to **Deployments** tab in Vercel
2. Click **Redeploy** on the latest deployment
3. OR push a new commit to trigger automatic deployment

---

## 🔍 Verify Environment Variables

After setting environment variables in Vercel, verify they're configured correctly:

**Visit the Health Check Endpoint:**
```
https://your-app.vercel.app/api/healthz
```

This endpoint shows:
- ✅ Which environment variables are configured (without exposing values)
- ⚠️ Which variables are missing, categorized by importance
- 🟢 Overall health status: `healthy`, `degraded`, or `critical`
- 💡 Helpful warnings and recommendations

**Example Response:**
```json
{
  "ok": true,
  "environment": {
    "status": "degraded",
    "variables": {
      "critical": {
        "DATABASE_URL": "configured",
        "SUPABASE_URL": "configured",
        "SUPABASE_SERVICE_ROLE_KEY": "configured"
      },
      "required": {
        "VITE_SUPABASE_URL": "configured",
        "VITE_SUPABASE_ANON_KEY": "missing",
        "SUPABASE_ANON_KEY": "configured"
      },
      "important": {
        "OPENAI_API_KEY": "missing"
      }
    },
    "warnings": [
      "⚠️ 1 required variable(s) missing - core features unavailable: VITE_SUPABASE_ANON_KEY",
      "⚠️ 1 important variable(s) missing - some features limited: OPENAI_API_KEY"
    ]
  }
}
```

**Status Meanings:**
- `healthy` 🟢 - All critical, required, and important variables configured
- `degraded` 🟡 - Some variables missing, app works but with reduced functionality
- `critical` 🔴 - Critical variables missing, app may crash

---

## 🐛 Troubleshooting

### Issue: "Failed to load groups"
**Cause:** Database connection failure or missing tables  
**Fix:** Verify `DATABASE_URL` is set and points to a database with proper schema

### Issue: Profile showing username but no name/picture
**Cause:** Profile data not in database OR hydration failing  
**Fix:** Check that `profiles` table exists and has data for your user

### Issue: "No completed workouts yet"
**Cause:** Workouts table empty or Supabase credentials missing  
**Fix:** Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly

### Issue: Workout generation failing
**Cause:** Missing `OPENAI_API_KEY` OR Supabase database access  
**Fix:** Add `OPENAI_API_KEY` environment variable in Vercel

---

## 🎯 Quick Test Checklist

After deployment, verify:
- [ ] Home page shows your full name (not just username)
- [ ] Profile picture appears in welcome banner
- [ ] Workout history loads (if you have workouts)
- [ ] Groups page loads without errors
- [ ] You can create a new workout
- [ ] You can log a PR

---

## 💡 Production vs Development Databases

**IMPORTANT:** Your development (Replit) and production (Vercel) environments should use **separate databases**:

- **Development:** Replit-provided Neon database
- **Production:** Your own Neon database OR use same database with caution

**Recommendation:** Create a separate production database to avoid data conflicts.

---

## 📞 Need Help?

Common issues:
1. **Environment variables not taking effect:** Redeploy after adding variables
2. **Database connection errors:** Check `DATABASE_URL` format and credentials
3. **CORS errors:** Ensure `VITE_SUPABASE_URL` matches `SUPABASE_URL`
4. **Missing tables:** Run migrations on production database

For Vercel deployment logs:
- Go to Vercel Dashboard → Deployments → Click on deployment → View Function Logs
