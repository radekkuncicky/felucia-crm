import { describe, it, expect } from 'vitest'
import path from 'path'
import {
  UPLOADS_ROOT, safeUploadPath, sniffFile, checkImageUpload, checkDocumentUpload, checkLogoUpload, isImageDataUri,
} from '@/lib/uploadSafety'

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)])
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)])
const PDF = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n')
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(16)])
const HTML = Buffer.from('<!DOCTYPE html><html><body><script>alert(1)</script></body></html>')

describe('safeUploadPath — cesty z DB/klienta zůstávají pod public/uploads', () => {
  it('běžná cesta se přeloží pod UPLOADS_ROOT', () => {
    expect(safeUploadPath('/uploads/org/abc/logo.png')).toBe(path.join(UPLOADS_ROOT, 'org', 'abc', 'logo.png'))
  })

  it('odmítne traversal, absolutní cesty, data: URI, prázdno', () => {
    expect(safeUploadPath('/uploads/../.env')).toBeNull()
    expect(safeUploadPath('/uploads/org/../../.env')).toBeNull()
    expect(safeUploadPath('/uploads/org/..%2F..%2F.env')).not.toBeNull() // literál, ne traversal — zůstane pod uploads
    expect(safeUploadPath('../.env')).toBeNull()
    expect(safeUploadPath('/etc/passwd')).toBeNull()
    expect(safeUploadPath('/.env')).toBeNull()
    expect(safeUploadPath('data:image/png;base64,AAAA')).toBeNull()
    expect(safeUploadPath('')).toBeNull()
    expect(safeUploadPath(null)).toBeNull()
    expect(safeUploadPath(undefined)).toBeNull()
    expect(safeUploadPath('/uploads/a\0b')).toBeNull()
  })

  it('vynutí požadovaný prefix (např. adresář konkrétní zakázky)', () => {
    expect(safeUploadPath('/uploads/zakazky/z1/foto.jpg', '/uploads/zakazky/z1/')).not.toBeNull()
    expect(safeUploadPath('/uploads/zakazky/z2/foto.jpg', '/uploads/zakazky/z1/')).toBeNull()
    expect(safeUploadPath('/uploads/zakazky/z1/../z2/foto.jpg', '/uploads/zakazky/z1/')).toBeNull()
    expect(safeUploadPath('/uploads/org/x/logo.png', '/uploads/zakazky/')).toBeNull()
  })
})

describe('sniffFile — typ podle magic bytes', () => {
  it('rozpozná png/jpg/pdf/zip', () => {
    expect(sniffFile(PNG)?.ext).toBe('png')
    expect(sniffFile(JPG)?.ext).toBe('jpg')
    expect(sniffFile(PDF)?.kind).toBe('pdf')
    expect(sniffFile(ZIP)?.kind).toBe('zip')
  })
  it('text/HTML nerozpozná jako nic', () => {
    expect(sniffFile(HTML)).toBeNull()
    expect(sniffFile(Buffer.from('ab'))).toBeNull()
  })
})

describe('checkImageUpload — přípona z obsahu, ne z názvu/Content-Type', () => {
  it('skutečný obrázek projde s příponou podle obsahu', () => {
    expect(checkImageUpload(PNG)).toEqual({ ext: 'png', mime: 'image/png' })
    expect(checkImageUpload(JPG)).toEqual({ ext: 'jpg', mime: 'image/jpeg' })
  })
  it('HTML/PDF/zip se za obrázek nevydá', () => {
    expect(checkImageUpload(HTML)).toBeNull()
    expect(checkImageUpload(PDF)).toBeNull()
    expect(checkImageUpload(ZIP)).toBeNull()
  })
  it('respektuje povolený seznam', () => {
    expect(checkImageUpload(PNG, ['jpg'])).toBeNull()
  })
})

describe('checkDocumentUpload — podklady zakázek / dokumenty org', () => {
  it('PDF, obrázky a Office projdou, přípona podle obsahu', () => {
    expect(checkDocumentUpload(PDF, 'smlouva.pdf')).toEqual({ ext: 'pdf' })
    expect(checkDocumentUpload(PNG, 'foto.PNG')).toEqual({ ext: 'png' })
    expect(checkDocumentUpload(JPG, 'foto.jpeg')).toEqual({ ext: 'jpg' })
    expect(checkDocumentUpload(ZIP, 'projekt.docx')).toEqual({ ext: 'docx' })
    expect(checkDocumentUpload(ZIP, 'archiv.zip')).toEqual({ ext: 'zip' })
    expect(checkDocumentUpload(Buffer.from('a;b;c\n1;2;3\n'), 'data.csv')).toEqual({ ext: 'csv' })
  })

  it('aktivní obsah (.html/.svg/.js/.xml) je vždy odmítnut', () => {
    for (const name of ['x.html', 'x.htm', 'x.svg', 'x.js', 'x.xml', 'x.xhtml', 'x.mht', 'x']) {
      expect(checkDocumentUpload(HTML, name), name).toBeNull()
    }
  })

  it('obsah musí odpovídat příponě (HTML pojmenované .pdf, PDF pojmenované .png)', () => {
    expect(checkDocumentUpload(HTML, 'x.pdf')).toBeNull()
    expect(checkDocumentUpload(PDF, 'x.png')).toBeNull()
    expect(checkDocumentUpload(HTML, 'x.docx')).toBeNull()
    expect(checkDocumentUpload(PNG, 'x.txt')).toBeNull() // binární obsah pod textovou příponou
  })
})

describe('checkLogoUpload — rastr podle obsahu, SVG jen bez skriptů', () => {
  it('rastr projde, HTML ne', () => {
    expect(checkLogoUpload(PNG)?.ext).toBe('png')
    expect(checkLogoUpload(HTML)).toBeNull()
  })
  it('čisté SVG projde, SVG se skriptem / handlerem / odkazem ne', () => {
    expect(checkLogoUpload(Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'))?.ext).toBe('svg')
    expect(checkLogoUpload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull()
    expect(checkLogoUpload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'))).toBeNull()
    expect(checkLogoUpload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect/></a></svg>'))).toBeNull()
    expect(checkLogoUpload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body/></foreignObject></svg>'))).toBeNull()
  })
})

describe('isImageDataUri — JSON fallback fotek', () => {
  it('přijme jen base64 data: URI obrázku', () => {
    expect(isImageDataUri('data:image/jpeg;base64,' + PNG.toString('base64'))).toBe(true)
    expect(isImageDataUri('data:image/png;base64,AAAA')).toBe(true)
    expect(isImageDataUri('/../.env')).toBe(false)
    expect(isImageDataUri('/uploads/zakazky/x/1.jpg')).toBe(false)
    expect(isImageDataUri('data:text/html;base64,AAAA')).toBe(false)
    expect(isImageDataUri('data:image/svg+xml;base64,AAAA')).toBe(false)
    expect(isImageDataUri(null)).toBe(false)
    expect(isImageDataUri({ toString: () => 'data:image/png;base64,AAAA' })).toBe(false)
  })
  it('hlídá maximální velikost', () => {
    expect(isImageDataUri('data:image/png;base64,' + 'A'.repeat(200), 100)).toBe(false)
  })
})
