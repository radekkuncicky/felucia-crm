# UX Audit — postup oprav

Stav oprav podle UX auditu z 12. 7. 2026 (artefakt: https://claude.ai/code/artifact/e2013ee4-5dcb-4426-9294-c6b15ab92bc8).
Legenda: `[ ]` pending · `[~]` in-progress · `[x]` done

Pravidla: před začátkem úkolu označit `[~]` + commit `start: <ID>`; po dokončení `[x]` + poznámka + commit. Po každém úkolu lint + typecheck. Pořadí: vlny 1→5, uvnitř vlny shora dolů.

## Mimo audit (nahlášené bugy)

- [x] **BUG-2026-07-12** — Dáša vytvořila 2 OP se stejným číslem (OP-26-100, dva create_deal paralelně ve stejné ms). Příčina: všechny generátory čísel = „přečti max, přičti 1" bez zámku; deals/quotes/kontrakty navíc bez unique constraintu.
  - Poznámka: (1) Prod data opravena — 6 duplicitních párů OP přečíslováno (Hellstein→OP-26-101, Solák→102, Šimurda→103, 2× Mohelník backdatovaný import→104/105, Obec Těškovice→106; vždy zůstalo číslo na starším/používanějším z páru) + 3 páry duplicitních čísel nabídek (Dášina trojice z 29. 6. → NAB-26-0118/0119/0120). (2) Unique indexy deals(orgId,kod), quotes(orgId,kod), servisni_kontrakty(orgId,cisloKontraktu) — vytvořeno ručně v zamčené transakci + migrace 20260712130000 s IF NOT EXISTS přes `migrate deploy` (migrate dev hlásil drift a chtěl reset — nepoužívat). Zakázky/servisní zakázky/SOD/předáváky/vyúčtování už unique měly. (3) Kód: lib/uniqueKod.ts `createWithUniqueKod` (retry na P2002) + lib/dealKod.ts (centralizace OP generátoru, dřív duplicitně inline v Dáše); obaleno všech 7 create míst (2× deal, 5× quote). Testy 92/92 OK.

## VLNA 1 — Důvěra

- [x] **K2** — Sdílený `lib/api.ts` s `apiFetch()` (auto `toast.error` při chybě). Nahradit tichá fetch volání (RychlaPoznamka, EtapySection, PipelineBar, FotoTab, MontazDatePicker, InlineStatusBadge, modul servis…). Optimistic UI vždy rollback + toast.
  - Poznámka: Hotovo. `lib/api.ts` — apiFetch vrací ApiResult (nevyhazuje, mechanická náhrada vzoru `if (res.ok)`), + zkratky api.get/post/patch/put/delete; toast.error automaticky (serverové `error` pole → fallback), opts `errorMessage`/`silent`. Migrováno 13 souborů: RychlaPoznamka, EtapySection (inline „Chyba" → toast), PipelineBar, FotoTab, MontazDatePicker, InlineStatusBadge (+ success toast po smazání OP), ZakazkyPageClient (inline+bulk stav s rollbackem), servis: ZakazkaDetailClient (patch/reklamace/fotky; alert(data.error) nahrazeny toastem — zbylé alert/confirm/prompt řeší K7), ZakazkySeznamClient, ZarizeniClient (+QR), KontraktyClient (4 volání dřív bez kontroly res.ok!), PlanClient (inline banner → toast), VyuctovaniSekce. Zbylé soubory s fetch bez toastu (deals taby, settings managery…) mají většinou vlastní inline error stavy — migrace průběžně při dotyku (S10 pravidlo). tsc + lint OK.
- [x] **S1** — Smazat 6 vlastních Toast implementací (PredavakClient, ProfileClient, UsersManager, DealActions, BillingActions, BillingClient), všude sonner. DealsKanban inline banner → toast.
  - Poznámka: Hotovo. Všech 6 vlastních Toast komponent smazáno, nahrazeno sonnerem (PredavakClient/ProfileClient/UsersManager si nechaly interní `showToast(msg, type)` delegující na sonner — minimální diff, 30+ call-sites beze změny). DealActions navíc zmigrován na api.* (duplicate/delete/vytvořit zakázku dřív tiché) + success toasty. DealsKanban a PlanClient inline error bannery → toast. Billing* fetch volání nechána na nativním fetch (přesměrování na Stripe, vlastní hlášky), jen toasty přes sonner. tsc + lint OK.
- [~] **K7** — `confirm()` v ZakazkaDetailClient → `confirmDialog()`. Projít kód, nahradit další confirm()/alert(). ESLint `no-restricted-globals` pro confirm/alert.
  - Poznámka:
- [ ] **S4** — `loading.tsx` na chybějící top-level routy (servis, produkty, SOD, sklad, kalendář, aktivity, settings…) z existujících Skeleton komponent.
  - Poznámka:
- [ ] **K5** — BottomNav technika: duplicitní tab „Foto" (`/zakazky`). Smazat, nebo zkratka na výběr zakázky s aktivovanou kamerou.
  - Poznámka:

## VLNA 2 — Konzistence

- [ ] **S3** — `lib/format.ts` (formatKc, formatKcCompact, formatDate, formatDateTime, formatRelative). Nahradit 90+ inline toLocaleString a 3 kopie fmtKc. ESLint zákaz inline toLocaleString.
  - Poznámka:
- [ ] **S2** — Jeden ikonový systém (rozšířit ui/Icons.tsx nebo lucide-react). Migrovat Sidebar/BottomNav z inline SVG. Nahradit všech ~101 emoji.
  - Poznámka:
- [ ] **S13** — Sjednotit tón (vykání) v mikrocopy. Reálná jména v placeholderech → vzorová („Jan Novák", „Vzorová stavba s.r.o.").
  - Poznámka:
- [ ] **K1** — Mobilní drawer: zobrazit Nastavení, Superadmin, Dokumenty, Analýzy (dnes `hidden md:block`). Nepoužitelné obrazovky na mobilu → zjednodušená verze, ne tiché schování.
  - Poznámka:

## VLNA 3 — Základy systému

- [ ] **K4** — Sémantické barevné tokeny (bg-surface, bg-surface-2, text-primary/secondary/muted, border-default) jako CSS proměnné v tailwind.config. Migrace tříd, smazání ~180 řádků `.dark` override bloku v globals.css a remapu modré→zelené.
  - Poznámka:
- [ ] **S10** — `components/ui/` primitivy: Button (variant, size), Input, Select, Card, Badge, Dialog. Nové featury povinně, staré při dotyku.
  - Poznámka:
- [ ] **K6** — Globální `:focus-visible` pravidlo, zákaz holého outline-none. Modály (ConfirmModal, MobileSheet) → nativní `<dialog>` / sdílený Dialog primitiv (focus trap, Esc, aria).
  - Poznámka:
- [ ] **S12** — Zrušit plošný min-height 44px hack v globals.css; touch target řešit v Button primitivu velikostí.
  - Poznámka:

## VLNA 4 — Škálování

- [ ] **K3+S9** — Serverové stránkování (cursor, 50/stránku) pro klienty, produkty, zakázky. Sortovatelné hlavičky. Klikatelné celé řádky tabulek.
  - Poznámka:
- [ ] **S7** — Jeden `/api/search` nad všemi entitami (klient, OP, zakázka, servisní zakázka, produkt, lead) s typovými badgi. CommandPalette jediný vstup; SidebarSearch smazat nebo trigger palety.
  - Poznámka:
- [ ] **S8** — Command palette: doimplementovat/odstranit ⌘1–⌘4, přimíchat příkazy do fuzzy výsledků, sekce „Nedávné".
  - Poznámka:

## VLNA 5 — Výjimečnost

- [ ] **V1** — Optimistic UI: seznamy zakázek, checkbox úkolu, komentáře, poznámky.
  - Poznámka:
- [ ] **V2** — Toast s „Zpět" (sonner action) pro vratné akce; confirm jen pro nevratné.
  - Poznámka:
- [ ] **V3** — Keyboard-first seznamy (↑/↓ či j/k, Enter, „e", „c"). Doimplementovat ⌘1–⌘4, „g d / g z" go-to.
  - Poznámka:
- [ ] **V4** — MobileSheet: slide-up transition, swipe-to-dismiss, Esc na desktopu, prefers-reduced-motion.
  - Poznámka:
- [ ] **V5** — Scroll restoration při návratu do seznamu (sessionStorage per pathname / přehodnotit vnitřní scroll kontejner).
  - Poznámka:
- [ ] **V6** — Smazat CSS @import Google Fonts a mrtvé Arial pravidlo (fonty přes next/font).
  - Poznámka:
- [ ] **V7** — KPI karty a pipeline řádky → filtrované seznamy (`/deals?stav=NABIDKA`…).
  - Poznámka:
- [ ] **V8** — Onboarding checklist pro prázdný STARTER tenant („3 kroky k první nabídce") nebo ukázková zakázka.
  - Poznámka:
- [ ] **V9** — Collapsed stav sidebaru bez flashe (inline script/cookie). Separator skupin v collapsed režimu.
  - Poznámka:
- [ ] **V10** — Přepínač hustoty tabulky (komfortní/kompaktní) + sticky thead.
  - Poznámka:
- [ ] **V11** — Tabulková čísla doprava + `font-variant-numeric: tabular-nums`.
  - Poznámka:
