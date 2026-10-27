# KPI pro vedení firmy - specifikace (požadavek, zatím neimplementováno)

Datum: 2026-10-11 · Stav: **pravidla schválená Radkem, zbývají doplňující otázky v
[02-otevrene-otazky.md](02-otevrene-otazky.md)**

## Zadání (Radek)
Vedení firmy má **každý den** (ne v měsíčním reportu) vidět klíčová čísla. Prvním uživatelem je
NANTO (tepelná čerpadla, klimatizace, rekuperace). Z auditu firmy vyšly jako hlavní problémy
zálohy, pozdní fakturace a marže po zakázce.

| # | KPI | Cíl (výchozí pro NANTO, nastavitelný per org) | Vyhodnocení |
|---|-----|-----------------------------------------------|-------------|
| 1 | SOD s uhrazenou zálohou min. 70 % včas | 9 z 10 smluv (90 %) | týdně + klouzavých 30 dní |
| 2 | Dny od předání do konečné faktury | max. 1 den | týdně + klouzavých 30 dní |
| 3 | Hotovost a čerpání kontokorentu | kladná hotovost | týdně + klouzavých 30 dní (trend po týdnech) |
| 4 | Hrubá marže po zakázce s plnou cenou práce | min. 35 % | měsíčně, trend 12 měsíců |
| 5 | Materiál bez přiřazené zakázky | max. 1 % tržeb za měsíc | měsíčně, trend 12 měsíců |
| 6 | Zakázky podle zdroje a konverze lead → vyhraný OP | (cíl nezadán) | měsíčně, trend 12 měsíců |
| 7 | Cena za vyhraný případ z Google Ads | (cíl nezadán) | měsíčně, trend 12 měsíců |
| 8 | Dokončené zakázky na montážní partu za měsíc | (cíl nezadán) | měsíčně, trend 12 měsíců |
| 9 | Hodiny jednatelů na montáži | 0 do konce 2027 | měsíčně, trend 12 měsíců |
| 10 | Zisk běžného provozu | min. 6 % | měsíčně, trend 12 měsíců |

Historie se počítá zpětně od **1. 1. 2026**, pokud data existují. Kde neexistují, KPI začíná
od nasazení evidence a graf to ukazuje (viz 3.5).

## Schválená rozhodnutí

### Rozsah (Radek, 2026-10-11, první kolo)
1. **Zatím jen pro NANTO, přes přepínač modulu.** Nový příznak `OrgSettings.modulKpi` má výchozí
   hodnotu `false` a zapne se jen NANTO. Definice, cíle, viditelnost a ruční hodnoty se ukládají
   per organizace. Žádné větvení podle slugu `nanto` v kódu.
2. Multi-tenancy bez výjimky: všechny dotazy jdou přes `orgPrisma(orgId)` a RLS, nové modely se
   přidají do `TENANT_MODELS`.

### Obchodní pravidla (Radek, 2026-10-11, druhé kolo)
Pravidla jsou rozepsaná u jednotlivých KPI v části 2, číslo v závorce **(R n)** odkazuje na
Radkovo rozhodnutí.

**Zálohy (KPI 1)**
- **R1:** poměr = uhrazená záloha s DPH / aktuální cena SOD s DPH včetně dodatků. Počítá se
  uhrazená záloha, ne vystavená.
- **R2:** splněno = min. 70 % uhrazeno před objednáním materiálu. Bez data objednávky v systému
  do 14 dní od podpisu SOD.
- **R3:** klimatizace se počítají stejně jako ostatní. Výjimku schvaluje jednatel s důvodem.
  Výjimka se nepočítá jako splněná a zobrazuje se zvlášť (počet a seznam).

**Fakturace (KPI 2)**
- **R4:** předání = podpis předávacího protokolu zákazníkem.
  - Etapy se měří každá zvlášť.
  - Konečná faktura = první vyúčtovací faktura po předání, ne zálohová ani daňový doklad
    k záloze.
  - Počítají se kalendářní dny.
  - Servis zatím vynechán.
- **R5:** předaná a nevyfakturovaná déle než 1 den jde do seznamu „K vyfakturování“ s upozorněním
  manažerovi zakázky.

**Hotovost (KPI 3)**
- **R6:** do napojení ABRA ruční zadání jednou týdně: zůstatek účtu a čerpání kontokorentu. Limit
  kontokorentu je nastavení organizace. Trend po týdnech.

**Marže (KPI 4)**
- **R7:**
  - Výnos = vyfakturováno bez DPH, zálohy se nepočítají dvakrát.
  - Náklad = materiál ve skutečných nákupních cenách + práce + subdodávky podle faktur +
    provize přiřazené k zakázce.
  - PHM a auta jdou do režie.
- **R8:** marže se vyhodnocuje po vyúčtování zakázky. Rozpracované zakázky se zobrazují zvlášť
  jako průběžný stav.
- **R9:**
  - Práce = hodiny × vnitřní sazba. Sazba je per osoba a per org, výchozí 380 Kč/h.
  - Jednatelé se počítají sazbou montážníka.
  - Subdodavatelé na IČO podle skutečné faktury.
  - Evidence hodin je nová, patří do fáze 2.

**Materiál bez zakázky (KPI 5)**
- **R10:**
  - Zdroj: výdej ze skladu bez zakázky, později nákupní faktury bez zakázky z ABRA.
  - Kategorie „provozní spotřeba“ je povolená, vše ostatní musí mít zakázku.
  - Měří se jako % tržeb za měsíc.

