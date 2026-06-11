import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', disallow: ['/api/', '/superadmin/', '/(dashboard)/'] },
    ],
    sitemap: 'https://felucia.io/sitemap.xml',
  }
}
