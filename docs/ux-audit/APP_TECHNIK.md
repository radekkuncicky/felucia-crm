# AUDIT — Felucia Tech (appka pro techniky), 2026-11-14

**Zdroje:** kód appky `/var/www/felucia-tech` (HEAD 199fe68), snímky z `/root/screenshots-felucia-tech`,
dotazy do prod DB (jen čtení), webový průzkum (zdroje na konci).

## 0. Výchozí stav v číslech: appka se v terénu skoro nepoužívá
Stav NANTO k 2026-11-14 (prod DB, jen čtení):

| Měřítko | Hodnota |
|---|---|
| Zakázky s montáží za posledních 30 dní | **8** |
| Z toho s aspoň 1 fotkou | **0** (průměr 0,0 fotky na zakázku) |
| Z toho s aspoň 1 poznámkou | **0** (průměr 0,0) |
| Fotky celkem po měsících (6–11/2026) | 6: 3 · 7: 5 · 9: 20 (2 zakázky) · 10 a 11: 0 |
| Poznámky celkem po měsících | 6: 1 · 10: 1 |
| Servisy za 30 dní | 1, z toho s protokolem 0 a s podpisem 0 |
| Výkaz práce (od 2026-11-13) | 3 záznamy, 1 technik, 2 ze 3 zapsané do druhého dne |
| Technici se zapnutým výkazem | 3 ze 3 účtů (z toho 1 neaktivní, reálně 2: Radek K a Tomáš) |
| Zakázky s titulní fotkou (6 měsíců) | 2 z 57 |

**Co z toho plyne:** nejde o vyladění detailů. Appka zatím neprošla základním testem, jestli ji kluci
na stavbě vůbec otevřou. Proto jsou nejdůležitější body „Hlas techniků“ (sekce 4) a „Měření“ (sekce 6).
Pozor na malá čísla: 8 montáží za měsíc znamená, že jedna zakázka posune výsledek o 12 %.

### 0.1 Diagnostika: proč je využití nulové (prod DB, jen čtení, 2026-11-14)

**a) Viděli technici montáže v appce?** Ano, všech 8 montáží mělo přiřazeného technika i termín:

| Zakázka | Montáž | Stav dnes | Technik v CRM |
|---|---|---|---|
| 26-176 | 16.10. | **PŘIŘAZENA** | Radek K |
| 26-159 | 19.10. | V realizaci | Tomáš |
| 26-093 | 19.10. | **PŘIŘAZENA** | Tomáš |
| 26-153 | 21.10. | Vyúčtována | Radek K |
| 26-080 | 27.10. | Vyúčtována | Radek K |
| 26-144 | 28.10. | Hotovo | Tomáš |
| 26-099 | 3.11. | Hotovo | Tomáš + Radek K |
| 26-184 | 9.11. | **PŘIŘAZENA** | Tomáš |

U žádné ze tří tučně označených nikdo neklepl na „Zahájit práci“, přestože termín montáže už je pryč.
Ostatní stavy posouvala kancelář na webu.

**b) Kdo appku vůbec má** (`users.lastLoginAt` se nastavuje i při přihlášení z mobilu, `pushToken`, audit log):

| Uživatel | Role | Poslední přihlášení | Push token | Aktivita v appce za 60 dní |
|---|---|---|---|---|
| Radek K (Radkův technický účet) | TECHNIK | 13.11. | ano | 1× mobilní přihlášení, 2× změna zakázky |
| Tomáš Kahánek | TECHNIK | 1.11. | **ne** | 2× mobilní přihlášení, 4× úprava předáváku (naposledy 28.9.) |
| Tomáš Kahánek (druhý účet, neaktivní) | TECHNIK | nikdy | ne | – |
| **Veči** | – | **nemá účet** | – | – |

- **Veči v systému vůbec není.** Jeho montáže nemůže vidět a nikdy mu nebyly přiřazené.
  Nedá se tedy ani změřit, co dělá.
