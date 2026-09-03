# Felucia Sales - plán (výstup Fáze 0)

Datum: 2026-08-03. Průzkum repa nanto-crm a felucia-tech před psaním kódu.

## Schválená rozhodnutí (Radek, 2026-08-03)

1. **Architektura: varianta A** - nový samostatný repozitář `felucia-sales`, start kopií jádra z felucia-tech (api, auth, outbox, theme, useFotoUpload, SignaturePad)
2. **Pipeline: enum `StavDealu` beze změny** - fáze zaměření se odvozuje z existence záznamu `Zamereni` na OP, žádná migrace stavů
3. **NZÚ dotace a roční úspora: vynechat úplně** (ani backlog struktura)
4. **Plan gating: žádný** - obchodní modul pro všechny plány, limity drží počty userů/OP z plánu

## 1. Co průzkum ukázal (realita vs zadání)

Zadání předpokládá monorepo a pár věcí, které v repu nejsou. Skutečný stav:

| Zadání předpokládá | Realita |
|---|---|
| Monorepo `apps/` + `packages/shared` | Dva samostatné git repozitáře: CRM `/var/www/nanto-crm` (Next.js, prod) a appka `/var/www/felucia-tech` (Expo, vývoj na Radkově Macu, server je prod kopie) |
| Nový model `ObchodniPripad` | Už existuje: `Deal` (= OP) s pipeline `StavDealu` (NOVY, JEDNANI, NABIDKA, PRED_UZAVRENIM, USPECH, PAS, ZNEPLATNENO), `duvodProhry`, přiřazený obchodník, `technologie`, `kod`. Poptávková fáze žije v modulu Leady vč. konverze na OP + klienta |
| Nový model `Aktivita` | Už existuje: `Activity` (HOVOR, EMAIL, SCHUZKA, POZNAMKA, UKOL) s `reminderAt`; pg-boss worker už posílá bell + email připomínky |
| Nabídka s variantami | `Quote`/`QuoteItem` per Deal, více nabídek na OP (pole `nazev` = jméno varianty), položkové slevy, DPH 12/21 per položka i OP, veřejné sdílení odkazem, PDF šablony |
| Documenso na e-podpisy | Documenso se nepoužívá. Vlastní podpisový systém: `SodPodpisRelace`, SMS OTP (smsmanager/smsbrana/gosms), online podpis smluv vč. interního podpisu za zhotovitele |
| DejaVuSans TTF kvůli diakritice | Bezpředmětné: PDF se generuje Puppeteerem z HTML (quoteRenderer, hardenPdfPage), čeština funguje. Instrukce by platila pro pdfkit, který tu není |
| Hlasové poznámky v Tech | V Tech nejsou (žádné expo-av). Přepis neexistuje nikde, Dáša (AI asistent) je jen textová |
| `tenantId` + RLS | Sloupec se jmenuje `orgId`; izolace přes `orgPrisma` + RLS (`TENANT_MODELS` v lib/orgPrisma.ts, `scripts/generate-rls-sql.ts`) |
| Role `SALES` | Existuje role `OBCHODNIK`, novou roli není třeba zavádět |
| Zod validace | Zod v repu není, mobile routes validují ručně. Držet konvenci repa |
| ARES endpoint reuse | `/api/ares` existuje, ale jede na cookie session (getServerSession). Pro mobil potřebuje variantu s `getMobileSession` |

Co je naopak hotové a přímo použitelné z Tech:
- **JWT auth**: `/api/auth/mobile/login` (email + heslo, bez kódu org) a `/refresh`, 30denní token, SecureStore, axios interceptor s auto-logoutem na 401
- **Offline-first vzor**: TanStack Query persister (AsyncStorage) + outbox fronta (`lib/outbox.ts`, NetInfo auto-flush, MAX_ATTEMPTS, indikátor OutboxBadge). Žádná SQLite, osvědčené v provozu
- **Foto pipeline**: `useFotoUpload` (kamera na 1 tap, komprese 1600px/0.7 přes expo-image-manipulator), server ukládá do `public/uploads/...`
- **SignaturePad** komponenta (podpis prstem u předáváku a servisu)
- **Design systém**: `lib/theme.tsx` (DARK/LIGHT tokeny, useThemedStyles), Felucia barvy, Ionicons
- **Push notifikace**: server-side hotové (`lib/push.ts`, `/api/mobile/push-token`)
- **EAS pipeline**: eas.json, TestFlight funguje (build 13), Apple review org připravená

