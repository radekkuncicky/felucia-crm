# Homepage felucia.io - zadání redesignu

ROZHODNUTÍ
- NANTO jmenovat jako firmu, kde Felucia vznikla a běží: NE. Píše se jen "vyvinuto v provozu montážní firmy".
- Mobilní aplikace: iOS v App Store (ID 6779400065). Android uvádět jako "připravujeme".
- Felucia Sales (obchodní aplikace): nezmiňovat.
- Ceny: uvádět bez DPH, za firmu a měsíc.

ZMĚNY PO AUDITU (2026-10-01, mají přednost před původním zadáním; zadání níže je podle nich už upravené)
1. ABRA Flexi: na webu nikde. Řetěz dokladů končí ... -> VYU -> servis. Vypadává z kroku 5, sekce 6.5, mřížky detailů a hero smyčky.
2. Ukázková zakázka je 26-101. Všechny doklady jsou v řadě 101 ve formátech z facts: OP-26-101, NAB-26-0101, SOD-26-101, zakázka 26-101, PP-26-101, VYU-26-101, servisní zakázka SZ-26-0101, kontrakt SK-26-101. Všechna data jsou smyšlená.
3. Podpis: vždy "elektronický podpis ověřený SMS kódem", nikdy "certifikovaný", nikdy Documenso. Dostupnost: Professional a Enterprise v ceně; Standard příplatek 99 Kč za licenci měsíčně, do 100 smluv měsíčně; Starter ne. Uvést u kroku Smlouva, v mřížce detailů i v ceníku. Důkaz podpisu (facts bod 3) ukázat v SodMock i v mřížce detailů: "Ke každému podpisu klienta se uloží čas, telefonní číslo ověřené SMS kódem, IP adresa a otisk dokumentu." Netvrdit nic, co se neukládá. Na webu žádné právní výklady.
4. Šablony SOD: "náhled", ne "živý náhled".
5. Role existují jen: Správce, Manažer zakázek, Obchodník, Hlavní technik, Technik. "Vedoucí" je pole na zakázce, ne role. Naskladňuje Správce nebo Manažer zakázek (oprávnění sklad - plný přístup). Předávací protokol zakládá Technik nebo Hlavní technik. Protokol i vyúčtování schvaluje Manažer zakázek nebo Správce (oprávnění schvalování).
6. Dáša: ukázková konverzace jen s akcemi nad OP, klienty, nabídkami, aktivitami a stavem OP. Žádné přesouvání termínů, žádné e-maily. Limity z lib/dasaLimits.ts. O AI a osobních údajích web nic netvrdí, ani v sekci Data a důvěra.
7. Podpis ve Felucia Tech: políčko na displeji telefonu na výšku, ne celá obrazovka na šířku.
8. Offline, přesné znění: "Bez signálu se uloží odškrtnuté položky, komentáře, fotky i servisní protokol. Podpis a změnu stavu technik dokončí, až bude online."
9. Ceny a technik: tvrzení platí jen pro montáž ("Při montáži technik ceny nevidí."). Nikde netvrdit, že technik ceny nevidí obecně (servisní protokol v appce má pole Práce (Kč) a Materiál (Kč)).
10. Android: "připravujeme", bez odkazu na Google Play.
11. Servisní modul: jen Professional a Enterprise. Uvést v sekci Servis i v ceníku.
12. Ceny: bez DPH, za firmu a měsíc.
13. Další rozpory podle facts (tvrdit jen ověřené):
   a) Přirážka v Kč nebo % při naskladnění neexistuje - z webu vypadává.
   b) Stav materiálu NASKLADNENO se v aplikaci jmenuje "Rezervováno". Stavy na webu: Čeká, Objednáno, Rezervováno, Vydáno.
   c) Předávací protokol má v aplikaci sloupce "Plánováno" a "Použito"; rozdíl aplikace sama nezobrazuje. Ukázka používá "Plánováno (z nabídky)", "Použito" a rozdíl jako zvýraznění ukázky, ne jako sloupec aplikace.
   d) Stavy schvalování: protokol Rozpracován -> Podepsán -> Schválen (nebo Odmítnuto); vyúčtování Návrh -> Ke schválení -> Schváleno. Vyúčtování vzniká automaticky při schválení protokolu, s množstvím "Použito".
   e) Zakázka vzniká automaticky po podpisu SOD (OP přejde na Úspěch) a přebírá klienta, technologii, vedoucího a položky aktivní nabídky. Smlouva zůstává u obchodního případu, zakázka na něj odkazuje.
   f) Ceník = cenová hladina nad katalogem produktů; nabídka se skládá z položek katalogu (materiál i práce) s cenami podle zvoleného ceníku.
   g) API: API klíče pro příjem poptávek a odchozí webhooky jsou ve všech plánech; obecné REST API neexistuje. White-label = vlastní vzhled záhlaví a patičky dokumentů, jen Professional a Enterprise.
   h) Felucia Tech: záhlaví "Můj den", tlačítka "Navigovat na stavbu" a "Zavolat", záložky Dnes, Zakázky, Servis, Já. Zápis práce = komentáře a poznámka protokolu, výkaz hodin aplikace nemá.
   i) Dáša je dostupná ve Standard, Professional i Enterprise; jednotka limitu je kredit, ne dotaz.