**Zdroje a Ads (KPI 6, 7)**
- **R11:**
  - Zdroj je povinné pole na leadu: doporučení, Google Ads, web organicky, opakovaný zákazník,
    partner, ostatní.
  - U doporučení volitelně, kdo doporučil.
  - Zdroj se přenáší na OP a zakázku.
- **R12:**
  - Konverze = vyhrané OP / leady podle měsíce vzniku leadu.
  - Útrata za Ads: ruční měsíční zadání, později API.
  - Cena za zakázku = útrata / vyhrané případy se zdrojem Google Ads.

**Party a jednatelé (KPI 8, 9)**
- **R13:**
  - Parta = pojmenovaná skupina techniků v nastavení org.
  - Zakázka má hlavní partu.
  - Dokončená = podepsaný předávací protokol v daném měsíci.
- **R14:** hodiny jednatelů = součet výkazů práce uživatelů s rolí jednatel. Výkazy jsou nová
  evidence (fáze 2).

**Zisk (KPI 10)**
- **R15:**
  - Do napojení ABRA ruční měsíční zadání výsledku z účetnictví.
  - Jednorázové položky jde označit a vyřadit.
  - Běžný provoz = výsledek bez jednorázových položek.

**Zobrazení**
- **R16:**
  - KPI vidí jen role jednatel / vedení.
  - Semafor: zelená = cíl splněn, oranžová = do 10 % od cíle, červená = horší.
- **R17:** KPI 1-3 se vyhodnocují týdně a za klouzavých 30 dní, ostatní měsíčně s trendem
  12 měsíců. Historie od 1. 1. 2026.
- **R18:** týdenní souhrn v pondělí v 7:00 e-mailem a notifikací jednatelům.

### Doplňující rozhodnutí (Radek, 2026-10-11, třetí kolo)
- **R19 (Q24):** jednatel je **nová role `JEDNATEL`**, ne příznak. Preset = vše jako Správce + `kpi`.
  Ostatní role `kpi` nemají, vedení ho jde přidělit per-user přepisem.
- **R20 (Q28, část):** oranžová **relativně k cíli** (cíl 35 % → oranžová 31,5–35 %). U cíle 0 jen
  zelená / červená. KPI bez cíle bez semaforu.
- **R21 (Q17):** výdej bez zakázky a mimo provozní spotřebu se **povolí** a jen započítá do KPI 5.
- **R22 (Q30):** modul se pro NANTO zapne **jednorázově v DB**. Žádný přepínač ve `/settings/features`
  ani v superadminu.
- **R23 (nový nález):** CRM neumělo vydat materiál ze skladu bez zakázky. Do skladu přibyla akce
  **„Výdej bez zakázky“** s kategorií (Provozní spotřeba / Jiné) a povinným důvodem. KPI 5 počítá
  výdeje mimo provozní spotřebu. Korekce zůstávají inventurou a do KPI nevstupují.

- **R24 (Q1, 2026-10-13):** faktury a úhrady **jen z ABRA Flexi** (varianta b), žádné ruční
  zadávání v CRM. Krok „Faktury + úhrady“ se přesouvá z fáze 2 do 3b. Fáze 2 začíná zdrojem
  poptávky; KPI 1, 2, procento KPI 5 a tržby v KPI 4 čekají na přístupy do ABRA.

- **R25 (Q18–Q20, Q22, Q23, 2026-10-18):**
  - Q18: vyhrané OP podle zdroje se počítají podle **měsíce výhry** (`Deal.vyhrano`).
  - Q19: kdo doporučil = **výběr klienta i volný text**.
  - Q20: web formulář zdroj **nevynucuje**. Google Ads se pozná z konverzních stop
    (gclid / gbraid / wbraid, utm_source=google + placené medium). Jinak zůstane prázdný
    („Neuvedeno“). Zpětně se nedoplňuje.
  - Q22: zakázka se 3 etapami = **3 dokončení** (3 předávací protokoly).
  - Q23: party **zpětně nepřiřazovat**, platí od nasazení.

## 1. Co průzkum datového modelu ukázal a co z rozhodnutí plyne

