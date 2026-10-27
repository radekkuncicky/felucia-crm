/**
 * Otevře Dášu se zprávou „zpracuj diktát“ (klient — AIAssistant poslouchá
 * událost `dasha:open`). Text diktátu Dáša načte nástrojem get_diktat podle ID,
 * do zprávy jde jen ID — zpráva má limit 4000 znaků a text je data, ne pokyn.
 */
export function zpracujDiktatSDasou(diktatId: string) {
  window.dispatchEvent(new CustomEvent('dasha:open', {
    detail: { prompt: `Zpracuj můj diktát [diktat:${diktatId}] — navrhni, co založit (lead, klient, OP), a po mém potvrzení to založ a diktát připoj.` },
  }))
}
