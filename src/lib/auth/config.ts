import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

// Helper to refresh the access token
async function refreshAccessToken(token: any) {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      throw refreshedTokens
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + refreshedTokens.expires_in,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    }
  } catch (error) {
    console.error('Error refreshing access token:', error)
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    }
  }
}

export const authOptions: NextAuthOptions = {
  // Trust the host header - allows both localhost and Tailscale to work
  // NextAuth will auto-detect the callback URL from the request
  trustHost: true,
  pages: {
    signIn: '/login.html',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/spreadsheets.readonly',
          ].join(' '),
          access_type: 'offline',
          // Use 'select_account' to show account picker without re-asking for permissions
          // Only shows full consent on first login or when scopes change
          prompt: 'select_account',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Restrict to allowed email domains (set ALLOWED_EMAIL_DOMAINS in .env.local)
      // Example: ALLOWED_EMAIL_DOMAINS=sophiesociety.com,gmail.com
      // Leave unset or empty to allow all domains (useful for development)
      const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS?.split(',').map(d => d.trim()).filter(Boolean)

      if (allowedDomains && allowedDomains.length > 0 && user.email) {
        const emailDomain = user.email.split('@')[1]
        if (!allowedDomains.includes(emailDomain)) {
          // Return false to deny access, or a URL to redirect to an error page
          return '/login.html?error=unauthorized_domain'
        }
      }

      return true
    },
    async jwt({ token, account }) {
      // Initial sign in - persist the OAuth access_token and refresh_token
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        }
      }

      // Return previous token if the access token has not expired yet
      if (token.expiresAt && Date.now() < (token.expiresAt as number) * 1000) {
        return token
      }

      // Access token has expired, try to refresh it
      return await refreshAccessToken(token)
    },
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken as string
      session.error = token.error as string | undefined
      return session
    },
  },
  session: {
    strategy: 'jwt',
  },
}

// Extend the built-in session types
declare module 'next-auth' {
  interface Session {
    accessToken?: string
    error?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
    error?: string
  }
}