| Potřeba podle pravidel | Realita v `prisma/schema.prisma` |
|---|---|
| Faktury (zálohové, vyúčtovací), jejich částky a úhrady (KPI 1, 2, 4, 5) | **Neexistují.** `Vyuctovani.schvaleno` je jen interní schválení. Fakturační příznak mají jen servisní zakázky (`ServisniZakazka.vyfakturovano`). |
| Dodatky SOD se změnou ceny (KPI 1) | **Neexistují.** `Sod` má jen `cenaSDph` / `cenaBezDph`. |
| Datum objednání materiálu (KPI 1) | **Existuje:** `Objednavka.odeslano` u objednávek se `zakazkaId`. Materiál vydaný ze skladu bez objednávky datum objednání nemá, proto platí 14denní pravidlo. |
| Výjimka zálohy schválená jednatelem (KPI 1) | Neexistuje. |
| Výkaz hodin a vnitřní sazby (KPI 4, 9) | Neexistuje. |
| Subdodávky a provize na zakázce (KPI 4) | Neexistují. `Dodavatel` s `ico` jde použít pro subdodavatele. |
| Skutečné nákupní ceny materiálu (KPI 4) | **Existuje:** `SkladPohyb` VYDEJ s `zakazkaId` a `nakupniCena`. Výdej vzniká při schválení předávacího protokolu (`app/api/predavaky/[id]/schvalit/route.ts`). Dodávky z objednávek jdou přes sklad (`PRIJEM_SKLAD` v `lib/objednavky.ts`). |
| Kategorie „provozní spotřeba“ u výdeje (KPI 5) | Neexistuje. `SkladPohyb` má jen volný `duvod`. |
| Zdroj poptávky (KPI 6, 7) | Neexistuje. `Lead.zdroj` (`LeadZdroj`) je jen kanál (WEB_FORMULAR / RUCNE / IMPORT). |
| Montážní party (KPI 8) | Neexistují. Jsou jen `TechnikZakazka`, `EtapaTechnik` a `Zakazka.vedouciId`. |
| Role jednatel (KPI 9, R16, R18) | Neexistuje. `Role` = ADMIN, MANAZER, OBCHODNIK, HLAVNI_TECHNIK, TECHNIK. |
| Hotovost, výsledek, Ads útrata (KPI 3, 7, 10) | V CRM nic. Ruční zadání, později ABRA Flexi a Google Ads. |

### Hlavní důsledek: faktury jsou páteř
Podle pravidel R1, R4, R7 a R10 stojí čtyři KPI (1, 2, 4, 5) na **fakturách a jejich úhradách**,
které CRM dnes vůbec nezná. Návrh proto zavádí jeden tenant model `Faktura` (viz 4.3). Plnit se dá
dvěma způsoby:
- **a) ruční zadání v CRM** (fáze 2, rychlé nasazení, ale dvojí práce vedle ABRA)
- **b) synchronizace z ABRA Flexi** (fáze 3, bez dvojí práce a umí doplnit historii od
  1. 1. 2026, ale čeká na přístupy)

Kterou cestou jít, je klíčová otázka Q1 v souboru 02. Model je pro obě cesty stejný (`zdroj`
RUCNE / ABRA), takže ruční začátek a pozdější přechod na ABRA nic nerozbije.

## 2. Rozbor KPI

Ke každému KPI: výpočet podle pravidel, z čeho se počítá dnes, co chybí a nejmenší zásah.
**(Q n)** odkazuje na doplňující otázku v souboru 02.

### KPI 1 - SOD s uhrazenou zálohou ≥ 70 % včas (R1-R3)
- **Výpočet:** pro každou podepsanou SOD v období (`Sod.stav = PODEPSANO`, `Sod.podepsano`):
  - **cena** = `Sod.cenaSDph` + součet změn ceny z podepsaných dodatků
  - **rozhodné datum:**
    - první `Objednavka.odeslano` mezi objednávkami zakázky navázané na SOD
      (`Sod.dealId` → `Zakazka.opId` → `Objednavka.zakazkaId`)
    - pokud žádná taková objednávka není, `Sod.podepsano + 14 dní`
  - **uhrazeno** = součet úhrad s DPH zálohových faktur dané SOD / zakázky s datem úhrady
    ≤ rozhodné datum
  - **splněno** = uhrazeno / cena ≥ 70 %
  - **výjimka** = SOD se schválenou výjimkou. Nepočítá se jako splněná a zobrazuje se zvlášť (R3).
  - KPI = splněné / všechny SOD v období. Výjimky zůstávají ve jmenovateli (Q2).
- Do hodnocení vstupují SOD až po uplynutí rozhodného data. Do té doby jsou „čeká“ a zobrazí se
  v proklik seznamu jako hrozící (Q3).
- **Dnes:** podpis a cena SOD, odeslání objednávky.
- **Chybí:**
  - uhrazené zálohy (faktura + úhrada)
  - dodatky SOD
  - schválení výjimky
- **Nejmenší zásah:**
  - `Faktura` typu ZALOHOVA s úhradou (4.3)
  - `SodDodatek` (sodId, cislo, zmenaCenySDph, podepsano), pokud dodatky dnes nejsou v CRM
    jinak (Q4)
  - na `Sod` pole výjimky: `zalohaVyjimkaDuvod`, `zalohaVyjimkaSchvalilId` (musí být jednatel),
    `zalohaVyjimkaSchvaleno`
- **Proklik:**
  - SOD nesplněné (cena, uhrazeno, %, rozhodné datum)
  - SOD hrozící (blíží se rozhodné datum, záloha neuhrazena)
  - výjimky zvlášť (počet, seznam, důvod, kdo schválil)
- **Fáze:** 2 (faktury ručně), nebo 3b (faktury z ABRA), podle Q1. Výjimky a dodatky ve fázi 2.

### KPI 2 - Dny od předání do konečné faktury ≤ 1 (R4, R5)
- **Výpočet:**
  - Jednotka měření je předávací protokol (`Predavak`), u etapových zakázek tedy každá etapa
    zvlášť (`Predavak.etapaId`).
  - Předání = `Predavak.podpisano`.
  - Konečná faktura = první `Faktura` typu VYUCTOVACI dané zakázky / etapy s `vystaveno`
    ≥ `podpisano`.
  - Dny = kalendářní rozdíl (Q5: počítá se po dnech, nebo po hodinách?).
  - Na Nástěnce průměr dní a počet předání nad cílem za týden a za klouzavých 30 dní (Q6).
  - Servisní zakázky jsou vynechané.
