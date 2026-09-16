import { MetadataRoute } from 'next'
import { CONTENT_UPDATED, SITE_URL } from '@/lib/landing'

// Jen veřejné marketingové stránky. Login/CRM/tokenové odkazy jsou noindex
// (middleware X-Robots-Tag + robots.txt), do sitemapy nepatří.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: new Date(CONTENT_UPDATED.home), changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/support`, lastModified: new Date(CONTENT_UPDATED.support), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/terms`, lastModified: new Date(CONTENT_UPDATED.terms), changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/privacy`, lastModified: new Date(CONTENT_UPDATED.privacy), changeFrequency: 'yearly', priority: 0.2 },
  ]
}
