# Neon Auth Integration Guide

> **Status:** Neon Auth support was removed in favor of Clerk-only authentication. This document is retained for historical reference only. Do not follow these steps for current deployments.

This app now uses [Neon Auth](https://neon.com/docs/neon-auth/overview) for native authentication with automatic Postgres user sync.

## Setup Instructions

### 1. Enable Neon Auth in Neon Console

1. Go to your Neon project in the [Neon Console](https://console.neon.tech)
2. Navigate to **Neon Auth** settings
3. Enable Neon Auth for your project
4. Copy your **App ID** and **API Key**

### 2. Configure Environment Variables

Add these to your `.env` file:

```env
# Neon Auth Configuration
NEON_AUTH_APP_ID=your_app_id_from_neon_console
NEON_AUTH_API_KEY=your_api_key_from_neon_console
NEON_AUTH_URL=https://auth.neon.tech  # Default, or your custom domain
```

### 3. Enable OAuth Providers

In Neon Console > Neon Auth settings:
- Enable **Google OAuth**
- Configure Google OAuth credentials (Client ID & Secret)
- Set redirect URI to: `https://your-domain.com` (or `http://localhost:4577` for dev)

### 4. Database Schema

Neon Auth automatically creates and manages user tables in your Postgres database. Your existing `users` table will work alongside Neon Auth's tables, or you can migrate to use Neon Auth's user structure.

**Note:** Neon Auth syncs user data automatically. Your `listings` table should reference Neon Auth's user ID structure.

### 5. Install Dependencies

```bash
npm install @neondatabase/stack-js
```

## How It Works

1. **User Signs In**: Click "Sign in with Google" → Redirects to Google → Returns to app
2. **Automatic Sync**: Neon Auth automatically syncs user data to your Postgres database
3. **Session Management**: Neon Auth handles sessions and tokens
4. **Backend Integration**: Your backend can query user data directly from Postgres

## Backend Integration

Your backend endpoints can now query users directly from Postgres:

```sql
-- Users are automatically synced by Neon Auth
SELECT * FROM users WHERE email = 'user@example.com';
```

## Migration from Custom Auth

The app supports both Neon Auth and legacy JWT auth:
- If Neon Auth is configured → Uses Neon Auth
- If not configured → Falls back to legacy email/password auth

## Benefits

✅ **No custom auth code** - Neon handles it all  
✅ **Automatic user sync** - Users always up-to-date in Postgres  
✅ **Built-in OAuth** - Google, GitHub, etc.  
✅ **Teams & Permissions** - Built-in support  
✅ **Real-time sync** - User data stays in sync automatically  

## Documentation

- [Neon Auth Overview](https://neon.com/docs/neon-auth/overview)
- [Neon Auth Best Practices](https://neon.com/docs/neon-auth/best-practices)
- [Neon Auth JavaScript SDK](https://neon.com/docs/neon-auth/sdks-api/javascript)

## Troubleshooting

**Neon Auth not working?**
- Check environment variables are set correctly
- Verify App ID and API Key in Neon Console
- Check browser console for errors
- Ensure OAuth redirect URI matches your domain

**Users not syncing?**
- Neon Auth syncs automatically - check your Postgres `users` table
- Verify database connection is working
- Check Neon Auth logs in Neon Console
