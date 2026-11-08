import { describe, it, expect, vi, afterEach } from 'vitest'
import { abraZapis, AbraChyba, type AbraKonfigurace } from '@/lib/abra/flexi'
import { nazevZakazkyAbra, odesliZakazkuDoAbry } from '@/lib/abra/zakazka'
import { zaznamAdresare } from '@/lib/abra/adresar'

/** ABRA Flexi F2 — založení zakázky s odběratelem (adresář podle ext ID, bez párování) */

const K: AbraKonfigurace = { url: 'https://flexi.test', firma: 'firma_s_r_o_', uzivatel: 'api', heslo: 'tajne', orgSlug: 'x' }
const FO = { id: 'c1', typKlienta: 'FYZICKA_OSOBA', jmeno: 'Jan', prijmeni: 'Novák', telefon: '724 000 111', mesto: 'Ostrava', ulice: '', ico: '123' }
const FIRMA = { id: 'c2', typKlienta: 'FIRMA', jmeno: 'SOTIFO s.r.o.', prijmeni: 'Jan Florko', ico: '17995647', dic: 'CZ17995647', mesto: 'Český Těšín', email: 'a@b.cz' }
const Z = { cislo: '26-201', technologie: 'TEPELNE_CERPADLO', klient: FO }
const ok = (winstrom: object) => new Response(JSON.stringify({ winstrom }), { status: 200 })
const nenalezeno = () => new Response('{}', { status: 404 })
const telo = (f: ReturnType<typeof vi.fn>, i: number) => JSON.parse(f.mock.calls[i][1].body).winstrom

afterEach(() => vi.unstubAllGlobals())

describe('ABRA adresář', () => {
  it('fyzická osoba: jméno + kontakty, bez IČO, prázdná pole se neposílají', () => {
    expect(zaznamAdresare(FO)).toEqual({
      id: 'ext:FELUCIA:klient:c1', nazev: 'Jan Novák', mesto: 'Ostrava', tel: '724 000 111',
      stat: 'code:CZ', typVztahuK: 'typVztahu.odberDodav',
    })
  })

  it('firma: název firmy, IČO, DIČ', () => {
    expect(zaznamAdresare(FIRMA)).toMatchObject({ nazev: 'SOTIFO s.r.o.', ic: '17995647', dic: 'CZ17995647', email: 'a@b.cz', mesto: 'Český Těšín' })
  })
})

describe('ABRA zakázka', () => {
  it('název „Příjmení Jméno - Technologie“, u firmy název firmy', () => {
    expect(nazevZakazkyAbra(Z)).toBe('Novák Jan - Tepelné čerpadlo')
    expect(nazevZakazkyAbra({ ...Z, technologie: 'JINE' })).toBe('Novák Jan')
    expect(nazevZakazkyAbra({ ...Z, klient: FIRMA })).toBe('SOTIFO s.r.o. - Tepelné čerpadlo')
  })

  it('zápis jinam než do zakázek a adresáře odmítne bez volání API', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    await expect(abraZapis(K, 'faktura-vydana', {})).rejects.toBeInstanceOf(AbraChyba)
    expect(f).not.toHaveBeenCalled()
  })

  it('nový klient i zakázka: založí adresář, zakázku s firmou a stavem MÁME', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(ok({ zakazka: [] }))
      .mockResolvedValueOnce(nenalezeno())
      .mockResolvedValueOnce(ok({ success: 'true', results: [{ id: '500' }] }))
      .mockResolvedValueOnce(ok({ success: 'true', results: [{ id: '99' }] }))
    vi.stubGlobal('fetch', f)
    expect(await odesliZakazkuDoAbry(K, Z)).toEqual({ stav: 'ZALOZENO', abraId: '99', adresarId: '500', adresarZalozen: true })
    expect(f.mock.calls[1][0]).toContain('/adresar/ext%3AFELUCIA%3Aklient%3Ac1.json')
    expect(telo(f, 2).adresar[0].nazev).toBe('Jan Novák')
    expect(telo(f, 3)).toEqual({ zakazka: [{ kod: '26-201', nazev: 'Novák Jan - Tepelné čerpadlo', stavZakazky: 'code:MÁME', firma: '500' }] })
  })

  it('opakovaný klient: adresář podle ext ID znovu použije, nezakládá', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(ok({ zakazka: [] }))
      .mockResolvedValueOnce(ok({ adresar: [{ id: '500' }] }))
      .mockResolvedValueOnce(ok({ success: 'true', results: [{ id: '100' }] }))
    vi.stubGlobal('fetch', f)
    expect(await odesliZakazkuDoAbry(K, { ...Z, cislo: '26-202' })).toMatchObject({ stav: 'ZALOZENO', adresarId: '500', adresarZalozen: false })
    expect(f).toHaveBeenCalledTimes(3)
    expect(Object.keys(telo(f, 2))).toEqual(['zakazka'])
  })

  it('existující zakázka bez firmy: firmu doplní', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(ok({ zakazka: [{ id: '87', kod: '26-201', firma: '' }] }))
      .mockResolvedValueOnce(ok({ adresar: [{ id: '500' }] }))
      .mockResolvedValueOnce(ok({ success: 'true', results: [{ id: '87' }] }))
    vi.stubGlobal('fetch', f)
    expect(await odesliZakazkuDoAbry(K, Z)).toMatchObject({ stav: 'DOPLNENA_FIRMA', abraId: '87', adresarId: '500' })
    expect(telo(f, 2)).toEqual({ zakazka: [{ id: '87', firma: '500' }] })
  })

  it('existující zakázka s firmou: nic nezapisuje', async () => {
    const f = vi.fn().mockResolvedValueOnce(ok({ zakazka: [{ id: '42', kod: '26-201', firma: 'code:X' }] }))
    vi.stubGlobal('fetch', f)
    expect(await odesliZakazkuDoAbry(K, Z)).toMatchObject({ stav: 'EXISTUJE', abraId: '42' })
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('dry-run: nic neuloží a zakázka jde s ?dry-run=true', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(ok({ zakazka: [] }))
      .mockResolvedValueOnce(nenalezeno())
      .mockResolvedValueOnce(ok({ success: 'true', results: [{ id: '1' }] }))
      .mockResolvedValueOnce(ok({ success: 'true', results: [{ id: '2' }] }))
    vi.stubGlobal('fetch', f)
    expect(await odesliZakazkuDoAbry(K, Z, { dryRun: true })).toMatchObject({ stav: 'NANECISTO', adresarId: null })
    expect(f.mock.calls[2][0]).toMatch(/adresar\.json\?dry-run=true$/)
    expect(f.mock.calls[3][0]).toMatch(/zakazka\.json\?dry-run=true$/)
  })

  it('chyba Flexi se propíše', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(ok({ zakazka: [] }))
      .mockResolvedValueOnce(ok({ adresar: [{ id: '500' }] }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ winstrom: { success: 'false', results: [{ errors: [{ message: 'Kód musí být unikátní' }] }] } }), { status: 400 })))
    await expect(odesliZakazkuDoAbry(K, Z)).rejects.toThrow('Kód musí být unikátní')
  })

  it('číslo s koncovkou etapy odmítne', async () => {
    await expect(odesliZakazkuDoAbry(K, { ...Z, cislo: '26-047-1' })).rejects.toThrow('RR-NNN')
  })
})