=== ZADÁNÍ ===

1. PROČ PŘEDĚLÁVKA
Současná homepage je návod v 9 krocích se screenshoty. Screenshoty hustého rozhraní jsou v měřítku stránky nečitelné, vypadají jako generický admin a neukazují pointu. Stránka popisuje, kde se co kliká, ale neříká, proč se to firmě vyplatí.

2. PRO KOHO
Cílovka:
- majitel nebo provozní ředitel montážní a servisní firmy (tepelná čerpadla, klimatizace, rekuperace, podlahové vytápění, vzduchotechnika)
- firma o 3 až 30 lidech, kancelář plus technici v terénu
- dnes jede na Excelu, e-mailu, papírových předávácích a WhatsAppu, případně na obecném CRM, které nezná montáž
- není to IT člověk a často čte na mobilu mezi zakázkami

3. GRO
Felucia drží jednu zakázku v jednom záznamu od poptávky po servis. Data se zadají jednou a dál jen tečou:
- co obchodník prodal, to technik namontuje
- co technik skutečně použil, to se vyúčtuje
- co se namontovalo, to se servisuje

Cíle stránky:
- Do 10 sekund návštěvník pochopí, co to je, pro koho to je a proč to šetří peníze.
- Do dvou minut scrollování projde celý tok zakázky a uvidí každý podstatný detail.
- Jediná konverze: domluvit 20minutovou ukázku.

4. VIZUÁLNÍ MOTIV: ŘETĚZ DOKLADŮ
Celým webem prochází jeden ukázkový zákazník a jeho doklady v monospace štítcích:
poptávka -> OP-26-101 -> NAB-26-0101 -> SOD-26-101 -> zakázka 26-101 -> PP-26-101 -> VYU-26-101 -> servis
- Formáty čísel převezmi z kódu (facts bod 16), vše v řadě 101.
- Štítky jsou vizuální podpis Felucie: ukazují jeden propojený záznam, ne hromadu oddělených modulů.

Jednotná ukázková data napříč webem:
- zákaznice: Jana Nováková, rodinný dům, Ostrava-Poruba
- zařízení: tepelné čerpadlo vzduch-voda 9 kW
- nabídka: 248 600 Kč bez DPH
- technik: Petr Svoboda
- termín montáže: čt 15. 10.

5. NÁHRADA SCREENSHOTŮ
Žádné screenshoty ani fotky obrazovek. Každá ukázka produktu je kódovaná komponenta:
- zjednodušený, zvětšený výřez skutečného rozhraní se 3 až 6 prvky, které nesou pointu dané sekce
- skutečné názvy polí, stavů a tlačítek z aplikace
- klíčový prvek zvýrazněný (např. rozdíl 10 m -> 12 m)
- ostrá v každém rozlišení a čitelná na mobilu
- obrazovky Felucia Tech v jednoduchém CSS rámu telefonu
- role="img", aria-label s popisem a malý štítek "Ukázková data"

