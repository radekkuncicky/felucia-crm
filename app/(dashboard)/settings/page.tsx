import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

interface CardDef {
  href: string
  label: string
  description: string
  iconPath: React.ReactNode
}

function CardIcon({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 rounded-[10px] bg-[#E8F5E9] dark:bg-[rgba(76,175,80,0.12)]"
      style={{ width: 36, height: 36 }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </div>
  )
}

const SECTIONS: { label: string; cards: CardDef[] }[] = [
  {
    label: 'Účet',
    cards: [
      {
        href: '/settings/profile',
        label: 'Můj profil',
        description: 'Jméno, heslo, avatar, kontaktní údaje',
        iconPath: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
      },
      {
        href: '/settings/users',
        label: 'Uživatelé',
        description: 'Správa členů týmu, role a oprávnění',
        iconPath: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
      },
      {
        href: '/settings/company',
        label: 'Nastavení firmy',
        description: 'Logo, název, adresa, fakturační údaje',
        iconPath: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
      },
    ],
  },
  {
    label: 'Obchod',
    cards: [
      {
        href: '/settings/contract-templates',
        label: 'Šablony smluv',
        description: 'SOD šablony, patičky, podmínky',
        iconPath: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>,
      },
      {
        href: '/settings/quotes',
        label: 'Šablony nabídek',
        description: 'Vzhled PDF nabídek, barvy, logo, vlastní HTML',
        iconPath: <><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></>,
      },
      {
        href: '/settings/dokumenty',
        label: 'Vzhled dokumentů',
        description: 'Záhlaví, patička a číslování stránek PDF smluv',
        iconPath: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="4" y1="6" x2="8" y2="6" /><line x1="16" y1="20" x2="20" y2="20" /></>,
      },
      {
        href: '/products',
        label: 'Produkty a ceníky',
        description: 'Import, kategorie, cenové hladiny',
        iconPath: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>,
      },
      {
        href: '/settings/import-products',
        label: 'Import produktů',
        description: 'Import z Excelu, hromadné přidání',
        iconPath: <><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></>,
      },
    ],
  },
  {
    label: 'Zakázky',
    cards: [
      {
        href: '/settings/zakazky',
        label: 'Nastavení zakázek',
        description: 'Výchozí vedoucí, auto-přiřazení, prefix číslování',
        iconPath: <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></>,
      },
    ],
  },
  {
    label: 'Systém',
    cards: [
      {
        href: '/settings/features',
        label: 'Funkce a přepínače',
        description: 'Zapnout/vypnout moduly a funkce',
        iconPath: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
      },
      {
        href: '/settings/billing',
        label: 'Fakturace a plán',
        description: 'Předplatné, platby, limity plánu',
        iconPath: <><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></>,
      },
    ],
  },
  {
    label: 'Pokročilé',
    cards: [
      {
        href: '/settings/evidence',
        label: 'Vlastní pole',
        description: 'Vlastní atributy pro OP a klienty',
        iconPath: <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>,
      },
      {
        href: '/settings/extensions',
        label: 'Rozšíření',
        description: 'Doplňkové moduly a integrace',
        iconPath: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
      },
      {
        href: '/settings/api',
        label: 'API a webhooky',
        description: 'Integrace, webhooky, přístupové tokeny',
        iconPath: <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></>,
      },
      {
        href: '/settings/visibility-tree',
        label: 'Viditelnost dat',
        description: 'Přístupová práva, co kdo vidí',
        iconPath: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
      },
      {
        href: '/settings/audit-log',
        label: 'Historie změn',
        description: 'Audit log, kdo co kdy změnil',
        iconPath: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
      },
    ],
  },
]

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nastavení</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Správa účtu, organizace a systémových funkcí</p>
      </div>

      <div className="space-y-2">
        {SECTIONS.map(section => (
          <div key={section.label}>
            <p className="mb-3 mt-6 text-[#6B8C6B] dark:text-[#4A6B4A]" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px' }}>
              {section.label}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {section.cards.map(card => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group flex items-start gap-3 p-4 rounded-[14px] border transition-all duration-150
                    bg-white dark:bg-[#0D1A0E]
                    border-green-200 dark:border-[rgba(76,175,80,0.2)]
                    hover:bg-[#F4FAF4] dark:hover:bg-[#0F2010]
                    hover:border-green-500 dark:hover:border-[#4CAF50]"
                >
                  <CardIcon>{card.iconPath}</CardIcon>
                  <div className="min-w-0">
                    <p className="font-semibold truncate text-[#1A2E1B] dark:text-[#E8F5E9]" style={{ fontSize: 13, fontFamily: "'Space Grotesk', sans-serif" }}>
                      {card.label}
                    </p>
                    <p className="mt-0.5 text-[#4A6B4A] dark:text-[#81C784]" style={{ fontSize: 11, lineHeight: 1.5 }}>
                      {card.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
