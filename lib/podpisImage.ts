/**
 * Podpisy klienta se ukládají ve dvou formátech:
 *  - web (SignatureCanvas): PNG data URL
 *  - mobilní appky (felucia-tech): surový `<svg>…</svg>` s path M/L souřadnicemi
 *    přes celou obrazovku telefonu
 * Tenhle helper obojí převede na hodnotu použitelnou v `<img src>` — SVG ořízne
 * na skutečný tah a přebarví na inkoust. Cokoliv jiného (cizí URL, HTML) zahodí.
 * Izomorfní — bez Bufferu, běží i v prohlížeči.
 */

const INK = '#111827'
const PADDING = 12

function svgJeBezpecne(svg: string): boolean {
  return !/<script|<foreignObject|javascript:|\son[a-z]+\s*=|<iframe|<object|<embed|xlink:href|\shref\s*=/i.test(svg)
}

/** Ořízne viewBox na bounding box všech path souřadnic (jen absolutní M/L, tak appka kreslí). */
function oriznoutNaTah(svg: string): string {
  const nums: number[] = []
  const dAttr = /\sd="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = dAttr.exec(svg)) !== null) {
    for (const n of m[1].match(/-?\d+(?:\.\d+)?/g) ?? []) nums.push(Number(n))
  }
  if (nums.length < 4 || nums.length % 2 !== 0) return svg
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i])
    minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1])
  }
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return svg
  const r = (n: number) => Math.round(n * 10) / 10
  const x = r(minX - PADDING), y = r(minY - PADDING)
  const w = r(Math.max(maxX - minX + 2 * PADDING, 1)), h = r(Math.max(maxY - minY + 2 * PADDING, 1))
  return svg
    .replace(/<svg\b([^>]*)>/, (_m, attrs: string) => {
      const bezRozmeru = attrs.replace(/\s(?:width|height|viewBox)="[^"]*"/g, '')
      return `<svg${bezRozmeru} viewBox="${x} ${y} ${w} ${h}">`
    })
}

/** Data URL pro `<img src>` (PNG i SVG), nebo null když hodnota není použitelný podpis. */
export function podpisToImgSrc(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.trim()
  if (v.startsWith('data:image/')) return v
  if (!v.startsWith('<svg') || !svgJeBezpecne(v)) return null
  const svg = oriznoutNaTah(v).replace(/stroke="#[0-9a-fA-F]{3,8}"/g, `stroke="${INK}"`)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
