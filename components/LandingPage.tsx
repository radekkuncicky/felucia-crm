'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// ─── Utils ────────────────────────────────────────────────────────────────────

const mont: React.CSSProperties = { fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }

function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > threshold)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [threshold])
  return scrolled
}

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.opacity = '0'
    el.style.transform = 'translateY(20px)'
    el.style.transition = `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.style.opacity = '1'; el.style.transform = 'none'; obs.disconnect() } },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [delay])
  return <div ref={ref} className={className}>{children}</div>
}

// ─── Dashboard mockup ─────────────────────────────────────────────────────────

function DashboardMockup() {
  return (
    <div className="relative w-full max-w-xl mx-auto lg:mx-0">
      <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-white">
        {/* Browser chrome */}
        <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 bg-white border border-gray-200 rounded-md px-3 py-1 text-[11px] text-gray-400 text-center">
            app.felucia.io/dashboard
          </div>
        </div>
        <div className="flex h-64 sm:h-80">
          {/* Sidebar */}
          <div className="w-12 sm:w-44 bg-[#1A2744] flex flex-col flex-shrink-0">
            <div className="flex items-center gap-2 px-2 sm:px-3 py-3 border-b border-slate-700">
              <div className="w-6 h-6 rounded-md bg-[#FFC93C] flex items-center justify-center flex-shrink-0">
                <div className="w-2.5 h-2.5 bg-[#111] rounded-sm" />
              </div>
              <span className="hidden sm:block text-white text-xs font-bold">FELUCIA CRM</span>
            </div>
            <div className="flex-1 px-1.5 sm:px-2 py-2 space-y-1">
              {[['Nástěnka', true], ['Klienti', false], ['Obchod', false], ['Aktivity', false]].map(([l, a]) => (
                <div key={String(l)} className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${a ? 'bg-blue-600' : ''}`}>
                  <div className={`w-3 h-1 rounded-full flex-shrink-0 ${a ? 'bg-white' : 'bg-slate-600'}`} />
                  <span className={`hidden sm:block text-xs truncate ${a ? 'text-white' : 'text-slate-400'}`}>{String(l)}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Main area */}
          <div className="flex-1 bg-gray-50 p-2.5 flex flex-col gap-2.5 overflow-hidden">
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { l: 'Aktivní OP', v: '24', c: 'bg-blue-50 border-blue-100' },
                { l: 'V jednání', v: '8', c: 'bg-amber-50 border-amber-100' },
                { l: 'Výhra', v: '12', c: 'bg-green-50 border-green-100' },
                { l: 'Objem', v: '2.4M', c: 'bg-purple-50 border-purple-100' },
              ].map(s => (
                <div key={s.l} className={`${s.c} border rounded-lg p-1.5`}>
                  <div className="text-[9px] text-gray-500 mb-0.5 truncate">{s.l}</div>
                  <div className="text-sm font-bold text-gray-900">{s.v}</div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex-1">
              <div className="bg-gray-50 border-b grid grid-cols-3 px-2.5 py-1.5">
                {['Kód', 'Předmět', 'Stav'].map(h => (
                  <span key={h} className="text-[9px] font-semibold text-gray-400 uppercase">{h}</span>
                ))}
              </div>
              {[
                { k: 'OP-26-001', p: 'Klima Novák', s: 'Jednání', c: 'bg-blue-100 text-blue-700' },
                { k: 'OP-26-002', p: 'TČ Veselý', s: 'Nabídka', c: 'bg-amber-100 text-amber-700' },
                { k: 'OP-26-003', p: 'Rekuperace Pavel', s: 'Úspěch', c: 'bg-green-100 text-green-700' },
                { k: 'OP-26-004', p: 'VZT Horák', s: 'Poptávka', c: 'bg-gray-100 text-gray-600' },
              ].map(r => (
                <div key={r.k} className="grid grid-cols-3 px-2.5 py-1.5 border-b border-gray-100 last:border-0 items-center">
                  <span className="font-mono text-[9px] text-gray-500">{r.k}</span>
                  <span className="text-[10px] text-gray-700 truncate">{r.p}</span>
                  <span className={`text-[9px] px-1 py-0.5 rounded-full font-medium w-fit ${r.c}`}>{r.s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Dáša FAB */}
      <div className="absolute -bottom-3 -right-3 w-11 h-11 rounded-full bg-[#FFC93C] shadow-lg flex items-center justify-center text-base font-bold text-[#111]">✦</div>
    </div>
  )
}

// ─── Dáša chat mockup ─────────────────────────────────────────────────────────

function DashaChat() {
  const msgs = [
    { r: 'user', t: 'Dášo, udělej nabídku pro Nováka jako tu od Veselého, ale s Daikin 3,5kW místo 2,5kW' },
    { r: 'ai', t: 'Rozumím — zduplikuji nabídku od Veselého a vyměním Daikin 2,5kW za 3,5kW. Mám provést?' },
    { r: 'user', t: 'Ano' },
    { r: 'ai', t: '✓ Hotovo. Nabídka „Varianta A" vytvořena — celková cena 87 400 Kč bez DPH.' },
  ]
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-w-sm w-full">
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#FFC93C] flex items-center justify-center font-bold text-[#111] text-sm flex-shrink-0">D</div>
        <div>
          <div className="font-semibold text-sm">Dáša</div>
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            AI asistentka · online
          </div>
        </div>
      </div>
      <div className="p-4 bg-[#FAFAFA] flex flex-col gap-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 items-end ${m.r === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.r === 'ai' && (
              <div className="w-6 h-6 rounded-full bg-[#FFC93C] flex items-center justify-center text-[10px] font-bold flex-shrink-0">D</div>
            )}
            <div className={`max-w-[78%] px-3 py-2 text-sm rounded-2xl leading-relaxed ${
              m.r === 'user'
                ? 'bg-[#FFC93C] text-[#111] rounded-br-md'
                : 'bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm'
            }`}>
              {m.t}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between py-5 text-left gap-4">
        <span className="font-semibold text-gray-900 text-sm sm:text-base">{q}</span>
        <svg className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <p className="pb-5 text-gray-600 leading-relaxed text-sm">{a}</p>}
    </div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
    ),
    title: 'Obchodní případy',
    desc: 'Sledujte každou zakázku od poptávky po realizaci. Pipeline zobrazení, stavy, termíny a přiřazení techniků — vždy víte, co se děje.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    ),
    title: 'Profesionální nabídky',
    desc: 'Generujte PDF nabídky za minuty. Produktový katalog s ceníky, šablony pro každou technologii, automatický výpočet DPH a zálohy.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
    ),
    title: 'Katalog a ceníky',
    desc: 'Kompletní katalog produktů s nákupními cenami, maržemi a ceníky. Import z Excelu, automatické kódy, přehled ziskovosti.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ),
    title: 'Aktivity a úkoly',
    desc: 'Hovory, schůzky, úkoly — vše zaznamenáte jedním klikem. Připomínky na OP bez aktivity každé pondělí, středu a pátek.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    ),
    title: 'Správa klientů',
    desc: 'Kompletní historie každého klienta — všechny zakázky, nabídky, komunikace a dokumenty na jednom místě.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    ),
    title: 'Přehledy a analytika',
    desc: 'Funnel prodeje, měsíční výkonnost, úspěšnost obchodníků. Data která pomáhají rozhodovat, ne jen vykazovat.',
  },
]

