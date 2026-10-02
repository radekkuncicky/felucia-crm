import { CONTENT_UPDATED, SITE_NAME, SITE_URL } from '@/lib/landing'

// Katalog pro AI agenty podle Agentic Resource Discovery (ARD, github.com/ards-project/ard-spec).
// Lighthouse (audit ard-schema) ho hledá na /.well-known/ai-catalog.json, novější verze
// specifikace na /.well-known/ard.json - servírujeme obojí. Veřejné API ani MCP server
// nemáme, takže jediná položka je llms.txt (přehled webu pro jazykové modely).
// Nepřidávat položky, které reálně neexistují.
export function aiCatalog() {
  return {
    specVersion: '1.0',
    host: {
      displayName: SITE_NAME,
      documentationUrl: `${SITE_URL}/llms.txt`,
      logoUrl: `${SITE_URL}/icon-512.png`,
    },
    entries: [
      {
        identifier: 'urn:air:felucia.io:docs:llms-txt',
        displayName: 'Felucia - přehled produktu pro jazykové modely (llms.txt)',
        type: 'text/markdown',
        url: `${SITE_URL}/llms.txt`,
        description:
          'Věcný přehled systému Felucia pro montážní a servisní firmy (tepelná čerpadla, klimatizace, rekuperace): průchod zakázkou od poptávky po servis, funkce, aplikace pro techniky, ceník, časté otázky a kontakt. Čeština.',
        tags: ['software', 'montážní firmy', 'servisní firmy', 'tepelná čerpadla', 'klimatizace', 'rekuperace', 'řízení zakázek'],
        representativeQueries: [
          'software pro montážní a servisní firmy',
          'systém pro firmy montující tepelná čerpadla a klimatizace',
          'kolik stojí Felucia',
          'jak Felucia řeší předávací protokol a vyúčtování podle skutečně použitého materiálu',
        ],
        updatedAt: new Date(CONTENT_UPDATED.home).toISOString(),
      },
    ],
  }
}

export function aiCatalogResponse() {
  return new Response(JSON.stringify(aiCatalog(), null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
