'use client'

// Náběh sekcí při scrollu (opacity + posun 8 px, 300 ms, jen jednou).
// Prvky s data-reveal; co je při načtení už vidět, se neskrývá.
// Při prefers-reduced-motion nedělá nic.

import { useEffect } from 'react'

export function RevealObserver() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!('IntersectionObserver' in window)) return
    const prvky = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    for (const el of prvky) {
      if (el.getBoundingClientRect().top < window.innerHeight) el.setAttribute('data-revealed', '')
    }
    const root = document.querySelector('.mk')
    root?.classList.add('mk-reveal-on')
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        e.target.setAttribute('data-revealed', '')
        io.unobserve(e.target)
      }
    }, { rootMargin: '0px 0px -8% 0px' })
    prvky.filter(el => !el.hasAttribute('data-revealed')).forEach(el => io.observe(el))
    return () => {
      io.disconnect()
      root?.classList.remove('mk-reveal-on')
    }
  }, [])
  return null
}
