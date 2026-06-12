import sanitize from 'sanitize-html'

/**
 * Sanitizace tenant HTML před uložením/renderem do PDF (puppeteer) a před
 * zobrazením v náhledu. Obrana proti script injection a SSRF — puppeteer
 * navíc blokuje síť na úrovni request interception (lib/pdf.ts), tohle je
 * první vrstva.
 */

const DOCUMENT_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'div', 'span',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'mark', 'blockquote',
  'pre', 'code', 'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'colgroup', 'col',
  'caption', 'figure', 'figcaption', 'img', 'a',
  // inline SVG ikony (šablony nabídek) — bezpečná podmnožina, žádné <use>/href
  'svg', 'g', 'path', 'polyline', 'polygon', 'line', 'circle', 'ellipse', 'rect',
]

const SVG_ATTRS = [
  'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'd', 'points', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'width', 'height', 'transform', 'opacity', 'fill-rule', 'clip-rule',
]

const DOCUMENT_ATTRIBUTES: Record<string, string[]> = {
  '*': ['style', 'class', 'align', 'valign'],
  ol: ['style', 'class', 'type', 'start'],
  ul: ['style', 'class', 'type'],
  li: ['style', 'class', 'value'],
  td: ['style', 'class', 'align', 'valign', 'colspan', 'rowspan', 'width'],
  th: ['style', 'class', 'align', 'valign', 'colspan', 'rowspan', 'width'],
  col: ['style', 'class', 'span', 'width'],
  table: ['style', 'class', 'border', 'cellpadding', 'cellspacing', 'width'],
  img: ['style', 'class', 'src', 'alt', 'width', 'height'],
  a: ['style', 'class', 'href'],
  svg: ['style', 'class', ...SVG_ATTRS, 'xmlns'],
  g: SVG_ATTRS, path: SVG_ATTRS, polyline: SVG_ATTRS, polygon: SVG_ATTRS,
  line: SVG_ATTRS, circle: SVG_ATTRS, ellipse: SVG_ATTRS, rect: SVG_ATTRS,
}

const COMMON_OPTIONS: sanitize.IOptions = {
  allowedSchemes: ['https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['data', 'https'] },
  allowProtocolRelative: false,
  parser: { lowerCaseAttributeNames: false },
}

/**
 * HTML fragment dokumentu (vlastní záhlaví/patička PDF).
 * Povoluje inline styly, tabulky a SVG, zahazuje skripty, iframy, event
 * handlery a vše mimo https/mailto/tel odkazy; obrázky jen data: a https.
 */
export function sanitizeDocumentHtml(html: string): string {
  return sanitize(html, {
    ...COMMON_OPTIONS,
    allowedTags: DOCUMENT_TAGS,
    allowedAttributes: DOCUMENT_ATTRIBUTES,
  })
}

const FONT_HOSTS = ['https://fonts.googleapis.com/', 'https://fonts.gstatic.com/']

/**
 * Celý HTML dokument (texty smluv, CUSTOM_HTML šablony nabídek): navíc
 * povoluje kostru dokumentu, <style> blok a <link> POUZE na Google Fonts.
 * CSS url() exfiltraci blokuje request interception v puppeteeru. Doctype
 * se po sanitizaci vrací, aby render nespadl do quirks mode.
 */
export function sanitizeFullDocumentHtml(html: string): string {
  const clean = sanitize(html, {
    ...COMMON_OPTIONS,
    allowedTags: [...DOCUMENT_TAGS, 'html', 'head', 'body', 'meta', 'title', 'link', 'style', 'header', 'footer', 'main', 'section', 'article'],
    allowedAttributes: {
      ...DOCUMENT_ATTRIBUTES,
      meta: ['charset'],
      link: ['href', 'rel'],
      html: ['lang'],
    },
    allowVulnerableTags: true, // <style> — vědomě; síť je v puppeteeru blokovaná
    exclusiveFilter: frame =>
      frame.tag === 'link' &&
      !FONT_HOSTS.some(h => (frame.attribs.href ?? '').startsWith(h)),
  })
  return /^\s*<!doctype/i.test(html) ? `<!DOCTYPE html>\n${clean}` : clean
}

/**
 * Je uložený text smlouvy HTML? (stejná heuristika jako PDF render)
 */
export function isHtmlContent(text: string): boolean {
  return text.trimStart().startsWith('<')
}
