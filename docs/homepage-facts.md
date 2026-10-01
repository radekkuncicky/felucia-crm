# Homepage felucia.io - fakta z kódu (audit 2026-10-01)

Zdroj pravdy pro texty nové homepage. Každé tvrzení o funkci musí mít níže stav ANO;
ČÁSTEČNĚ formulovat přesně podle poznámky; NE vynechat. Ověřeno proti větvi
`servis-refactor` (HEAD fa6b021) a kopii appky `/var/www/felucia-tech` (HEAD 7f4433b, 2026-09-15 -
kanonický repozitář appky je na Radkově Macu, mohou tam být novější změny).

---

## Část 1 - audit současné homepage

### Route a komponenty
- `/` = `app/page.tsx` (server). Přihlášeného (ne-demo) uživatele přesměruje na `/dashboard`.
  Vkládá JSON-LD (WebPage, SoftwareApplication s Offer z PLANS, FAQPage, HowTo z WORKFLOW_PHASES, ContactPoint)
  a renderuje `app/FeluciaLanding.tsx`.
- `app/FeluciaLanding.tsx` - JEDEN klientský soubor (`'use client'`, 1178 řádků), vše inline styly, téma
  podle třídy `.dark` na `<html>` (MutationObserver). Sekce v pořadí:
  `Navbar` -> `Hero` (+ screenshot zakázky) -> `Marquee` (nekonečný pás oborů) -> `WorkflowSteps`
  (#jak-to-funguje, 4 fáze / 9 kroků, screenshoty + carousel telefonu) -> `DasaSection` (#dasa, animovaný chat)
  -> `Pricing` (#ceny) -> `FAQ` (#faq) -> `CtaSection` (#ukazka, formulář) -> `Footer`.
- Obsah sdílí `lib/landing.ts` (SITE_*, CONTACT, OPERATOR, PLANS, FAQS, WORKFLOW_PHASES, FEATURE_LIST,
  ACCOUNTING_SOFTWARE, CONTENT_UPDATED). Ze stejných dat se generuje `app/llms.txt/route.ts`
  a `app/sitemap.ts` (lastmod) - při přepisu textů je nutné udržet konzistentní.
- `components/LandingPage.tsx` (688 ř.) - starý landing, nikde neimportovaný (mrtvý kód).
- Na subdoménách `{slug}.felucia.io` middleware přesměruje `/` na `/auth/signin` (`middleware.ts:107`).
  Indexovatelné jsou jen `/`, `/terms`, `/privacy`, `/support` (`middleware.ts` INDEXABLE_PATHS).

### Obrázky z public/marketing
- Hero: `crm-zakazka.jpg` (eager, fetchPriority high) - LCP je dnes obrázek.
- Kroky: `crm-op`, `crm-nabidka`, `crm-smlouva`, `crm-zakazka`, `crm-material`, `crm-predavak`,
  `crm-vyuctovani`, `crm-servis` (2160x1350, lazy). Krok 6 = carousel `tech-muj-den`, `tech-zakazka-detail`,
  `tech-zakazka-kontakty`, `tech-zakazka-komentare`, `tech-predavak-polozky`, `tech-predavak-podpis` (780x1689).
- Nepoužité: `crm-dashboard.jpg`, `crm-kalendar.jpg`, `crm-servis-nastenka.jpg`.
- Generuje `scripts/marketing-shots.sh`. `/marketing/` musí zůstat ve výjimkách matcheru middleware.

### Formulář "Domluvit ukázku" (#ukazka)
- Pole: Jméno a příjmení * (text), Název firmy * (text), Email * (type=email), Telefon (nepovinně, type=tel).
  Validace jen HTML `required` + `type=email` v prohlížeči.
- Odeslání: `fetch POST /api/contact` s `{ jmeno, email, zprava }`; firma a telefon se slepí do textu `zprava`
  ("ŽÁDOST O UKÁZKU FELUCIA ... Firma: ... Telefon: ...").
- `app/api/contact/route.ts`: rate limit 5 / hod / IP (`lib/rateLimit.ts`, in-memory - po restartu se nuluje),
  kontrola přítomnosti polí a délek (200/200/5000), HTML escape, `sendEmail('info@felucia.io', ...)`
  přes globální SMTP (`lib/email.ts`, Resend). Serverová validace formátu e-mailu NENÍ.
- Ochrana proti spamu: jen rate limit. Žádný honeypot, captcha ani časová pojistka.
- Po odeslání: `ok` -> karta "Žádost přijata! Díky. Ozveme se vám a domluvíme si termín 20minutové ukázky.";
  chyba -> "Chyba při odesílání. Zkuste to prosím znovu, nebo nám napište na info@felucia.io."
- Data tečou JEN e-mailem na info@felucia.io. Do DB (Lead) se nic neukládá, žádné potvrzení odesílateli.

### Metadata a SEO
- `app/page.tsx`: title absolute `Felucia — software pro montážní a servisní firmy` (s dlouhou pomlčkou),
  description "Od nabídky přes montáž až po pravidelný servis. Felucia propojí kancelář a techniky v jednom CRM — ..."
  (dlouhá pomlčka), canonical `/`, openGraph (title, description, url, siteName, cs_CZ, website).
- `app/layout.tsx`: metadataBase https://felucia.io, title template `%s | Felucia`, keywords, robots,
  twitter `summary_large_image`, verifikace z env `GOOGLE_SITE_VERIFICATION` a `BING_SITE_VERIFICATION`
  (v `.env` aktuálně NENASTAVENÉ - meta se nevypisují), natvrdo `<meta name="grovetech-vibe-verify" ...>`.
  Site-wide JSON-LD Organization + WebSite.
- `app/opengraph-image.tsx` (ImageResponse 1200x630, tmavě zelený gradient, alt s dlouhou pomlčkou),
  `app/twitter-image.tsx` re-exportuje OG.
- `app/robots.txt`, `app/sitemap.ts`, `app/llms.txt/route.ts`.

### Dáša demo
- `DasaChat` - skriptovaná animace (setTimeout), startuje IntersectionObserverem; uživatel klikne na jedno ze 3 OP
  tlačítek, pak běží dál. Obsahuje emoji, dlouhé pomlčky a tykání; ukazuje "Mám ji rovnou odeslat klientovi?"
  (Dáša e-maily odesílat neumí - viz bod 12). Body vlevo ("Navrhuje text nabídek z technické specifikace",
  "Automaticky shrne stav zakázky", "Připraví zprávu pro klienta jedním klikem") kódem nepodložené.
- Patička sekce: "Dostupná v plánech Standard a Professional · 500 dotazů/měsíc (Standard) nebo neomezeně (Professional)".

### Ceník
- Ceny a body plánů jsou natvrdo v `lib/landing.ts` PLANS (Starter 490, Standard 1490, Professional 2490,
  Enterprise individuálně). NEJSOU sdílené s aplikací: limity žijí v `lib/planLimits.ts`, Stripe ceny v Stripe
  (`lib/stripe.ts` jen price ID z env). Žádná vazba - musí se hlídat ručně.
- DPH ani "za firmu" na webu uvedeno není (jen "Kč /měsíc").

### FAQ (texty v lib/landing.ts FAQS)
1. Pro jaké firmy je Felucia vhodná? - "Pro menší české montážní a servisní firmy — typicky klimatizace a tepelná čerpadla — kde majitel koordinuje obchod, zakázky a několik techniků v terénu."
2. Co technik zvládne v telefonu? - "V aplikaci Felucia Tech vidí dnešní a nadcházející zakázky, navigaci a kontakty na stavbě, pokyny a podklady k montáži. Může odškrtávat položky, přidávat fotky a poznámky a na konci vyplnit předávací protokol s podpisem zákazníka. Mobilní funkce jsme ověřili ve zdrojovém kódu, provozní zkušenosti průběžně sbíráme s prvními firmami."
3. Jak probíhá ukázka? - "20 minut online. Ukážeme průchod jednou zakázkou od nabídky po servis a probereme, jestli Felucia sedí vašemu provozu."
4. Jak se domlouvá zavedení? - "Po ukázce se domluvíme na rozsahu a podmínkách a začínáme na konkrétní zakázce s vaším týmem. První firmy zavádíme osobně a postupně."
5. Jaká data lze importovat? - "Podporujeme import produktů z Excel souboru (XLSX) přes průvodce v nastavení. Kompletní migraci klientů, zakázek a historie z předchozího systému aktuálně neděláme — probereme na ukázce, co je u vás potřeba."
6. Je nutné připojení k internetu? - "Felucia běží jako webová a mobilní aplikace, takže část funkcí vyžaduje internetové připojení. Plně offline provoz negarantujeme."
- FAQ je dnes klientský akordeon (button + state), ne details/summary.

### Kotvy
| Kotva | Stav |
|---|---|
| #jak-to-funguje | section WorkflowSteps - OK |
| #technici | `<li>` kroku 6 (STEP_ANCHORS) - OK |
| #servis | div fáze Servis (PHASE_ANCHORS) - OK |
| #ceny | section Pricing - OK |
| #faq | section FAQ - OK |
| #ukazka | section CtaSection - OK |
| #dasa | section Dáša - OK (není v menu) |
| #funkce | v patičce (Produkt -> Funkce) - **MRTVÁ, na stránce žádný prvek s tímto id** |

### Styly, fonty, knihovny
- Tailwind 3.4 je v projektu, ale landing ho skoro nepoužívá (inline styly + pár tříd v `app/globals.css`:
  `fl-marquee-*`, `fl-step*`).
- Fonty (`app/layout.tsx`, next/font/google): Inter (tělo, `--font-inter`), Space Grotesk (nadpisy landingu,
  `--font-space-grotesk`), Montserrat (`--font-montserrat`). V `app/fonts/` leží `GeistVF.woff`
  a `GeistMonoVF.woff`, nikde nepoužité. Monospace font v projektu nenačtený.
- Animační knihovny: žádné (framer-motion apod. není). Ikony: žádná knihovna, vlastní SVG
  (`components/ui/Icons`, inline path v landingu). Dále: next-themes, sonner, recharts, dompurify.
- CSP (`middleware.ts`): script-src nonce + strict-dynamic, style-src 'self' 'unsafe-inline' + Google Fonts,
  img-src self/data/blob/https - inline styly i `<style>` fungují, inline `<script>` jen s nonce.

---

## Část 2 - inventura skutečných funkcí

Legenda: **ANO** hotovo a v produkci | **ČÁSTEČNĚ** jen část / s omezením | **NE** neexistuje.

### 1. Lead -> obchodní případ - ANO
- Tlačítko **"Převést na OP"**, dialog **"Převést na obchodní případ"** (`app/(dashboard)/leady/[id]/LeadDetailClient.tsx:548,665`),
  API `app/api/leady/[id]/convert/route.ts` - vytvoří klienta (nebo použije existujícího `existingClientId`)
  a OP; přenese kontakt, technologii, předmět.
- Duplicity klientů: `lib/clientDuplicate.ts` - shoda telefonu/e-mailu (normalizovaně) nebo přibližná shoda
  jména (bez diakritiky + Levenshtein); použito při převodu leadu, zakládání klienta
  (`app/api/clients/check-duplicate`), importu.
- Stavy leadu: Nový, Kontaktován, Kvalifikován, Převeden, Zrušen (enum LeadStatus).
- Stavy OP (`lib/constants.ts`): Nový, Jednání, Nabídka, Před uzavřením, Úspěch, Prohráno, Zneplatněno.

### 2. Nabídky - ANO (ceníky ČÁSTEČNĚ)
- Položky materiálu a práce s cenami, DPH, nákupní ceny (Quote/QuoteItem).
- Ceníky: model `Cenik` + `CenikPolozka` (cena produktu v ceníku), správa v Produktech (`products/CenikDetail.tsx`),
  filtr ceníku v katalogu při přidávání položek (`components/ProductCatalogModal.tsx`). ČÁSTEČNĚ: ceník = cenová
  hladina nad katalogem produktů, ne samostatný ceník prací.
- Kopírování: **"Duplikovat"**, **"Jinému klientovi"** (`deals/[id]/NabidkyTab.tsx:1482,1485`), v menu
  **"Kopírovat do jiného OP"** (`:1890`); duplikace celého OP (`DealActions.tsx`).
- PDF šablony nabídek: QuoteTemplate typy BASE / STANDARD / CUSTOM_HTML / SYSTEM, vlastní HTML+CSS v tabulce
  `quote_template_htmls` (model QuoteTemplateHtml), PDF přes Puppeteer (`app/api/quotes/[id]/export-pdf`).
  Počet šablon dle plánu (Starter 1, Standard 10, Professional+ neomezeně).
- Sdílení nabídky odkazem + e-mailem ("Poslat klientovi"), veřejná stránka `/nabidka/...`.

### 3. SOD - ČÁSTEČNĚ (podle plánu)
- Šablony smluv: TipTap editor (`components/SodTemplateEditor.tsx`) s proměnnými `{{cislo_smlouvy}}`,
  `{{klient_jmeno}}`, `{{klient_adresa}}` ... + HTML režim a import .docx/.html.
  Náhled: tlačítko **"Náhled s ukázkovými daty →"** / **"Náhled"** (`settings/contract-templates/ContractTemplatesManager.tsx:338,427`)
  - náhled na kliknutí, NE živý vedle editoru.
- PDF smlouvy: ANO (`lib/sodPdf.ts`, Puppeteer).
- E-podpis: VLASTNÍ implementace (`/podpis/[token]`, `lib/sodPodpis.ts`), **Documenso se nepoužívá**.
  Není to kvalifikovaný/certifikovaný podpis - je to prostý elektronický podpis s ověřením SMS kódem.
- SMS OTP: ANO, `lib/sms.ts`, v produkci `SMS_PROVIDER=smsmanager` (SmsManager.cz).
- Podpis za zhotovitele (interní) i klienta - stav **"Čeká na podpis za zhotovitele"**, **"Odesláno k podpisu"**, **"Podepsáno"**.
  Události: OTP odeslán / ověřen, zobrazeno, připomínka, revize (verze smlouvy).
- **Co se při podpisu ukládá jako důkaz** (ověřeno 2026-10-01: `app/api/public/podpis/[token]/podepsat`, `overit`,
  `app/api/sod/[id]/podepsat-interne`, `lib/sodPodpis.ts`; v produkci 10/10 podepsaných smluv má otisk i IP):
  - klient: podepsat jde až po ověření SMS kódu (cookie z `overit`); ukládá se čas podpisu, vyplněné jméno, obrázek
    podpisu, IP adresa, prohlížeč (user agent), **SHA-256 otisk textu smlouvy** (podepsaná verze) a telefonní číslo,
    na které přišel kód, s časem ověření (`SodPodpisRelace.telefon`, `otpOvereno`). Otisk se tiskne do PDF
    ("Otisk dokumentu (SHA-256)").
  - zhotovitel (interní podpis): přihlášený uživatel s oprávněním podepisovat smlouvy, čas, jméno, obrázek podpisu,
    SHA-256 otisk; **bez SMS kódu**. Pozdější úprava textu interní podpis zneplatní.
  - auditní záznam `SodUdalost` ke každé události (vytvořeno, odesláno, zobrazeno, SMS kód odeslán / ověřen / chybný,
    podepsáno, revize...) s časem, IP a prohlížečem.
  - neukládá se: kvalifikovaný certifikát ani časové razítko certifikační autority.
- Podepsaná smlouva uložená u OP; podpis automaticky převede OP na Úspěch a založí zakázku (`lib/dealUspech.ts`).
- **Omezení podle plánu** (`lib/modulPodpisy.ts`): online podpis je v ceně jen Professional/Enterprise;
  Standard jen jako příplatkový modul **99 Kč/licence/měsíc, limit 100 smluv/měsíc**; Starter vůbec.

### 4. Převod OP na zakázku - ANO
- Automaticky při přechodu OP na Úspěch (po podpisu SOD i ručně), `lib/zakazkaWorkflow.ts` `createZakazkaFromDeal`;
  ručně přes `POST /api/zakazky` z OP.
- Přenáší: klienta, název (předmět OP), technologii, vedoucího (kdo přechod spustil / vlastník OP), položky
  z AKTIVNÍ nabídky (název, kód, produkt, množství, jednotka, prodejní a nákupní cena, DPH; stav Čeká).
  Místo stavby: při ručním založení `mistoStavby ?? adresa díla z OP`; při auto-založení po podpisu se nevyplní
  (dohledává se z OP v detailu). Smlouva a dokumenty zůstávají u OP, zakázka na OP odkazuje (opId).
- Při plánu se servisním modulem + nastavení `automatickyServis` vznikne i záznam Zařízení.
- **Číslo zakázky přebírá číslo OP**: OP-26-101 -> zakázka **26-101** (jiné číslo jen při kolizi).

### 5. Materiál a sklad - ČÁSTEČNĚ
- Stavy položky zakázky (UI): **Čeká -> Objednáno -> Rezervováno -> Vydáno** (enum NASKLADNENO se v UI
  zobrazuje jako **"Rezervováno"**, ne "Naskladněno").
- Sklad v2 (reálná zásoba): příjem (`app/api/sklad/prijem` - produkt, množství, nákupní cena, poznámka),
  korekce/inventura, rezervace, výdej, vratky (SkladPohybTyp). Dodavatelé a objednávky ze zakázky
  (OBJ-RR-NNN, stavy Návrh / Odeslaná / Částečně doručená / Doručená / Zrušená).
- **Naskladnění s přirážkou v Kč nebo % - NE** (v kódu žádná přirážka).

### 6. Zakázka - ANO
- Stavový pruh (`zakazky/[id]/PipelineBar.tsx`): **Nová, Přiřazena, V realizaci, Předána, Vyúčtována, Hotovo**;
  u zakázek s etapami se pruh prodlužuje o uzly Etapa N -> Montáž -> Předávka -> Vyúčtování.
- Taby (`lib/zakazkaTaby.ts`): Položky, Úkoly, Kontakty, Protokoly a vyúčtování, Podklady a foto, **Historie**
  (komentáře + aktivita, `HistorieTab.tsx`, `KomentareTab.tsx`, `AktivitaTab.tsx`).
- Termín montáže od-do, technici, vedoucí, místo stavby s navigací, titulní fotka, příznak Kdykoliv, kalendář s DnD.
- Mazání: ANO, `DELETE /api/zakazky/[id]` s oprávněním `zakazkyMazani` (výchozí Správce, Manažer zakázek).
- Číslování RR-NNN (viz bod 16).

### 7. Felucia Tech (mobilní appka techniků) - ANO (offline ČÁSTEČNĚ, podpis na šířku NE)
- Zdroj: `/var/www/felucia-tech` (Expo, bundle `io.felucia.tech`). Mobilní API `app/api/mobile/*`.
- Taby: **Dnes** (záhlaví **"Můj den"**), **Zakázky**, **Servis**, **Já**. Další obrazovky: detail zakázky,
  předávací protokol, detail servisní zakázky, login.
- Detail zakázky: **"Navigovat na stavbu"**, volání klientovi (`tel:`), kontakty na stavbě, pokyny, podklady,
  odškrtávání položek, komentáře, fotky (kamera/galerie).
- Ceny: technik ceny NEVIDÍ - mobilní API položek zakázky ceny vynechává (`app/api/mobile/zakazka/[id]/route.ts`
  "ceny záměrně vynechány"); web role Technik/Hlavní technik mají `financeProdejni: false`. Výjimka: servisní
  protokol v appce má pole **"Práce (Kč)"** a **"Materiál (Kč)"** (`app/servis/[id].tsx:342,355`).
- Zápis materiálu: v předávacím protokolu technik zadává skutečné **Použito** u každé položky a může přidat
  novou položku. Zápis práce: komentáře/poznámka protokolu; servisní protokol (závady, práce, doporučení).
  Výkaz hodin NENÍ.
- Podpis zákazníka: `components/SignaturePad.tsx` - pole 320x180 v obrazovce protokolu. **Fullscreen ani
  orientace na šířku v kódu NENÍ** (v kopii na serveru).
- Offline: ČÁSTEČNĚ - data se cachují 1 den (React Query persist do AsyncStorage) a offline fronta
  (`lib/outbox.ts`) odešle později: odškrtnutí položky, komentář, fotky zakázky i servisu, servisní protokol.
  **Stavové přechody a podpisy jen online** (komentář v outbox.ts).
- iOS: App Store (ID 6779400065 dle zadání - v kódu webu odkaz zatím není). Android: build existuje, v Google Play
  publikováno není (paměť projektu) -> "připravujeme".

### 8. Předávací protokol - ANO
- PP-RR-NNN, sloupce v UI **Plánováno / Použito** (`predavaky` detail :581-582); sloupec "Rozdíl" v UI není
  (dá se dopočítat). Položka může být vyřazena (`zahrnuto`).
- Podpis klienta (SVG), příznak "klient nepřítomen", poznámka, fotky (PredavakFoto), PDF protokolu.
- Stavy: **Rozpracován -> Podepsán -> Schválen**, nebo **Odmítnuto** (s důvodem).

### 9. Schvalování - ANO
- Protokol i vyúčtování schvaluje oprávnění `zakazkySchvalovani` = výchozí role **Správce** a **Manažer zakázek**
  (ne "vedoucí zakázky" - vedoucí je pole na zakázce, ne role; schvalovat může jen s tímto oprávněním).
- Schválení protokolu (`app/api/predavaky/[id]/schvalit`) automaticky založí vyúčtování z protokolu (VYU-RR-NNN).
- Vyúčtování: **Návrh -> Ke schválení -> Schváleno**; schválení posune zakázku na Vyúčtována, volitelně
  "Schválit a zahájit další etapu".

### 10. Vyúčtování a ABRA Flexi - vyúčtování ANO, **ABRA Flexi export NE**
- Vyúčtování: položky, PDF (`app/api/vyuctovani/[id]/pdf`), schvalování.
- Export do ABRA Flexi v kódu **neexistuje** (žádné API, soubor ani tlačítko; zmínka jen v `lib/landing.ts`
  ACCOUNTING_SOFTWARE). Napojení je ve fázi plánu, čeká na přístupy od účetní firmy.

### 11. Servis - ANO (jen Professional a Enterprise)
- Modely: `Zarizeni` (název, typ, výrobní číslo, datum instalace, záruka do, QR token, vazba na klienta a OP),
  `ServisniKontrakt` (SK-RR-NNN, typ Roční/Pololetní/Dvouletý/Jednorázový, interval měsíců, cena, začátek/konec,
  auto-prodloužení), `ServisniZakazka` (SZ-RR-NNNN).
- Hlavní cesta (`lib/servisStav.ts`): **Nová -> Naplánovaná -> Probíhá -> Dokončená -> Vyúčtovaná -> Uzavřená**;
  vedlejší stavy Čeká, Zrušená (+ legacy Reklamace). "Prošlý termín" se počítá dynamicky.
- Typy: Plánovaný servis, Porucha, Záruční oprava, Pozáruční oprava, Uvedení do provozu, Kontrola.
- Plánované prohlídky: po dokončení zakázky z kontraktu se automaticky založí další podle intervalu
  (`lib/servisZakazkaService.ts`). Pohledy Aktuální/Plánované, Portfolio s filtrem "Záruka končí" (do 90 dní),
  plán `/servis/plan`, kalendář. Zařízení s QR stránkou `/zarizeni/[token]`.
- Technik zapisuje zásah v appce (protokol, závady, práce, materiál, fotky, podpis).
- Gating: `hasServiceModule` jen PROFESSIONAL, ENTERPRISE (`/servis` jinak PlatinumGuard).

### 12. Dáša - ČÁSTEČNĚ
- Nástroje (`lib/dasaTools.ts`): search_deals, get_deal, search_clients, search_products, list_quote_templates,
  get_quote_template, get_briefing (čtení); **create_quote** (nabídka k OP), **create_deal**, **create_client**,
  **add_activity**, **change_deal_status** (zápis). Nic jiného - **neumí měnit termín montáže, zakázky, sklad,
  protokoly, neodesílá e-maily, nemaže.**
- Model: Haiku 4.5 na dotazy, Sonnet 4.6 na akce; Technik nesmí vidět ceny ani tvořit nabídky (v promptu).
- Limity: Starter bez Dáši; enforcement přes **AI kredity**: Standard 200 / měsíc, Professional 1000 / měsíc,
  Enterprise neomezeně (+ dokoupené kredity). Pole `aiTokensPerMonth` (500 / neomezeně) je legacy a zobrazuje se
  v Nastavení -> Fakturace - **web i billing uvádějí "500" a "neomezeně", reálně platí 200 / 1000 kreditů.**
- Osobní údaje vs AI: **žádná anonymizace/pseudonymizace**. Data z CRM (jména klientů, předměty OP...) se posílají
  do API Anthropic; zabalená do `<data source="crm">` jako ochrana proti prompt injection. `/privacy` 5.3 to
  přiznává. Lze pravdivě říct jen: "AI se spouští jen na vaši akci; potřebné údaje se posílají poskytovateli
  Anthropic; Dáša nic nemaže a zápisy dělá jen na váš pokyn."

### 13. Role a oprávnění - ANO
- Role (`lib/permissions.ts`): **Správce**, **Manažer zakázek**, **Obchodník**, **Hlavní technik**, **Technik**.
  Žádná role "skladník", "účetní" ani "vedoucí zakázky".
- Prodejní ceny: Správce, Manažer zakázek, Obchodník. Nákupní ceny a marže: Správce, Manažer zakázek.
  Technik a Hlavní technik ceny nevidí.
- Per-user přepisy oprávnění jen Standard+ (`hasCustomPermissions`).

### 14. Multi-tenant - ANO (API ČÁSTEČNĚ)
- Subdomény `{slug}.felucia.io` (middleware), `orgPrisma` + PostgreSQL RLS (fail-closed) jako druhá linie.
- White-label: Professional+ = vlastní styl záhlaví/patičky dokumentů "VLASTNI" (`lib/dokumentyChrome.ts`);
  vlastní doména NE.
- API: API klíče pro příjem leadů (`app/api/public/leads`, `website-leads`) + odchozí webhooky (`/settings/api`).
  Obecné REST API pro data NENÍ. Plánem se API negatuje (dostupné ve všech plánech).

### 15. GDPR a data - ANO
- Anonymizace klienta (`lib/clientAnonymize.ts`) - jméno -> "Smazaný klient #...", kontakty a adresa smazány,
  obchodní historie zůstává.
- `/privacy` existuje (Hetzner, EU - bod 6.3; AI Anthropic - 5.3; zálohy 14 dní vč. offsite - 3.4).
- Zálohy: denně 3:00, šifrované (gpg AES-256), 14 dní, offsite kopie (Backblaze B2).

### 16. Formáty čísel dokladů
| Doklad | Formát | Příklad | Zdroj |
|---|---|---|---|
| Obchodní případ | OP-RR-NNN | OP-26-101 | lib/dealKod.ts |
| Nabídka | NAB-RR-NNNN | NAB-26-0101 | lib/quoteKod.ts |
| SOD | SOD-RR-NNN | SOD-26-032 | lib/sodHelpers.ts |
| Zakázka | RR-NNN (= číslo OP bez "OP-") | 26-101 | lib/zakazkaWorkflow.ts |
| Předávací protokol | PP-RR-NNN | PP-26-032 | lib/zakazkyHelpers.ts |
| Vyúčtování | VYU-RR-NNN | VYU-26-032 | lib/zakazkyHelpers.ts |
| Servisní zakázka | SZ-RR-NNNN | SZ-26-0001 | lib/servisniZakazkaCislo.ts |
| Servisní kontrakt | SK-RR-NNN | SK-26-001 | lib/servisniKontraktCislo.ts |
| Objednávka | OBJ-RR-NNN | OBJ-26-001 | lib/objednavky.ts |

### 17. Plány (ceny: lib/landing.ts, limity: lib/planLimits.ts, platba: Stripe)
| | Starter | Standard | Professional | Enterprise |
|---|---|---|---|---|
| Cena (web, Kč/měs.) | 490 | 1 490 | 2 490 | individuálně |
| Uživatelé | 1 | 5 | 20 | neomezeně |
| Obchodní případy | 20 | neomezeně | neomezeně | neomezeně |
| Produkty | 100 | neomezeně | neomezeně | neomezeně |
| Šablony nabídek / smluv | 1 / 1 | 10 / 10 | neomezeně | neomezeně |
| Editace patičky šablon | ne | ano | ano | ano |
| Dáša | ne | 200 kreditů/měs. | 1000 kreditů/měs. | neomezeně |
| Online podpis SOD | ne | modul 99 Kč/licence/měs., 100 smluv/měs. | ano | ano |
| Servisní modul | ne | ne | ano | ano |
| White-label dokumentů | ne | ne | ano | ano |
| Vlastní oprávnění uživatelů | ne | ano | ano | ano |
| API klíče + webhooky | ano | ano | ano | ano |
| Subdoména | ano | ano | ano | ano |
| Podpora (odezva) | 48 h | 24 h | 4 h | 1 h |
- Zkušební doba 30 dní (`TRIAL_DNI`). Zda jsou ceny bez DPH, z kódu neplyne (Stripe) - zadání říká bez DPH.
- Web uvádí "2-5 uživatelů" / "5-20 uživatelů" / "20+" a "Ceníky a analytiky" (Standard), "Dedikovaný onboarding,
  SLA garance, Vlastní integrace + školení" (Enterprise) - obchodní sliby, ne kód.