- **Tomáš nemá push token**, takže mu nechodí žádná upozornění, připomínka v 18:00 ani nové zakázky.
  Appka ho ničím nevolá zpátky.
- **Platforma a verze appky se zjistit nedají.** nginx pro mobilní API nemá přístupový log a server
  verzi appky neukládá. Android: memory eviduje otevřený bug s přihlášením na Androidu
  („Network request failed“) a appka není na Google Play. **Kdo z kluků má Android, appku reálně
  nemá.** Ověřit v rozhovoru.
- Doporučení (malá změna backendu, vlna 0): ukládat k uživateli `platform` a verzi appky
  při přihlášení a registraci push tokenu, aby šlo příště odpovědět z dat.

**c) Zářijová stopa:** 20 fotek nahrál **Tomáš**. Bylo to 9 fotek u 26-150 (14.9., v den montáže)
a 11 fotek u 26-160 (22.9., den po montáži), k tomu 4 úpravy předáváku do 28.9.
**Od té doby od něj žádná fotka.** Appku tedy umí a uměl ji používat, pak přestal. Proč, je
první otázka do rozhovoru. Data na to neodpoví: přestala appka fungovat (build, přihlášení),
nebo přestala dávat smysl?
Radek K nahrál poslední fotku 4.7.

**d) Jiné firmy:** appku reálně používá jen NANTO. Ostatní tenanty jsou `applereview` (testovací org
pro Apple, poslední přihlášení 14.9.), `demo` (nikdo se nepřihlásil), `dumnanovo` (poslední
přihlášení 30.3.) a `obsolete`. Zrušení Emailu a titulní fotky tedy nikoho dalšího nezasáhne.
Pozor: `applereview` je demo pro App Review a seed nesmí potřebovat zrušené funkce.

**Shrnutí do tří příčin:**

| Příčina | Platí? | Důkaz | Řešení |
|---|---|---|---|
| 1. Zakázky nejsou v appce | **Částečně** | 8/8 montáží přiřazeno, ale Veči nemá účet a externisté také ne | Kancelář: založit Večimu účet a přiřazovat ho. Bez kódu. |
| 2. Appku neotevírají | **Ano, hlavní příčina** | Tomáš: přihlášení 1.11., bez push tokenu, 3 montáže nikdo nezahájil. Android neověřen. | Instalace a přihlášení u všech, zapnout notifikace, dohoda (viz 0.2) |
| 3. Otevírají, ale nedokumentují | Zatím se nedá posoudit | Tomáš v září dokumentoval (20 fotek), pak přestal | Až tady pomůže UX (vlny 1–2) a rozhovor |

### 0.2 Kde UX nepomůže: dohoda, ne kód
Firma má tři montéry a jeden z nich je majitel. Žádný redesign nevyřeší „nemusím“.
**Nejlevnější pokus (0 řádků kódu, 2 týdny):**
- Pravidlo: fotky z montáže jsou v appce a nikde jinde (ne ve WhatsAppu, ne v galerii).
- Radek nebo vedoucí zakázky na každou fotku a poznámku do druhého dne nějak zareaguje
  (komentář, telefonát). To je bod 7 z průzkumu v praxi.
- **Radek a Tomáš jdou příkladem.** Když appku nepoužívá spolumajitel ani majitel
  (Radek K: poslední fotka 4.7.), nebudou ji používat ani zaměstnanci.
- Po 2 týdnech pustit dotazy ze sekce 6 a porovnat se sekcí 0.

## 1. Co říká průzkum
1. Když technici appku nepoužívají, je to skoro vždy chyba návrhu, ne školení.
   Otravnou appku obcházejí (SMS, papír) a vedení pak nemá data.
2. Rychlost hlavního úkolu má přednost před počtem funkcí. Na každé zakázce se opakuje 5 akcí
   (otevřít, jet, vyfotit, poznamenat, uzavřít) a ty musí jít jedním palcem.
