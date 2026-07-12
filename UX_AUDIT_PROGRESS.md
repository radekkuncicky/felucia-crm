# UX Audit — postup oprav

Stav oprav podle UX auditu z 12. 7. 2026 (artefakt: https://claude.ai/code/artifact/e2013ee4-5dcb-4426-9294-c6b15ab92bc8).
Legenda: `[ ]` pending · `[~]` in-progress · `[x]` done

Pravidla: před začátkem úkolu označit `[~]` + commit `start: <ID>`; po dokončení `[x]` + poznámka + commit. Po každém úkolu lint + typecheck. Pořadí: vlny 1→5, uvnitř vlny shora dolů.

## VLNA 1 — Důvěra

- [ ] **K2** — Sdílený `lib/api.ts` s `apiFetch()` (auto `toast.error` při chybě). Nahradit tichá fetch volání (RychlaPoznamka, EtapySection, PipelineBar, FotoTab, MontazDatePicker, InlineStatusBadge, modul servis…). Optimistic UI vždy rollback + toast.
  - Poznámka:
- [ ] **S1** — Smazat 6 vlastních Toast implementací (PredavakClient, ProfileClient, UsersManager, DealActions, BillingActions, BillingClient), všude sonner. DealsKanban inline banner → toast.
  - Poznámka:
- [ ] **K7** — `confirm()` v ZakazkaDetailClient → `confirmDialog()`. Projít kód, nahradit další confirm()/alert(). ESLint `no-restricted-globals` pro confirm/alert.
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
