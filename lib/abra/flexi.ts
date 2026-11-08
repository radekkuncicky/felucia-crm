/**
 * ABRA Flexi REST API (docs: https://demo.flexibee.eu/devdoc/) — čtení + úzký zápis.
 *
 * Napojení je zatím jedno na instanci (NANTO, účetní Rocketas): přístup v .env
 * ABRA_FLEXI_URL / _COMPANY / _USER / _PASSWORD a org, ke které patří, v
 * ABRA_FLEXI_ORG_SLUG. Flexi je ostré účetnictví — GET jen do evidencí, které
 * účetní povolili, zápis (`abraZapis`) jen do ZAPISOVATELNE_EVIDENCE.
 */

/** Evidence, které nám účetní povolili (banka, přijaté faktury, interní doklady NE) */
const POVOLENE_EVIDENCE = new Set(['faktura-vydana', 'zakazka', 'adresar', 'cenik'])
/** Kam smíme zapisovat (F2). Faktury záměrně NE — ty až po výslovném souhlasu. */
const ZAPISOVATELNE_EVIDENCE = new Set(['zakazka', 'adresar'])

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
function hlavicky(k: AbraKonfigurace) {
  return {
    Authorization: `Basic ${Buffer.from(`${k.uzivatel}:${k.heslo}`).toString('base64')}`,
    Accept: 'application/json',
  }
}

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
    headers: hlavicky(k),
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

/**
 * GET jednoho záznamu podle ID (číselné nebo `ext:…`/`code:…`) → záznam, nebo
 * null, když neexistuje (Flexi vrací 404).
 */
export async function abraGetJeden<T = Record<string, unknown>>(
  k: AbraKonfigurace,
  evidence: string,
  id: string,
  params: Record<string, string> = {},
): Promise<T | null> {
  if (!POVOLENE_EVIDENCE.has(evidence)) throw new AbraChyba(`Evidence ${evidence} není povolená`)
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${k.url}/c/${encodeURIComponent(k.firma)}/${evidence}/${encodeURIComponent(id)}.json${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    headers: hlavicky(k),
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000),
  })
  if (res.status === 404) return null
  const body = await res.json().catch(() => null) as { winstrom?: Record<string, unknown> } | null
  if (!res.ok || !body?.winstrom || body.winstrom.success === 'false') {
    const msg = typeof body?.winstrom?.message === 'string' ? body.winstrom.message : `HTTP ${res.status}`
    throw new AbraChyba(`ABRA ${evidence}/${id}: ${msg}`)
  }
  return ((body.winstrom[evidence] as T[] | undefined) ?? [])[0] ?? null
}

export interface AbraVysledekZapisu {
  /** ID nového/změněného záznamu ve Flexi (u dry-run Flexi vrací dočasné) */
  id: string | null
  dryRun: boolean
}

/**
 * POST jednoho záznamu do evidence. `dryRun` = Flexi zápis zvaliduje a provede
 * nanečisto (`?dry-run=true`), nic neuloží. Pozor: Flexi POST bez `id`/`ext:`
 * vždy zakládá nový záznam — kontrolu duplicity musí udělat volající.
 */
export async function abraZapis(
  k: AbraKonfigurace,
  evidence: string,
  zaznam: Record<string, unknown>,
  opts: { dryRun?: boolean } = {},
): Promise<AbraVysledekZapisu> {
  if (!ZAPISOVATELNE_EVIDENCE.has(evidence)) throw new AbraChyba(`Do evidence ${evidence} se nezapisuje`)
  const qs = opts.dryRun ? '?dry-run=true' : ''
  const res = await fetch(`${k.url}/c/${encodeURIComponent(k.firma)}/${evidence}.json${qs}`, {
    method: 'POST',
    headers: { ...hlavicky(k), 'Content-Type': 'application/json' },
    body: JSON.stringify({ winstrom: { [evidence]: [zaznam] } }),
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000),
  })
  const body = await res.json().catch(() => null) as {
    winstrom?: { success?: string; message?: string; results?: { id?: string; errors?: { message?: string }[] }[] }
  } | null
  const w = body?.winstrom
  if (!res.ok || !w || w.success === 'false') {
    const chyby = w?.results?.flatMap(r => r.errors ?? []).map(e => e.message).filter(Boolean).join('; ')
    throw new AbraChyba(`ABRA zápis ${evidence}: ${chyby || w?.message || `HTTP ${res.status}`}`)
  }
  return { id: w.results?.[0]?.id ?? null, dryRun: !!opts.dryRun }
}