## 2. Architektura: samostatný repozitář felucia-sales (schváleno)

Nový git repozitář `felucia-sales` (server `/var/www/felucia-sales` jako prod kopie, vývoj na Macu, stejný workflow jako Tech). Start kopií jádra z felucia-tech:

- `lib/api.ts` (axios + SecureStore + 401 logout), `lib/auth.ts` (login/refresh)
- `lib/outbox.ts` + persister setup (offline fronta, NetInfo flush) + `OutboxBadge`
- `lib/theme.tsx` (design tokeny DARK/LIGHT, useThemedStyles), `lib/constants.ts` (Felucia barvy)
- `lib/useFotoUpload.ts` (kamera, komprese 1600px), `components/SignaturePad.tsx`, `LoadingSkeleton.tsx`
- `lib/navigation.ts` (nav chooser Apple/Google/Waze), `lib/notifications.ts` (push token)
- config: babel/metro/tsconfig/eas.json podle Tech (vč. metro stubů, pokud budou potřeba)

Vědomá cena: opravy jádra se musí dělat v obou repech ručně. Držet soubory jádra co nejblíž originálu, ať jde diffovat.

## 3. Datový model (Fáze 1)

Vše v nanto-crm `schema.prisma`, vždy `orgId` + zápis do `TENANT_MODELS` + přegenerovat `prisma/rls.sql` + RLS test tenant A/B.

### Nové modely

**`Zamereni`**
- `id`, `orgId`, `dealId` (FK Deal), `autorId` (FK User)
- `typ` - reuse stávající enum `Technologie` (KLIMA, TEPELNE_CERPADLO, REKUPERACE, PODLAHOVE_TOPENI, VZDUCHOTECHNIKA, JINE), nezavádět duplicitní enum ze zadání
- `stav` (`ROZPRACOVANE` / `UZAVRENE`) - uzavřít lze jen s kompletní povinnou sadou foto tagů
- `gpsLat`, `gpsLng`, `datum`
- `odpovedi Json` - odpovědi formuláře
- `definiceId` + `definiceVerze` - odkaz na verzi definice formuláře, se kterou bylo vyplněno

**`ZamereniFoto`**
- `id`, `orgId`, `zamereniId`, `url`, `tag` (enum `ZamereniFotoTag`: ROZVADEC, VENKOVNI_JEDNOTKA, VNITRNI_JEDNOTKA, STAVAJICI_ZDROJ, FASADA, PROSTUP, CELKOVY_POHLED, JINE), `gpsLat/gpsLng`, `popis`, `poradi`, `anotace Json?` (overlay: šipky, obdélníky, texty)
- soubor na disk `public/uploads/zamereni/{id}/` po vzoru zakázek

**`ZamereniDefinice`** (konfigurace formuláře, aby otázky šly měnit bez release)
- `id`, `orgId`, `typ` (Technologie), `verze`, `aktivni`, `schemaJson` (sekce a otázky: typ pole, popisek, povinnost, podmíněné zobrazení), `povinneTagy ZamereniFotoTag[]`
- seed výchozích definic podle zadání (společné + TČ + klima + rekuperace + podlahovka); editor v CRM webu je samostatný pozdější krok, do té doby úprava seedem/superadminem

### Úpravy existujících modelů (žádná duplikace)

- **`Deal`**: stavy beze změny (schváleno). `duvodProhry` je dnes volný text, zadání chce enum (CENA, KONKURENCE, ODLOZENO, NEREAGOVAL) - navrhuju enum + zachování textové poznámky
- **`Quote`**: doplnit `platnostDo DateTime?`, `odeslanoAt DateTime?`, `odeslanoKanal` (EMAIL/SMS), `varianta` netřeba (`nazev` už existuje). Tři varianty = tři Quotes na jednom Dealu, UI je ukáže vedle sebe
- **`Activity`**: beze změn, follow-up = UKOL s `reminderAt`

## 4. API vrstva (Fáze 2)

Pod `/api/mobile/obchod/*`, vše přes `getMobileSession` + `orgPrisma`, ruční validace po vzoru stávajících mobile routes, rate limit přes `checkRateLimit`:

