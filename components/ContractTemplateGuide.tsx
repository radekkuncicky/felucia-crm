'use client'

import { useState } from 'react'

/**
 * Rozbalovací nápověda na stránce šablon smluv — vysvětlí uživateli, jak
 * šablonu poskládat (vizuální vs HTML režim, povolené prvky, omezení, import).
 * Seznam konkrétních {{symbolů}} je v bočním panelu editoru, tady jen princip.
 */
export default function ContractTemplateGuide() {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-blue-50/60 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-blue-900 dark:text-blue-200">Jak vytvořit vlastní šablonu smlouvy?</span>
        </span>
        <svg
          className={`w-4 h-4 text-blue-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 text-sm text-gray-700 dark:text-slate-300">
          {/* Princip */}
          <section>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">1. Princip: text + symboly</h4>
            <p className="leading-relaxed">
              Napíšete obyčejný text smlouvy a na místa, která se mají u každého případu lišit
              (jméno klienta, cena, termín…), vložíte <strong>symbol</strong> ve tvaru{' '}
              <code className="px-1 py-0.5 rounded bg-white dark:bg-slate-800 font-mono text-xs text-blue-700 dark:text-blue-400">{'{{klient_jmeno}}'}</code>.
              Při generování smlouvy z obchodního případu se symbol automaticky nahradí
              skutečnou hodnotou. Kompletní seznam symbolů je v panelu{' '}
              <strong>&bdquo;Symboly&ldquo;</strong> vpravo od editoru — stačí kliknout a symbol se vloží na kurzor.
            </p>
          </section>

          {/* Režimy */}
          <section>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">2. Dva režimy editoru</h4>
            <ul className="list-disc pl-5 space-y-1 leading-relaxed">
              <li>
                <strong>Vizuální</strong> (výchozí) — píšete jako ve Wordu. Tlačítky v liště
                děláte nadpisy, <strong>tučné</strong>, <em>kurzívu</em>, podtržení, zarovnání
                a odrážkové/číslované seznamy. Pro běžnou smlouvu to plně stačí.
              </li>
              <li>
                <strong>HTML</strong> (tlačítko <span className="font-mono">{'</>'} HTML</span> vpravo v liště) — pro pokročilé,
                když potřebujete <strong>tabulky</strong> (např. podpisová část) nebo vlastní styly.
                Editor se přepne na zdrojový HTML kód.
              </li>
            </ul>
          </section>

          {/* Co lze v HTML */}
          <section>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">3. Co lze použít v HTML režimu</h4>
            <ul className="list-disc pl-5 space-y-1 leading-relaxed">
              <li>Nadpisy <code className="font-mono text-xs">{'<h1>'}</code>–<code className="font-mono text-xs">{'<h3>'}</code>, odstavce <code className="font-mono text-xs">{'<p>'}</code>, zlom řádku <code className="font-mono text-xs">{'<br>'}</code></li>
              <li>Formátování: <code className="font-mono text-xs">{'<strong>'}</code>, <code className="font-mono text-xs">{'<em>'}</code>, <code className="font-mono text-xs">{'<u>'}</code>, seznamy <code className="font-mono text-xs">{'<ul>'}</code>/<code className="font-mono text-xs">{'<ol>'}</code></li>
              <li>Tabulky <code className="font-mono text-xs">{'<table>'}</code> a vlastní styly přes <code className="font-mono text-xs">{'style="…"'}</code> nebo blok <code className="font-mono text-xs">{'<style>'}</code></li>
              <li>Vlastní písmo jen z <strong>Google Fonts</strong> (přes <code className="font-mono text-xs">{'<link>'}</code>), obrázky jen jako <code className="font-mono text-xs">https://</code> nebo vložené <code className="font-mono text-xs">data:</code></li>
            </ul>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              Základní vzhled (písmo Times New Roman 11&nbsp;pt, formát A4, okraje) doplní systém sám —
              stačí se starat o obsah. Z bezpečnostních důvodů se odstraní skripty, formuláře,
              externí odkazy mimo Google&nbsp;Fonts a vše ostatní mimo výše uvedené.
            </p>
          </section>

          {/* Import */}
          <section>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">4. Máte hotovou smlouvu ve Wordu?</h4>
            <p className="leading-relaxed">
              Použijte <strong>&bdquo;⬆ Import z DOCX/HTML&ldquo;</strong> v editoru. Soubor <code className="font-mono text-xs">.docx</code> nebo{' '}
              <code className="font-mono text-xs">.html</code> (do 5&nbsp;MB) se převede na šablonu. Doporučený postup:
              ve Wordu si do textu napište symboly ve tvaru <code className="font-mono text-xs">{'{{...}}'}</code> (např. <code className="font-mono text-xs">{'{{cena_s_dph}}'}</code>),
              uložte jako <code className="font-mono text-xs">.docx</code>, naimportujte a doladěte.
            </p>
          </section>

          {/* Tip */}
          <p className="text-xs text-gray-500 dark:text-slate-400 border-t border-blue-100 dark:border-blue-900/30 pt-3">
            💡 Než šablonu uložíte, klikněte na <strong>&bdquo;Náhled s ukázkovými daty&ldquo;</strong> — uvidíte
            smlouvu vyplněnou vzorovými hodnotami a ověříte, že jsou všechny symboly napsané správně
            (špatně napsaný symbol se v náhledu zobrazí jako <code className="font-mono text-xs">{'{{...}}'}</code>).
          </p>
        </div>
      )}
    </div>
  )
}
