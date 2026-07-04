# Servis refactor - mapa současného stavu

Stav k 2026-06-16, větev `servis-refactor`. Jen analýza, žádný produkční kód.

## Dva paralelní světy (jádro problému)

Dnes existují dvě nezávislé reprezentace "servisní práce", které spolu nijak nekomunikují:

### Svět A - ServisniNavsteva (modul SERVIS)
- Model `ServisniNavsteva`, tabulka `servisni_navstevy`.
- Vzniká automaticky z `ServisniKontrakt` (funkce `generateNavstevy` v `app/api/servis/kontrakty/route.ts`) podle `intervalMesicu`.
- Nese: `stav` (ServisStav), `typ` (NavstevaTyp), `planovanyTermin`/`skutecnyTermin`, `technikId`, `nalezeneZavady`, `doporuceni`, `nakladyCas`/`nakladyMaterial`, `fotky` (Json), `podpisKlienta`.
- Renderuje se v: `/servis` (přehled), `/servis/plan` (seznam), `/servis/kontrakty` (per kontrakt).
- Reaktivní servis (porucha) lze založit jen jako ad-hoc návštěvu uvnitř kontraktu. Samostatný vstup chybí.

### Svět B - Zakazka typ=SERVISNI (modul ZAKÁZKY)
- NENÍ samostatný model. Je to `Zakazka` s filtrem `typ: 'SERVISNI'`.
- Renderuje se v `/zakazky/servisni` (`page.tsx` + `ServisniZakazkyClient.tsx`).
- `Zakazka` je těžký model: `etapy`, `polozky` (ZakazkaPolozka + sklad), `predavaky` (Predavak + podpis + fotky), `vyuctovani` (Vyuctovani + VyuctovaniPolozka), `technici` (TechnikZakazka), `fotky`, `komentare`, `dokumenty`, `montazOd/Do`, vazba na `Deal` (op).
- Tj. plnohodnotné položkové vyúčtování i předávací protokol tu UŽ existují, ale na obchodní/montážní zakázce.

## Reálná data v produkci (rozhoduje o váze migrace)

| Tabulka | Počet | Pozn. |
|---|---|---|
| servisni_navstevy | 22 | všechny ve stavu PLANOVANA |
| zakazky typ=SERVISNI | **0** | tuto cestu zatím nikdo nepoužil |
| zakazky typ=OBCHODNI | 19 | běžné montážní zakázky |
| servisni_kontrakty | 5 | |
| zarizeni | 22 | |
| vyuctovani | 14 | patří k OBCHODNÍM zakázkám |
| predavaky | 15 | patří k OBCHODNÍM zakázkám |

**Důsledek:** sjednocení nevyžaduje migraci žádné servisní `Zakazka` (0 řádků). Migrujeme jen 22 návštěv, které jsou všechny PLANOVANA. To je čistá, nízkoriziková migrace.

## Stavy dnes

- `ServisStav` (návštěva): PLANOVANA, POTVRZENA, PROBIHA, DOKONCENA, ZRUSENA, PRESLA.
- `ZakazkaStav` (zakázka): NOVA, PRIRAZENA, V_REALIZACI, PREDANA, VYUCTOVANA, HOTOVO.
- `NavstevaTyp`: PLANOVANY_SERVIS, PORUCHA, ZARUCNI_OPRAVA, POZARUCNI_OPRAVA, UVEDENI_DO_PROVOZU, KONTROLA.

## Jak se dělá PDF a dokumenty (vzor, který musíme dodržet)

Kanonická cesta (SOD, `app/api/sod/[id]/pdf/route.ts`):
1. Sestav HTML přes generátor (`lib/sodDocument.ts`), tenant HTML přes `sanitizeFullDocumentHtml` z `lib/sanitizeHtml.ts`.
2. `const chrome = await buildDokumentChrome(orgId, plan)` - per-tenant záhlaví/patička z `/settings/dokumenty`.
3. `const pdf = await generatePdf(html, chrome)` - `lib/pdf.ts`, uvnitř `hardenPdfPage()` (JS vypnutý, síť jen Google Fonts).

## Bezpečnostní díra v dnešním servisním protokolu

`app/api/servis/navstevy/[id]/protokol/route.ts`:
- Volá `puppeteer.launch()` + `page.setContent()` napřímo, BEZ `hardenPdfPage()` (JS zapnutý, žádná SSRF ochrana).
- `lib/servisniProtokolHtml.ts` skládá HTML BEZ escapování. Pole `zprava`, `nalezeneZavady`, `doporuceni`, `org.nazev` i `org.logo` (do `<img src>`) jdou do šablony raw.
- Nepoužívá `buildDokumentChrome` (jiný vzhled než SOD).
- Refactor tuto díru zavře (přechodem na `generatePdf` + sanitizaci + escapování).

## Plan gating a RLS

- Gating: všechny servisní stránky a API kontrolují `getPlanLimits(plan).hasServiceModule` (PROFESSIONAL+), jinak `PlatinumGuard` / 403.
- RLS/tenant: API přes `orgPrisma(orgId)`. `ServisniNavsteva`, `Zarizeni`, `ServisniKontrakt`, `Zakazka`, `Vyuctovani`, `Predavak` jsou v `TENANT_MODELS` (lib/orgPrisma.ts). Nový model i child tabulku musíme do `TENANT_MODELS` přidat (jinak spadne test izolace).

## Mobilní kontrakty (nerozbít potichu)

- `/api/servis/upcoming` - vrací pole `servisniNavsteva` (raw řádky + `kontrakt.klient`, `technik`), filtr `stav: 'PLANOVANA'`, příštích 30 dní.
- `/api/servis/stats` - počty (zarizeniCount, aktivniKontrakty, nadchazejiNavstevy, presleNavstevy, dokonceneNavstevy).
- `/api/servis/navstevy` (GET/POST), `/api/servis/navstevy/[id]` (PATCH/POST), `/fotky`, `/protokol`.
- App felucia-tech (Radkův Mac) tyto cesty volá. Po přejmenování stavů (PLANOVANA -> NAPLANOVANA) tyto endpointy přestanou vracet data, pokud je nepřemapujeme. Řeší se ve Fázi 2.

## Kde jsou rizika

1. Přejmenování stavů rozbije mobilní `upcoming`/`stats` (hardcoded PLANOVANA). Nutná zpětná kompatibilita nebo úprava app.
2. Protokol PDF - bezpečnostní díra, nutno převést na `generatePdf` + sanitizace.
3. `/zakazky/servisni` (Zakazka typ=SERVISNI) je slepá větev s 0 daty, ale je v menu a má UI. Po refactoru ji nahradí nový modul - rozhodnout, zda route smazat nebo nechat redirect.
4. `generateNavstevy` generuje až 5 let návštěv dopředu pro kontrakt bez konce - po sjednocení to budou "servisní zakázky", takže pozor na objem.
