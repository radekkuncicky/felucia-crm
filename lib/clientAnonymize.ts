/**
 * GDPR anonymizace klienta — náhrada za hard delete, který stejně nejde
 * použít (Client má FK vazby na Deal/Zakazka/ServisniZakazka/ServisniKontrakt/
 * Zarizeni bez cascade/setnull, RESTRICT by mazání odmítlo). Anonymizace PII
 * na Client záznamu, vazby na obchodní historii zůstávají netknuté.
 */
export function anonymizedClientData(clientId: string) {
  return {
    jmeno: `Smazaný klient #${clientId.slice(-8)}`,
    prijmeni: '',
    telefon: null,
    email: 'anonymized@deleted.local',
    ulice: null,
    mesto: null,
    psc: null,
    ico: null,
    dic: null,
    poznamka: null,
    anonymizedAt: new Date(),
  }
}
