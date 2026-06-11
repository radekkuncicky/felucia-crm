'use client'

import { signOut } from 'next-auth/react'

export default function DemoBanner() {

  return (
    <div
      className="fixed left-0 right-0 z-50 flex items-center justify-between px-4 py-2 text-sm font-medium"
      style={{ background: 'linear-gradient(90deg, #7B2FBE, #00D4C8)', color: '#fff', top: 0, height: 40 }}
    >
      <span>
        Demo prostředí — data se neukládají · Dáša je aktivní až v naučeném prostředí
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => {
            const target = window.top ?? window
            target.location.href = '/#pricing'
          }}
          style={{
            background: '#fff', color: '#7B2FBE', borderRadius: 6, padding: '2px 12px',
            fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
          }}
        >
          Vyzkoušet 14 dní →
        </button>
        <button
          onClick={() => void signOut({ callbackUrl: '/' })}
          style={{
            background: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: 6,
            padding: '2px 10px', fontSize: 12, border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer',
          }}
        >
          Ukončit demo
        </button>
      </div>
    </div>
  )
}
