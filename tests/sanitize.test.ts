import { describe, it, expect } from 'vitest'
import { sanitizeDocumentHtml, sanitizeFullDocumentHtml, isHtmlContent } from '@/lib/sanitizeHtml'

describe('sanitizeFullDocumentHtml (texty smluv, CUSTOM_HTML šablony nabídek)', () => {
  it('odstraní <script> a event handlery', () => {
    const out = sanitizeFullDocumentHtml('<p onclick="alert(1)">Cena díla</p><script>fetch("http://localhost:3000/api")</script>')
    expect(out).not.toContain('script')
    expect(out).not.toContain('onclick')
    expect(out).toContain('Cena díla')
  })

  it('odstraní iframe, object a formuláře', () => {
    const out = sanitizeFullDocumentHtml('<iframe src="https://evil.cz"></iframe><object data="x"></object><form><input></form><p>OK</p>')
    expect(out).toBe('<p>OK</p>')
  })

  it('zachová strukturu smlouvy: nadpisy, tabulky, inline styly, číslované seznamy, placeholdery', () => {
    const html = '<h1 style="text-align:center">SMLOUVA O DÍLO</h1>'
      + '<ol type="I" start="2"><li>článek</li></ol>'
      + '<table border="1"><tbody><tr><td colspan="2" style="font-weight:bold">{{konecna_cena}}</td></tr></tbody></table>'
      + '<p><strong>{{klient_jmeno}}</strong>, {{klient_adresa}}</p>'
    expect(sanitizeFullDocumentHtml(html)).toBe(html)
  })

  it('zachová kostru dokumentu, <style> a Google Fonts <link>', () => {
    const html = '<!DOCTYPE html>\n<html lang="cs"><head><meta charset="UTF-8">'
      + '<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">'
      + '<style>body { font-family: Inter; }</style></head>'
      + '<body><h1>Nabídka {{kod}}</h1></body></html>'
    const out = sanitizeFullDocumentHtml(html)
    expect(out).toContain('<!DOCTYPE html>')
    expect(out).toContain('fonts.googleapis.com')
    expect(out).toContain('<style>body { font-family: Inter; }</style>')
    expect(out).toContain('<h1>Nabídka {{kod}}</h1>')
  })

  it('zahodí <link> mimo Google Fonts a skripty', () => {
    const out = sanitizeFullDocumentHtml('<html><head><link href="https://evil.cz/x.css" rel="stylesheet"><script>x()</script></head><body>OK</body></html>')
    expect(out).not.toContain('evil.cz')
    expect(out).not.toContain('script')
    expect(out).toContain('OK')
  })

  it('odkazy: https/mailto projdou, javascript: ne', () => {
    const out = sanitizeFullDocumentHtml('<a href="https://nanto.cz/reference">web</a><a href="javascript:alert(1)">x</a><a href="mailto:a@b.cz">mail</a>')
    expect(out).toContain('href="https://nanto.cz/reference"')
    expect(out).toContain('href="mailto:a@b.cz"')
    expect(out).not.toContain('javascript:')
  })

  it('obrázky: data: projde (logo), http: ne', () => {
    const out = sanitizeFullDocumentHtml('<img src="data:image/png;base64,AAAA"><img src="http://evil.cz/x.png">')
    expect(out).toContain('src="data:image/png;base64,AAAA"')
    expect(out).not.toContain('evil.cz')
  })

  it('zachová inline SVG ikony bez event handlerů', () => {
    const out = sanitizeFullDocumentHtml('<svg viewBox="0 0 24 24" fill="none" stroke="#111" onload="x()"><path d="M3 9l9-7"/></svg>')
    expect(out).toContain('viewBox="0 0 24 24"')
    expect(out).toContain('<path d="M3 9l9-7"')
    expect(out).not.toContain('onload')
  })

  it('zachová {{#polozky}} smyčku beze změny', () => {
    const html = '<table><tbody>{{#polozky}}<tr><td>{{polozka_nazev}}</td><td>{{polozka_celkem}}</td></tr>{{/polozky}}</tbody></table>'
    expect(sanitizeFullDocumentHtml(html)).toBe(html)
  })
})

describe('sanitizeDocumentHtml (vlastní záhlaví/patička PDF)', () => {
  it('odstraní skripty a <style> blok, zachová inline styly a data: logo', () => {
    const out = sanitizeDocumentHtml('<style>x{}</style><div style="color:#333"><img src="data:image/png;base64,AA"><script>x()</script>Firma</div>')
    expect(out).not.toContain('<style>')
    expect(out).not.toContain('script')
    expect(out).toContain('style="color:#333"')
    expect(out).toContain('src="data:image/png;base64,AA"')
  })

  it('zachová span s class pro číslování stránek', () => {
    const html = 'Strana <span class="pageNumber"></span> z <span class="totalPages"></span>'
    expect(sanitizeDocumentHtml(html)).toBe(html)
  })
})

describe('isHtmlContent', () => {
  it('rozliší HTML od prostého textu (vč. < v textu)', () => {
    expect(isHtmlContent('<p>Smlouva</p>')).toBe(true)
    expect(isHtmlContent('  \n<h1>S</h1>')).toBe(true)
    expect(isHtmlContent('Cena je < 50 000 Kč')).toBe(false)
  })
})
