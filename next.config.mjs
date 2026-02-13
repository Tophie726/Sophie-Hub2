/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hide "X-Powered-By: Next.js" header (server info disclosure)
  poweredByHeader: false,

  allowedDevOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://toms-macbook-pro.tail2387f7.ts.net:3000',
  ],

  // Security headers
  async headers() {
    if (process.env.NODE_ENV !== 'production') {
      return [];
    }

    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            // NOTE: 'unsafe-inline' is an accepted risk for Next.js App Router.
            // See: src/docs/audits/csp-accepted-risk.md
            value: process.env.NODE_ENV === 'production'
              ? "default-src 'self'; script-src 'self' 'unsafe-inline' https://us.i.posthog.com https://us-assets.i.posthog.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.googleusercontent.com https://lh3.google.com https://*.slack-edge.com; connect-src 'self' https://us.i.posthog.com https://us-assets.i.posthog.com https://*.supabase.co https://oauth2.googleapis.com; font-src 'self'; frame-ancestors 'none'"
              : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us.i.posthog.com https://us-assets.i.posthog.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.googleusercontent.com https://lh3.google.com https://*.slack-edge.com; connect-src 'self' https://us.i.posthog.com https://us-assets.i.posthog.com https://*.supabase.co https://oauth2.googleapis.com; font-src 'self'; frame-ancestors 'none'",
          },
          ...(process.env.VERCEL ? [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
