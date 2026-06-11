import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://felucia.io', lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
    { url: 'https://felucia.io/login', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.5 },
  ]
}
