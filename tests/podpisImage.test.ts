import { describe, it, expect } from 'vitest'
import { podpisToImgSrc } from '@/lib/podpisImage'

const MOBILE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="379" height="734" viewBox="0 0 379 734"><path d="M205.7,397.8 L191.3,426.4 L185.3,442.1" stroke="#00D4C8" stroke-width="2.5" fill="none"/></svg>'

function decode(src: string) {
  return decodeURIComponent(src.replace('data:image/svg+xml;charset=utf-8,', ''))
}

describe('podpisToImgSrc', () => {
  it('PNG data URL z webu projde beze změny', () => {
    expect(podpisToImgSrc('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
  })

  it('surové SVG z appky převede na data URL, ořízne na tah a přebarví na inkoust', () => {
    const src = podpisToImgSrc(MOBILE_SVG)!
    expect(src.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    const svg = decode(src)
    expect(svg).toContain('viewBox="173.3 385.8 44.4 68.3"')
    expect(svg).not.toMatch(/\swidth=|\sheight=/)
    expect(svg).toContain('stroke="#111827"')
    expect(svg).not.toContain('#00D4C8')
  })

  it('SVG bez path zůstane s původním viewBoxem', () => {
    const svg = decode(podpisToImgSrc('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>')!)
    expect(svg).toContain('viewBox="0 0 10 10"')
  })

  it('zahodí prázdné, cizí URL a nebezpečné SVG', () => {
    expect(podpisToImgSrc(null)).toBeNull()
    expect(podpisToImgSrc('')).toBeNull()
    expect(podpisToImgSrc('https://evil.example/x.png')).toBeNull()
    expect(podpisToImgSrc('<svg onload="alert(1)"></svg>')).toBeNull()
    expect(podpisToImgSrc('<svg><script>alert(1)</script></svg>')).toBeNull()
    expect(podpisToImgSrc('<svg><foreignObject></foreignObject></svg>')).toBeNull()
    expect(podpisToImgSrc('<svg><a href="javascript:x"></a></svg>')).toBeNull()
  })
})
