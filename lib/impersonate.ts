import { cookies } from 'next/headers'
import { signCookieValue, verifyCookieValue } from './signedCookie'

export const IMPERSONATE_COOKIE = 'sa_impersonate'

export type ImpersonateCookie = {
  superAdminId: string
  superAdminJmeno: string
  orgId: string
  orgNazev: string
  impersonatingUserId: string
  /** Kdy impersonace začala (ms) — cookie z dřívějšího přihlášení se nepoužije */
  vytvoreno?: number
}

/** Ověřená impersonační cookie aktuálního requestu (null mimo request context nebo bez cookie) */
export function readImpersonateCookie(): ImpersonateCookie | null {
  try {
    const raw = cookies().get(IMPERSONATE_COOKIE)?.value
    return verifyCookieValue<ImpersonateCookie>(raw, IMPERSONATE_COOKIE)
  } catch {
    // cookies() mimo request (build, worker, testy)
    return null
  }
}

/** Smazat impersonační cookie (route handler / server action; jinde tiše nic) */
export function clearImpersonateCookie() {
  try {
    cookies().delete(IMPERSONATE_COOKIE)
  } catch {
    // mimo route handler cookies nejdou měnit
  }
}

export { signCookieValue, verifyCookieValue }