3. Prostředí: rukavice, slunce, špína. Velké dotykové plochy (48–56 px), vysoký kontrast,
   žádné stíny, nespoléhat jen na barvu, žádná skrytá gesta.
4. Diktování a rychlé volby místo psaní.
5. Krátké formuláře. Nepřenášet papír 1:1.
6. Offline jako samozřejmost, klidná zpráva, žádný poplach.
7. Ukázat technikům, k čemu jejich fotky a poznámky slouží. Když poznámky nikdo nečte, přestanou je psát.

## 2. Co zachováme
Sticky lišta u palce s „dalším krokem“ (`components/AkcniLista.tsx`), hero „Další zastávka“ na Dnes,
offline fronta (`lib/outbox.ts`), optimistické zaškrtávání, podpis na celou obrazovku, kamera z lišty.

## 3. Nálezy a návrhy
Formát: **Dnes → Návrh → Proč → Přínos oproti dnešku.**

### H. Servis: chybí data, která server už posílá (VLNA 0, chyba)
- **Dnes:** od 2026-09-20 API vrací `popis`, `priorita` (URGENTNÍ), `adresaZasahu`, `kontaktJmeno`
  a `kontaktTelefon`. Appka nic z toho nezobrazuje (`app/servis/[id].tsx`, `components/ServisCard.tsx`).
- **Návrh:** štítek URGENTNÍ v seznamu i detailu, popis závady připnutý nahoře. Navigace na
  `adresaZasahu` (fallback adresa klienta), volat `kontaktTelefon` (fallback telefon klienta).
- **Proč:** technik může jet na fakturační adresu místo na místo zásahu. Je to chyba, ne kosmetika.
- **Přínos:** správné místo a správný člověk. Jen zobrazení, beze změny backendu. **Samostatný build hned.**

### A. Hodiny a km z karty zakázky pryč, nová obrazovka „Konec dne“ (VLNA 1)
- **Dnes:** `VykazSection` je uprostřed detailu zakázky (`app/zakazka/[id].tsx:603`) i servisu,
  i se sazbami a editací záznamů.
- **Návrh:**
  1. Sekci z detailu zakázky i servisu **odstranit**.
  2. **Nová obrazovka `app/konec-dne.tsx`:** dnešní zakázky a servisy. U každé položky hodiny a km.
     **Políčka jsou prázdná, bez předvyplnění.** Klepnutí na číslo otevře numerickou klávesnici
     (`decimal-pad` pro hodiny, `number-pad` pro km). Tlačítka +/− slouží jen k doladění
     (hodiny ±0,5, km ±5). Tlačítko „Uložit den“ uloží jen vyplněné řádky. Prázdný řádek se neuloží
     a souhrn před uložením ukáže, co zůstalo nezapsané.
  3. **Km se zapisují na zakázku** (doprava se dá přeúčtovat klientovi a vstupuje do kalkulace).
     DB se nemění, záznam zůstává `VykazPrace` na zakázce nebo servisu.
  4. Večerní připomínka v 18:00 a blok „Dnes nezapsáno“ vedou na Konec dne (`lib/notifications.ts`).
  5. **Panel „Zapsat výjezd?“ po dokončení zakázky se zatím nedělá.** Jedno místo zápisu znamená
     jeden zdroj pravdy. Pokud po měsíci měření ukáže zapomenuté zápisy, přidá se.
  6. `app/vykaz.tsx` (souhrn, fakturace, PDF) přejde do záložky Výkaz (viz G).
- **Proč:** detail slouží k práci u klienta. Hodiny jsou administrativa za den. Předvyplněná čísla
  jsou past: klepnutí na „Uložit“ beze změny by uložilo včerejší hodnoty. Krokovač na 60 km
  znamená 12 klepnutí.