- **Dnes:** `Predavak.podpisano`, `etapaId`, `zakazkaId`.
- **Chybí:** faktura.
- **Nejmenší zásah:**
  - `Faktura` s vazbou `zakazkaId`, `etapaId?` a volitelně `predavakId?`
  - nový pohled „K vyfakturování“ (R5): předávací protokoly podepsané před více než cílovým
    počtem dní bez konečné faktury
  - upozornění manažerovi zakázky (`Zakazka.vedouciId`) bellem `typ: 'K_VYFAKTUROVANI'`, jednou
    denně ze sweepu ve workeru, jednou na předávací protokol (Q7: co když zakázka manažera nemá?)
- **Proklik:** seznam „K vyfakturování“, seřazený od nejstaršího.
- **Fáze:** 2 / 3b podle Q1.

### KPI 3 - Hotovost a čerpání kontokorentu (R6)
- **Výpočet:**
  - Týdenní ruční záznam: zůstatek účtu a čerpání kontokorentu.
  - Hotovost = zůstatek − čerpání (Q8: vzorec potvrdit).
  - Cíl: hotovost > 0. Zobrazí se i čerpání vůči limitu kontokorentu.
  - Trend po týdnech, klouzavých 30 dní = poslední 4 záznamy.
- **Dnes:** nic.
- **Nejmenší zásah:**
  - `KpiHodnota` s obdobím TYDEN
  - limit kontokorentu v `KpiNastaveni` (nebo `OrgSettings.kontokorentLimit`)
  - více účtů v jednom záznamu je otázka Q8
- **Proklik:** historie zadání (kdo, kdy, hodnoty).
- Upozornění v pondělním souhrnu, pokud za minulý týden chybí zadání.
- **Fáze:** 3a (ruční), 3b (ABRA).

### KPI 4 - Hrubá marže po zakázce s plnou cenou práce ≥ 35 % (R7-R9)
- **Výpočet** (za zakázku):
  - **výnos** = součet `Faktura` bez DPH zakázky. Zálohové faktury a daňové doklady k záloze se
    nezapočítají, pokud je obsahuje vyúčtovací faktura (Q9: jak se zálohy odečítají ve
    vyúčtovací faktuře NANTO?).
  - **materiál:**
    - = `SkladPohyb` VYDEJ se `zakazkaId` × `nakupniCena` − VRATKA_VYDEJE
    - Objednávky se nezapočítávají zvlášť, dodávky jdou přes sklad, jinak by se materiál počítal
      dvakrát.
    - Materiál koupený mimo CRM: Q10.
  - **práce:**
    - = součet `ZakazkaVykaz.hodiny` × sazba
    - Sazba se bere v pořadí: sazba osoby → sazba org (výchozí 380 Kč/h).
    - Jednatel se počítá sazbou montážníka (Q11: která to je?).
  - **subdodávky** = `ZakazkaNaklad` typu SUBDODAVKA (dodavatel s IČO, číslo faktury, částka bez
    DPH)
  - **provize** = `ZakazkaNaklad` typu PROVIZE (Q12: komu a jak se provize evidují?)
  - PHM a auta se nezapočítávají (režie)
  - marže = (výnos − náklady) / výnos
- **Vyhodnocení:**
  - Zakázka vstupuje do KPI po vyúčtování (R8), tj. v měsíci schválení posledního vyúčtování,
    nebo vystavení poslední vyúčtovací faktury (Q13).
  - Na Nástěnce podíl zakázek ≥ 35 % a vážená marže za měsíc (Q14: co je hlavní číslo
    dlaždice?).
- **Rozpracované zakázky:** zvlášť, jako průběžný stav (dosavadní výnos a náklady, bez semaforu).
- **Dnes:** nákupní ceny výdejů ze skladu.
- **Chybí:**
  - faktury
  - výkaz hodin
  - sazby
  - subdodávky a provize
- **Nejmenší zásah:**
  - `ZakazkaVykaz`
  - `User.vnitrniSazba Decimal?`
  - výchozí sazba org v `KpiNastaveni`
  - `ZakazkaNaklad` (typ SUBDODAVKA / PROVIZE, dodavatelId?, ico, cisloDokladu, datum,
    castkaBezDph, zdroj RUCNE / ABRA)
- **Viditelnost:** jen vedení (R16). Sazby a náklady se nikde jinde nezobrazují.
- **Proklik:** vyúčtované zakázky pod 35 % s rozpadem výnos / materiál / práce / subdodávky /
  provize a seznam rozpracovaných.
- **Fáze:** 2 (výkaz, sazby, náklady) + faktury podle Q1.

### KPI 5 - Materiál bez zakázky ≤ 1 % tržeb (R10)
- **Výpočet:**
  - čitatel = `SkladPohyb` VYDEJ se `zakazkaId = null` a kategorie ≠ PROVOZNI_SPOTREBA,
    `mnozstvi × nakupniCena`, za měsíc
  - později čitatel doplní nákupní faktury z ABRA bez zakázky
  - jmenovatel = tržby za měsíc (Q15: fakturované bez DPH stejně jako u KPI 4?)
- **Dnes:** výdeje bez zakázky. Historii od 1. 1. 2026 jde spočítat, ale bez kategorie, takže se
  do ní započítá i provozní spotřeba (Q16: dozařadit historii ručně?).
