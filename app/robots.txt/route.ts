import { NextRequest } from 'next/server'
import { SITE_URL } from '@/lib/landing'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'
const MAIN_HOSTS = new Set([ROOT_DOMAIN, `www.${ROOT_DOMAIN}`, 'localhost', 'localhost:3000', 'localhost:3001'])

// Cesty přihlášené aplikace, tokenových odkazů a nahraných souborů — nikdy neindexovat.
const DISALLOW = [
  '/api/', '/superadmin/', '/auth/', '/login', '/forgot-password', '/reset-password', '/magic-link',
  '/onboarding', '/dashboard', '/deals', '/clients', '/leady', '/products', '/quotes', '/quote-templates',
  '/activities', '/calendar', '/sod', '/cenovka', '/analytics', '/documents', '/zakazky', '/predavaky',
  '/sklad', '/servis', '/settings', '/maintenance', '/nabidka/', '/podpis/', '/zarizeni/', '/uploads/', '/demo',
]

// AI crawlery, které chceme na marketingovém webu výslovně povolit (GEO).
const AI_BOTS = [
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot',
  'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot', 'Applebot-Extended',
  'Amazonbot', 'meta-externalagent', 'DuckAssistBot', 'CCBot', 'cohere-ai', 'YouBot', 'MistralAI-User',
]

function mainRobots(): string {
  const lines: string[] = ['User-agent: *', 'Allow: /']
  for (const d of DISALLOW) lines.push(`Disallow: ${d}`)
  lines.push('')
  for (const bot of AI_BOTS) {
    lines.push(`User-agent: ${bot}`, 'Allow: /')
    for (const d of DISALLOW) lines.push(`Disallow: ${d}`)
    lines.push('')
  }
  lines.push(`Sitemap: ${SITE_URL}/sitemap.xml`, `# LLM-friendly overview: ${SITE_URL}/llms.txt`, '')
  return lines.join('\n')
}

// Tenant subdomény ({slug}.felucia.io) a jiné hosty = přihlášené CRM, nikdy neindexovat.
const TENANT_ROBOTS = 'User-agent: *\nDisallow: /\n'

export function GET(req: NextRequest) {
  const host = (req.headers.get('host') || '').toLowerCase()
  const body = MAIN_HOSTS.has(host) ? mainRobots() : TENANT_ROBOTS
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'X-Robots-Tag': 'noindex',
    },
  })
}