- **Přínos:** kratší detail, celý den zapsaný na jednom místě a žádná falešná data.
- **Rozhodnuto:** Konec dne je výchozí pro všechny techniky. Hodiny na zakázku jsou podklad
  i pro kalkulaci a výsledovku, nejen pro fakturaci techniků. Přepínač „Zapisovat hodiny a km“
  zůstane pro firmy, které to nechtějí.

### K. Klidný pruh při výpadku signálu (VLNA 1, jen text a barva)
- **Dnes:** červený pruh „Jste offline — zobrazují se poslední data“ (`app/zakazka/[id].tsx:440`).
- **Návrh:** neutrální nebo jantarový pruh „Bez signálu — změny se odešlou samy“, s počtem čekajících
  změn z outboxu. Náhrada blokujících Alertů za toasty až ve vlně 3.
- **Přínos:** méně stresu ve sklepě a důvěra, že se nic neztratilo.

### C. Pryč s duplicitami a zbytečnostmi (VLNA 1)
| Zrušit | Důvod | Náhrada |
|---|---|---|
| Karta „Přidat titulní fotku“ nahoře v detailu | Zabírá nejlepší místo, má ji 2 z 57 zakázek | Volba „Nastavit jako titulní“ ve Fotkách |
| Tlačítko „Email“ klientovi | Technik klientovi nemailuje; kdyby chybělo, vrácení je pár řádků | – |
| „Navigovat na stavbu“ / „Zavolat“ v kartách | Stejné akce jsou ve sticky liště | Lišta |
| Samostatná karta „Předávací protokol“ | Totéž dělá „další krok“ v liště | Štítek stavu v hlavičce |
| Long-press foto = galerie | Skryté gesto | Tlačítko „Z galerie“ ve Fotkách |
| „Checklist je prázdný — položky přidá manažer v desktopu“ | Technika to neodblokuje | Prázdnou sekci skrýt |

**Titulní fotka na webu** (grep CRM): používá ji jen hlavička detailu zakázky
(`app/(dashboard)/zakazky/[id]/layout.tsx:201`, nahrání `TitulniFotoUpload.tsx`) a appka Sales v referencích
(`app/api/mobile/obchod/reference/route.ts`, kde se při chybějící titulní bere první fotka).
**V PDF, nabídkách ani seznamech na webu se nepoužívá.** Data: 2 z 57 zakázek za 6 měsíců.
Doporučení pro web: nechat, jak je. Neškodí a Sales ji umí nahradit první fotkou. Rušit nic nemusíme.

### F. Dnes = celý den včetně servisů (VLNA 1)
- **Dnes:** záložka Dnes ukazuje jen zakázky. Servisy, které má technik od d2e9486 jako výchozí,
  jsou jen v záložce Servis.
- **Návrh:** jedna časová osa (zakázky i servisy podle času), hero zůstane, nahoře „1 / 3 hotovo“.
  Od 15:00 karta „Konec dne“, dokud den není zapsaný.
- **API:** `GET /api/mobile/dnes` (`app/api/mobile/dnes/route.ts`) dostane **jen nové pole**
  (`servisy`). Stávající pole zůstanou beze změny, takže starší verze appky nespadnou.
  Pořadí: **nejdřív nasadit CRM, pak build appky.** Zvýšit `CACHE_VERZE` v appce (`app/_layout.tsx`).
- **Přínos:** jedna obrazovka na celý den a pocit odvedené práce.

### D. Poznámky: rychlé štítky a hlavně aby je někdo četl (VLNA 1 + 2)
- **Dnes v appce:** malé pole až na konci stránky, úprava jen long-pressem. Oprávnění k mikrofonu je
  v `app.json`, ale nic ho nepoužívá.