- **Chybí:**
  - kategorie výdeje
  - tržby (faktury)
- **Nejmenší zásah:**
  - `SkladPohyb.kategorie` (enum ZAKAZKA / PROVOZNI_SPOTREBA, nebo nullable příznak
    `provozniSpotreba`)
  - ruční výdej bez zakázky musí mít kategorii PROVOZNI_SPOTREBA, jinak ho validace nepustí
    (Q17: zakázat, nebo jen varovat?)
- **Proklik:** výdeje bez zakázky a bez kategorie s možností rovnou přiřadit zakázku nebo
  kategorii.
- **Fáze:** 1 (čitatel v Kč + kategorie), procento až s fakturami (2 / 3b).

### KPI 6 - Zakázky podle zdroje a konverze (R11, R12)
- **Výpočet:**
  - Konverze za měsíc M = leady vzniklé v M (`Lead.vytvoreno`), jejichž OP je ve stavu USPECH
    (`Lead.prevedenNaOpId` → `Deal.stav`) / leady vzniklé v M.
  - Rozpad podle zdroje.
  - Měsíce se doplňují zpětně, jak OP vyhrávají.
  - Zakázky podle zdroje = počet a hodnota vyhraných OP podle zdroje (Q18: za měsíc výhry?).
- **Dnes:** řetězec lead → OP → zakázka a stav OP. Konverze bez zdroje jde spočítat od
  1. 1. 2026.
- **Chybí:** zdroj poptávky a kdo doporučil.
- **Nejmenší zásah:**
  - Per-org číselník `ZdrojPoptavky` (orgId, kod, nazev, poradi, aktivni). Pro NANTO se založí
    6 položek z R11.
    - Kód GOOGLE_ADS je pevný, používá ho KPI 7.
    - Kód DOPORUCENI zapíná pole „kdo doporučil“.
  - `Lead.zdrojId` (povinné při založení, R11)
  - `Lead.doporucilKlientId?` + `Lead.doporucilText?` (Q19)
  - kopie na `Deal.zdrojId?` a `Zakazka.zdrojId?` při převodu
  - Formulář z webu (WEB_FORMULAR) zdroj nezná, ten se doplní při kvalifikaci (Q20).
- **Historie:** zdroj zpětně chybí. Konverze bez rozpadu jde od 1. 1. 2026, rozpad podle zdroje
  od nasazení (nebo po ručním doplnění, Q20).
- **Proklik:** leady bez zdroje a leady měsíce podle zdroje a stavu.
- **Fáze:** 1 (konverze bez zdroje), 2 (zdroj).

### KPI 7 - Cena za vyhraný případ z Google Ads (R12)
- **Výpočet:**
  - útrata za měsíc (ruční `KpiHodnota` s obdobím MESIC, později API)
  - dělená vyhranými OP se zdrojem GOOGLE_ADS
  - (Q21: vyhrané v měsíci útraty, nebo leady vzniklé v měsíci útraty jako u konverze?)
- **Chybí:** útrata + zdroj z KPI 6.
- **Proklik:** vyhrané případy z Ads v měsíci.
- **Fáze:** 3a / 3c (vyžaduje zdroj z fáze 2).

### KPI 8 - Dokončené zakázky na partu za měsíc (R13)
- **Výpočet:**
  - počet `Predavak` podepsaných v měsíci (`podpisano`), přiřazených partě přes
    `Zakazka.hlavniPartaId`
  - Etapy: Q22 (jedna zakázka s více etapami = více dokončení?).
  - Hodnota dlaždice: průměr na partu + rozpad podle part.
- **Dnes:** podpisy předávacích protokolů od 1. 1. 2026.
- **Chybí:** party.
- **Nejmenší zásah:**
  - `MontazniParta` (orgId, nazev, aktivni) + `MontazniPartaClen` (partaId, userId) v nastavení
    organizace
  - `Zakazka.hlavniPartaId?` ve výběru v detailu zakázky
  - Historii jde doplnit zpětným přiřazením party zakázkám od 1. 1. 2026 (Q23).
- **Proklik:** dokončené zakázky měsíce podle party a zakázky bez party.
- **Fáze:** 2.

### KPI 9 - Hodiny jednatelů na montáži (R14, cíl 0 do konce 2027)
- **Výpočet:** součet `ZakazkaVykaz.hodiny` uživatelů s příznakem jednatel za měsíc.
- **Chybí:**
  - výkaz hodin
  - označení jednatele
- **Nejmenší zásah:**
  - `User.jednatel Boolean @default(false)`
  - Návrh: **příznak, ne nová role** v enumu `Role`. Jednatel má dál svou roli (ADMIN), a nová
    role by zasáhla `lib/permissions.ts` a aplikace felucia-tech / felucia-sales, které nové
    role neumí (Q24).
- **Historie:** od nasazení výkazu.
- **Proklik:** výkazy jednatelů za měsíc.
- **Fáze:** 2.

### KPI 10 - Zisk běžného provozu ≥ 6 % (R15)
- **Výpočet:**
  - ruční měsíční záznam: výsledek hospodaření a tržby z účetnictví (Q25: tržby zadat ručně,
    nebo brát z faktur?)
  - plus seznam jednorázových položek (popis, částka, znaménko)
  - běžný provoz = výsledek − jednorázové položky
  - KPI = běžný provoz / tržby
