'use client'

// Ukázka ke kroku průvodce. Renderuje se jen aktivní záložka - ostatní ukázky
// se dotáhnou až po přepnutí (menší HTML i RSC payload homepage).

import dynamic from 'next/dynamic'
import type { KrokId } from './content'

const ObchodniPripadMock = dynamic(() => import('../mocks/ObchodniPripadMock').then(m => m.ObchodniPripadMock))
const SodMock = dynamic(() => import('../mocks/SodMock').then(m => m.SodMock))
const MaterialMock = dynamic(() => import('../mocks/MaterialMock').then(m => m.MaterialMock))
const TechZakazka = dynamic(() => import('../tech/TechScreens').then(m => m.TechZakazka))
const VyuctovaniMock = dynamic(() => import('../mocks/VyuctovaniMock').then(m => m.VyuctovaniMock))
const ServisPlanMock = dynamic(() => import('../mocks/ServisPlanMock').then(m => m.ServisPlanMock))

export function KrokUkazka({ id }: { id: KrokId }) {
  switch (id) {
    case 'obchod': return <ObchodniPripadMock callout={false} />
    case 'smlouva': return <SodMock callout={false} />
    case 'priprava': return <MaterialMock callout={false} />
    case 'montaz': return <TechZakazka />
    case 'predani': return <VyuctovaniMock callout={false} />
    case 'servis': return <ServisPlanMock />
  }
}