const faqItems = [
  { q: 'Je CRM opravdu zadarmo?', a: 'Ano, základní plán je zdarma bez časového omezení. Platíte jen pokud potřebujete pokročilé funkce jako AI asistentku Dášu, více uživatelů nebo prioritní podporu.' },
  { q: 'Funguje to i na telefonu?', a: 'Ano. CRM je plně responzivní a funguje na jakémkoliv zařízení. Technici ho používají v terénu na mobilu, obchodníci v kanceláři na počítači.' },
  { q: 'Jak rychle mohu začít?', a: 'Registrace zabere 2 minuty. Import produktového katalogu z Excelu dalších 5 minut. První nabídku vytvoříte do hodiny od registrace.' },
  { q: 'Mohu importovat data z jiného systému?', a: 'Ano, podporujeme import produktů z Excel exportu. Migrace klientů a zakázek je možná přes CSV nebo nám napište — pomůžeme.' },
  { q: 'Je systém bezpečný?', a: 'Data jsou uložena na evropských serverech (Hetzner, Německo). HTTPS šifrování, přístup pouze přes klíč, automatické zálohy každou noc.' },
  { q: 'Pro jak velkou firmu je CRM vhodné?', a: 'Od živnostníka po firmu s 20+ techniky. Systém roste s vámi — přidávejte uživatele, ceníky a funkce podle potřeby.' },
]