- **Dnes v CRM (ověřeno):** poznámka z appky (`POST /api/mobile/zakazka/[id]/komentar`) se uloží
  do `zakazka_komentare` a **na webu je vidět jen v záložce Historie** (`HistorieTab`, smíchaná
  s auditním logem). Záložka je jen pro uživatele s právem editace. **Nikdo nedostane upozornění.**
  Manažer se o poznámce dozví, jen když Historii sám otevře. Odpovídá to i datům:
  2 poznámky za půl roku.
- **Návrh:**
  1. **(Vlna 1, CRM)** Nová poznámka od technika pošle bell notifikaci vedoucímu zakázky,
     případně manažerovi. Poslední poznámky technika se ukážou v záložce Přehled detailu zakázky,
     ne jen v Historii.
  2. **(Vlna 1, appka)** Rychlé štítky jedním klepnutím: „Chybí materiál“, „Zákazník nebyl doma“,
     „Nedodělek“, „Hotovo bez závad“. Odešlou se jako poznámka a dají se doplnit textem.
  3. **(Vlna 2)** Poznámky jako vlastní segment detailu, úprava a mazání přes viditelné ⋯.
  4. **Diktát:** tlačítko „Nadiktovat“ ve fázi 1 **nedělat**. iOS neumí z appky spustit diktování
     klávesnice, takže by jen otevřelo klávesnici a technik by stejně klepal na mikrofon.
     Fáze 2 (přepis přímo v zařízení, `expo-speech-recognition`) až po testu češtiny v hluku na stavbě.
- **Proč:** psaní v rukavicích nefunguje, a když poznámky nikdo nečte, technici přestanou psát.
- **Přínos:** poznámky dorazí k manažerovi a ten nemusí při vyúčtování volat, co se dělo.

### B. Detail zakázky: z 11 karet pod sebou na strukturu podle práce (VLNA 2)
- **Dnes:** titulní fotka, hlavička, adresa, klient, tým, hodiny, kontakty, položky, dokumenty a pokyny,
  předávák, fotky, komentáře. Je to 6–8 obrazovek posouvání. Pokyny manažera jsou 9., checklist 8.
- **Návrh:** kompaktní hlavička, připnuté **Pokyny** (pokud jsou) a segmenty
  **Práce · Fotky · Poznámky · Info**.
  - Práce = checklist a dokumenty
  - Fotky = fotodokumentace, galerie, nastavení titulní fotky
  - Info = adresa (s úpravou), klient, kontakty na stavbě, tým
- **Přínos:** pokyny vidí každý a k checklistu se nemusí posouvat.

```
┌──────────────────────────────┐
│ ‹  26-901   Montáž klima 3+kk │
│ V realizaci · dnes 8:00       │
│ ┌ POKYNY ─────────────────┐   │
│ │ Venkovní jednotka na    │   │
│ │ konzoli, klíč u souseda │   │
│ └─────────────────────────┘   │
│ [Práce][Fotky 4][Pozn.][Info] │
│ ☐ Daikin Perfera 3,5 kW  1 ks │
│ ☑ Konzole                1 ks │
├──────────────────────────────┤
│ ➤Navigovat ☎Volat 📷Foto      │
│ [   ✓ Dokončit předávák    ]  │
└──────────────────────────────┘
```

### E. Barvy Felucie, natvrdo světlý režim (VLNA 2)
- **Dnes:** azurová `#00D4C8`, fialová `#7B2FBE` a tmavě modrá `#0A0F1E` (`lib/constants.ts`, `lib/theme.tsx`).
  Na webu je zelená. Režim se řídí systémem.
- **Návrh:** **jen světlý režim** (kvůli slunci). Tmavý režim a přepínač „Vzhled“ v Já se ruší,
  `ThemeProvider` vždy vrací světlou paletu. Zelená Felucie: na tlačítkách `#2E7D32` s bílým textem
  (kontrast 5,13 : 1, splňuje WCAG AA). Bílá na `#4CAF50` má jen 2,78 : 1, takže `#4CAF50`
  zůstane pro plochy a ikony. Fialovou zrušit. Barva stavu jen jako doplněk k textu a červená jen
  pro problém. Dnes je „Nová“ zakázka červená, takže vypadá jako chyba.
