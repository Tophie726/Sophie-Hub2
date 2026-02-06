/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hide "X-Powered-By: Next.js" header (server info disclosure)
  poweredByHeader: false,

  allowedDevOrigins: [
    'http://toms-macbook-pro.tail2387f7.ts.net:3000',
  ],

  // Security headers
  async headers() {
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
            value: process.env.NODE_ENV === 'production'
              ? "default-src 'self'; script-src 'self' 'unsafe-inline' https://us.i.posthog.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.googleusercontent.com; connect-src 'self' https://us.i.posthog.com https://*.supabase.co https://oauth2.googleapis.com; font-src 'self'; frame-ancestors 'none'"
              : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us.i.posthog.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.googleusercontent.com; connect-src 'self' https://us.i.posthog.com https://*.supabase.co https://oauth2.googleapis.com; font-src 'self'; frame-ancestors 'none'",
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
