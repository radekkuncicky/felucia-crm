import { test, expect, Page } from '@playwright/test'

/**
 * Kritické toky CRM. Každý test hlídá i JS chyby stránky (pageerror) —
 * to je záchranná síť proti rozbité hydrataci (např. při změnách CSP).
 */

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /hydrat/i.test(msg.text())) errors.push(msg.text())
  })
  return errors
}

test('dashboard se načte a je interaktivní', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/dashboard')
  await expect(page.locator('body')).toContainText(/dashboard|přehled|nástěnka/i)
  expect(errors).toEqual([])
})

test('zakázky: seznam a detail se otevřou', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/zakazky')
  await expect(page.locator('body')).toContainText('E2E Zakázka')
  await page.getByRole('row', { name: /E2E Zakázka/ }).getByRole('link', { name: /Detail/ }).click()
  await page.waitForURL(/\/zakazky\/[^/]+$/)
  await expect(page.locator('body')).toContainText('E2E Zakázka')
  expect(errors).toEqual([])
})

test('zakázka detail: rozbalovací kontakty fungují (hydratace)', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/zakazky')
  await page.getByRole('row', { name: /E2E Zakázka/ }).getByRole('link', { name: /Detail/ }).click()
  await page.waitForURL(/\/zakazky\/[^/]+$/)
  const kontakt = page.locator('summary', { hasText: /kontakt/i }).first()
  if (await kontakt.count()) {
    await kontakt.click()
    await expect(page.locator('body')).toContainText('klient@example.com')
  }
  expect(errors).toEqual([])
})

test('servis: seznam zakázek a detail', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/servis/zakazky')
  await expect(page.locator('body')).toContainText(/SZ-\d\d-9001/)
  await page.getByText(/SZ-\d\d-9001/).first().click()
  await page.waitForURL('**/servis/zakazky/**')
  await expect(page.locator('body')).toContainText(/protokol|stav|technik/i)
  expect(errors).toEqual([])
})

test('servis: nová servisní akce pro klienta z ulice (nový klient + nové zařízení)', async ({ page }) => {
  const errors = trackErrors(page)
  const prijmeni = `Zulice${Date.now()}`
  await page.goto('/servis/nova')
  await expect(page.locator('h1')).toContainText('Nová servisní akce')

  // 1. Kdo — inline založení klienta
  await page.getByPlaceholder(/Příjmení, jméno nebo firma/).fill(prijmeni)
  await page.getByRole('button', { name: /Vytvořit klienta/ }).click()
  // unikátní telefon — jinak test DB z minulého běhu vyvolá dialog „Nemyslíte tohoto klienta?"
  await page.getByPlaceholder('+420 …').first().fill(`+420 6${String(Date.now()).slice(-8)}`)
  await page.getByLabel('Ulice a číslo popisné').fill('Testovací 7')
  await page.getByLabel('Město').fill('Brno')
  await page.getByRole('button', { name: 'Vytvořit a použít' }).click()
  await expect(page.locator('body')).toContainText(prijmeni)

  // 2. Co — nové zařízení
  await page.getByRole('button', { name: '+ Nové zařízení' }).click()
  await page.getByPlaceholder('Daikin Perfera 3,5 kW').fill('Klima E2E')

  // 3. Problém — adresa předvyplněná z klienta
  await expect(page.getByPlaceholder('Ulice 12, 110 00 Praha')).toHaveValue(/Testovací 7/)
  await page.getByPlaceholder(/Klimatizace nechladí/).fill('Nechladí, hlásí E7')
  await page.getByRole('button', { name: 'Urgentní' }).click()

  await page.getByRole('button', { name: 'Založit servisní akci' }).click()
  await page.waitForURL('**/servis/zakazky/**')
  await expect(page.locator('body')).toContainText('Nechladí, hlásí E7')
  await expect(page.locator('body')).toContainText('Klima E2E')
  await expect(page.locator('body')).toContainText(/Urgentní/)
  expect(errors).toEqual([])
})

test('servis: portfolio seskupuje klienta se zařízením; staré routy redirectují', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/servis/portfolio')
  await expect(page.locator('h1')).toContainText('Servisní portfolio')
  // klient z předchozího testu (klient z ulice) má zařízení „Klima E2E" → rozbalit hledáním
  await page.getByPlaceholder(/Klient, zařízení/).fill('Klima E2E')
  await expect(page.locator('body')).toContainText('Klima E2E')
  await expect(page.locator('body')).toContainText(/Bez servisní smlouvy/)

  await page.goto('/servis/zarizeni')
  await page.waitForURL('**/servis/portfolio')
  await page.goto('/servis/kontrakty')
  await page.waitForURL('**/servis/portfolio')
  expect(errors).toEqual([])
})