const dashaChecks = [
  'Sestaví cenovou nabídku podle vašich instrukcí',
  'Přidá položky a slevy do nabídky',
  'Zduplikuje nabídku od jiného klienta s úpravami',
  'Vytvoří nový obchodní případ nebo klienta',
  'Přidá aktivitu nebo poznámku k zakázce',
  'Vyhledá informace z celého CRM dle vašich práv',
  'Ovládáte ji hlasem i textem — česky',
]

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const scrolled = useScrolled()
  const [menuOpen, setMenuOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [formStatus, setFormStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormStatus('loading')
    try {
      const r = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (r.ok) { setFormStatus('ok'); setForm({ name: '', email: '', phone: '', message: '' }) }
      else setFormStatus('err')
    } catch { setFormStatus('err') }
  }

  const navLinks = [
    ['#features', 'Funkce'],
    ['#ai', 'AI Dáša'],
    ['#how', 'Jak to funguje'],
    ['#faq', 'FAQ'],
    ['#contact', 'Kontakt'],
  ]

  return (
    <div className="landing-page min-h-screen bg-white text-[#111111]">

      {/* ═══════════════════════════ NAVBAR ═══════════════════════════════════ */}
      <header className={`sticky top-0 z-50 bg-white transition-shadow duration-200 ${scrolled ? 'shadow-md' : 'shadow-sm border-b border-gray-100'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="bg-[#FFC93C] rounded-lg p-1.5">
              <svg className="w-5 h-5 text-[#111]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <span style={mont} className="font-bold text-xl tracking-tight">FELUCIA</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">{label}</a>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-700 border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors">
              Přihlásit se
            </Link>
            <Link href="/auth/register" className="text-sm font-bold bg-[#FFC93C] text-[#111] rounded-lg px-4 py-2 hover:bg-[#ffb800] transition-colors">
              Začít zdarma
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMenuOpen(o => !o)} className="md:hidden p-2 text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 flex flex-col gap-1">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)} className="text-gray-700 py-2.5 font-medium border-b border-gray-50 last:border-0">{label}</a>
            ))}
            <div className="flex gap-3 pt-4">
              <Link href="/login" className="flex-1 text-center border border-gray-300 rounded-xl py-3 font-medium text-sm">Přihlásit se</Link>
              <Link href="/auth/register" className="flex-1 text-center bg-[#FFC93C] text-[#111] rounded-xl py-3 font-bold text-sm">Začít zdarma</Link>
            </div>
          </div>
        )}
      </header>

      {/* ═══════════════════════════ HERO ════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 bg-[#FFC93C]/15 text-[#92600A] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <span className="text-[#FFC93C]">✦</span> Specializovaný CRM pro HVAC profesionály
            </div>
            <h1 style={mont} className="text-4xl sm:text-5xl xl:text-[52px] font-bold text-[#111111] leading-[1.1] mb-6">
              CRM pro HVAC firmy,<br />
              který skutečně rozumí<br />
              <span className="text-[#FFC93C]">vašemu oboru.</span>
            </h1>
            <p className="text-lg text-[#4A4A4A] leading-relaxed mb-8 max-w-lg">
              Spravujte obchodní případy, cenové nabídky a klienty na jednom místě.
              S AI asistentkou Dášou ušetříte hodiny administrativy každý týden.
            </p>
            <div className="flex flex-wrap gap-3 mb-6">
              <Link href="/auth/register" className="inline-flex items-center gap-2 bg-[#FFC93C] text-[#111] font-bold px-6 py-3.5 rounded-xl text-base hover:bg-[#ffb800] transition-colors shadow-sm">
                Začít zdarma
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
              <a href="#features" className="inline-flex items-center gap-2 border-2 border-gray-200 text-gray-700 font-semibold px-6 py-3.5 rounded-xl text-base hover:border-gray-300 hover:bg-gray-50 transition-colors">
                Zobrazit demo
              </a>
            </div>
            <p className="text-xs text-gray-400">Žádná platební karta · Bez instalace · Spuštění za 5 minut</p>
          </FadeIn>
          <FadeIn delay={150}>
            <DashboardMockup />
          </FadeIn>
        </div>
      </section>

      {/* ═══════════════════════ MARQUEE ══════════════════════════════════════ */}
      <div className="bg-[#111111] py-4 overflow-hidden">
        <div className="marquee-track">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-10 flex-shrink-0 pr-10">
              {['Tepelná čerpadla', 'Klimatizace', 'Rekuperace', 'Podlahové vytápění', 'Vzduchotechnika', 'Montáže a servis', 'Záruční opravy', 'Revize'].map(item => (
                <span key={item} className="whitespace-nowrap flex items-center gap-3 text-white/60 text-sm font-medium">
                  <span className="text-[#FFC93C] text-xs">✦</span> {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════ FEATURES ════════════════════════════════════ */}
      <section id="features" className="py-20 sm:py-28 bg-[#F5F5F5]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <FadeIn className="text-center mb-14">
            <h2 style={mont} className="text-3xl sm:text-4xl font-bold text-[#111] mb-4">
              Vše co potřebujete pro řízení HVAC zakázek
            </h2>
            <p className="text-lg text-[#4A4A4A] max-w-2xl mx-auto">
              Od první poptávky až po předání — celý proces na jednom místě.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <FadeIn key={f.title} delay={i * 60}>
                <div className="bg-white rounded-[14px] p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow h-full">
                  <div className="w-11 h-11 bg-[#FFC93C]/15 rounded-xl flex items-center justify-center text-[#92600A] mb-4">
                    {f.icon}
                  </div>
                  <h3 style={mont} className="font-bold text-[#111] mb-2 text-lg">{f.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ AI DÁŠA ══════════════════════════════════════ */}
      <section id="ai" className="py-20 sm:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <FadeIn>
              <div className="inline-flex items-center gap-2 bg-[#FFC93C]/15 text-[#92600A] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <span className="text-[#FFC93C]">✦</span> Umělá inteligence
              </div>
              <h2 style={mont} className="text-3xl sm:text-4xl font-bold text-[#111] mb-5">
                Dáša — vaše AI asistentka,<br />
                <span className="text-[#FFC93C]">která zná váš obor</span>
              </h2>
              <p className="text-[#4A4A4A] leading-relaxed mb-8">
                Dáša není jen chatbot. Je to specializovaná AI asistentka navržená přímo pro HVAC firmy —
                rozumí tepelným čerpadlům, klimatizacím i rekuperacím.
                <br /><br />
                Pracuje přímo v CRM a ví, na kterém obchodním případu právě pracujete.
                Stačí jí říct co potřebujete — ona to zařídí.
              </p>
              <ul className="space-y-3">
                {dashaChecks.map(item => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#FFC93C] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-[#111]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="text-sm text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </FadeIn>
            <FadeIn delay={150} className="flex justify-center lg:justify-end">
              <DashaChat />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ══════════════════════ SCREENSHOTS ══════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-[#F5F5F5]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <FadeIn className="text-center mb-14">
            <h2 style={mont} className="text-3xl sm:text-4xl font-bold text-[#111] mb-4">
              Přehledný design, který šetří čas
            </h2>
            <p className="text-lg text-[#4A4A4A]">
              Navrženo pro lidi v terénu i v kanceláři — na počítači i telefonu.
            </p>
          </FadeIn>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { label: 'Dashboard s pipeline přehledem', color: 'bg-blue-50', icon: '📊' },
              { label: 'Detail obchodního případu', color: 'bg-amber-50', icon: '📋' },
              { label: 'Generování cenové nabídky', color: 'bg-green-50', icon: '📄' },
            ].map((s, i) => (
              <FadeIn key={s.label} delay={i * 80}>
                <div className="bg-white rounded-[14px] border border-gray-200 overflow-hidden shadow-sm">
                  <div className={`${s.color} aspect-video flex flex-col items-center justify-center gap-3`}>
                    <span className="text-4xl">{s.icon}</span>
                    <div className="space-y-1.5 w-3/4">
                      <div className="h-2 bg-gray-200 rounded-full" />
                      <div className="h-2 bg-gray-200 rounded-full w-3/4" />
                      <div className="h-2 bg-gray-200 rounded-full w-1/2" />
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm font-semibold text-gray-700">{s.label}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ HOW IT WORKS ═══════════════════════════════════ */}
      <section id="how" className="py-20 sm:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <FadeIn className="text-center mb-14">
            <h2 style={mont} className="text-3xl sm:text-4xl font-bold text-[#111] mb-4">
              Spuštění za jeden den
            </h2>
          </FadeIn>
          <div className="grid sm:grid-cols-3 gap-8 relative">
            {/* connector line — desktop only */}
            <div className="hidden sm:block absolute top-10 left-1/4 right-1/4 h-0.5 bg-[#FFC93C]/30" />
            {[
              { n: '1', title: 'Zaregistrujte se', desc: 'Vytvořte účet organizace během 2 minut. Žádná instalace, žádný IT odborník.' },
              { n: '2', title: 'Importujte data', desc: 'Nahrajte produktový katalog z Excelu. Klienty přidáte ručně nebo importem.' },
              { n: '3', title: 'Začněte pracovat', desc: 'Vytvořte první obchodní případ a nechte Dášu sestavit nabídku za vás.' },
            ].map((step, i) => (
              <FadeIn key={step.n} delay={i * 100} className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-[#FFC93C] flex items-center justify-center mb-5 shadow-md z-10">
                  <span style={mont} className="text-2xl font-bold text-[#111]">{step.n}</span>
                </div>
                <h3 style={mont} className="font-bold text-xl text-[#111] mb-3">{step.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed max-w-xs">{step.desc}</p>
              </FadeIn>
            ))}
          </div>
          <FadeIn className="text-center mt-12">
            <Link href="/auth/register" className="inline-flex items-center gap-2 bg-[#FFC93C] text-[#111] font-bold px-8 py-4 rounded-xl text-base hover:bg-[#ffb800] transition-colors shadow-sm">
              Začít zdarma →
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* ════════════════════════ FAQ ════════════════════════════════════════ */}
      <section id="faq" className="py-20 sm:py-28 bg-[#F5F5F5]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <FadeIn className="text-center mb-12">
            <h2 style={mont} className="text-3xl sm:text-4xl font-bold text-[#111] mb-4">Časté otázky</h2>
          </FadeIn>
          <FadeIn>
            <div className="bg-white rounded-[14px] shadow-sm border border-gray-100 px-6">
              {faqItems.map(item => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ════════════════════ CONTACT ════════════════════════════════════════ */}
      <section id="contact" className="py-20 sm:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <FadeIn className="text-center mb-14">
            <h2 style={mont} className="text-3xl sm:text-4xl font-bold text-[#111] mb-4">
              Máte otázky? Napište nám.
            </h2>
            <p className="text-lg text-[#4A4A4A]">Odpovíme do 24 hodin.</p>
          </FadeIn>
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Form */}
            <FadeIn>
              {formStatus === 'ok' ? (
                <div className="bg-green-50 border border-green-200 rounded-[14px] p-8 text-center">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Zpráva odeslána!</h3>
                  <p className="text-sm text-gray-600">Ozveme se vám brzy.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Jméno *</label>
                      <input
                        type="text" required value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFC93C] focus:border-[#FFC93C]"
                        placeholder="Jan Novák"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                      <input
                        type="email" required value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFC93C] focus:border-[#FFC93C]"
                        placeholder="jan@firma.cz"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefon</label>
                    <input
                      type="tel" value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFC93C] focus:border-[#FFC93C]"
                      placeholder="+420 123 456 789"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Zpráva *</label>
                    <textarea
                      required rows={5} value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFC93C] focus:border-[#FFC93C] resize-none"
                      placeholder="Váš dotaz nebo zpráva..."
                    />
                  </div>
                  {formStatus === 'err' && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                      Nepodařilo se odeslat zprávu. Zkuste to prosím znovu.
                    </p>
                  )}
                  <button
                    type="submit" disabled={formStatus === 'loading'}
                    className="w-full bg-[#FFC93C] hover:bg-[#ffb800] disabled:opacity-60 text-[#111] font-bold py-3.5 rounded-xl transition-colors"
                  >
                    {formStatus === 'loading' ? 'Odesílám...' : 'Odeslat zprávu'}
                  </button>
                </form>
              )}
            </FadeIn>

            {/* Contact info */}
            <FadeIn delay={150}>
              <div className="space-y-6">
                <div>
                  <h3 style={mont} className="font-bold text-xl text-[#111] mb-6">FELUCIA s.r.o.</h3>
                  {[
                    { icon: '✉️', label: 'Email', value: 'info@felucia.io', href: 'mailto:info@felucia.io' },
                    { icon: '📞', label: 'Telefon', value: '+420 724 347 986', href: 'tel:+420724347986' },
                    { icon: '📍', label: 'Adresa', value: 'Výstavní 2224/8, 709 00 Ostrava', href: null },
                  ].map(item => (
                    <div key={item.label} className="flex items-start gap-4 mb-5">
                      <div className="w-10 h-10 bg-[#FFC93C]/15 rounded-xl flex items-center justify-center flex-shrink-0 text-base">
                        {item.icon}
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-0.5">{item.label}</div>
                        {item.href ? (
                          <a href={item.href} className="text-sm font-medium text-[#111] hover:text-[#92600A] transition-colors">{item.value}</a>
                        ) : (
                          <span className="text-sm font-medium text-[#111]">{item.value}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-[#FFC93C]/10 border border-[#FFC93C]/30 rounded-[14px] p-5">
                  <p className="text-sm font-semibold text-[#92600A] mb-1">Rychlá odpověď</p>
                  <p className="text-sm text-gray-600">Obvykle odpovídáme do 2–4 hodin v pracovní dny.</p>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ════════════════════════ FOOTER ═════════════════════════════════════ */}
      <footer className="bg-[#111111] text-white py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-3 gap-8 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-[#FFC93C] rounded-lg p-1.5">
                  <svg className="w-5 h-5 text-[#111]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <span style={mont} className="font-bold text-xl">FELUCIA</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">CRM systém pro HVAC profesionály.</p>
            </div>

            {/* Links */}
            <div>
              <p style={mont} className="font-semibold text-sm mb-4 text-gray-300">Navigace</p>
              <ul className="space-y-2.5">
                {[['#features', 'Funkce'], ['#ai', 'AI Dáša'], ['#faq', 'FAQ'], ['#contact', 'Kontakt'], ['/login', 'Přihlásit se']].map(([href, label]) => (
                  <li key={href}>
                    <a href={href} className="text-sm text-gray-400 hover:text-white transition-colors">{label}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <p style={mont} className="font-semibold text-sm mb-4 text-gray-300">Kontakt</p>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><a href="mailto:info@felucia.io" className="hover:text-white transition-colors">info@felucia.io</a></li>
                <li><a href="tel:+420724347986" className="hover:text-white transition-colors">+420 724 347 986</a></li>
                <li>Výstavní 2224/8, Ostrava</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
            <p>© 2026 FELUCIA s.r.o. · Všechna práva vyhrazena</p>
            <p>Specializovaný CRM pro HVAC profesionály</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
