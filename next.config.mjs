/** @type {import('next').NextConfig} */

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com https://vercel.live;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' blob: data: https://*.supabase.co https://avatars.githubusercontent.com;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://*.supabase.co https://va.vercel-scripts.com wss://*.supabase.co https://api.anthropic.com https://api.notion.com https://waba.360dialog.io https://www.payfast.co.za https://sandbox.payfast.co.za;
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self' https://www.payfast.co.za https://sandbox.payfast.co.za;
  upgrade-insecure-requests;
`.replace(/\n/g, ' ').trim()

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',    value: 'on' },
  { key: 'X-XSS-Protection',          value: '1; mode=block' },
  { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy',   value: ContentSecurityPolicy },
]

const nextConfig = {
  // ── Security headers ────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/icons/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },

  // ── Server Actions ───────────────────────────────────────────
  serverActions: {
    allowedOrigins: [
      'localhost:3000',
      process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') ?? '',
    ].filter(Boolean),
  },

  // ── Image optimisation ──────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
  },

  // ── Package import optimisation ──────────────────────────────
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-dropdown-menu',
      'recharts',
      'framer-motion',
    ],
  },

  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
}

export default nextConfig
