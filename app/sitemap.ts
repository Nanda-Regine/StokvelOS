// app/sitemap.ts
import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://stokvelos.co.za'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url:              `${BASE_URL}/`,
      lastModified:     new Date(),
      changeFrequency:  'monthly',
      priority:         1,
    },
    {
      url:              `${BASE_URL}/pricing`,
      lastModified:     new Date(),
      changeFrequency:  'monthly',
      priority:         0.9,
    },
    {
      url:              `${BASE_URL}/auth/login`,
      lastModified:     new Date(),
      changeFrequency:  'yearly',
      priority:         0.5,
    },
    {
      url:              `${BASE_URL}/auth/signup`,
      lastModified:     new Date(),
      changeFrequency:  'yearly',
      priority:         0.7,
    },
  ]
}
