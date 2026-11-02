/**
 * ABRA Flexi REST API — jen ČTENÍ (docs: https://demo.flexibee.eu/devdoc/).
 *
 * Napojení je zatím jedno na instanci (NANTO, účetní Rocketas): přístup v .env
 * ABRA_FLEXI_URL / _COMPANY / _USER / _PASSWORD a org, ke které patří, v
 * ABRA_FLEXI_ORG_SLUG. Flexi je ostré účetnictví — klient záměrně neumí nic
 * jiného než GET a pouští jen do evidencí, které účetní povolili.
 */

/** Evidence, které nám účetní povolili (banka, přijaté faktury, interní doklady NE) */
const POVOLENE_EVIDENCE = new Set(['faktura-vydana', 'zakazka', 'adresar', 'cenik'])

export interface AbraKonfigurace {
  url: string
  firma: string
  uzivatel: string
  heslo: string
  orgSlug: string
}

export function abraKonfigurace(): AbraKonfigurace | null {
  const e = process.env
  if (!e.ABRA_FLEXI_URL || !e.ABRA_FLEXI_COMPANY || !e.ABRA_FLEXI_USER || !e.ABRA_FLEXI_PASSWORD || !e.ABRA_FLEXI_ORG_SLUG) return null
  return {
    url: e.ABRA_FLEXI_URL.replace(/\/+$/, ''),
    firma: e.ABRA_FLEXI_COMPANY,
    uzivatel: e.ABRA_FLEXI_USER,
    heslo: e.ABRA_FLEXI_PASSWORD,
    orgSlug: e.ABRA_FLEXI_ORG_SLUG,
  }
}

export class AbraChyba extends Error {}

/**
 * GET `<url>/c/<firma>/<evidence>[/(filtr)].json?…` → pole záznamů evidence.
 * Filtr se píše do cesty (Flexi `?where=` tiše ignoruje) a enkóduje se tady.
 */
export async function abraGet<T = Record<string, unknown>>(
  k: AbraKonfigurace,
  evidence: string,
  opts: { filtr?: string; params?: Record<string, string> } = {},
): Promise<T[]> {
  if (!POVOLENE_EVIDENCE.has(evidence)) throw new AbraChyba(`Evidence ${evidence} není povolená`)
  const filtr = opts.filtr ? `/${encodeURIComponent(`(${opts.filtr})`)}` : ''
  const qs = new URLSearchParams(opts.params ?? {}).toString()
  const res = await fetch(`${k.url}/c/${encodeURIComponent(k.firma)}/${evidence}${filtr}.json${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${Buffer.from(`${k.uzivatel}:${k.heslo}`).toString('base64')}`,
      Accept: 'application/json',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000),
  })
  const body = await res.json().catch(() => null) as { winstrom?: Record<string, unknown> } | null
  if (!res.ok || !body?.winstrom || body.winstrom.success === 'false') {
    const msg = typeof body?.winstrom?.message === 'string' ? body.winstrom.message : `HTTP ${res.status}`
    throw new AbraChyba(`ABRA ${evidence}: ${msg}`)
  }
  return (body.winstrom[evidence] as T[] | undefined) ?? []
}