- **Nejmenší zásah:** `KpiHodnota` (MESIC) + `KpiJednorazovaPolozka` (orgId, mesic, popis,
  castka, zadalId).
- **Proklik:** měsíční historie s rozpadem výsledek / jednorázové / běžný provoz.
- **Fáze:** 3a (ručně), 3b (ABRA).

## 3. Zobrazení

### 3.1 Kdo KPI vidí (R16)
- Nové oprávnění `kpi` v `lib/permissions.ts`.
- Má ho uživatel s `User.jednatel = true` a uživatelé, kterým ho vedení přidělí přes per-user
  přepisy oprávnění (Q26: kdo je „vedení“ kromě jednatelů?).
- Kontrola flag + oprávnění na serveru v každé stránce i API routě.

### 3.2 Nástěnka - horní řada KPI
- Úplně nahoře na `app/(dashboard)/dashboard/page.tsx`, nad `CoMamDelatPanel`. Zobrazí se jen při
  `modulKpi` + oprávnění `kpi`.
- **Dlaždice:** název, hodnota, cíl, semafor, období a mini trend.
  - KPI 1-3: hodnota za minulý týden a za klouzavých 30 dní.
  - Ostatní: poslední uzavřený měsíc (Q27: ukazovat i průběžný aktuální měsíc?).
- **Semafor (R16):**
  - zelená = cíl splněn
  - oranžová = horší než cíl nejvýš o 10 %
  - červená = horší
  - Výklad „10 %“ (relativně, nebo v procentních bodech) a cíle s nulou (KPI 3, 9) řeší Q28.
- **Bez dat:** šedá dlaždice „chybí data“ s odkazem na zadání, nikdy zelená bez dat.
- **Mobil:** vodorovně posuvná řada, `components/ui` primitivy, sémantické barevné tokeny.

### 3.3 Detail KPI - `/kpi/[kod]`
- Graf:
  - KPI 1-3 po týdnech
  - ostatní 12 měsíců
  - od 1. 1. 2026, kde data jsou, s vyznačeným začátkem evidence
- Pod grafem seznam záznamů, které KPI kazí (u každého KPI v části 2), s proklikem na SOD,
  zakázku, OP, předávací protokol nebo výdej.
- U KPI 1 zvlášť sekce **Výjimky**, u KPI 4 zvlášť **Rozpracované**.

### 3.4 Seznam „K vyfakturování“ (R5)
- Samostatný pohled pod Zakázkami (`/zakazky/k-vyfakturovani`, Q29: kdo ho vidí, jen vedení,
  nebo i manažeři zakázek?).
- Obsahuje předávací protokoly podepsané před více než 1 dnem bez konečné faktury.
- Bell upozornění manažerovi zakázky (viz KPI 2).

### 3.5 Nastavení - `/settings/kpi`
- KPI: aktivní, cíl, pořadí.
- Limit kontokorentu, výchozí vnitřní sazba (380 Kč/h) a sazba montážníka pro jednatele.
- Ruční zadání:
  - týdně hotovost (KPI 3)
  - měsíčně útrata za Ads (KPI 7), výsledek + jednorázové položky (KPI 10)
- Číselník zdrojů poptávky, montážní party, příznak jednatel a sazba u uživatele (správa
  uživatelů).

### 3.6 Týdenní souhrn - pondělí 7:00 (R18)
- Fronta pg-boss `kpi-tydenni-souhrn` ve `worker/index.ts`,
  `boss.schedule(Q, '0 7 * * 1', null, { tz: 'Europe/Prague' })`. Ostatní fronty `tz` nemají,
  tady ho uvést výslovně.
- Worker projde org s `modulKpi = true` a počítá přes `orgPrisma(orgId)`, ne holým `prisma`.
- Příjemci: uživatelé s `jednatel = true` (R18).
- Bell `typ: 'KPI_TYDENNI_SOUHRN'` (`lib/createNotification.ts`) + e-mail `emailKpiTydenniSouhrn`
  (`lib/email.ts`, jen při `isEmailConfigured()`).
- Obsah souhrnu:
  - všechna aktivní KPI se semaforem a změnou proti minulému týdnu / měsíci
  - počet položek „K vyfakturování“
  - chybějící ruční zadání
- Vzory: `worker/followupy.ts`, `worker/reminders.ts`. Idempotence přes `singletonKey` = orgId +
  ISO týden.
- Druhá denní fronta `kpi-k-vyfakturovani` (např. 8:00) posílá upozornění manažerům zakázek
  (R5).

## 4. Architektura (multi-tenancy)

### 4.1 Modul
- `OrgSettings.modulKpi Boolean @default(false)`. Úpravy na těchto místech:
  - `prisma/schema.prisma`
  - `lib/orgSettings.ts`
  - `context/OrgSettingsContext.tsx`
  - whitelist v `app/api/settings/org-settings/route.ts`
  - `/settings/features`
  - `navFlags()` v `lib/navigation.ts`
- Zapnutí pro NANTO: superadmin flagy dnes jen zobrazuje (Q30: jednorázově v DB, nebo přepínač
  v superadminu?).

### 4.2 Výpočetní vrstva - `lib/kpi/`
- `registry.ts`: kód, název, jednotka, směr cíle, granularita (TYDEN / MESIC), zdroj dat,
  výchozí cíl.