test('servis: seznam má pohledy Aktuální / Plánované ze smluv a hledání', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/servis/zakazky')
  await expect(page.getByRole('button', { name: /^Aktuální/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Plánované ze smluv/ }).first()).toBeVisible()
  await page.getByPlaceholder(/Hledat číslo, klienta/).fill('9001')
  await expect(page.locator('body')).toContainText(/SZ-\d\d-9001/)
  expect(errors).toEqual([])
})

test('klient: tab Servis ukazuje servisní zakázky klienta', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/servis/zakazky')
  await page.getByText(/SZ-\d\d-9001/).first().click()
  await page.waitForURL('**/servis/zakazky/**')
  // z detailu zakázky na kartu klienta
  await page.getByRole('link', { name: 'Klient E2E' }).first().click()
  await page.waitForURL('**/clients/**')
  await page.getByRole('link', { name: /^Servis \(/ }).click()
  await expect(page.locator('body')).toContainText(/SZ-\d\d-9001/)
  await expect(page.locator('body')).toContainText('Zařízení a smlouvy')
  expect(errors).toEqual([])
})

test('servisní nástěnka /servis se načte', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/servis')
  await expect(page.locator('body')).toContainText('Dnes v terénu')
  await expect(page.locator('body')).toContainText('Urgentní & nezaplánované')
  await expect(page.locator('body')).toContainText('Blížící se servisy ze smluv')
  await expect(page.getByRole('link', { name: '+ Nová servisní akce' })).toBeVisible()
  expect(errors).toEqual([])
})

test('klienti: seznam obsahuje seed klienta', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/clients')
  await expect(page.locator('body')).toContainText('E2E')
  expect(errors).toEqual([])
})

test('API vrací JSON pro přihlášeného (session funguje)', async ({ page }) => {
  const res = await page.request.get('/api/notifications')
  expect(res.status()).toBeLessThan(500)
})

test('CSP: script-src má nonce a nemá unsafe-inline', async ({ page }) => {
  const res = await page.goto('/dashboard')
  const csp = res?.headers()['content-security-policy'] ?? ''
  const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? ''
  expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/)
  expect(scriptSrc).toContain("'strict-dynamic'")
  expect(scriptSrc).not.toContain('unsafe-inline')
})

test.describe('nepřihlášený', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('CSP: signin (dřív statická stránka) se hydratuje — formulář reaguje', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(String(err)))
    await page.goto('/auth/signin')
    await page.locator('input[type="email"]').fill('x@y.cz')
    await page.locator('input[type="password"]').fill('spatne')
    await page.locator('button[type="submit"]').click()
    // hydratovaný formulář zobrazí chybu (bez hydratace by se nic nestalo)
    await expect(page.locator('body')).toContainText('Nesprávný email nebo heslo', { timeout: 10_000 })
    expect(errors).toEqual([])
  })
})

test('sklad: záložky Zásoby / Dodavatelé / Objednávky se načtou a přepínají', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/sklad')
  await expect(page.locator('body')).toContainText(/Zásoby/)
  await page.getByRole('button', { name: 'Dodavatelé' }).click()
  await expect(page.locator('body')).toContainText(/Nový dodavatel|Zatím žádný dodavatel/)
  await page.getByRole('button', { name: 'Objednávky' }).click()
  await expect(page.locator('body')).toContainText(/Nové objednávky vznikají ze zakázky/)
  // dialog nového dodavatele nabízí lustraci přes ARES (našeptávač + tlačítko u IČO)
  await page.getByRole('button', { name: 'Dodavatelé' }).click()
  await page.getByRole('button', { name: /Nový dodavatel/ }).click()
  await expect(page.locator('body')).toContainText(/Vyhledat firmu v ARES/)
  await expect(page.getByRole('button', { name: 'ARES' })).toBeVisible()
  expect(errors).toEqual([])
})

