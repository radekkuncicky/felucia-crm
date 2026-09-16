import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const alt = 'Felucia — software pro montážní a servisní firmy. Od nabídky přes montáž až po pravidelný servis.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'linear-gradient(135deg, #0A120A 0%, #0D1A0E 55%, #1A2E1B 100%)',
          color: '#E8F5E9',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 40 40" fill="none">
            <path d="M20 4C14 4 9 9.5 9 16c0 4 1.5 7.5 4 10l7 10 7-10c2.5-2.5 4-6 4-10 0-6.5-5-12-11-12z" fill="#4CAF50" />
            <path d="M20 10 C20 10 15 14 15 18 C15 20.5 17.5 22 20 22 C20 22 20 16 20 10Z" fill="#0A120A" opacity="0.8" />
            <path d="M20 10 C20 10 25 14 25 18 C25 20.5 22.5 22 20 22 C20 22 20 16 20 10Z" fill="#0A120A" opacity="0.5" />
          </svg>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>felucia</div>
          <div
            style={{
              marginLeft: 'auto',
              fontSize: 22,
              fontWeight: 600,
              color: '#4CAF50',
              border: '2px solid rgba(76,175,80,0.45)',
              borderRadius: 999,
              padding: '10px 22px',
              background: 'rgba(76,175,80,0.12)',
            }}
          >
            Systém pro montážní a servisní firmy
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 18, fontSize: 72, fontWeight: 700, lineHeight: 1.1, letterSpacing: -2 }}>
            <span>Od nabídky přes</span>
            <span style={{ color: '#4CAF50' }}>montáž</span>
            <span>až po pravidelný</span>
            <span style={{ color: '#C8A97A' }}>servis.</span>
          </div>
          <div style={{ fontSize: 28, color: '#A5C8A5', lineHeight: 1.4, maxWidth: 1000 }}>
            Felucia propojí kancelář a techniky v jednom systému. Nabídky, podklady k montáži, skutečně použitý materiál i předávací protokoly u konkrétní zakázky.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 24, color: '#6B8F6B' }}>
          <span>Klimatizace · Tepelná čerpadla · Rekuperace · Servis</span>
          <span style={{ color: '#81C784', fontWeight: 600 }}>felucia.io</span>
        </div>
      </div>
    ),
    { ...size },
  )
}