- Jeden soubor na KPI: `hodnota(db, obdobi)`, `zaznamy(db, obdobi)` a `trend(db, od)`, kde `db`
  je `orgPrisma(orgId)`. Sdílí je Nástěnka, detail i worker.
- `semafor.ts`: jedna funkce pro všechna KPI podle R16 a Q28.
- Agregace v DB. Raw SQL jen uvnitř `db.$transaction` kvůli RLS. Případně krátká cache per org.
- Testy: vitest nad `nanto_crm_test`. Každé KPI má fixture s hraničními případy a test tenant
  izolace.
- Hraniční případy:
  - KPI 1: 14denní pravidlo, výjimka, dodatek
  - KPI 2: etapy
  - KPI 4: zálohy nepočítat dvakrát

### 4.3 Nové modely (všechny s `orgId` → `TENANT_MODELS` + přegenerovat `prisma/rls.sql`)

| Model | Fáze | Pole |
|---|---|---|
| `KpiNastaveni` | 1 | orgId, kod, aktivni, cil, poradi; unique (orgId, kod). Org parametry (limit kontokorentu, výchozí sazba, sazba montážníka) buď zde, nebo v `OrgSettings` |
| `Faktura` | 2 / 3b | orgId, zakazkaId, etapaId?, predavakId?, sodId?, typ (ZALOHOVA / DANOVY_DOKLAD_ZALOHA / VYUCTOVACI), cislo, vystaveno, castkaBezDph, castkaSDph, uhrazeno DateTime?, uhrazenoSDph Decimal?, zdroj (RUCNE / ABRA), externiId?; unique (orgId, cislo) |
| `SodDodatek` | 2 | orgId, sodId, cislo, zmenaCenySDph, podepsano (pokud to Q4 potvrdí) |
| `ZakazkaVykaz` | 2 | orgId, zakazkaId, etapaId?, userId, datum, hodiny, poznamka? |
| `ZakazkaNaklad` | 2 | orgId, zakazkaId, typ (SUBDODAVKA / PROVIZE), dodavatelId?, ico?, cisloDokladu?, datum, castkaBezDph, zdroj (RUCNE / ABRA) |
| `ZdrojPoptavky` | 2 | orgId, kod, nazev, poradi, aktivni |
| `MontazniParta`, `MontazniPartaClen` | 2 | orgId, nazev, aktivni / partaId, userId |
| `KpiHodnota` | 3a | orgId, kod, obdobi (TYDEN / MESIC), od (Date), hodnoty Json (např. `{zustatek, cerpaniKK}`), zdroj, zadalId; unique (orgId, kod, obdobi, od) |
| `KpiJednorazovaPolozka` | 3a | orgId, mesic, popis, castka, zadalId |

Úpravy existujících modelů:
- `Sod`: `zalohaVyjimkaDuvod`, `zalohaVyjimkaSchvalilId`, `zalohaVyjimkaSchvaleno`
- `SkladPohyb.kategorie`
- `Lead.zdrojId`, `Lead.doporucilKlientId?`, `Lead.doporucilText?`; `Deal.zdrojId?`;
  `Zakazka.zdrojId?`, `Zakazka.hlavniPartaId?`
- `User.jednatel`, `User.vnitrniSazba?`

## 5. Fáze, odhady, rizika

Odhady jsou v pracovních dnech implementace včetně testů a nasazení, bez čekání na odpovědi a
přístupy. Proti prvnímu návrhu jsou vyšší, protože pravidla vyžadují faktury, úhrady a náklady,
které CRM nemá.

### Fáze 1 - z dat, která už máme (~4-5 dní) — **IMPLEMENTOVÁNO 2026-10-11**
Stav implementace:
- Schéma: role `JEDNATEL`, `OrgSettings.modulKpi`, `KpiNastaveni`, `SkladPohyb.kategorie`
  (migrace `20261011220000_kpi_faze1`)
- `lib/kpi/` (registr, období v pražském čase, semafor, výpočty KPI 5, 6, 8)
- Nástěnka: horní řada `KpiRada`
- stránky `/kpi`, `/kpi/[kod]` a `/kpi/nastaveni`. Nastavení je pod modulem KPI, ne pod
  `/settings`, aby ho šlo hlídat stejnou podmínkou (modul + oprávnění).
- `/api/sklad/vydej` + dialog ve skladu
- worker `kpi-tydenni-souhrn` (po 7:00 Europe/Prague)
- testy `tests/kpi.test.ts`
- Dlaždice ukazuje poslední uzavřený měsíc, detail i průběžný aktuální měsíc (Q27 zatím
  nerozhodnuto).

- **Infrastruktura:**
  - `modulKpi`, `User.jednatel` + oprávnění `kpi`, `KpiNastaveni`
  - `lib/kpi/` (období týden / 30 dní / měsíc, semafor)
  - řada na Nástěnce, `/kpi/[kod]`, `/settings/kpi`
  - pondělní souhrn jednatelům
- **KPI:**
  - 6 (konverze lead → vyhraný OP, bez zdroje, od 1. 1. 2026)
  - 5 (výdeje bez zakázky v Kč + kategorie provozní spotřeba, procento zatím ne)
  - 8 (počet podepsaných předávacích protokolů za měsíc celkem, bez rozpadu na party)
  - KPI ostatních fází se zobrazí jako „chybí data“, nebo se skryjí (nastavení aktivní)
