import { describe, it, expect } from 'vitest'
import { importContractFile } from '@/lib/contractImport'

describe('importContractFile', () => {
  it('odmítne nepodporovanou příponu', async () => {
    const r = await importContractFile('smlouva.pdf', Buffer.from('cokoliv'))
    expect('error' in r && r.error).toContain('Podporované formáty')
  })

  it('načte .html a sanitizuje (script pryč, text zůstane)', async () => {
    const html = '<h1>Smlouva {{cislo_smlouvy}}</h1><script>fetch("http://localhost")</script><p>OK</p>'
    const r = await importContractFile('smlouva.html', Buffer.from(html, 'utf-8'))
    expect('html' in r).toBe(true)
    if ('html' in r) {
      expect(r.html).toContain('Smlouva {{cislo_smlouvy}}')
      expect(r.html).toContain('<p>OK</p>')
      expect(r.html).not.toContain('script')
    }
  })

  it('zachová tabulky a inline styly z .html (proč existuje HTML režim)', async () => {
    const html = '<table border="1"><tbody><tr><td style="font-weight:bold">{{konecna_cena}}</td></tr></tbody></table>'
    const r = await importContractFile('tabulka.htm', Buffer.from(html, 'utf-8'))
    expect('html' in r && r.html).toContain('<table')
    expect('html' in r && r.html).toContain('{{konecna_cena}}')
  })

  it('vrátí chybu u prázdného obsahu', async () => {
    const r = await importContractFile('prazdne.html', Buffer.from('   ', 'utf-8'))
    expect('error' in r && r.error).toContain('žádný použitelný text')
  })

  it('vrátí čitelnou chybu u poškozeného .docx', async () => {
    const r = await importContractFile('rozbity.docx', Buffer.from('tohle není zip'))
    expect('error' in r && r.error).toContain('.docx se nepodařilo přečíst')
  })
})
