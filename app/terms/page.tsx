import Link from 'next/link'

export const metadata = {
  title: 'Všeobecné obchodní podmínky',
  alternates: { canonical: '/terms' },
  description: 'Všeobecné obchodní podmínky služby Felucia CRM provozované společností EFIKU SOLUTIONS s.r.o.',
}

export default function TermsPage() {
  return (
    <div style={{ background: '#060E06', minHeight: '100vh', color: '#C8E6C9' }}>
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid rgba(76,175,80,0.15)', padding: '0 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8 2 5 5.5 5 9c0 5 7 13 7 13s7-8 7-13c0-3.5-3-7-7-7z" fill="#4CAF50" opacity="0.9"/>
              <path d="M12 6c-1.2 1.5-2 3.2-2 4.5 0 1.1.9 2 2 2s2-.9 2-2c0-1.3-.8-3-2-4.5z" fill="#81C784"/>
            </svg>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: '#E8F5E9' }}>felucia</span>
          </Link>
          <Link href="/" style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B8F6B', textDecoration: 'none' }}>
            ← Zpět na hlavní stránku
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '56px 24px 80px' }}>

        {/* Draft notice */}
        <div style={{
          marginBottom: 32,
          padding: '12px 16px',
          background: 'rgba(255,193,7,0.08)',
          border: '1px dashed rgba(255,193,7,0.4)',
          borderRadius: 8,
          fontFamily: 'Inter, sans-serif',
          fontSize: 13,
          color: '#FFD54F',
          lineHeight: 1.6,
        }}>
          <strong>Před zveřejněním doplňte:</strong> IČO, adresa sídla, datum platnosti.{' '}
          Doporučena právní revize zejm. čl. 7, 8 a 9.
        </div>

        <div style={{ marginBottom: 48 }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 700, color: '#E8F5E9', marginBottom: 8 }}>
            Všeobecné obchodní podmínky
          </h1>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#6B8F6B' }}>
            EFIKU SOLUTIONS s.r.o. | Služba Felucia CRM | felucia.io
          </p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#6B8F6B', marginTop: 4 }}>
            Platné od: 15. 7. 2026
          </p>
        </div>

        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, lineHeight: 1.8, color: '#A5D6A7' }}>

          <Section title="Čl. 1 — Úvodní ustanovení">
            <p>1.1 Tyto všeobecné obchodní podmínky (dále jen &bdquo;VOP&ldquo;) upravují práva a povinnosti mezi společností EFIKU SOLUTIONS s.r.o., IČO: 29703972, se sídlem Výstavní 2224/8, 709 00 Ostrava (dále jen &bdquo;Poskytovatel&ldquo;), a fyzickými nebo právnickými osobami, které uzavřely smlouvu o poskytování služby Felucia CRM (dále jen &bdquo;Uživatel&ldquo;).</p>
            <p>1.2 Služba Felucia CRM je cloudová softwarová aplikace určená pro správu obchodních případů, zakázek a interní agendy (dále jen &bdquo;Služba&ldquo;).</p>
            <p>1.3 Uzavřením smlouvy nebo aktivací uživatelského účtu Uživatel potvrzuje, že se s těmito VOP seznámil a souhlasí s nimi v celém rozsahu.</p>
          </Section>

          <Section title="Čl. 2 — Uzavření smlouvy a přístup ke Službě">
            <p>2.1 Smlouva o poskytování Služby je uzavřena okamžikem aktivace uživatelského účtu nebo uhrazením první platby, podle toho, co nastane dříve.</p>
            <p>2.2 Přístup ke Službě je podmíněn registrací, souhlasem s VOP a — po uplynutí zkušební doby — uhrazením příslušného předplatného dle aktuálního ceníku na felucia.io.</p>
            <p>2.3 Za veškeré aktivity provedené pod účtem Uživatele odpovídá Uživatel. Uživatel je povinen zajistit, aby přihlašovací údaje nebyly zpřístupněny neoprávněným osobám.</p>
          </Section>

          <Section title="Čl. 3 — Zkušební doba">
            <p>3.1 Každý nový Uživatel má nárok na bezplatnou zkušební dobu v délce 14 dní od aktivace účtu. Během zkušební doby je Služba dostupná v plném rozsahu bez poplatku.</p>
            <p>3.2 Po uplynutí zkušební doby, pokud Uživatel nepřejde na placené předplatné, dojde k automatickému omezení přístupu. Uživateli se zobrazí výzva k pokračování; bez aktivního předplatného nelze vytvářet nové záznamy ani upravovat stávající data.</p>
            <p>3.3 Uživatel má po uplynutí zkušební doby možnost přejít na placené předplatné kdykoliv během 60 dní od jejího skončení. Po uplynutí této lhůty bez úhrady předplatného může být účet i s veškerými daty trvale smazán.</p>
            <p>3.4 Poskytovatel si vyhrazuje právo zkušební dobu omezit nebo zrušit v případě jejího zneužití.</p>
          </Section>

          <Section title="Čl. 4 — Rozsah a dostupnost Služby">
            <p>4.1 Poskytovatel garantuje dostupnost Služby ve výši 99 % v kalendářním měsíci. Do výpočtu se nezahrnuje plánovaná údržba ani výpadky způsobené okolnostmi mimo kontrolu Poskytovatele.</p>
            <p>4.2 Při nedodržení garantované dostupnosti vzniká Uživateli nárok na slevu z měsíčního poplatku:</p>
            <ul>
              <li>dostupnost 97–99 %: sleva 40 %</li>
              <li>dostupnost nižší než 97 %: sleva 60 %</li>
            </ul>
            <p>4.3 Plánovanou údržbu provádí Poskytovatel přednostně mimo běžnou pracovní dobu (8:00–17:00 SEČ) a informuje o ní Uživatele prostřednictvím oznámení v aplikaci.</p>
            <p>4.4 Poskytovatel neodpovídá za výpadky způsobené třetími stranami (hosting, telekomunikační sítě, kybernetické útoky apod.).</p>
            <p>4.5 Poskytovatel je oprávněn Službu průběžně rozvíjet a upravovat její funkce. Změny, které podstatně omezují stávající funkčnost, budou oznámeny alespoň 15 dní předem prostřednictvím oznámení v aplikaci nebo e-mailem.</p>
          </Section>

          <Section title="Čl. 5 — Povinnosti Uživatele">
            <p>5.1 Uživatel je povinen využívat Službu v souladu s platnými právními předpisy a těmito VOP.</p>
            <p>5.2 Uživatel nesmí prostřednictvím Služby ukládat ani šířit obsah odporující zákonu nebo poškozující práva třetích osob.</p>
            <p>5.3 Za správnost, úplnost a zákonnost dat vložených do Služby odpovídá výhradně Uživatel.</p>
            <p>5.4 Uživateli se doporučuje pravidelně exportovat vlastní data mimo Službu. Poskytovatel nenese odpovědnost za ztrátu dat vzniklou nečinností Uživatele v tomto ohledu.</p>
          </Section>

          <Section title="Čl. 6 — Ceny a platební podmínky">
            <p>6.1 Ceny za Službu jsou stanoveny aktuálním ceníkem na felucia.io. Ceny jsou uváděny bez DPH, není-li výslovně uvedeno jinak.</p>
            <p>6.2 Platby probíhají předem, zpravidla měsíčně nebo ročně dle volby Uživatele.</p>
            <p>6.3 Změna ceníku nabývá účinnosti nejdříve 30 dní po oznámení Uživateli. Pokud Uživatel se změnou nesouhlasí, je oprávněn smlouvu vypovědět před datem účinnosti změny.</p>
            <p>6.4 Při prodlení s úhradou nastupují tato opatření:</p>
            <ul>
              <li>po 5 dnech — pozastavení přístupu ke Službě; obnovení po úhradě dlužné částky,</li>
              <li>po 60 dnech — zrušení účtu a zánik smlouvy; obnovení pouze na základě písemné dohody,</li>
              <li>po 120 dnech — trvalé a nevratné smazání veškerých dat Uživatele.</li>
            </ul>
          </Section>

          <Section title="Čl. 7 — Odpovědnost za data a jejich ztrátu">
            <p>7.1 Poskytovatel provádí zálohy dat s frekvencí odpovídající aktuálním technickým možnostem infrastruktury. Zálohovací praxe je doplňková a nezakládá odpovědnost Poskytovatele za zachování dat.</p>
            <p>7.2 Uživatel bere na vědomí, že provoz cloudové softwarové služby je spojen s technickými riziky, která mohou vést k dočasné nebo trvalé nedostupnosti či ztrátě dat.</p>
            <p>7.3 Poskytovatel nenese žádnou odpovědnost za ztrátu, poškození nebo zničení dat Uživatele, ke kterému dojde v důsledku:</p>
            <ul>
              <li>technické závady serverů, úložišť nebo síťové infrastruktury,</li>
              <li>kybernetického útoku, ransomwaru nebo jiného bezpečnostního incidentu,</li>
              <li>chyby v softwaru třetí strany nebo cloudové infrastruktury,</li>
              <li>lidské chyby na straně Uživatele nebo jeho zaměstnanců,</li>
              <li>vyšší moci (výpadek sítě, přírodní katastrofa, pandemie apod.),</li>
              <li>jakékoli jiné příčiny mimo přímou a prokazatelnou vinu Poskytovatele.</li>
            </ul>
            <p>7.4 Uživatel je výhradně odpovědný za pravidelné zálohování svých dat mimo systém Felucia CRM.</p>
            <p>7.5 Po ukončení smlouvy jsou data Uživatele uchovávána po dobu 30 dní, poté mohou být trvale smazána. Uživatel je povinen zajistit export svých dat před ukončením smlouvy nebo v průběhu této lhůty.</p>
          </Section>

          <Section title="Čl. 8 — Omezení odpovědnosti Poskytovatele">
            <p>8.1 Celková odpovědnost Poskytovatele vůči Uživateli z jakéhokoli titulu je omezena maximálně na výši předplatného uhrazeného Uživatelem za poslední 3 měsíce před vznikem škodné události.</p>
            <p>8.2 Poskytovatel v žádném případě neodpovídá za:</p>
            <ul>
              <li>ušlý zisk, ztrátu obchodní příležitosti nebo poškození pověsti,</li>
              <li>nepřímé, náhodné, následné nebo zvláštní škody,</li>
              <li>škody způsobené ztrátou nebo poškozením dat (viz čl. 7),</li>
              <li>škody vzniklé v důsledku absence vlastní zálohy dat na straně Uživatele.</li>
            </ul>
            <p>8.3 Tato omezení platí bez ohledu na právní základ nároku a i v případě, že byl Poskytovatel na možnost takové škody předem upozorněn.</p>
          </Section>

          <Section title="Čl. 9 — Zpracování osobních údajů">
            <p>9.1 Zpracování osobních údajů se řídí samostatnou Zásadou ochrany osobních údajů dostupnou na felucia.io/privacy.</p>
            <p>9.2 Pokud Uživatel prostřednictvím Služby zpracovává osobní údaje svých zákazníků nebo zaměstnanců, jedná jako správce osobních údajů a je plně odpovědný za soulad s nařízením GDPR. Poskytovatel v takovém případě vystupuje jako zpracovatel a je připraven uzavřít smlouvu o zpracování osobních údajů (DPA) na vyžádání.</p>
            <p>9.3 Uživatel může u klienta v evidenci provést anonymizaci osobních údajů (jméno, kontakty, adresa, IČO/DIČ) v rámci naplnění práva na výmaz — vazby na obchodní případy, zakázky a účetní doklady tím zůstávají zachovány, jak vyžaduje zákonná retence účetních záznamů. Anonymizace je nevratná.</p>
            <p>9.4 Zálohy databáze (denní, uchovávány 14 dní, včetně offsite kopie) slouží výhradně pro obnovu provozu po havárii, nejsou samostatným úložištěm osobních údajů a s běžnou rotací zálohy zanikají. Údaje anonymizované nebo smazané v produkční databázi se z historických záloh nemažou zvlášť — zanikají až uplynutím retenční doby zálohy.</p>
          </Section>

          <Section title="Čl. 10 — Trvání a ukončení smlouvy">
            <p>10.1 Smlouva se uzavírá na dobu neurčitou s měsíčním nebo ročním fakturačním cyklem.</p>
            <p>10.2 Každá smluvní strana je oprávněna smlouvu vypovědět s výpovědní dobou 30 dní ke konci aktuálního fakturačního období.</p>
            <p>10.3 Poskytovatel je oprávněn smlouvu okamžitě ukončit při závažném porušení VOP ze strany Uživatele.</p>
          </Section>

          <Section title="Čl. 11 — Změny VOP">
            <p>11.1 Poskytovatel je oprávněn VOP kdykoli změnit. Změna nabývá účinnosti 30 dní po oznámení Uživateli prostřednictvím aplikace nebo e-mailem.</p>
            <p>11.2 Pokračování v užívání Služby po datu účinnosti změny se považuje za souhlas s novým zněním VOP. Pokud Uživatel se změnou nesouhlasí, je oprávněn smlouvu vypovědět před datem účinnosti.</p>
            <p>11.3 Aktuální znění VOP je vždy dostupné na felucia.io/terms.</p>
          </Section>

          <Section title="Čl. 12 — Závěrečná ustanovení">
            <p>12.1 Tyto VOP se řídí právem České republiky. Případné spory budou řešeny příslušnými soudy v České republice; místně příslušným soudem prvního stupně je soud příslušný podle sídla Poskytovatele.</p>
            <p>12.2 Neplatnost jednotlivého ustanovení nemá vliv na platnost ostatních ustanovení VOP.</p>
            <p>12.3 Tyto VOP tvoří spolu se smlouvou úplnou dohodu stran ohledně Služby a nahrazují veškerá předchozí ujednání téhož předmětu.</p>
          </Section>

        </div>

        {/* Footer */}
        <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid rgba(76,175,80,0.15)', fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#4A6B4A' }}>
          <p>
            EFIKU SOLUTIONS s.r.o. | Výstavní 2224/8, 709 00 Ostrava | IČO: 29703972 | info@efiku.cz | felucia.io
          </p>
          <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
            <Link href="/privacy" style={{ color: '#6B8F6B', textDecoration: 'none' }}>Zásady ochrany osobních údajů</Link>
            <Link href="/" style={{ color: '#6B8F6B', textDecoration: 'none' }}>felucia.io</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 18,
        fontWeight: 600,
        color: '#81C784',
        marginBottom: 16,
        paddingBottom: 8,
        borderBottom: '1px solid rgba(76,175,80,0.15)',
      }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </section>
  )
}
