'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

// QR štítek zařízení (felucia.io/zarizeni/<token>) — stáhnout PNG / tisk / kopírovat URL.
// Přeneseno ze /servis/zarizeni; používá portfolio i tab Servis na klientovi.
export default function QrModal({ zarizeni, onClose }: { zarizeni: { id: string; nazev: string; qrToken: string | null }; onClose: () => void }) {
  const [qrSvg, setQrSvg] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        let token = zarizeni.qrToken
        if (!token) {
          const res = await api.get<{ qrToken: string }>(`/api/servis/zarizeni/${zarizeni.id}/qr-token`,
            { errorMessage: 'QR kód se nepodařilo vygenerovat.' })
          if (!res.ok || !res.data) return
          token = res.data.qrToken
        }
        const url = `https://felucia.io/zarizeni/${token}`
        setQrUrl(url)

        const QRCode = (await import('qrcode')).default
        const svg = await QRCode.toString(url, { type: 'svg', margin: 2, width: 240 })
        setQrSvg(svg)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [zarizeni.id, zarizeni.qrToken])

  async function downloadPng() {
    if (!qrUrl) return
    const QRCode = (await import('qrcode')).default
    const canvas = document.createElement('canvas')
    await QRCode.toCanvas(canvas, qrUrl, { width: 400, margin: 2 })
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `qr-${zarizeni.nazev.replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }

  function printQr() {
    const win = window.open('', '_blank')
    if (!win || !qrSvg) return
    win.document.write(`<html><head><title>QR - ${zarizeni.nazev}</title>
    <style>
      body { font-family: 'Inter', sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; margin:0; background:#fff; }
      .qr-print { display:flex; flex-direction:column; align-items:center; gap:12px; }
      h2 { font-size:18px; font-weight:700; color:#1a1a2e; text-align:center; }
      p { font-size:11px; color:#6b7280; text-align:center; word-break:break-all; max-width:280px; }
    </style>
    </head><body>
    <div class="qr-print">
      ${qrSvg}
      <h2>${zarizeni.nazev}</h2>
      <p>${qrUrl ?? ''}</p>
    </div>
    </body></html>`)
    win.document.close()
    win.print()
  }

  function copyUrl() {
    if (!qrUrl) return
    navigator.clipboard.writeText(qrUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">QR kód</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 flex flex-col items-center gap-4">
          <p className="text-sm text-gray-600 dark:text-slate-400 text-center font-medium">{zarizeni.nazev}</p>

          <div className="w-60 h-60 flex items-center justify-center bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            {loading ? (
              <div className="text-gray-400 text-sm">Načítám…</div>
            ) : qrSvg ? (
              <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
            ) : (
              <div className="text-red-500 text-sm text-center px-4">Chyba generování</div>
            )}
          </div>

          {qrUrl && (
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center break-all max-w-full">{qrUrl}</p>
          )}

          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={downloadPng}
              disabled={!qrSvg}
              className="w-full py-2 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-lg disabled:opacity-40 transition-colors"
            >
              ⬇ Stáhnout PNG
            </button>
            <button
              onClick={printQr}
              disabled={!qrSvg}
              className="w-full py-2 text-sm font-medium bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-800 dark:text-white rounded-lg disabled:opacity-40 transition-colors"
            >
              Tisknout
            </button>
            <button
              onClick={copyUrl}
              disabled={!qrUrl}
              className="w-full py-2 text-sm font-medium border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg disabled:opacity-40 transition-colors"
            >
              {copied ? '✓ Zkopírováno!' : 'Kopírovat URL'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

