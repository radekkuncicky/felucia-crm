import { describe, it, expect } from 'vitest'
import { ROLE_PRESETS, type RoleName } from '@/lib/permissions'
import { sidebarSections, bottomNavItems, paletteItems, footerItems, type NavCtx } from '@/lib/navigation'

const org = { modulServis: true, modulLeady: true, modulDokumenty: true, modulAnalytiky: true }
const ctx = (role: RoleName, plan = 'PROFESSIONAL', orgSettings: NavCtx['orgSettings'] = org): NavCtx =>
  ({ perms: ROLE_PRESETS[role], plan, orgSettings })
const menu = (c: NavCtx) => sidebarSections(c).flatMap(s => s.items.map(i => i.href))
const paleta = (c: NavCtx) => { const p = paletteItems(c); return [...p.navigace, ...p.akce].map(i => i.href) }

describe('navigace podle role', () => {
  it('admin má sekce Obchod / Realizace / Servis / Katalog a nastavení', () => {
    const s = sidebarSections(ctx('ADMIN'))
    expect(s.map(x => x.title).filter(Boolean)).toEqual(['Obchod', 'Realizace', 'Servis', 'Katalog'])
    expect(menu(ctx('ADMIN'))).toEqual(expect.arrayContaining(['/quotes', '/predavaky', '/servis/portfolio', '/activities']))
    expect(footerItems(ctx('ADMIN')).map(i => i.href)).toContain('/settings')
  })

  for (const role of ['TECHNIK', 'HLAVNI_TECHNIK'] as const) {
    it(`${role} nevidí obchod ani nastavení nikde`, () => {
      const vse = [...menu(ctx(role)), ...bottomNavItems(ctx(role)).map(i => i.href), ...paleta(ctx(role))]
      for (const zakazane of ['/deals', '/clients', '/leady', '/quotes', '/activities', '/settings', '/deals/new', '/documents', '/analytics']) {
        expect(vse).not.toContain(zakazane)
      }
      expect(menu(ctx(role))).toEqual(expect.arrayContaining(['/dashboard', '/zakazky', '/predavaky', '/calendar']))
    })
  }

  it('technik má „Moje zakázky", hlavní technik „Zakázky"', () => {
    expect(sidebarSections(ctx('TECHNIK'))[0].items.find(i => i.id === 'zakazky')?.label).toBe('Moje zakázky')
    expect(sidebarSections(ctx('HLAVNI_TECHNIK'))[0].items.find(i => i.id === 'zakazky')?.label).toBe('Zakázky')
  })

  it('servis jen s plánem PROFESSIONAL+ a zapnutým modulem', () => {
    expect(menu(ctx('ADMIN', 'STANDARD'))).not.toContain('/servis')
    expect(menu(ctx('ADMIN', 'PROFESSIONAL', { ...org, modulServis: false }))).not.toContain('/servis')
    expect(menu(ctx('HLAVNI_TECHNIK', 'STARTER'))).not.toContain('/servis/zakazky')
    expect(menu(ctx('HLAVNI_TECHNIK'))).toContain('/servis/zakazky')
  })

  it('leady ne na STARTER ani s vypnutým modulem', () => {
    expect(menu(ctx('ADMIN', 'STARTER'))).not.toContain('/leady')
    expect(menu(ctx('ADMIN', 'PROFESSIONAL', { ...org, modulLeady: false }))).not.toContain('/leady')
  })

  it('BottomNav: technik / obchodník / admin', () => {
    expect(bottomNavItems(ctx('TECHNIK')).map(i => i.href)).toEqual(['/dashboard', '/zakazky', '/predavaky'])
    expect(bottomNavItems(ctx('OBCHODNIK')).map(i => i.href)).toEqual(['/dashboard', '/deals', '/activities', '/clients'])
    expect(bottomNavItems(ctx('ADMIN')).map(i => i.href)).toEqual(['/dashboard', '/deals', '/zakazky', '/servis'])
    expect(bottomNavItems(ctx('ADMIN', 'STANDARD')).map(i => i.href)).toEqual(['/dashboard', '/deals', '/zakazky', '/clients'])
  })

  it('obchodník nevidí protokoly, sklad, servis ani nastavení', () => {
    const m = menu(ctx('OBCHODNIK'))
    expect(m).not.toContain('/predavaky')
    expect(m).not.toContain('/sklad')
    expect(m).not.toContain('/servis')
    expect(footerItems(ctx('OBCHODNIK'))).toHaveLength(0)
  })

  it('rychlá akce servisu jen s dispečinkem', () => {
    expect(paleta(ctx('ADMIN'))).toContain('/servis/nova')
    expect(paleta(ctx('HLAVNI_TECHNIK'))).not.toContain('/servis/nova')
  })
})
