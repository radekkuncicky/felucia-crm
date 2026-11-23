'use client'

import { useEffect, useRef } from 'react'
import { getSession, useSession } from 'next-auth/react'

/**
 * Když session zanikne pod rukama (vypršela, změna hesla na jiném zařízení,
 * deaktivace), uživatel místo nefunkčních akcí a toastu „Unauthorized“
 * skončí na přihlášení s vysvětlením a návratem na rozdělanou stránku.
 *
 * Dva spouštěče: změna stavu useSession (refetch při návratu do okna) a 401
 * z vlastního /api (ověří se přes getSession — 401 může být i legitimní).
 */
const MIMO_APLIKACI = ['/auth', '/login', '/forgot-password', '/reset-password', '/magic-link', '/podpis', '/nabidka', '/zarizeni', '/demo', '/oauth']

let odhlasuji = false
let presmerovano = false

function naPrihlaseni() {
  if (odhlasuji || presmerovano) return
  const { pathname, search } = window.location
  if (pathname === '/' || MIMO_APLIKACI.some(p => pathname === p || pathname.startsWith(p + '/'))) return
  presmerovano = true
  window.location.href = `/auth/signin?reason=expired&callbackUrl=${encodeURIComponent(pathname + search)}`
}

export default function SessionWatch() {
  const { status } = useSession()
  const bylPrihlasen = useRef(false)

  useEffect(() => {
    if (status === 'authenticated') bylPrihlasen.current = true
    else if (status === 'unauthenticated' && bylPrihlasen.current) naPrihlaseni()
  }, [status])

  useEffect(() => {
    const puvodni = window.fetch
    let kontroluji = false
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      // Vlastní odhlášení není „vypršelo“
      if (url.includes('/api/auth/signout')) odhlasuji = true
      const res = await puvodni(input, init)
      if (res.status === 401 && bylPrihlasen.current && !kontroluji) {
        let path = ''
        try { const u = new URL(url, window.location.href); if (u.origin === window.location.origin) path = u.pathname } catch { /* cizí URL */ }
        if (path.startsWith('/api/') && !path.startsWith('/api/auth/') && !path.startsWith('/api/public/') && !path.startsWith('/api/mobile/')) {
          kontroluji = true
          getSession().then(s => { if (!s) naPrihlaseni() }).finally(() => { kontroluji = false })
        }
      }
      return res
    }
    return () => { window.fetch = puvodni }
  }, [])

  return null
}
