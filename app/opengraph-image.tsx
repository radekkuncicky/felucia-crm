import { ImageResponse } from 'next/og'

// OG/Twitter obrázek homepage - stejný text a styl jako nová homepage
// (components/marketing/homepage/content.ts HERO, světlé pozadí, řetěz dokladů).
export const runtime = 'nodejs'
export const alt = 'Felucia: Co prodáte, to se namontuje. Co se použije, to se vyúčtuje.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const DOKLADY = ['OP-26-101', 'NAB-26-0101', 'SOD-26-101', '26-101', 'PP-26-101', 'VYU-26-101', 'servis']

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
          padding: '60px 72px',
          background: '#FAFAF7',
          color: '#15181A',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg width="52" height="52" viewBox="0 0 40 40" fill="none">
            <path d="M20 4C14 4 9 9.5 9 16c0 4 1.5 7.5 4 10l7 10 7-10c2.5-2.5 4-6 4-10 0-6.5-5-12-11-12z" fill="#4CAF50" />
            <path d="M20 10 C20 10 15 14 15 18 C15 20.5 17.5 22 20 22 C20 22 20 16 20 10Z" fill="#FAFAF7" opacity="0.8" />
            <path d="M20 10 C20 10 25 14 25 18 C25 20.5 22.5 22 20 22 C20 22 20 16 20 10Z" fill="#FAFAF7" opacity="0.5" />
          </svg>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>felucia</div>
          <div style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 600, color: '#2E7D32' }}>
            Systém pro montážní a servisní firmy
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 68, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 }}>
          <span>Co prodáte, to se namontuje.</span>
          <span>Co se použije, to se vyúčtuje.</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, maxWidth: 900 }}>
            {DOKLADY.map(d => (
              <div
                key={d}
                style={{
                  display: 'flex',
                  fontSize: 22,
                  fontFamily: 'monospace',
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1.5px solid #C8E6C9',
                  background: '#EAF5EA',
                  color: '#1F5E23',
                }}
              >
                {d}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 26, fontWeight: 600, color: '#2E7D32' }}>felucia.io</span>
        </div>
      </div>
    ),
    { ...size },
  )
}
