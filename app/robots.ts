import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://stokvelos.co.za'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/auth/login', '/auth/signup'],
        disallow: [
          '/dashboard',
          '/members',
          '/contributions',
          '/meetings',
          '/reports',
          '/settings',
          '/setup',
          '/api/',
          '/_next/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