6. STRUKTURA STRÁNKY

6.1 Hlavička (sticky, po scrollu s pozadím)
- Odkazy: Jak to funguje (#jak-to-funguje), Technici (#technici), Servis (#servis), Funkce (#funkce), Ceny (#ceny), FAQ (#faq), Přihlásit se (/auth/signin).
- Tlačítko Domluvit ukázku (#ukazka).
- Na mobilu menu v panelu, tlačítko ukázky zůstává viditelné.

6.2 Hero
Texty:
- Nadtitulek: Systém pro montážní a servisní firmy
- H1: Co prodáte, to se namontuje. Co se použije, to se vyúčtuje.
- Podtitulek: Felucia drží celou zakázku v jednom záznamu - od poptávky přes smlouvu, sklad a práci technika až po vyúčtování a pravidelný servis. Pro firmy v oboru tepelných čerpadel, klimatizací a rekuperací.
- Tlačítka: Domluvit 20minutovou ukázku (primární), Projít zakázku krok za krokem (sekundární, #jak-to-funguje).
- Pod tlačítky drobně: Bez závazků. Osobní rozhovor o vašem provozu.

Vizuál "živá zakázka" (vpravo, na mobilu pod textem):
- Jedna karta, která se proměňuje stavy:
  poptávka -> OP-26-101 -> NAB-26-0101 (TČ 9 kW, 248 600 Kč) -> SOD-26-101 podepsána (2 podpisy, ověřeno SMS kódem) -> zakázka 26-101 (termín, technik) -> materiál vydán (14/14) -> technik na místě (6 fotek) -> protokol PP-26-101 (potrubí 10 m -> 12 m) -> VYU-26-101 schváleno -> servisní prohlídka naplánována
- Pod kartou lišta šesti fází: Obchod, Smlouva, Příprava, Montáž, Předání, Servis. Aktivní fáze je zvýrazněná a kliknutím se dá přepnout.
- Automatický posun zhruba 2,5 s na stav, pauza při najetí myší nebo fokusu, tlačítko pauza/přehrát.
- Při prefers-reduced-motion statický stav "kompletní zakázka" se všemi štítky.

Pod hero statický pás oborů: Tepelná čerpadla, Klimatizace, Rekuperace, Podlahové vytápění, Vzduchotechnika, Servisní kontrakty.

6.3 Kde utíkají peníze
H2: Kde montážním firmám utíkají peníze
Čtyři karty (titulek, jedna až dvě věty, drobný odkaz na krok, který to řeší):
- Materiál navíc, který nikdo nevyúčtuje. V nabídce 10 m potrubí, na stavbě padlo 12 m. Dva metry zmizí, pokud je technik nenapíše a kancelář nedohledá.
- Technik volá do kanceláře. Adresa, kontakt, co se přesně prodalo, jestli je materiál připravený.
- Smlouvy na papíře. Tisk, podpis, sken, e-mail a pak hledání, která verze platí.
- Servis, na který se zapomene. Zařízení bez naplánované prohlídky je zákazník, kterého za dva roky obslouží někdo jiný.
Žádná vymyšlená čísla.

6.4 Jak to funguje (#jak-to-funguje)
H2: Jedna zakázka od poptávky po servis
Podtitulek: Obchod, kancelář, sklad i technici pracují nad stejnými daty. Každý krok přebírá to, co vzniklo v předchozím.

Interaktivní průvodce se šesti záložkami:
- role="tablist", ovládání šipkami, Home a End
- desktop: záložky vlevo, ukázka vpravo
- mobil: pilulky s vodorovným posunem uvnitř vlastního kontejneru
- každá záložka obsahuje: kdo pracuje (názvy rolí podle facts), 2 až 3 body, ukázku a řádek "Přechází dál:"

Záložky:
1 Obchod (Obchodník)
- Lead jedním kliknutím na obchodní případ, údaje klienta se převezmou, hlídání duplicit.
- Nabídka z položek materiálu a práce z katalogu s cenami podle ceníku, nebo zkopírovaná z jiného případu.
- PDF nabídky ve vlastním designu firmy.
- Přechází dál: klient, adresa díla, položky nabídky.

2 Smlouva (Obchodník a klient)
- SOD vygenerovaná ze šablony s proměnnými.
- Elektronický podpis ověřený SMS kódem: podepíše firma i klient, na počítači nebo mobilu.
- Podepsané PDF uložené u případu.
- Dostupnost podpisu: Professional a Enterprise v ceně, Standard za příplatek 99 Kč za licenci měsíčně (do 100 smluv), Starter ne.
- Přechází dál: podepsaný rozsah díla.

3 Příprava (Manažer zakázek, Hlavní technik)
- Zakázka vznikne automaticky po podpisu smlouvy a převezme klienta a položky nabídky.
- Termín, technik a vedoucí zakázky.
- Materiál ve stavech Objednáno -> Rezervováno -> Vydáno; naskladňuje Manažer zakázek.
- Přechází dál: co přesně a kde montovat.

4 Montáž (Technik)
- Aplikace Felucia Tech: Můj den, navigace, kontakt, podklady.
- Odškrtávání položek, skutečně použitý materiál, komentáře a fotky.
- Při montáži technik ceny nevidí.
- Přechází dál: skutečně provedená práce a použitý materiál.

5 Předání a vyúčtování (Technik, Manažer zakázek)
- Předávací protokol plán vs skutečnost, podpis klienta na displeji telefonu.
- Manažer zakázek protokol schválí a vyúčtování vznikne z protokolu se skutečně použitým množstvím.
- Manažer zakázek vyúčtování zkontroluje a schválí.
- Přechází dál: namontovaná zařízení.

6 Servis (Technik, Manažer zakázek; jen Professional a Enterprise)
- Zařízení se zárukou, kontrakty, plánované prohlídky.
- Servisní zakázka v šesti fázích (názvy z kódu).
- Přechází dál: další prohlídka a další zakázka.

6.5 Plán vs skutečnost (zvýrazněná sekce)
H2: Nabídka 10 m. Použito 12 m. Vyúčtováno 12 m.
Text:
- Technik zapíše skutečně použitý materiál přímo na místě. Předávací protokol ho porovná s nabídkou, Manažer zakázek rozdíl zkontroluje a schválí a vyúčtování vznikne z protokolu. Nic se nedohledává zpětně.
- Při montáži technik ceny nevidí. Konečné vyúčtování kontroluje a schvaluje Manažer zakázek.
Vizuál:
- velký výřez protokolu PP-26-101: 4 až 5 položek se sloupci Plánováno (z nabídky) / Použito a zvýrazněným rozdílem
- řádek potrubí zvýrazněný (+2 m)
- pod tím stavy Podepsán -> Schválen -> VYU-26-101 Návrh -> Schváleno (názvy stavů z kódu)

6.6 Kancelář a terén (#technici)
H2: Kancelář vidí celou zakázku. Technik jen to, co potřebuje na stavbě.
Vlevo desktopová ukázka zakázky 26-101:
- termín, adresa, technik, vedoucí
- stav materiálu
- stavový pruh
Vpravo telefon s Felucia Tech a přepínačem obrazovek:
- Můj den
- Detail zakázky (adresa s navigací, kontakt, podklady)
- Materiál (bez cen)
- Fotky
- Podpis zákazníka (políčko na displeji na výšku)
Body pro techniky:
- vše k zakázce v telefonu
- navigace jedním klepnutím
- zápis práce a materiálu
- fotky
- podpis zákazníka na displeji
- offline přesně: "Bez signálu se uloží odškrtnuté položky, komentáře, fotky i servisní protokol. Podpis a změnu stavu technik dokončí, až bude online."
Odznak App Store s funkčním odkazem na aplikaci ID 6779400065. Android: "připravujeme", bez odkazu na Google Play.

6.7 Servis (#servis)
H2: Montáží zakázka nekončí.
Text: Každé namontované zařízení zůstává v evidenci u zákazníka i původní zakázky - se zárukou, historií zásahů a servisním kontraktem. Felucia hlídá termíny prohlídek a technik zapíše zásah v telefonu.
Vizuál:
- karta zařízení: typ, výrobní číslo, datum montáže, záruka do, kontrakt, poslední a další prohlídka
- lišta šesti fází servisní zakázky
Drobně uveď: servisní modul je v plánech Professional a Enterprise.

6.8 Detaily (#funkce)
H2: Detaily, na kterých to v praxi stojí
Mřížka 12 až 16 položek (ikona, titulek, jedna věta). Pouze funkce se stavem ANO ve facts.
Kandidáti:
- elektronický podpis ověřený SMS kódem (Professional a Enterprise, Standard za příplatek)
- šablony smluv s proměnnými a náhledem
- PDF šablony nabídek ve vašem designu
- kopírování nabídek
- ceníky nad katalogem materiálu a práce
- sklad se stavy materiálu u zakázky
- plán vs skutečnost v protokolu
- schvalování protokolů a vyúčtování
- evidence zařízení, záruk a kontraktů
- historie zakázky (komentáře a aktivita)
- hlídání duplicitních klientů
- stavový pruh zakázky
- role a oprávnění
- vlastní subdoména firma.felucia.io
- anonymizace klienta podle GDPR

6.9 Dáša (tmavá sekce)
H2: Dáša. AI asistentka, která pracuje s vaší zakázkou.
Text: Zeptáte se nebo zadáte úkol, Dáša ho provede a potvrdí, co udělala. Nenahrazuje postup zakázky, šetří kliky.
Vizuál:
- statická konverzace, 2 až 3 výměny, žádné automatické přehrávání
- pouze akce, které Dáša podle kódu skutečně umí
- jen akce nad OP, klienty, nabídkami, aktivitami a stavem OP; žádné přesouvání termínů, žádné e-maily
- odpovědi v minulém čase, například "Hotovo, obchodní případ OP-26-101 jsem založila."
Pod tím dostupnost a limity podle plánu z lib/dasaLimits.ts. O AI a osobních údajích nic netvrdit.

6.10 Data a důvěra
H2: Vaše data zůstávají vaše.
Jen ověřené body:
- každá firma má oddělený prostor a vlastní subdoménu
- umístění serverů
- GDPR: anonymizace klienta, odkaz na /privacy
- provozovatel EFIKU SOLUTIONS s.r.o., IČO 29703972, Ostrava
- vyvinuto v provozu montážní firmy (NANTO podle ROZHODNUTÍ)

6.11 Ceny (#ceny)
H2: Cena podle velikosti týmu
- Pod nadpisem: Na ukázce doporučíme plán podle počtu lidí a provozu.
- Plány, limity a ceny z konfigurace nebo facts. DPH podle ROZHODNUTÍ.
- Desktop: 4 sloupce a rozbalitelná srovnávací tabulka všech funkcí.
- Mobil: karty pod sebou.
- U každého plánu jasně, zda obsahuje servisní modul (jen Professional a Enterprise), online podpis (Professional a Enterprise v ceně, Standard za příplatek 99 Kč za licenci měsíčně do 100 smluv, Starter ne), Dášu (limity z lib/dasaLimits.ts), editaci šablon, white-label a API (API klíče a webhooky ve všech plánech).
- Žádné štítky typu "Nejoblíbenější".

6.12 FAQ (#faq)
Akordeon přes details/summary. Zachovej současné otázky, odpovědi ověř proti facts. Doplň:
- Vidí technik ceny? (odpověď jen pro montáž, podle změny 9)
- Funguje aplikace bez signálu? (odpověď přesně podle změny 8)
- Kdo vidí naše data?

6.13 Ukázka (#ukazka)
H2: Ukážeme vám to na zakázce, jakou děláte každý týden.
- Tři kroky zavedení jako dnes.
- Formulář se stejnou funkcí jako dnes, nový vzhled.
- Kontakt: info@felucia.io, 724 347 986.

6.14 Patička
- popis
- funkční kotvy
- Podmínky, Soukromí, Podpora
- provozovatel a IČO
- "Vše roste." může zůstat

7. TEXTY - PRAVIDLA
Jazyk:
- čeština, vykání, krátké věty
- konkrétní pojmy z oboru: zakázka, montáž, předávací protokol, SOD, vyúčtování
Zakázané fráze:
- revoluční, inovativní, komplexní řešení, digitální transformace
- posuňte své podnikání, na míru vašim potřebám a podobné prázdné obraty
Zakázaný obsah:
- vymyšlené statistiky a procenta úspor
- reference, loga zákazníků, hodnocení
Interpunkce:
- jen obyčejný spojovník "-"
- nikdy dlouhé pomlčky, ani v meta tazích a alt textech
Ověřování tvrzení:
- každé tvrzení o funkci musí mít ve facts stav ANO
- ČÁSTEČNĚ formuluj přesně podle stavu
- NE vynech
- texty v tomto zadání uprav jen tam, kde je fakta vyvracejí

8. VIZUÁLNÍ SMĚR
Charakter:
- věcný, technický, sebevědomý
- inspirace technickým výkresem a dobře vedenou dokumentací, ne generickým SaaS
Barvy a tvary:
- teplé světlé pozadí (například #FAFAF7), téměř černý text
- jemné 1px linky, zaoblení 10 až 12 px, minimální stíny
- značková zelená #4CAF50 jen na plochy, ikony a velké prvky
- pro text a odkazy tmavší zelená s kontrastem alespoň 4,5:1 (například #2E7D32)
- jedna tmavá sekce (Dáša) pro rytmus
Motivy:
- štítky dokladů v monospace jako opakující se motiv
- pod ukázkami jemná rastrová síť jako na výkresu, velmi nízký kontrast
Písmo:
- font, který projekt už používá
- pokud žádný výrazný, Geist a Geist Mono přes next/font
Animace:
- náběh při scrollu jednou (opacity a posun 8 px, 300 ms) a hero smyčka
- vše vypnout při prefers-reduced-motion
Zakázáno:
- fotobanka, ilustrace lidí, emoji
- gradientové bloby, glassmorphism
- nekonečné marquee
- screenshoty

9. TECHNIKA
Architektura a závislosti:
- Next.js app router, serverové komponenty jako výchozí
- klientské komponenty jen pro hero animaci, průvodce záložkami, přepínač obrazovek telefonu, formulář a mobilní menu
- žádné nové těžké závislosti; animace přes CSS a IntersectionObserver, knihovnu jen pokud už je v package.json
Výkon a responzivita:
- žádné obrázky v hero, LCP je text H1
- mobil od 360 px, žádný vodorovný scroll stránky
- ukázky na mobilu zjednodušené (méně polí), nikdy zmenšené do nečitelna
Přístupnost:
- jeden H1 a logická hierarchie nadpisů
- viditelný fokus, ovládání klávesnicí, kontrast AA
SEO:
- zachovat canonical, ověřovací meta tagy, OG a Twitter image routy
- nový title a description
- JSON-LD: SoftwareApplication, Organization, FAQPage
Nedotýkat se:
- auth, API, tenant logiky a ničeho s NANTO_ORG_ID
- globálního layoutu aplikace mimo homepage
- souborů v public/marketing (nemazat)
Cíl Lighthouse mobil: Performance 90+, Accessibility 95+, SEO 100.

=== KONEC ZADÁNÍ ===
