import Link from 'next/link'

export const metadata = {
  title: 'Zásady ochrany osobních údajů | Felucia',
  description: 'Zásady ochrany osobních údajů služby Felucia CRM provozované společností EFIKU s.r.o.',
}

const TODO = ({ children }: { children: React.ReactNode }) => (
  <span style={{
    background: 'rgba(255,193,7,0.18)',
    color: '#FFD54F',
    border: '1px dashed rgba(255,193,7,0.5)',
    borderRadius: 4,
    padding: '1px 6px',
    fontFamily: 'monospace',
    fontSize: '0.9em',
  }}>
    {children}
  </span>
)

export default function PrivacyPage() {
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

        {/* Draft notice */}
        <div style={{
          marginBottom: 32,
          padding: '12px 16px',
          background: 'rgba(255,193,7,0.08)',
          border: '1px dashed rgba(255,193,7,0.4)',
          borderRadius: 8,
          fontFamily: 'Inter, sans-serif',
          fontSize: 13,
          color: '#FFD54F',
          lineHeight: 1.6,
        }}>
          <strong>Před zveřejněním doplňte:</strong> IČO, adresa sídla, kontaktní e-mail pro žádosti subjektů údajů, datum platnosti.{' '}
          Doporučena právní revize.
        </div>

        <div style={{ marginBottom: 48 }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 700, color: '#E8F5E9', marginBottom: 8 }}>
            Zásady ochrany osobních údajů
          </h1>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#6B8F6B' }}>
            EFIKU s.r.o. | Služba Felucia CRM | felucia.io
          </p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#6B8F6B', marginTop: 4 }}>
            Platné od: <TODO>[DATUM]</TODO>
          </p>
        </div>

        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, lineHeight: 1.8, color: '#A5D6A7' }}>

          <Section title="1. Kdo jsme a jakou roli hrajeme">
            <p>1.1 Provozovatelem služby Felucia CRM je společnost EFIKU s.r.o., IČO: <TODO>[IČO]</TODO>, se sídlem <TODO>[adresa]</TODO> (dále jen &bdquo;Poskytovatel&ldquo; nebo &bdquo;my&ldquo;).</p>
            <p>1.2 Ve vztahu k datům, která do Služby vkládá Uživatel (organizace používající Felucia CRM), vystupujeme jako <strong>zpracovatel</strong> osobních údajů ve smyslu GDPR. Uživatel je <strong>správcem</strong> osobních údajů svých vlastních klientů, zaměstnanců a obchodních partnerů — je plně odpovědný za právní důvod a soulad zpracování s GDPR. Detail tohoto vztahu upravuje čl. 9 <Link href="/terms" style={{ color: '#81C784' }}>Všeobecných obchodních podmínek</Link>.</p>
            <p>1.3 Tyto zásady popisují, jak s osobními údaji nakládáme jako zpracovatel dat Uživatelů a zároveň jako správce údajů o samotných uživatelských účtech (přihlašovací a fakturační údaje).</p>
          </Section>

          <Section title="2. Jaká data zpracováváme">
            <p>2.1 <strong>Údaje o uživatelském účtu</strong> — jméno, e-mail, hashované heslo, přiřazená organizace a role. Zde jsme správcem.</p>
            <p>2.2 <strong>Data klientů, která do Služby vkládá Uživatel</strong> — jméno, telefon, e-mail, adresa, IČO/DIČ, a obchodní historie (obchodní případy, zakázky, servisní zakázky, vyúčtování). Zde jsme zpracovatelem, Uživatel je správcem.</p>
            <p>2.3 <strong>Technická a provozní data</strong> — přihlašovací a auditní logy (kdo, kdy, jakou akci provedl — tabulka auditních záznamů), technická metadata (IP adresa u API požadavků kvůli rate-limitingu, chybové logy).</p>
          </Section>

          <Section title="3. Právní základ a doba uchování">
            <p>3.1 Údaje uživatelského účtu zpracováváme po dobu trvání smluvního vztahu (plnění smlouvy), účetní a auditní záznamy po dobu vyžadovanou zákonem.</p>
            <p>3.2 Data klientů Uživatele zpracováváme po dobu, po kterou je Uživatel sám potřebuje a udržuje ve Službě — o rozsahu a délce rozhoduje Uživatel jako správce.</p>
            <p>3.3 Klienta s navázanou obchodní historií (obchodní případ, zakázka, servisní zakázka, vyúčtování) nelze technicky smazat, protože účetní doklady mají zákonnou dobu uchování. Právo na výmaz se u takového klienta naplňuje <strong>anonymizací</strong> — jméno, kontakty, adresa a IČO/DIČ se nevratně nahradí anonymním záznamem, zatímco vazba na obchodní a účetní historii zůstává zachována. Klienta bez jakékoli navázané historie lze smazat rovnou.</p>
            <p>3.4 Zálohy databáze pořizujeme denně a uchováváme 14 dní, včetně offsite kopie u externího úložiště. Zálohy slouží výhradně pro obnovu provozu po havárii — nejsou samostatným úložištěm osobních údajů a s běžnou rotací automaticky zanikají. Údaje anonymizované nebo smazané v produkční databázi se z již existujících záloh nemažou zvlášť — zaniknou až uplynutím retenční doby dané zálohy (nejdéle 14 dní od jejího pořízení).</p>
          </Section>

          <Section title="4. Práva subjektu údajů">
            <p>4.1 Pokud jste klientem, zaměstnancem nebo obchodním partnerem některého Uživatele Felucia CRM (tedy osobou, jejíž údaje Uživatel vede v evidenci), máte právo na přístup ke svým údajům, jejich opravu, přenositelnost a za podmínek popsaných výše i na výmaz (viz 3.3).</p>
            <p>4.2 Svá práva uplatňujte přímo u organizace, která vaše údaje vede a je jejich správcem (typicky firma, se kterou jste v obchodním vztahu) — <strong>ne u nás</strong>. My jako zpracovatel nemáme oprávnění rozhodovat o žádostech subjektů údajů namísto správce; můžeme správci poskytnout technickou součinnost (např. provést anonymizaci na jeho pokyn).</p>
            <p>4.3 Pokud jste uživatelem účtu Felucia CRM (přihlašujete se do aplikace), ohledně údajů vašeho účtu (jméno, e-mail, fakturační údaje) nás můžete kontaktovat přímo — viz čl. 8 Kontakt.</p>
          </Section>

          <Section title="5. Třetí strany">
            <p>5.1 <strong>Webhooky nastavené Uživatelem</strong> — v nastavení (/settings/api) si může Uživatel sám nakonfigurovat vlastní webhook endpoint. Pokud tak učiní, data z jeho organizace (včetně osobních údajů klientů — jméno, kontakt, adresa apod.) se při každé události odešlou na URL, kterou si Uživatel zadal. Volbu, zabezpečení a další nakládání s daty na cílovém endpointu má plně v rukou a plně za ně odpovídá Uživatel jako správce — my doručení pouze technicky zprostředkujeme (podepsaný HTTP požadavek) a neukládáme, co cílový server s daty dále dělá.</p>
            <p>5.2 <strong>Platby</strong> — zpracování plateb předplatného zajišťuje Stripe, Inc. Platební údaje (číslo karty apod.) neprocházejí přes naši infrastrukturu, zpracovává je přímo Stripe.</p>
            <p>5.3 <strong>AI asistent</strong> — pokud má organizace na svém plánu aktivovaný AI asistent a Uživatel jej použije, mohou být v rámci konverzace odeslány relevantní údaje z evidence (např. jméno klienta, předmět obchodního případu) do API poskytovatele Anthropic za účelem generování odpovědi. Funkce je volitelná a AI asistent se spouští jen na výslovnou akci uživatele.</p>
          </Section>

          <Section title="6. Zabezpečení">
            <p>6.1 Data jednotlivých organizací jsou od sebe odděleny na dvou úrovních — aplikační vrstvou i přímo v databázi (Row Level Security), takže i případná chyba v aplikační logice by neumožnila přístup k datům cizí organizace.</p>
            <p>6.2 Veškerá komunikace probíhá šifrovaně přes TLS (HTTPS).</p>
            <p>6.3 Infrastruktura běží na vlastním serveru (Hetzner, EU), nesdílíme databázi ani úložiště s jinými poskytovateli mimo výše uvedené subprocesory.</p>
            <p>6.4 Přístup k produkční infrastruktuře mají pouze pověřené osoby Poskytovatele.</p>
          </Section>

          <Section title="7. Zpracovatelská smlouva (DPA)">
            <p>7.1 Pokud jako Uživatel potřebujete formální smlouvu o zpracování osobních údajů (DPA) pro doložení souladu s GDPR, jsme připraveni ji na vyžádání uzavřít — viz čl. 9.2 VOP.</p>
            <p>7.2 Samoobslužné generování DPA v aplikaci zatím neposkytujeme; o smlouvu si prosím napište na kontaktní e-mail níže.</p>
          </Section>

          <Section title="8. Kontakt">
            <p>8.1 Ve věcech těchto zásad, žádostí ohledně údajů vašeho uživatelského účtu, nebo žádosti o DPA nás kontaktujte na <TODO>info@efiku.cz</TODO>.</p>
            <p>8.2 Pokud jde o údaje, které o vás vede některá z organizací používajících Felucia CRM (jste jejím klientem, zaměstnancem apod.), obraťte se prosím přímo na tuto organizaci — viz bod 4.2.</p>
            <p>8.3 Tyto zásady můžeme čas od času aktualizovat; aktuální znění je vždy dostupné na felucia.io/privacy.</p>
          </Section>

        </div>

        {/* Footer */}
        <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid rgba(76,175,80,0.15)', fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#4A6B4A' }}>
          <p>
            EFIKU s.r.o. | <TODO>[adresa]</TODO> | IČO: <TODO>[IČO]</TODO> | info@efiku.cz | felucia.io
          </p>
          <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
            <Link href="/terms" style={{ color: '#6B8F6B', textDecoration: 'none' }}>Všeobecné obchodní podmínky</Link>
            <Link href="/" style={{ color: '#6B8F6B', textDecoration: 'none' }}>felucia.io</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 18,
        fontWeight: 600,
        color: '#81C784',
        marginBottom: 16,
        paddingBottom: 8,
        borderBottom: '1px solid rgba(76,175,80,0.15)',
      }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </section>
  )
}