- **Přínos:** jedna značka napříč web, Sales a Tech, čitelnost na slunci a o polovinu méně
  barevných variant k údržbě.

### G. Záložky: Dnes · Práce · Výkaz · Já (VLNA 2)
- Práce = jeden seznam se segmentem Zakázky / Servis a filtrem stavu.
- Výkaz = souhrn, fakturace a PDF (dnešní `app/vykaz.tsx`). Skrytý, když je výkaz vypnutý.
- **Přínos:** fakturace má vlastní místo a nepřekáží v práci.

### I. Čitelnost a dotykové plochy (VLNA 2)
- **Dnes:** nadpisy sekcí mají 11 px, tělo 13 px. Telefony v Týmu jsou 13px odkazy bez větší plochy.
  Ikony v liště nemají popisky. Hero má stín.
- **Návrh:** tělo min. 16 px, meta 13 px. Cíle min. 48 px, primární tlačítka 56 px. Popisky pod ikonami
  v liště. Bez stínů. **Respektovat velikost písma nastavenou v telefonu** (`allowFontScaling`
  nechat zapnuté, rozložení otestovat na největší systémové velikosti, `maxFontSizeMultiplier`
  jen tam, kde by se rozpadla lišta). Starší technici mívají písmo zvětšené.
- **Přínos:** méně klepnutí vedle v rukavicích a čitelnost na slunci i se zvětšeným písmem.

### J. Okamžik dokončení (VLNA 3)
Po podpisu předáváku potvrzení „Zakázka předána ✓“ se shrnutím a „Další zastávka: …“.
Upozornění „manažer schválil tvůj předávák“. Na Já přehled za měsíc.
Motivuje vidět výsledek, ne sbírat body.

### L. Splash a ikona (VLNA 3)
Sjednotit se značkou (dnes pozadí `#0A0F1E`).

## 4. Hlas techniků (CHYBĚLO, před vlnou 2 povinně)
- **Vlna 0,5, před vlnou 1:** krátký rozhovor s Tomášem a Večim (10 min každý, ideálně u auta
  s telefonem v ruce). Otázky:
  - Tomáš: proč jsi po září přestal fotit do appky? Nefungovala, nebo nedávala smysl?
  - Veči: jaký máš telefon (Android?) a chceš appku vůbec mít?
  - Oba: co děláte místo appky (WhatsApp, foťák, papír)? Co by vás přimělo ji používat?
    Mailujete někdy klientovi?
- **Před vlnou 2:** klikací HTML prototyp nového Dnes a detailu ukázat aspoň dvěma klukům.
  Úkoly: „najdi pokyny“, „vyfoť a pošli poznámku“, „zapiš dnešní den“. Měřit, kde zaváhají.
- Výsledek dopsat sem jako sekci „Co řekli technici“ a podle ní upravit vlnu 2.

## 5. Pořadí vln
| Vlna | Obsah | Nasazení |
|---|---|---|
| **0** | H (data servisu) + ukládání platformy a verze appky při přihlášení | samostatný build appky hned, malá změna CRM |
| **0,5 — diagnostika + rozhovory** | Večimu účet, u všech instalace, přihlášení a zapnuté notifikace (Android ověřit), rozhovory s Tomášem a Večim (sekce 4), start 2týdenní dohody (0.2) | bez kódu; výsledek dopsat do auditu, podle něj upravit vlnu 1 |
| **1** | A (Konec dne, hodiny pryč z detailu), K (pruh offline), C (úklid), F (servisy v Dnes), D1+D2 (notifikace a Přehled v CRM, rychlé štítky) | nejdřív CRM deploy (`dnes` + notifikace poznámek), pak build appky |
| **2** | po rozhovorech a prototypu: E (světlá zelená), B (nový detail), G (záložky), I (písmo), D3 | build appky |
| **3** | J, L, toasty místo Alertů, D4 (přepis v zařízení po testu češtiny) | build appky |

