# Část 1b - limity Dáši, pravdivost textů a hotfix homepage (2026-10-01)

Nasazeno přes `./scripts/deploy.sh` (typecheck, 475/475 testů, build, restart pod uživatelem nanto).

## 1. Limity Dáši - jeden zdroj pravdy

Nový modul `lib/dasaLimits.ts`: `DASA_KREDITY_MESICNE`, `dasaKredity()` (výpočet kreditu),
`formatDasaLimit()`, `formatDasaPlany()`, `formatDasaDostupnost()`.

| Soubor | Před | Po |
|---|---|---|
| `lib/dasaLimits.ts` (nový) | - | Starter 0, Standard 200, Professional 1000, Enterprise bez limitu (kredity/měsíc) |
| `lib/planLimits.ts` | `aiCreditsPerMonth` 0 / 200 / 1000 / Infinity natvrdo + nepoužívané `aiTokensPerMonth` 0 / 500 / Infinity / Infinity | `aiCreditsPerMonth` z modulu, `aiTokensPerMonth` odstraněno |
| `app/api/ai-assistant/route.ts` | vlastní `calcCredits()`, legacy pole `tokenLimit` (500 / null) v odpovědi | `dasaKredity()` z modulu, legacy `tokenLimit`/`tokensUsed` odstraněny (nikdo je nečetl, ani appky) |
| `app/(dashboard)/settings/billing/page.tsx` + `components/BillingClient.tsx` | "AI dotazy (tento měsíc)": počet dotazů (`aiTokensUsed`) / 500; seznam plánů "AI asistentka Dáša (500/měs)", "AI Dáša neomezená" | "Dáša - kredity (tento měsíc)": `aiCreditsUsed` / (limit plánu + `aiCreditsExtra`) = stejný strop jako vynucení; texty z `formatDasaLimit()` |
| `components/UpgradeModal.tsx` (nikde nepoužitá) | "500 zpráv/měs" | `formatDasaLimit('STANDARD')` |
| `lib/landing.ts` | "AI Dáša (500/měsíc)", "AI Dáša neomezená", "AI asistentka Dáša (plány Standard a Professional)" | "AI Dáša (200 kreditů měsíčně)", "AI Dáša (1 000 kreditů měsíčně)", "AI asistentka Dáša (plány Standard, Professional a Enterprise)" |
| `app/FeluciaLanding.tsx` | "Dostupná v plánech Standard a Professional · 500 dotazů/měsíc (Standard) nebo neomezeně (Professional)" | "Dostupná v plánech Standard (200 kreditů měsíčně), Professional (1 000 kreditů měsíčně) a Enterprise (bez limitu)" |

- Vynucení beze změny. Tenant NANTO je na plánu ENTERPRISE (bez limitu), žádnou zvláštní výjimku v kódu nemá - chování se nezměnilo.
- Stripe metadata ani seed limity Dáši neobsahují.

## 2. Co je kredit

Jeden kredit NENÍ jeden dotaz, proto všude "kreditů měsíčně".

`kredity = max(1, ceil(((vstupní tokeny - tokeny z cache) + 0,1 x tokeny z cache + 5 x výstupní tokeny) / 1000))`

Výstup je u poskytovatele 5x dražší než vstup, čtení z cache téměř zdarma. Počítá se za celý dotaz včetně
volání nástrojů. Produkce (185 dotazů do 2026-10-01): medián 4 kredity, 90 % dotazů do 15, maximum 37.
Limit = měsíční kredity plánu + dokoupené (`aiCreditsExtra`); nuluje se při prvním dotazu v novém měsíci.

## 3. /privacy, /terms, /support (nic neměněno)

Nenalezeno: Documenso, "certifikovaný" podpis, ABRA Flexi, Android, limity Dáši, tvrzení o anonymizaci
nebo izolaci osobních údajů před AI. /support a /terms se AI, podpisu ani subdodavatelů netýkají.

Nalezená pasáž /privacy 5.3 (pravdivá, jen neúplná):
> 5.3 AI asistent - pokud má organizace na svém plánu aktivovaný AI asistent a Uživatel jej použije, mohou být v rámci konverzace odeslány relevantní údaje z evidence (např. jméno klienta, předmět obchodního případu) do API poskytovatele Anthropic za účelem generování odpovědi. Funkce je volitelná a AI asistent se spouští jen na výslovnou akci uživatele.

Zpracovatelé: Anthropic uveden (bez země a právního základu předání mimo EU). SmsManager.cz chybí.
Chybí také Resend (e-maily, aktivní), Expo (push notifikace appky) a jméno offsite úložiště záloh (Backblaze B2).
Sentry je vypnuté (bez DSN), uvádět netřeba.

Navržená znění:
- 5.3: "AI asistentka Dáša - pokud ji Uživatel na svém plánu použije, odesílají se v rámci konverzace údaje z evidence potřebné k odpovědi (např. jméno klienta, předmět obchodního případu, položky nabídky) do API společnosti Anthropic, PBC (USA). Údaje se před odesláním neanonymizují. Dáša se spouští jen na výslovnou akci uživatele, nic nemaže a zápisy provádí jen na jeho pokyn."
- 5.4 (nový): "SMS kódy pro podpis smluv - při online podpisu smlouvy odesíláme telefonní číslo podepisující osoby a ověřovací kód přes službu SmsManager.cz (Česká republika)."
- 5.5 (nový): "E-maily - pozvánky, obnovy hesla, nabídky a smlouvy odesílané klientům doručujeme přes službu Resend. Předává se adresa příjemce a obsah zprávy."
- 5.6 (nový): "Push notifikace - mobilní aplikace Felucia Tech dostává upozornění přes push službu Expo. Předává se identifikátor zařízení a text upozornění."
- 3.4 doplnit: "... včetně šifrované offsite kopie (AES-256) u úložiště Backblaze B2."
- U Anthropic je potřeba doplnit právní základ předání do USA (nelze zjistit z kódu).

## 4. Změny na homepage (hotfix, bez redesignu)

- "Certifikovaný elektronický podpis" -> "Elektronický podpis ověřený SMS kódem" (krok 3).
- ABRA Flexi odstraněn úplně: konstanta `ACCOUNTING_SOFTWARE` a `formatAccountingSoftware()` smazány; krok 8
  "Schválíte vyúčtování a odešlete podklady do účetnictví" -> "Schválíte vyúčtování", popis "Po kontrole protokolu
  schválíte vyúčtování, které z protokolu vzniklo.", bod o exportu odstraněn (týká se i JSON-LD HowTo a llms.txt).
- "Aplikace Felucia Tech pro iOS a Android." -> "Aplikace Felucia Tech pro iOS, verzi pro Android připravujeme."
- Limity Dáši v sekci Dáša, v ceníku, v llms.txt a JSON-LD z `lib/dasaLimits.ts`.
- `CONTENT_UPDATED.home` (sitemap lastmod) -> 2026-10-01.

Ověřeno po nasazení: https://felucia.io 200, bez "certifikovaný" a "ABRA"; PM2 (nanto) online; log bez chyb.

## Mimo zadání
- Ceny v Nastavení -> Fakturace (49 / 999 / 1 499 Kč) se liší od webu (490 / 1 490 / 2 490 Kč). Neměněno.
- Demo okno (`components/DemoModal.tsx`) slibuje "neomezený přístup k Dáše" po založení účtu. Neměněno.