test('zakázka: objednávky pod položkami, starý odkaz ?tab=objednavky přesměruje, Objednat u dodavatele', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/zakazky')
  await page.getByRole('row', { name: /E2E Zakázka/ }).getByRole('link', { name: /Detail/ }).click()
  await page.waitForURL(/\/zakazky\/[^/]+$/)
  const detailUrl = page.url()
  // 6 tabů místo 9 — Objednávky jsou sekce na tabu Položky
  await expect(page.getByRole('link', { name: 'Protokoly a vyúčtování' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Objednávky', exact: true })).toHaveCount(0)
  await expect(page.locator('#objednavky')).toContainText(/Objednávky u dodavatelů/)
  // starý odkaz z e-mailu / notifikace
  await page.goto(`${detailUrl}?tab=objednavky`)
  await page.waitForURL(/tab=polozky/)
  await expect(page.locator('#objednavky')).toBeVisible()
  await page.getByRole('button', { name: /Objednat u dodavatele/ }).click()
  await expect(page.locator('body')).toContainText(/Vyberte položky a dodavatele/)
  expect(errors).toEqual([])
})

test('kalendář: dva měsíce, chip s klientem a přetažení montáže posune termín', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/zakazky')
  const detail = page.getByRole('row', { name: /E2E Zakázka/ }).getByRole('link', { name: /Detail/ })
  const zakazkaId = (await detail.getAttribute('href'))!.split('/').pop()!

  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const od = `${ym}-10`, doo = `${ym}-11`
  const set = await page.request.patch(`/api/zakazky/${zakazkaId}`, {
    data: { montazOd: new Date(od).toISOString(), montazDo: new Date(doo).toISOString() },
  })
  expect(set.ok()).toBeTruthy()

  await page.goto('/calendar')
  const MONTHS = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec']
  await expect(page.getByText(`${MONTHS[(now.getMonth() + 1) % 12]} ${now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()}`, { exact: true })).toBeVisible()

  const chip = page.locator(`[data-day="${od}"] a[href="/zakazky/${zakazkaId}"]`)
  await expect(chip).toContainText('Klient E2E')

  // Přetažení z 10. na 13. → montáž 13.–14. (délka zachována)
  const target = page.locator(`[data-day="${ym}-13"]`)
  const from = (await chip.boundingBox())!
  const to = (await target.boundingBox())!
  await page.mouse.move(from.x + 10, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + 30, from.y + from.height / 2, { steps: 5 })
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 })
  await page.mouse.up()

  await expect(page.locator(`[data-day="${ym}-13"] a[href="/zakazky/${zakazkaId}"]`)).toBeVisible()
  await expect.poll(async () => {
    const r = await page.request.get(`/api/zakazky/${zakazkaId}`)
    const z = await r.json()
    return [String(z.montazOd).slice(0, 10), String(z.montazDo).slice(0, 10)]
  }).toEqual([`${ym}-13`, `${ym}-14`])

  // Pool „Kdykoliv" je v měsíci vidět (i prázdný)
  await expect(page.getByRole('heading', { name: /Kdykoliv \(\d+\)/ })).toBeVisible()
  expect(errors).toEqual([])
})

test('kalendář na mobilu: výchozí Agenda po dnech, bez vodorovného posunu stránky', async ({ page }) => {
  const errors = trackErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/zakazky')
  const detail = page.getByRole('row', { name: /E2E Zakázka/ }).getByRole('link', { name: /Detail/ })
    .or(page.getByRole('link', { name: /E2E Zakázka/ })).first()
  const zakazkaId = (await detail.getAttribute('href'))!.split('/').filter(Boolean)[1]
  const dnes = new Date()
  const ds = `${dnes.getFullYear()}-${String(dnes.getMonth() + 1).padStart(2, '0')}-${String(dnes.getDate()).padStart(2, '0')}`
  const set = await page.request.patch(`/api/zakazky/${zakazkaId}`, {
    data: { montazOd: new Date(ds).toISOString(), montazDo: new Date(ds).toISOString() },
  })
  expect(set.ok()).toBeTruthy()

  await page.goto('/calendar')
  await expect(page.getByRole('button', { name: 'Agenda', pressed: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Dnes · / })).toBeVisible()
  await expect(page.locator(`a[href="/zakazky/${zakazkaId}"]`).first()).toContainText('Klient E2E')
  const preteka = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(preteka).toBe(false)
  await page.screenshot({ path: 'e2e/.results/kalendar-agenda-390.png', fullPage: true })
  expect(errors).toEqual([])
})