## 6. Měření (jak poznáme, že to pomohlo)
Měřit pro NANTO, vždy za 30 dní po nasazení vlny, porovnat s výchozím stavem v sekci 0.

| Měřítko | Výchozí stav | Cíl po vlně 1 | Cíl po vlně 2 |
|---|---|---|---|
| Podíl montáží s aspoň 1 fotkou z appky | 0 / 8 | ≥ 50 % | ≥ 80 % |
| Průměr fotek na montáž | 0,0 | ≥ 3 | ≥ 5 |
| Podíl montáží s aspoň 1 poznámkou technika | 0 / 8 | ≥ 30 % | ≥ 50 % |
| Výjezdy s výkazem zapsaným do druhého dne | 2 / 3 (1 den dat) | ≥ 80 % | ≥ 90 % |
| Servisy s dokončeným protokolem z appky | 0 / 1 | ≥ 70 % | ≥ 90 % |

Dotazy jsou jednoduché SELECTy nad `zakazky`, `zakazka_fotky`, `zakazka_komentare`, `vykaz_prace`
a `servisni_zakazky`. Při dalším auditu je pustím znovu. Když bude objem malý, sčítat 60 dní.

## 7. Rozhodnuto (2026-11-14)
- Panel „Zapsat výjezd?“: zatím ne, jen Konec dne.
- Email klientovi: zrušit.
- Titulní fotka: z detailu v appce pryč (zůstává volba ve Fotkách), web beze změny.
- Režim: natvrdo světlý, tmavý se ruší.
- Km: na zakázku.
- Konec dne: výchozí pro všechny techniky (přepínač zůstane).
- Notifikace poznámky technika: dostane ji vedoucí zakázky, když zakázka vedoucího nemá, tak manažer.
  Obchodník ne (byl by to šum).

## 8. Otevřené
- Výsledek rozhovorů a 2týdenní dohody (vlna 0,5) → podle něj upravit vlnu 1.
- Druhý, neaktivní účet Tomáše Kahánka: smazat, nebo nechat?

## Zdroje
- [Skedulo – What do field service techs want in a mobile app](https://www.skedulo.com/blog/what-do-field-service-techs-want-in-mobile-app.md)
- [fieldservicesoftware.io – Mobile FSM best practices](https://fieldservicesoftware.io/blog/mobile-fsm-best-practices/)
- [Fieldproxy – Technician app experience makes or breaks adoption](https://www.fieldproxy.ai/blog/mobile-first-fsm-why-technician-app-experience-makes-or-breaks-adoptio-d1-31)
- [MangoApps – Why technicians work around field service software](https://www.mangoapps.com/articles/why-technicians-work-around-field-service-software)
- [Glance – Designing apps for construction workers](https://thisisglance.com/learning-centre/how-should-i-design-apps-for-construction-workers)
- [Outdoors – Mobile interface legibility](https://outdoors.nordling.de/area/mobile-interface-legibility.md)
- [Oxmaint – Mobile work order app field workflow](https://oxmaint.com/industries/fleet-management/fleet-technician-mobile-work-order-app-field-workflow)
- [Jobber – Field documentation](https://www.getjobber.com/features/field-documentation-software/)
- [Capterra – ServiceTitan reviews](https://www.capterra.com/p/150053/ServiceTitan/reviews/) · [SplitMetrics – ServiceTitan Mobile](https://splitmetrics.com/apps/servicetitan-mobile/id1037989976)
- [Housecall Pro review](https://hvac-software-hub.pages.dev/hvac/crm/housecall-pro-review)
- Většina zdrojů jsou blogy dodavatelů FSM softwaru. Ber je jako směr, ne jako tvrdá data.
