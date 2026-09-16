import Link from 'next/link'

export const metadata = {
  title: 'Podpora',
  alternates: { canonical: '/support' },
  description: 'Potřebujete pomoc s Felucia CRM? Kontaktujte naši podporu telefonicky nebo e-mailem.',
}

export default function SupportPage() {
  return (
    <div style={{ background: '#060E06', minHeight: '100vh', color: '#C8E6C9' }}>
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid rgba(76,175,80,0.15)', padding: '0 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8 2 5 5.5 5 9c0 5 7 13 7 13s7-8 7-13c0-3.5-3-7-7-7z" fill="#4CAF50" opacity="0.9"/>
              <path d="M12 6c-1.2 1.5-2 3.2-2 4.5 0 1.1.9 2 2 2s2-.9 2-2c0-1.3-.8-3-2-4.5z" fill="#81C784"/>
            </svg>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: '#E8F5E9' }}>felucia</span>
          </Link>
          <Link href="/" style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B8F6B', textDecoration: 'none' }}>
            ← Zpět na hlavní stránku
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '56px 24px 80px' }}>

        <div style={{ marginBottom: 48 }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 700, color: '#E8F5E9', marginBottom: 8 }}>
            Podpora
          </h1>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, lineHeight: 1.8, color: '#A5D6A7' }}>
            Máte dotaz nebo potřebujete pomoct s Felucia CRM? Ozvěte se nám telefonicky nebo e-mailem, rádi pomůžeme.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 20,
          marginBottom: 48,
        }}>
          <a href="tel:+420724347986" style={{
            display: 'block',
            padding: '24px',
            borderRadius: 12,
            border: '1px solid rgba(76,175,80,0.2)',
            background: 'rgba(76,175,80,0.05)',
            textDecoration: 'none',
          }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6B8F6B', marginBottom: 8 }}>
              Telefon
            </p>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: '#E8F5E9' }}>
              +420 724 347 986
            </p>
          </a>

          <a href="mailto:info@felucia.io" style={{
            display: 'block',
            padding: '24px',
            borderRadius: 12,
            border: '1px solid rgba(76,175,80,0.2)',
            background: 'rgba(76,175,80,0.05)',
            textDecoration: 'none',
          }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6B8F6B', marginBottom: 8 }}>
              E-mail
            </p>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: '#E8F5E9' }}>
              info@felucia.io
            </p>
          </a>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid rgba(76,175,80,0.15)', fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#4A6B4A' }}>
          <p>
            EFIKU SOLUTIONS s.r.o. | Výstavní 2224/8, 709 00 Ostrava | IČO: 29703972 | info@efiku.cz | felucia.io
          </p>
          <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
            <Link href="/terms" style={{ color: '#6B8F6B', textDecoration: 'none' }}>Všeobecné obchodní podmínky</Link>
            <Link href="/privacy" style={{ color: '#6B8F6B', textDecoration: 'none' }}>Zásady ochrany osobních údajů</Link>
            <Link href="/" style={{ color: '#6B8F6B', textDecoration: 'none' }}>felucia.io</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