- `GET/POST pripady`, `GET/PATCH pripady/[id]`, `POST pripady/[id]/stav` (změna pipeline, zápis do AuditLog kdo a kdy, u prohry povinný důvod)
- `GET/POST pripady/[id]/zamereni`, `PATCH zamereni/[id]`, `POST zamereni/[id]/uzavrit` (validace povinných tagů), `POST zamereni/[id]/foto` (multipart, validace typu a velikosti, batch), `PATCH/DELETE foto/[fotoId]`
- `GET zamereni-definice?typ=` (aktivní verze pro daný typ)
- `GET ares?ico=` (mobile varianta stávající ARES logiky, vytáhnout sdílenou funkci z route do lib)
- `GET cenik/search?q=` (fulltext, oblíbené, naposledy použité), `POST pripady/[id]/nabidka` (sestavení Quote z ceníku), `GET nabidka/[id]/pdf` (reuse quoteRenderer), `POST nabidka/[id]/odeslat` (email reuse lib/email, SMS reuse lib/sms)
- `POST pripady/[id]/sod` (vytvoření SOD z odsouhlasené varianty přes stávající SOD systém), podpis na místě přes stávající podpisovou vrstvu; po podpisu automaticky stav pipeline + založení zakázky (vazba Deal -> Zakazka už existuje)
- `GET dnes` (schůzky z Activity, nesplněné follow-upy, adresy), `GET aktivity?dealId=`, `POST aktivity`, `PATCH aktivity/[id]`
- Follow-up automatika: nová pg-boss fronta ve stávajícím workeru (nabídka odeslána + X dní bez reakce -> Notification + push)

Marže: mobilní API vrací `nakladovaCena`/`nakupniCena` jen v odpovědích určených obchodníkovi (detail konfigurátoru za přepínačem), nikdy v datech pro klientský náhled/PDF pro klienta. Klientské PDF = stávající quote šablony, ty nákupní ceny neobsahují.

## 5. Aplikace (Fáze 3 az 7)

- `app/(tabs)/` taby: **Dnes** (schůzky, navigace do Map přes nav chooser, follow-upy), **Případy** (seznam/kanban podle stavu, filtry, hodnota pipeline, fulltext), **Nový případ** (ARES předvyplnění, výběr klienta), **Já** (profil, vzhled, logout - po vzoru Tech)
- Detail případu: pipeline akce, aktivity, zaměření, nabídky, SOD
- Zaměření: formulář renderovaný ze `ZamereniDefinice` (config-driven), foto s tagy + povinná sada, anotace (kreslení přes react-native-svg, stejná technika jako SignaturePad), GPS
- Konfigurátor nabídky: 3 varianty vedle sebe, přepínač DPH, slevy Kč i %, přepínač "režim obchodníka" pro marže, náhled PDF (WebView), odeslání email/SMS, offline do outboxu
- Offline: stávající persister + outbox rozšířený o nové druhy akcí (pripad, aktivita, zamereni, zamereni-foto); tvorba nabídky a podpis záměrně jen online (stejné pravidlo jako dnes u podpisů v Tech)
- Referenční galerie: offline cache (persister) nad novým jednoduchým endpointem, obsah spravuje org (nice-to-have, až na konec)
- Hlasové poznámky: doporučuju v první verzi nativní diktování iOS klávesnice do pole poznámky (nula kódu, PII neopouští telefon jinam než do CRM). Přepis + AI shrnutí schůzky dát do backlogu jako samostatnou věc (vyžaduje novou STT integraci, v Tech nic takového není)

## 6. Pořadí prací

1. **Fáze 1**: schema + migrace + TENANT_MODELS + RLS sql + testy izolace (nanto-crm, větev)
2. **Fáze 2**: mobilní API + testy (výpočty, práva, audit)
3. **Fáze 3**: skeleton v appce (role gate, taby, offline zapojení)
4. **Fáze 4**: zaměření + foto + anotace
5. **Fáze 5**: konfigurátor nabídky + PDF + odeslání
6. **Fáze 6**: SOD + podpis na místě + auto přechod pipeline
7. **Fáze 7**: Dnes / kanban / follow-up worker / push
8. **Fáze 8**: testy (RLS, ceny a DPH, outbox), EAS, dokumentace v `docs/`

Po každé fázi stop a shrnutí. Backend commity do nanto-crm (bez deploye bez Radka), app commity do felucia-tech repa.

## 7. Otevřené otázky

Hlavní čtyři rozhodnuty (viz úvod). Drobnosti k doladění za pochodu:

- `duvodProhry` jako enum + poznámka (navrženo v kap. 3, potvrdit při Fázi 1)
- kde přesně v CRM webu zobrazit zaměření na detailu OP (Fáze 2+, web má na OP taby)
- referenční galerie realizací: zdroj obsahu a správa (nice-to-have na konec)
