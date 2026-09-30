import { toast } from 'sonner'

/**
 * Jednotný fetch wrapper pro klientské komponenty.
 * Při síťové chybě nebo ne-OK odpovědi automaticky zobrazí toast.error
 * (zprávu vezme z `message`/`error` v JSON odpovědi serveru, jinak fallback;
 * u limitu plánu přidá do toastu odkaz na plány),
 * takže žádná akce neselže potichu.
 *
 * Nevyhazuje výjimky — vrací ApiResult, ať se dá mechanicky nahradit
 * dosavadní vzor `const res = await fetch(...); if (res.ok) { ... }`.
 */

export interface ApiResult<T = unknown> {
  ok: boolean
  status: number
  /** Parsované JSON tělo odpovědi (i u chybové odpovědi), jinak null. */
  data: T | null
}

interface ApiOpts {
  /** Vlastní chybová hláška místo serverové/fallbackové. */
  errorMessage?: string
  /** Nezobrazovat toast — volající si chybu hlásí sám. */
  silent?: boolean
}

const FALLBACK_ERROR = 'Akce se nepodařila. Zkuste to prosím znovu.'
const PLAN_LIMIT = 'PLAN_LIMIT_REACHED'
const NETWORK_ERROR = 'Nepodařilo se spojit se serverem. Zkontrolujte připojení.'

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function apiFetch<T = unknown>(
  url: string,
  init: RequestInit = {},
  opts: ApiOpts = {}
): Promise<ApiResult<T>> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    if (!opts.silent) toast.error(opts.errorMessage ?? NETWORK_ERROR)
    return { ok: false, status: 0, data: null }
  }

  const data = await parseJson<T>(res)

  if (!res.ok) {
    if (!opts.silent) {
      const body = data as { error?: unknown; message?: unknown; code?: unknown; upgradeUrl?: unknown } | null
      // Část API posílá kód v `error` a lidský text v `message` (limity plánu)
      const serverMsg = [body?.message, body?.error].find(
        (m): m is string => typeof m === 'string' && !!m && m !== PLAN_LIMIT,
      )
      const msg = opts.errorMessage ?? serverMsg ?? FALLBACK_ERROR
      if (body?.code === PLAN_LIMIT || body?.error === PLAN_LIMIT) {
        const upgradeUrl = typeof body?.upgradeUrl === 'string' ? body.upgradeUrl : '/settings/billing'
        toast.error(serverMsg ?? 'Dosáhli jste limitu vašeho plánu.', {
          action: { label: 'Zobrazit plány', onClick: () => { window.location.href = upgradeUrl } },
        })
      } else {
        toast.error(msg)
      }
    }
    return { ok: false, status: res.status, data }
  }

  return { ok: true, status: res.status, data }
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return body === undefined
    ? { method }
    : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

/** Zkratky pro běžné JSON požadavky: `api.patch(url, body)` atd. */
export const api = {
  get: <T = unknown>(url: string, opts?: ApiOpts) => apiFetch<T>(url, {}, opts),
  post: <T = unknown>(url: string, body?: unknown, opts?: ApiOpts) =>
    apiFetch<T>(url, jsonInit('POST', body), opts),
  patch: <T = unknown>(url: string, body?: unknown, opts?: ApiOpts) =>
    apiFetch<T>(url, jsonInit('PATCH', body), opts),
  put: <T = unknown>(url: string, body?: unknown, opts?: ApiOpts) =>
    apiFetch<T>(url, jsonInit('PUT', body), opts),
  delete: <T = unknown>(url: string, opts?: ApiOpts) =>
    apiFetch<T>(url, jsonInit('DELETE'), opts),
}
