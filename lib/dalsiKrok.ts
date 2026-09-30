import type { SodStav, StavDealu } from '@prisma/client'

export interface DalsiKrokVstup {
  dealId: string
  stav: StavDealu
  maNabidku: boolean
  nabidkaOdeslana: boolean
  /** Poslední nezrušená smlouva (bez STORNO/EXPIROVANO) */
  smlouva: { id: string; stav: SodStav } | null
  zakazka: { id: string; cislo: string } | null
}

export type Krok = { titulek: string; popis: string; akce: { label: string; href: string }[] }

/** Co má obchodník s OP udělat dál — odvozeno ze stavu nabídky, smlouvy a zakázky. */
export function urcitDalsiKrok(p: DalsiKrokVstup): Krok | null {
  const tab = (t: string) => `/deals/${p.dealId}?tab=${t}`
  if (p.stav === 'PAS' || p.stav === 'ZNEPLATNENO') return null
  if (p.zakazka) {
    return {
      titulek: `Realizace běží v zakázce ${p.zakazka.cislo}`,
      popis: 'Montáž, předávací protokol a vyúčtování se řeší v zakázce.',
      akce: [{ label: 'Otevřít zakázku', href: `/zakazky/${p.zakazka.id}` }],
    }
  }
  if (!p.maNabidku) {
    return {
      titulek: 'Připravte nabídku',
      popis: 'Sestavte nabídku ze vzoru nebo z katalogu produktů.',
      akce: [{ label: 'Vytvořit nabídku', href: tab('nabidky') }],
    }
  }
  if (!p.nabidkaOdeslana && !p.smlouva) {
    return {
      titulek: 'Pošlete nabídku klientovi',
      popis: 'Klient dostane odkaz na nabídku e-mailem, odeslání se zapíše k OP.',
      akce: [{ label: 'Otevřít nabídku', href: tab('nabidky') }],
    }
  }
  if (!p.smlouva) {
    return {
      titulek: 'Připravte smlouvu',
      popis: 'Až klient nabídku odsouhlasí, vygenerujte smlouvu o dílo.',
      akce: [{ label: 'Připravit smlouvu', href: tab('smlouvy') }],
    }
  }
  if (p.smlouva.stav === 'NAVRH' || p.smlouva.stav === 'K_INTERNIMU_PODPISU') {
    return {
      titulek: 'Odešlete smlouvu k podpisu',
      popis: 'Klient ji podepíše online, po podpisu vznikne zakázka automaticky.',
      akce: [{ label: 'Otevřít smlouvu', href: `/sod/${p.smlouva.id}` }],
    }
  }
  if (p.smlouva.stav === 'ODESLANO') {
    return {
      titulek: 'Čeká se na podpis klienta',
      popis: 'Po podpisu se OP přepne na Úspěch a vznikne zakázka.',
      akce: [{ label: 'Otevřít smlouvu', href: `/sod/${p.smlouva.id}` }],
    }
  }
  return null
}