- **Rizika:**
  - Fáze 1 ukáže jen minimum KPI. Hlavní problémy z auditu (zálohy, fakturace, marže) řeší až
    fáze 2 / 3b.
  - Kvalita historie: výdeje bez zakázky od 1. 1. 2026 nemají kategorii, takže ukážou horší
    číslo, než je pravda.
  - Nástěnka dnes jede na holém `prisma`. KPI část bude čistě přes `orgPrisma`.

### Fáze 2 - nová evidence (~10-14 dní)
**Stav:** krok 2 (zdroj poptávky) **IMPLEMENTOVÁN 2026-10-18** ve větvi `kpi-faze2-zdroj`:
- migrace `20261018120000_zdroj_poptavky`: číselník `ZdrojPoptavky` (6 výchozích
  zdrojů se založí při prvním čtení), `Lead`/`Deal.zdrojPoptavkyId` + kdo doporučil, `Deal.vyhrano`
  (backfill z audit logu → vznik zakázky → vznik OP)
- výběr zdroje: nový lead (s `modulKpi` povinný), detail leadu, nový OP, detail OP, zápis hovoru
- převod leadu (i z hovoru) kopíruje zdroj na OP; webové leady s gclid/UTM → Google Ads
- KPI 6: v detailu tabulka podle zdroje. Ukazuje konverzi leadů a vyhrané OP podle měsíce
  výhry (počet a hodnota aktivní nabídky bez DPH).
- Zdroj je na leadu i na OP, ne na zakázce. Zakázka ho čte přes `opId`, protože většina OP
  (134 ze 151 v roce 2026) vzniká bez leadu.
- Zbývá: správa číselníku v UI (zatím 6 výchozích) a posílání gclid z webu nanto.cz
  (`meta.gclid` nebo parametry v `meta.pageUrl`).

- **Pořadí (podle hodnoty pro audit):**
  1. **Faktury + úhrady** (`Faktura`, ruční zadání v detailu zakázky / vyúčtování) → KPI 2,
     seznam „K vyfakturování“ + upozornění manažerovi, KPI 1 (+ výjimky, dodatky), procento
     u KPI 5. *Pokud Q1 rozhodne „rovnou ABRA“, tento krok se přesune do 3b a fáze 2 začne
     bodem 2.*
  2. **Zdroj poptávky** (číselník, povinné pole, kdo doporučil, přenos na OP / zakázku) → KPI 6
     s rozpadem.
  3. **Montážní party** → KPI 8 s rozpadem.
  4. **Výkaz hodin + sazby + subdodávky / provize** (web + felucia-tech) → KPI 4 a 9.
- **Rizika:**
  - Ruční zadávání faktur znamená dvojí práci vedle ABRA. Hrozí, že se nebude dělat včas, a pak
    KPI 2 lže.
  - KPI 4 a 9 stojí na poctivém výkazu hodin. Felucia-tech potřebuje EAS build a review
    v obchodech a obě aplikace dnes neumějí nové role (paměť `project_appky_nove_role`).
  - Povinný zdroj na leadu: web formulář ho nezná a musí se doplnit při kvalifikaci, jinak
    blokuje.
  - Historie: faktury, hodiny a zdroje zpětně od 1. 1. 2026 jen ručním doplněním, nebo
    z ABRA (3b).
  - Citlivá data (sazby, marže) jen pro oprávnění `kpi`.

### Fáze 3 - externí zdroje
- **3a - ruční zadání (~2-3 dny):** týdenní hotovost (KPI 3), měsíční útrata Ads (KPI 7),
  měsíční výsledek + jednorázové položky (KPI 10), připomínky v pondělním souhrnu. Nezávisí na
  fázi 2, **lze nasadit hned po fázi 1** (doporučuji kvůli hotovosti).
- **3b - ABRA Flexi (~8-12 dní):**
  - faktury a úhrady do `Faktura` včetně historie od 1. 1. 2026 (KPI 1, 2, 4, 5)
  - přijaté faktury subdodavatelů do `ZakazkaNaklad` (KPI 4)
  - nákupní faktury bez zakázky (KPI 5)
  - zůstatky účtů (KPI 3)
  - výsledovka (KPI 10)
  - Navazuje na dokument pro účetní (ABRA Flexi, 2026-10-02).
- **3c - Google Ads API (~3-5 dní):** měsíční útrata (KPI 7).
- **Rizika:**
  - Přístupy k ABRA zatím nemáme.
  - Párování faktur na zakázku / etapu potřebuje společný klíč (číslo zakázky ve faktuře nebo
    variabilní symbol, Q31).
  - Typy dokladů v ABRA (zálohová / daňový doklad / vyúčtovací) se musí namapovat s účetní.
  - Google Ads developer token se schvaluje týdny.
  - API klíče per org šifrovaně (`Extension.apiKlic` je plaintext, nestačí).

## 6. Pořadí prací
1. Radek odpoví na doplňující otázky v `02-otevrene-otazky.md`. **Klíčová je Q1** (faktury
   ručně, nebo z ABRA), protože určuje pořadí fází.
2. Fáze 1 → hned 3a (ruční hotovost, Ads, výsledek).
3. Fáze 2 (faktury → zdroj → party → výkazy), nebo 3b, podle Q1.
4. 3c, až bude Google Ads přístup.
