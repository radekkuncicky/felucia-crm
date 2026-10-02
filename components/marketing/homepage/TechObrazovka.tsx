'use client'

// Obrazovka Felucia Tech pro přepínač v #technici - jen aktivní, ostatní na vyžádání.

import dynamic from 'next/dynamic'

export type TechObrazovkaId = 'muj-den' | 'zakazka' | 'material' | 'fotky' | 'podpis'

const OBRAZOVKY: Record<TechObrazovkaId, React.ComponentType> = {
  'muj-den': dynamic(() => import('../tech/TechScreens').then(m => m.TechMujDen)),
  zakazka: dynamic(() => import('../tech/TechScreens').then(m => m.TechZakazka)),
  material: dynamic(() => import('../tech/TechScreens').then(m => m.TechMaterial)),
  fotky: dynamic(() => import('../tech/TechScreens').then(m => m.TechFotky)),
  podpis: dynamic(() => import('../tech/TechScreens').then(m => m.TechPodpis)),
}

export function TechObrazovka({ id }: { id: TechObrazovkaId }) {
  const O = OBRAZOVKY[id]
  return <O />
}