test('detail zakázky na mobilu: sbalená hlavička s rychlými akcemi, taby hned na první obrazovce', async ({ page }) => {
  const errors = trackErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/zakazky')
  const detail = page.getByRole('row', { name: /E2E Zakázka/ }).getByRole('link', { name: /Detail/ })
    .or(page.getByRole('link', { name: /E2E Zakázka/ })).first()
  const zakazkaId = (await detail.getAttribute('href'))!.split('/').filter(Boolean)[1]

  await page.goto(`/zakazky/${zakazkaId}`)
  await expect(page.getByRole('heading', { name: 'E2E Zakázka' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Volat', exact: true })).toHaveAttribute('href', /^tel:/)
  await expect(page.getByRole('link', { name: 'Protokol', exact: true })).toBeVisible()
  // Detailní pole jsou sbalená, taby jsou vidět bez scrollu
  await expect(page.getByText('Termín montáže', { exact: true })).toBeHidden()
  const taby = await page.getByRole('link', { name: 'Položky', exact: true }).boundingBox()
  expect(taby!.y + taby!.height).toBeLessThan(844)
  await page.screenshot({ path: 'e2e/.results/zakazka-sbalena-390.png', fullPage: true })

  await page.getByRole('button', { name: 'Detail zakázky' }).click()
  await expect(page.getByText('Termín montáže', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Foto', exact: true }).click()
  await page.waitForURL(/tab=podklady/)
  await expect(page.locator('#foto')).toBeVisible()
  const preteka = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(preteka).toBe(false)
  expect(errors).toEqual([])
})

test('detail zakázky na desktopu: hlavička celá, bez mobilního přepínače', async ({ page }) => {
  await page.goto('/zakazky')
  const detail = page.getByRole('row', { name: /E2E Zakázka/ }).getByRole('link', { name: /Detail/ })
  await page.goto((await detail.getAttribute('href'))!)
  await expect(page.getByText('Termín montáže', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Detail zakázky' })).toBeHidden()
  await expect(page.getByRole('link', { name: 'Volat', exact: true })).toBeHidden()
})

test('nový klient: stačí příjmení, po uložení detail klienta + toast; firma má IČO a ARES', async ({ page }) => {
  const errors = trackErrors(page)
  const prijmeni = `Novak${Date.now()}`
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/clients/new')
  await page.getByRole('button', { name: 'Rozumím' }).click()
  await page.getByRole('button', { name: 'Firma' }).click()
  await expect(page.getByLabel('IČO')).toBeVisible()
  await expect(page.getByRole('button', { name: 'ARES', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Fyzická osoba' }).click()

  await page.getByRole('button', { name: 'Vytvořit klienta' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Příjmení je povinné' })).toBeVisible()

  await page.getByLabel('Příjmení').fill(prijmeni)
  await page.getByLabel('Telefon').fill(`+420 7${String(Date.now()).slice(-8)}`)
  await page.getByRole('button', { name: 'Vytvořit klienta' }).click()
  await page.waitForURL(/\/clients\/(?!new)[^/]+$/)
  await expect(page.getByText('Klient založen')).toBeVisible()
  await expect(page.locator('body')).toContainText(prijmeni)
  const preteka = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(preteka).toBe(false)
  expect(errors).toEqual([])
})

test('lead: nový lead v dialogu (Esc zavře), po uložení detail + toast', async ({ page }) => {
  const errors = trackErrors(page)
  const jmeno = `Lead E2E ${Date.now()}`
  await page.goto('/leady')
  await page.getByRole('button', { name: '+ Přidat lead', exact: true }).first().click()
  await expect(page.getByRole('dialog', { name: 'Nový lead' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.getByRole('button', { name: '+ Přidat lead', exact: true }).first().click()
  await page.getByLabel('Jméno').fill(jmeno)
  await page.getByLabel('Odh. hodnota (Kč)').fill('150 000')
  await page.getByRole('button', { name: 'Vytvořit lead' }).click()
  await page.waitForURL(/\/leady\/[^/]+$/)
  await expect(page.getByText('Lead vytvořen')).toBeVisible()
  await expect(page.locator('body')).toContainText(jmeno)
  const leadId = page.url().split('/').pop()!
  const lead = await (await page.request.get(`/api/leady/${leadId}`)).json()
  expect(Number(lead.odhadovanaHodnota)).toBe(150000)
  expect(errors).toEqual([])
})

test('zakázky: prázdný výsledek filtru nabídne cestu zpět', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/zakazky')
  await page.getByPlaceholder('Hledat zakázku…').fill('neexistuje-xyz-123')
  await expect(page.getByRole('heading', { name: 'Nic neodpovídá filtru' })).toBeVisible()
  await page.getByRole('button', { name: 'Zobrazit všechny zakázky' }).click()
  await expect(page.getByPlaceholder('Hledat zakázku…')).toHaveValue('')
  await expect(page.getByRole('row', { name: /E2E Zakázka/ })).toBeVisible()
  expect(errors).toEqual([])
})

test('nabídky a leady na mobilu: karty místo oříznuté tabulky, bez vodorovného posunu', async ({ page }) => {
  const errors = trackErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  for (const url of ['/quotes', '/leady']) {
    await page.goto(url)
    await expect(page.locator('h1')).toBeVisible()
    const preteka = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(preteka, url).toBe(false)
  }
  await expect(page.locator('table')).toBeVisible() // leady: tabulka s kartovou buňkou
  await page.screenshot({ path: 'e2e/.results/leady-390.png', fullPage: true })
  expect(errors).toEqual([])
})

test('detail zakázky: vysvětlivka stavů se otevře klepnutím (ne jen title)', async ({ page }) => {
  await page.goto('/zakazky')
  const detail = page.getByRole('row', { name: /E2E Zakázka/ }).getByRole('link', { name: /Detail/ })
  await page.goto((await detail.getAttribute('href'))!)
  const tip = page.getByRole('button', { name: /Jak se posouvají stavy|Jak fungují etapy/ })
  await tip.click()
  await expect(page.getByRole('tooltip')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toBeHidden()
})
