'use client'

import { toast } from 'sonner'
import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'
import { IconFlame, IconSnowflake, IconWind, IconHeat, IconFan, IconCog } from '@/components/ui/Icons'

// ── Types ────────────────────────────────────────────────────────────────────

interface TemplateConfig {
  id: string
  templateId: string
  primaryColor: string
  accentColor: string
  headerText: string | null
  footerLine1: string | null
  footerLine2: string | null
  footerLine3: string | null
  showOpKod: boolean
  showDatumPlatnosti: boolean
  showPoznamka: boolean
  logoUrl: string | null
}

interface Template {
  id: string
  nazev: string
  typ: 'BASE' | 'STANDARD' | 'CUSTOM_HTML' | 'SYSTEM'
  planRequired: string
  isDefault: boolean
  isSystem: boolean
  config: TemplateConfig | null
  htmlTemplate: { id: string; templateId: string; cssContent: string | null } | null
}

interface TemplateMapping {
  id: string
  technologie: string | null
  templateId: string
}

interface Props {
  initialTemplates: Template[]
  plan: string
  sampleQuoteId: string | null
  initialSingleTemplate: boolean
  initialMappings: TemplateMapping[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYP_LABELS: Record<string, string> = {
  BASE: 'BASE',
  STANDARD: 'STANDARD',
  CUSTOM_HTML: 'CUSTOM',
  SYSTEM: 'SYSTEM',
}

const TYP_COLORS: Record<string, string> = {
  BASE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  STANDARD: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  CUSTOM_HTML: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  SYSTEM: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const TECHNOLOGIES = [
  { value: 'TEPELNE_CERPADLO', label: 'Tepelné čerpadlo', icon: <IconFlame className="w-4 h-4 text-orange-500" /> },
  { value: 'KLIMA', label: 'Klimatizace', icon: <IconSnowflake className="w-4 h-4 text-sky-500" /> },
  { value: 'REKUPERACE', label: 'Rekuperace', icon: <IconWind className="w-4 h-4 text-teal-500" /> },
  { value: 'PODLAHOVE_TOPENI', label: 'Podlahové vytápění', icon: <IconHeat className="w-4 h-4 text-red-400" /> },
  { value: 'VZDUCHOTECHNIKA', label: 'Vzduchotechnika', icon: <IconFan className="w-4 h-4 text-indigo-400" /> },
  { value: 'OHREV_TUV', label: 'Ohřev TUV', icon: <IconHeat className="w-4 h-4 text-blue-400" /> },
  { value: 'JINE', label: 'Jiné', icon: <IconCog className="w-4 h-4 text-gray-400" /> },
]

const PLACEHOLDER_GROUPS = [
  {
    label: 'FIRMA',
    items: ['firma_nazev', 'firma_adresa', 'firma_ico', 'firma_dic', 'firma_telefon', 'firma_email', 'firma_logo_url'],
  },
  {
    label: 'KLIENT',
    items: ['klient_jmeno', 'klient_adresa', 'klient_ico', 'klient_dic', 'klient_telefon', 'klient_email'],
  },
  {
    label: 'NABÍDKA',
    items: ['nabidka_kod', 'nabidka_nazev', 'datum_vystaveni', 'datum_platnosti'],
  },
  {
    label: 'OBCHODNÍK',
    items: ['obchodnik_jmeno', 'obchodnik_telefon', 'obchodnik_email'],
  },
  {
    label: 'CENY',
    items: ['cena_bez_dph', 'dph_sazba', 'dph_castka', 'cena_s_dph'],
  },
]

const LOOP_ITEMS = ['polozka_kod', 'polozka_nazev', 'polozka_mnozstvi', 'polozka_jednotka', 'polozka_cena_kus', 'polozka_sleva', 'polozka_celkem']

const STARTER_TEMPLATE = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
  @page { size: A4; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; font-size: 11px; color: #111; }
</style>
</head>
<body>

<!-- HLAVIČKA -->
<div style="display:flex; justify-content:space-between; margin-bottom:24px;">
  <img src="{{firma_logo_url}}" style="height:40px;" />
  <div style="text-align:right;">
    <div style="font-weight:600;">{{firma_nazev}}</div>
    <div>{{firma_adresa}}</div>
    <div>IČO: {{firma_ico}}</div>
  </div>
</div>

<!-- KLIENT -->
<div style="margin-bottom:24px;">
  <div style="font-weight:600; margin-bottom:4px;">Připraveno pro:</div>
  <div>{{klient_jmeno}}</div>
  <div>{{klient_adresa}}</div>
</div>

<!-- POLOŽKY -->
<table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
  <thead>
    <tr style="background:#f5f5f5;">
      <th style="text-align:left; padding:6px 8px;">Název</th>
      <th style="text-align:right; padding:6px 8px;">Mn.</th>
      <th style="text-align:right; padding:6px 8px;">Cena/ks</th>
      <th style="text-align:right; padding:6px 8px;">Celkem</th>
    </tr>
  </thead>
  <tbody>
    {{#polozky}}
    <tr>
      <td style="padding:6px 8px;">{{polozka_nazev}}</td>
      <td style="text-align:right; padding:6px 8px;">{{polozka_mnozstvi}} {{polozka_jednotka}}</td>
      <td style="text-align:right; padding:6px 8px;">{{polozka_cena_kus}} Kč</td>
      <td style="text-align:right; padding:6px 8px;">{{polozka_celkem}} Kč</td>
    </tr>
    {{/polozky}}
  </tbody>
</table>

<!-- SOUČET -->
<div style="text-align:right;">
  <div>Bez DPH: {{cena_bez_dph}} Kč</div>
  <div>DPH {{dph_sazba}}%: {{dph_castka}} Kč</div>
  <div style="font-weight:700; font-size:14px;">Celkem: {{cena_s_dph}} Kč</div>
</div>

<!-- OBCHODNÍK -->
<div style="margin-top:40px; font-size:10px; color:#666;">
  {{obchodnik_jmeno}} · {{obchodnik_telefon}} · {{obchodnik_email}}
</div>

</body>
</html>`

function canEditType(plan: string, typ: string): boolean {
  if (typ === 'SYSTEM') return false
  if (typ === 'BASE') return true
  if (typ === 'STANDARD') return ['STANDARD', 'PROFESSIONAL', 'ENTERPRISE'].includes(plan)
  if (typ === 'CUSTOM_HTML') return ['PROFESSIONAL', 'ENTERPRISE'].includes(plan)
  return false
}

// ── Placeholder Panel ─────────────────────────────────────────────────────────

function PlaceholderPanel({ onInsert }: { onInsert: (text: string) => void }) {
  const [open, setOpen] = useState(false)

  const chip = (text: string) => (
    <button
      key={text}
      type="button"
      onClick={() => onInsert(`{{${text}}}`)}
      className="inline-block font-mono text-[11px] px-1.5 py-0.5 rounded border cursor-pointer transition-colors"
      style={{
        background: 'rgba(76,175,80,0.08)',
        borderColor: 'rgba(76,175,80,0.3)',
        color: '#81C784',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(76,175,80,0.2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(76,175,80,0.08)')}
    >
      {`{{${text}}}`}
    </button>
  )

  return (
    <div className="rounded-lg border border-[rgba(76,175,80,0.2)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[rgba(76,175,80,0.05)] text-sm font-medium text-green-800 dark:text-green-200"
      >
        <span>Dostupné placeholdery — kliknutím vložíš do editoru</span>
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 py-3 space-y-3 bg-[#0D1A0E] dark:bg-[#0D1A0E] bg-white">
          {PLACEHOLDER_GROUPS.map(g => (
            <div key={g.label}>
              <div className="text-[9px] uppercase tracking-widest text-green-600 dark:text-green-500 mb-1.5">{g.label}</div>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map(p => chip(p))}
              </div>
            </div>
          ))}
          <div>
            <div className="text-[9px] uppercase tracking-widest text-green-600 dark:text-green-500 mb-1.5">POLOŽKY (smyčka)</div>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              <button
                type="button"
                onClick={() => onInsert('{{#polozky}}')}
                className="inline-block font-mono text-[11px] px-1.5 py-0.5 rounded border cursor-pointer"
                style={{ background: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.3)', color: '#FBBF24' }}
              >
                {`{{#polozky}}`}
              </button>
              {LOOP_ITEMS.map(p => chip(p))}
              <button
                type="button"
                onClick={() => onInsert('{{/polozky}}')}
                className="inline-block font-mono text-[11px] px-1.5 py-0.5 rounded border cursor-pointer"
                style={{ background: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.3)', color: '#FBBF24' }}
              >
                {`{{/polozky}}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Instructions Panel ────────────────────────────────────────────────────────

function InstructionsPanel({ onUseStarter }: { onUseStarter: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-[rgba(76,175,80,0.2)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[rgba(76,175,80,0.05)] text-sm font-medium text-green-800 dark:text-green-200"
      >
        <span>Jak napsat HTML šablonu</span>
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 py-3 text-xs space-y-3 bg-white dark:bg-[#0D1A0E] text-gray-700 dark:text-slate-300">
          <p>Váš HTML bude vykreslen přes Puppeteer na formát <strong>A4</strong> (210 × 297 mm, max obsah 180 mm).</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>Google Fonts přes <code className="bg-gray-100 dark:bg-[#1C3B1C] px-1 rounded">@import url(...)</code> v &lt;style&gt;</li>
            <li>Okraje stránky: <code className="bg-gray-100 dark:bg-[#1C3B1C] px-1 rounded">@page {'{ margin: 15mm }'}</code></li>
            <li>Logo: <code className="bg-gray-100 dark:bg-[#1C3B1C] px-1 rounded">{'<img src="{{firma_logo_url}}" style="height:40px">'}</code></li>
            <li>Položky musí obsahovat smyčku <code className="bg-gray-100 dark:bg-[#1C3B1C] px-1 rounded">{'{{#polozky}}...{{/polozky}}'}</code></li>
          </ul>
          <div className="pt-1">
            <button
              type="button"
              onClick={onUseStarter}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[#4CAF50] text-[#4CAF50] hover:bg-[rgba(76,175,80,0.1)] transition-colors"
            >
              Použít jako výchozí bod →
            </button>
            <span className="text-gray-400 text-xs ml-2">Vloží ukázkovou kostru do editoru</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── HTML Textarea Editor ──────────────────────────────────────────────────────

function HtmlTextareaEditor({
  templateId,
  value,
  onChange,
  onSave,
  saving,
  saveStatus,
  sampleQuoteId,
}: {
  templateId: string
  value: string
  onChange: (v: string) => void
  onSave: () => void
  saving: boolean
  saveStatus: 'idle' | 'saving' | 'saved' | 'unsaved'
  sampleQuoteId: string | null
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = e.currentTarget
      const start = el.selectionStart
      const end = el.selectionEnd
      const newVal = value.substring(0, start) + '  ' + value.substring(end)
      onChange(newVal)
      setTimeout(() => {
        el.selectionStart = el.selectionEnd = start + 2
      }, 0)
    }
  }

  function insertAtCursor(text: string) {
    const el = taRef.current
    if (!el) {
      onChange(value + text)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const newVal = value.substring(0, start) + text + value.substring(end)
    onChange(newVal)
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + text.length
      el.focus()
    }, 0)
  }

  async function handlePreviewPdf() {
    if (!value.trim()) {
      toast.warning('Vložte HTML před náhledem.')
      return
    }
    if (!sampleQuoteId) {
      toast.warning('Pro náhled potřebujete mít alespoň jednu nabídku v systému.')
      return
    }
    setPdfLoading(true)
    try {
      const res = await fetch(`/api/settings/quote-templates/${templateId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: sampleQuoteId, htmlContent: value }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Chyba při generování PDF')
      }
      const blob = await res.blob()
      window.open(URL.createObjectURL(blob), '_blank')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba')
    } finally {
      setPdfLoading(false)
    }
  }

  const statusEl = saveStatus === 'saving' ? (
    <span className="text-xs text-gray-400">Ukládám...</span>
  ) : saveStatus === 'saved' ? (
    <span className="text-xs text-green-500">✓ Uloženo</span>
  ) : saveStatus === 'unsaved' ? (
    <span className="text-xs text-amber-500">● Neuložené změny</span>
  ) : null

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {statusEl}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePreviewPdf}
            disabled={pdfLoading || !sampleQuoteId}
            title={!sampleQuoteId ? 'Nejprve vytvořte nabídku' : ''}
            className="text-xs border border-[rgba(76,175,80,0.4)] text-green-600 dark:text-green-400 px-3 py-1.5 rounded-lg hover:border-[#4CAF50] disabled:opacity-40 transition-colors"
          >
            {pdfLoading ? 'Generuji…' : '⬇ Náhled PDF'}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="text-xs text-white bg-[#4CAF50] hover:bg-green-600 disabled:opacity-50 px-4 py-1.5 rounded-lg transition-colors"
          >
            {saving ? 'Ukládám…' : 'Uložit šablonu'}
          </button>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        ref={taRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        placeholder="<!-- Vložte HTML kód vaší nabídky -->"
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: 13,
          minHeight: 500,
          width: '100%',
          background: 'var(--html-editor-bg, #0A120A)',
          color: 'var(--html-editor-fg, #E8F5E9)',
          border: '1px solid rgba(76,175,80,0.3)',
          borderRadius: 8,
          padding: 16,
          resize: 'vertical',
          lineHeight: 1.6,
          outline: 'none',
        }}
        onFocus={e => (e.currentTarget.style.border = '1px solid rgba(76,175,80,0.6)')}
        onBlur={e => { e.currentTarget.style.border = '1px solid rgba(76,175,80,0.3)'; onSave() }}
      />

      {/* Panels */}
      <PlaceholderPanel onInsert={insertAtCursor} />
      <InstructionsPanel onUseStarter={() => { onChange(STARTER_TEMPLATE); taRef.current?.focus() }} />
    </div>
  )
}

// ── ColorPreview ──────────────────────────────────────────────────────────────

function ColorPreview({ primaryColor, accentColor, logoUrl }: { primaryColor: string; accentColor: string; logoUrl?: string | null }) {
  return (
    <div className="rounded overflow-hidden border border-gray-200 dark:border-slate-700" style={{ fontSize: 9 }}>
      <div style={{ background: primaryColor, color: '#fff', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {logoUrl
            ? <img src={logoUrl} style={{ height: 20, maxWidth: 80, objectFit: 'contain' }} alt="logo" />
            : <span style={{ fontWeight: 700, fontSize: 11 }}>Vaše firma s.r.o.</span>
          }
          <div style={{ opacity: .8, marginTop: 2 }}>CENOVÁ NABÍDKA</div>
        </div>
        <div style={{ textAlign: 'right', opacity: .9 }}>
          <div style={{ fontWeight: 700 }}>NAB-26-0001</div>
          <div>1. 1. 2026</div>
        </div>
      </div>
      <div style={{ background: accentColor, height: 3 }} />
      <div style={{ padding: '6px 12px', background: '#fff' }}>
        <div style={{ height: 6, background: '#f3f4f6', borderRadius: 2, marginBottom: 4, width: '80%' }} />
        <div style={{ height: 6, background: '#f3f4f6', borderRadius: 2, width: '60%' }} />
      </div>
    </div>
  )
}

// ── Inline Tech Editor (accordion content) ────────────────────────────────────

function InlineTechEditor({
  template,
  plan,
  htmlContent,
  saveStatus,
  saving,
  sampleQuoteId,
  onHtmlChange,
  onConfigChange,
  onSave,
}: {
  template: Template
  plan: string
  htmlContent: string
  saveStatus: 'idle' | 'saving' | 'saved' | 'unsaved'
  saving: boolean
  sampleQuoteId: string | null
  onHtmlChange: (v: string) => void
  onConfigChange: (field: keyof TemplateConfig, v: string | boolean) => void
  onSave: () => void
}) {
  const isPro = ['PROFESSIONAL', 'ENTERPRISE'].includes(plan)
  const isStandard = ['STANDARD', 'PROFESSIONAL', 'ENTERPRISE'].includes(plan)

  const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500'

  const saveStatusEl = saveStatus === 'saving' ? (
    <span className="text-xs text-gray-400">Ukládám…</span>
  ) : saveStatus === 'saved' ? (
    <span className="text-xs text-green-500">✓ Uloženo</span>
  ) : saveStatus === 'unsaved' ? (
    <span className="text-xs text-amber-500">● Neuložené změny</span>
  ) : null

  if (template.isSystem) {
    return (
      <div className="px-5 py-4 bg-gray-50 dark:bg-slate-800/50 border-t border-[#C8E6C9] dark:border-[#1C3B1C] flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
        <span>SYSTEM šablona — nelze upravovat. Interní šablony NANTO mají dynamické sekce dle technologie zakázky.</span>
      </div>
    )
  }

  if (template.typ === 'CUSTOM_HTML') {
    return (
      <div className="px-5 py-5 bg-[#F4FAF4] dark:bg-[#061206] border-t border-[#C8E6C9] dark:border-[#1C3B1C]">
        {isPro ? (
          <HtmlTextareaEditor
            templateId={template.id}
            value={htmlContent}
            onChange={onHtmlChange}
            onSave={onSave}
            saving={saving}
            saveStatus={saveStatus}
            sampleQuoteId={sampleQuoteId}
          />
        ) : (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-700 dark:text-amber-300">
            Vlastní HTML šablony jsou dostupné na plánu <strong>Professional</strong> a vyšším.
            <div className="mt-2">
              <a href="/settings/billing" className="underline font-medium">Zobrazit možnosti upgradu →</a>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (template.typ === 'BASE' || template.typ === 'STANDARD') {
    return (
      <div className="px-5 py-5 bg-[#F4FAF4] dark:bg-[#061206] border-t border-[#C8E6C9] dark:border-[#1C3B1C] space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Záhlaví</label>
          <textarea
            value={template.config?.headerText ?? ''}
            onChange={e => onConfigChange('headerText', e.target.value)}
            maxLength={200}
            rows={2}
            className={inp}
            placeholder="Volitelný text pod záhlavím nabídky…"
          />
        </div>

        {template.typ === 'STANDARD' && isStandard && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Primární barva</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={template.config?.primaryColor ?? '#4CAF50'}
                    onChange={e => onConfigChange('primaryColor', e.target.value)}
                    className="w-10 h-8 rounded cursor-pointer border border-gray-300 dark:border-slate-600 p-0.5"
                  />
                  <span className="text-xs font-mono text-gray-600 dark:text-slate-400">{template.config?.primaryColor ?? '#4CAF50'}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Akcentová barva</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={template.config?.accentColor ?? '#1A2E1B'}
                    onChange={e => onConfigChange('accentColor', e.target.value)}
                    className="w-10 h-8 rounded cursor-pointer border border-gray-300 dark:border-slate-600 p-0.5"
                  />
                  <span className="text-xs font-mono text-gray-600 dark:text-slate-400">{template.config?.accentColor ?? '#1A2E1B'}</span>
                </div>
              </div>
            </div>
            <ColorPreview
              primaryColor={template.config?.primaryColor ?? '#4CAF50'}
              accentColor={template.config?.accentColor ?? '#1A2E1B'}
              logoUrl={template.config?.logoUrl}
            />
          </div>
        )}

        {template.typ === 'BASE' && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
            Na plánu <strong>Starter</strong> je barva a logo pevně dané. Upgradujte na <strong>Standard</strong> pro personalizaci vzhledu.
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300">Patička</label>
          {(['footerLine1', 'footerLine2', 'footerLine3'] as const).map((field, i) => (
            <input
              key={field}
              value={template.config?.[field] ?? ''}
              onChange={e => onConfigChange(field, e.target.value)}
              placeholder={`Řádek ${i + 1}`}
              className={inp}
            />
          ))}
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300">Zobrazit v nabídce</label>
          {[
            { field: 'showOpKod' as const, label: 'Číslo obchodního případu' },
            { field: 'showDatumPlatnosti' as const, label: 'Datum platnosti nabídky' },
            { field: 'showPoznamka' as const, label: 'Poznámka / popis nabídky' },
          ].map(({ field, label }) => (
            <label key={field} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={template.config?.[field] ?? true}
                onChange={e => onConfigChange(field, e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700 dark:text-slate-300">{label}</span>
            </label>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={saving}
            className="text-xs text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-1.5 rounded-lg transition-colors"
          >
            {saving ? 'Ukládám…' : 'Uložit konfiguraci'}
          </button>
          {saveStatusEl}
        </div>
      </div>
    )
  }

  return null
}

// ── Template Editor Slide-over ────────────────────────────────────────────────

function TemplateEditor({
  template,
  plan,
  sampleQuoteId,
  htmlContent,
  cssContent,
  onHtmlChange,
  onNameChange,
  onConfigChange,
  onSave,
  onLogoUpload,
  onClose,
  saving,
  logoUploading,
  error,
  success,
}: {
  template: Template
  plan: string
  sampleQuoteId: string | null
  htmlContent: string
  cssContent: string
  onHtmlChange: (v: string) => void
  onNameChange: (v: string) => void
  onConfigChange: (field: keyof TemplateConfig, v: string | boolean) => void
  onSave: () => void
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClose: () => void
  saving: boolean
  logoUploading: boolean
  error: string | null
  success: string | null
}) {
  const [pdfLoading, setPdfLoading] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const canEdit = canEditType(plan, template.typ)
  const isPro = ['PROFESSIONAL', 'ENTERPRISE'].includes(plan)
  const isStandard = ['STANDARD', 'PROFESSIONAL', 'ENTERPRISE'].includes(plan)

  const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500'

  async function handlePreviewPdf() {
    if (template.typ === 'CUSTOM_HTML' && !htmlContent.trim()) {
      toast.warning('Vložte HTML před náhledem.')
      return
    }
    if (!sampleQuoteId) {
      toast.warning('Pro náhled potřebujete mít alespoň jednu nabídku v systému.')
      return
    }
    setPdfLoading(true)
    try {
      const body: Record<string, unknown> = { quoteId: sampleQuoteId }
      if (template.typ === 'CUSTOM_HTML') {
        body.htmlContent = htmlContent
        body.cssContent = cssContent || null
      }
      const res = await fetch(`/api/settings/quote-templates/${template.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Chyba')
      }
      const blob = await res.blob()
      window.open(URL.createObjectURL(blob), '_blank')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba')
    } finally {
      setPdfLoading(false)
    }
  }

  function insertAtCursor(text: string) {
    const el = taRef.current
    if (!el) { onHtmlChange(htmlContent + text); return }
    const start = el.selectionStart
    const end = el.selectionEnd
    const newVal = htmlContent.substring(0, start) + text + htmlContent.substring(end)
    onHtmlChange(newVal)
    setTimeout(() => { el.selectionStart = el.selectionEnd = start + text.length; el.focus() }, 0)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-[640px] max-w-full bg-white dark:bg-slate-900 z-50 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${TYP_COLORS[template.typ]}`}>
              {TYP_LABELS[template.typ]}
            </span>
            <span className="font-semibold text-gray-900 dark:text-white text-sm truncate max-w-[240px]">{template.nazev}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviewPdf}
              disabled={pdfLoading || !sampleQuoteId}
              title={!sampleQuoteId ? 'Nejprve vytvořte nabídku' : ''}
              className="text-xs text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 hover:border-emerald-500 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
            >
              {pdfLoading ? 'Generuji…' : '⬇ Náhled PDF'}
            </button>
            {canEdit && (
              <button onClick={onSave} disabled={saving} className="text-xs text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-3 py-1.5 rounded-lg">
                {saving ? 'Ukládám…' : 'Uložit'}
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 ml-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</div>}
          {success && <div className="text-sm text-green-700 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">{success}</div>}

          {template.isSystem && (
            <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-800 dark:text-white text-sm">SYSTEM šablona — nelze upravovat</p>
              </div>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Tato šablona je součástí vašeho NANTO nastavení.
              </p>
            </div>
          )}

          {(template.typ === 'BASE' || template.typ === 'STANDARD') && canEdit && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Název šablony</label>
                <input value={template.nazev} onChange={e => onNameChange(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Záhlaví</label>
                <textarea value={template.config?.headerText ?? ''} onChange={e => onConfigChange('headerText', e.target.value)} maxLength={200} rows={2} className={inp} placeholder="Volitelný text pod záhlavím nabídky…" />
              </div>
              {template.typ === 'STANDARD' && isStandard && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Logo</label>
                    <div className="flex items-center gap-3">
                      {template.config?.logoUrl && (
                        <img src={template.config.logoUrl} className="h-10 max-w-[120px] object-contain border border-gray-200 dark:border-slate-600 rounded p-1" alt="logo" />
                      )}
                      <label className="cursor-pointer text-xs text-primary dark:text-primary-light border border-blue-300 dark:border-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20">
                        {logoUploading ? 'Nahrávám…' : 'Nahrát logo'}
                        <input type="file" accept="image/*" className="hidden" onChange={onLogoUpload} disabled={logoUploading} />
                      </label>
                      {template.config?.logoUrl && (
                        <button onClick={() => onConfigChange('logoUrl', '')} className="text-xs text-red-400 hover:text-red-600">Odebrat</button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Primární barva</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={template.config?.primaryColor ?? '#4CAF50'} onChange={e => onConfigChange('primaryColor', e.target.value)} className="w-10 h-8 rounded cursor-pointer border border-gray-300 dark:border-slate-600 p-0.5" />
                        <span className="text-xs font-mono text-gray-600 dark:text-slate-400">{template.config?.primaryColor ?? '#4CAF50'}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Akcentová barva</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={template.config?.accentColor ?? '#1A2E1B'} onChange={e => onConfigChange('accentColor', e.target.value)} className="w-10 h-8 rounded cursor-pointer border border-gray-300 dark:border-slate-600 p-0.5" />
                        <span className="text-xs font-mono text-gray-600 dark:text-slate-400">{template.config?.accentColor ?? '#1A2E1B'}</span>
                      </div>
                    </div>
                  </div>
                  <ColorPreview primaryColor={template.config?.primaryColor ?? '#4CAF50'} accentColor={template.config?.accentColor ?? '#1A2E1B'} logoUrl={template.config?.logoUrl} />
                </div>
              )}
              {template.typ === 'BASE' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
                  Na plánu <strong>Starter</strong> je barva a logo pevně dané. Upgradujte na <strong>Standard</strong> pro personalizaci vzhledu.
                </div>
              )}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300">Patička</label>
                {(['footerLine1', 'footerLine2', 'footerLine3'] as const).map((field, i) => (
                  <input key={field} value={template.config?.[field] ?? ''} onChange={e => onConfigChange(field, e.target.value)} placeholder={`Řádek ${i + 1}`} className={inp} />
                ))}
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300">Zobrazit v nabídce</label>
                {[
                  { field: 'showOpKod' as const, label: 'Číslo obchodního případu' },
                  { field: 'showDatumPlatnosti' as const, label: 'Datum platnosti nabídky' },
                  { field: 'showPoznamka' as const, label: 'Poznámka / popis nabídky' },
                ].map(({ field, label }) => (
                  <label key={field} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={template.config?.[field] ?? true} onChange={e => onConfigChange(field, e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                    <span className="text-sm text-gray-700 dark:text-slate-300">{label}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {template.typ === 'STANDARD' && !isStandard && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-700 dark:text-amber-300">
              Šablony <strong>Standard</strong> jsou dostupné od plánu Standard.
            </div>
          )}

          {template.typ === 'CUSTOM_HTML' && (
            isPro ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Název šablony</label>
                  <input value={template.nazev} onChange={e => onNameChange(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-2">HTML obsah šablony</label>
                  <textarea
                    ref={taRef}
                    value={htmlContent}
                    onChange={e => onHtmlChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Tab') {
                        e.preventDefault()
                        const el = e.currentTarget
                        const start = el.selectionStart
                        const end = el.selectionEnd
                        const newVal = htmlContent.substring(0, start) + '  ' + htmlContent.substring(end)
                        onHtmlChange(newVal)
                        setTimeout(() => { el.selectionStart = el.selectionEnd = start + 2 }, 0)
                      }
                    }}
                    spellCheck={false}
                    placeholder="<!-- Vložte HTML kód vaší nabídky -->"
                    style={{
                      fontFamily: "'Courier New', Courier, monospace",
                      fontSize: 13,
                      minHeight: 400,
                      width: '100%',
                      background: '#0A120A',
                      color: '#E8F5E9',
                      border: '1px solid rgba(76,175,80,0.3)',
                      borderRadius: 8,
                      padding: 16,
                      resize: 'vertical',
                      lineHeight: 1.6,
                      outline: 'none',
                    }}
                  />
                </div>
                <PlaceholderPanel onInsert={insertAtCursor} />
                <InstructionsPanel onUseStarter={() => { onHtmlChange(STARTER_TEMPLATE); taRef.current?.focus() }} />
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-700 dark:text-amber-300">
                Vlastní HTML šablony jsou dostupné pouze na plánu <strong>Professional</strong> a vyšším.
                <div className="mt-2"><a href="/settings/billing" className="underline font-medium">Zobrazit možnosti upgradu →</a></div>
              </div>
            )
          )}
        </div>
      </div>
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function QuoteTemplatesSettings({
  initialTemplates,
  plan,
  sampleQuoteId,
  initialSingleTemplate,
  initialMappings,
}: Props) {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [singleTemplate, setSingleTemplate] = useState(initialSingleTemplate)
  const [mappings, setMappings] = useState<TemplateMapping[]>(initialMappings)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [mappingSaving, setMappingSaving] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null)
  const [newTyp, setNewTyp] = useState<'BASE' | 'STANDARD' | 'CUSTOM_HTML'>('STANDARD')
  const [, startTransition] = useTransition()

  // HTML/CSS content for CUSTOM_HTML templates (lazy loaded)
  const [htmlContent, setHtmlContent] = useState<Record<string, string>>({})
  const [cssContent, setCssContent] = useState<Record<string, string>>({})

  // Inline accordion state
  const [expandedTech, setExpandedTech] = useState<string | null>(null)
  const [inlineSaveStatus, setInlineSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'unsaved'>>({})
  const [inlineSaving, setInlineSaving] = useState<Record<string, boolean>>({})
  const inlineAutoSave = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const editingTemplate = templates.find(t => t.id === editingId) ?? null
  const isPro = ['PROFESSIONAL', 'ENTERPRISE'].includes(plan)
  const hasSystemTemplates = templates.some(t => t.isSystem)

  function getMappedTemplateId(technologie: string | null): string {
    return mappings.find(m => m.technologie === technologie)?.templateId ?? ''
  }

  async function loadHtmlIfNeeded(t: Template): Promise<string> {
    if (t.typ !== 'CUSTOM_HTML') return ''
    if (htmlContent[t.id] !== undefined) return htmlContent[t.id]
    try {
      const res = await fetch(`/api/settings/quote-templates/${t.id}`)
      const found = await res.json() as (Template & { htmlTemplate: { htmlContent?: string; cssContent?: string | null } | null })
      const html = found.htmlTemplate?.htmlContent ?? ''
      const css = found.htmlTemplate?.cssContent ?? ''
      setHtmlContent(prev => ({ ...prev, [t.id]: html }))
      setCssContent(prev => ({ ...prev, [t.id]: css }))
      return html
    } catch {
      setHtmlContent(prev => ({ ...prev, [t.id]: '' }))
      return ''
    }
  }

  async function saveMappings(newSingle: boolean, newMappings: TemplateMapping[]) {
    setMappingSaving(true)
    try {
      await fetch('/api/settings/org-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ singleTemplate: newSingle }),
      })
      await fetch('/api/settings/org-template-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: newMappings.map(m => ({ technologie: m.technologie, templateId: m.templateId })) }),
      })
      startTransition(() => router.refresh())
    } finally {
      setMappingSaving(false)
    }
  }

  async function handleModeChange(single: boolean) {
    setSingleTemplate(single)
    setExpandedTech(null)
    await saveMappings(single, mappings)
  }

  async function handleMappingChange(technologie: string | null, templateId: string) {
    const newMappings = mappings.filter(m => m.technologie !== technologie)
    if (templateId) newMappings.push({ id: '', technologie, templateId })
    setMappings(newMappings)
    // Pre-load HTML if CUSTOM_HTML
    if (templateId) {
      const t = templates.find(x => x.id === templateId)
      if (t) await loadHtmlIfNeeded(t)
    }
    await saveMappings(singleTemplate, newMappings)
  }

  async function handleTechExpand(techValue: string, mappedId: string) {
    if (expandedTech === techValue) {
      setExpandedTech(null)
      return
    }
    setExpandedTech(techValue)
    if (mappedId) {
      const t = templates.find(x => x.id === mappedId)
      if (t) await loadHtmlIfNeeded(t)
    }
  }

  // Inline save (for accordion editor)
  async function saveInline(templateId: string) {
    const t = templates.find(x => x.id === templateId)
    if (!t || t.isSystem) return
    setInlineSaving(prev => ({ ...prev, [templateId]: true }))
    setInlineSaveStatus(prev => ({ ...prev, [templateId]: 'saving' }))
    try {
      const body: Record<string, unknown> = { nazev: t.nazev }
      if (t.config) body.config = t.config
      if (t.typ === 'CUSTOM_HTML') {
        body.htmlContent = htmlContent[t.id] ?? ''
        body.cssContent = cssContent[t.id] || null
      }
      const res = await fetch(`/api/settings/quote-templates/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Chyba při ukládání')
      setInlineSaveStatus(prev => ({ ...prev, [templateId]: 'saved' }))
      setTimeout(() => setInlineSaveStatus(prev => ({ ...prev, [templateId]: 'idle' })), 2500)
      startTransition(() => router.refresh())
    } catch {
      setInlineSaveStatus(prev => ({ ...prev, [templateId]: 'unsaved' }))
    } finally {
      setInlineSaving(prev => ({ ...prev, [templateId]: false }))
    }
  }

  function handleInlineHtmlChange(templateId: string, val: string) {
    setHtmlContent(prev => ({ ...prev, [templateId]: val }))
    setInlineSaveStatus(prev => ({ ...prev, [templateId]: 'unsaved' }))
    if (inlineAutoSave.current[templateId]) clearTimeout(inlineAutoSave.current[templateId])
    inlineAutoSave.current[templateId] = setTimeout(() => saveInline(templateId), 2000)
  }

  function updateConfig(templateId: string, field: keyof TemplateConfig, value: string | boolean) {
    setTemplates(prev => prev.map(t => {
      if (t.id !== templateId) return t
      return {
        ...t,
        config: {
          ...(t.config ?? { id: '', templateId: t.id, primaryColor: '#4CAF50', accentColor: '#1A2E1B', headerText: null, footerLine1: null, footerLine2: null, footerLine3: null, showOpKod: true, showDatumPlatnosti: true, showPoznamka: true, logoUrl: null }),
          [field]: value,
        },
      }
    }))
  }

  async function handleEdit(t: Template) {
    setEditingId(t.id)
    setError(null)
    setSuccess(null)
    if (t.typ === 'CUSTOM_HTML') {
      await loadHtmlIfNeeded(t)
    }
  }

  async function handleSave() {
    if (!editingTemplate || editingTemplate.isSystem) return
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { nazev: editingTemplate.nazev }
      if (editingTemplate.config) body.config = editingTemplate.config
      if (editingTemplate.typ === 'CUSTOM_HTML') {
        body.htmlContent = htmlContent[editingTemplate.id] ?? ''
        body.cssContent = cssContent[editingTemplate.id] || null
      }
      const res = await fetch(`/api/settings/quote-templates/${editingTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Chyba při ukládání')
      }
      const updated = await res.json()
      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? { ...t, ...updated } : t))
      setSuccess('Šablona uložena')
      setTimeout(() => setSuccess(null), 2500)
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTemplateId) return
    const id = deleteTemplateId
    setDeleteTemplateId(null)
    const res = await fetch(`/api/settings/quote-templates/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTemplates(prev => prev.filter(t => t.id !== id))
      setMappings(prev => prev.filter(m => m.templateId !== id))
      if (editingId === id) setEditingId(null)
      startTransition(() => router.refresh())
    } else {
      const j = await res.json()
      setError(j.error ?? 'Chyba při mazání')
    }
  }

  async function handleNewTemplate() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings/quote-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazev: newName.trim(), typ: newTyp }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Chyba')
      }
      const tpl = await res.json()
      setTemplates(prev => [...prev, tpl])
      setNewModalOpen(false)
      setNewName('')
      setNewTyp('STANDARD')
      if (tpl.typ === 'CUSTOM_HTML') {
        setHtmlContent(prev => ({ ...prev, [tpl.id]: '' }))
        setCssContent(prev => ({ ...prev, [tpl.id]: '' }))
      }
      await handleEdit(tpl)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !editingTemplate) return
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const res = await fetch(`/api/settings/quote-templates/${editingTemplate.id}/logo`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Chyba při nahrávání loga')
      const j = await res.json()
      updateConfig(editingTemplate.id, 'logoUrl', j.logoUrl)
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba')
    } finally {
      setLogoUploading(false)
    }
  }

  async function handlePreviewCard(t: Template) {
    if (!sampleQuoteId) {
      toast.warning('Pro náhled potřebujete mít alespoň jednu nabídku v systému.')
      return
    }
    try {
      const body: Record<string, unknown> = { quoteId: sampleQuoteId }
      if (t.typ === 'CUSTOM_HTML') {
        const html = htmlContent[t.id] !== undefined ? htmlContent[t.id] : await loadHtmlIfNeeded(t)
        body.htmlContent = html
        body.cssContent = cssContent[t.id] || null
      }
      const res = await fetch(`/api/settings/quote-templates/${t.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Chyba')
      }
      const blob = await res.blob()
      window.open(URL.createObjectURL(blob), '_blank')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba')
    }
  }

  function isAssigned(templateId: string): boolean {
    return mappings.some(m => m.templateId === templateId)
  }

  const sel = 'w-full border border-[#C8E6C9] dark:border-[#1C3B1C] rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#0D1A0E] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500'

  // Helper: get template for single-mode inline editor
  const singleMappedId = getMappedTemplateId(null)
  const singleMappedTemplate = singleMappedId ? templates.find(t => t.id === singleMappedId) ?? null : null

  return (
    <div className="space-y-6 min-h-screen bg-[#F4FAF4] dark:bg-[#0A120A] -m-6 p-6">
      <ConfirmModal
        isOpen={deleteTemplateId !== null}
        title="Smazat šablonu"
        message="Smazat tuto šablonu nabídky? Tato akce je nevratná."
        confirmLabel="Smazat"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTemplateId(null)}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Šablony nabídek</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Nastavte vzhled a přiřaďte šablony PDF cenových nabídek</p>
        </div>
        {isPro && (
          <button
            onClick={() => setNewModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            + Nová šablona
          </button>
        )}
      </div>

      {/* ── SEKCE 1: Přiřazení ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#0D1A0E] rounded-xl border border-[#C8E6C9] dark:border-[#1C3B1C] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#C8E6C9] dark:border-[#1C3B1C]">
          <h2 className="font-semibold text-gray-900 dark:text-white">Přiřazení šablon</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Vyberte, která šablona se použije při exportu PDF nabídky</p>
        </div>

        {/* NANTO info banner */}
        {hasSystemTemplates && (
          <div className="px-5 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-b border-[#C8E6C9] dark:border-emerald-800 flex items-start gap-2">
            <span className="text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">ℹ</span>
            <div>
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">NANTO používá interní SYSTEM šablony s dynamickými sekcemi.</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">Šablony jsou generovány automaticky dle technologie zakázky a nelze je upravovat.</p>
            </div>
          </div>
        )}

        {/* Mode radio */}
        <div className="px-5 py-4 space-y-2 border-b border-[#C8E6C9] dark:border-[#1C3B1C]">
          {[
            { value: true, label: 'Jedna šablona pro všechny technologie', desc: 'Všechny nabídky použijí stejnou šablonu' },
            { value: false, label: 'Různé šablony podle technologie', desc: 'Každá technologie může mít vlastní šablonu' },
          ].map(opt => (
            <label
              key={String(opt.value)}
              onClick={() => singleTemplate !== opt.value && handleModeChange(opt.value)}
              className={`flex items-start gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                singleTemplate === opt.value
                  ? 'bg-[#F4FAF4] dark:bg-emerald-900/20 border-[#C8E6C9] dark:border-emerald-700'
                  : 'border-[#C8E6C9] dark:border-[#1C3B1C] hover:bg-[#F4FAF4] dark:hover:bg-[#0A120A]'
              }`}
            >
              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${singleTemplate === opt.value ? 'border-emerald-600 bg-emerald-600' : 'border-gray-400 dark:border-slate-500'}`}>
                {singleTemplate === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</div>
                <div className="text-xs text-gray-500 dark:text-slate-400">{opt.desc}</div>
              </div>
              {mappingSaving && singleTemplate === opt.value && <div className="ml-auto text-xs text-gray-400">Ukládám…</div>}
            </label>
          ))}
        </div>

        {/* Mapping section */}
        {singleTemplate ? (
          /* ── REŽIM A: Jedna šablona ── */
          <div className="divide-y divide-[#C8E6C9] dark:divide-[#1C3B1C]">
            <div className="px-5 py-4">
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-2">Výchozí šablona</label>
              <div className="flex items-center gap-3">
                <select
                  value={singleMappedId}
                  onChange={e => handleMappingChange(null, e.target.value)}
                  className={sel + ' max-w-sm'}
                >
                  <option value="">— Vybrat šablonu —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nazev} ({TYP_LABELS[t.typ]})
                    </option>
                  ))}
                </select>
                {singleMappedTemplate && (
                  <button
                    onClick={() => handlePreviewCard(singleMappedTemplate)}
                    disabled={!sampleQuoteId}
                    title={!sampleQuoteId ? 'Nejprve vytvořte nabídku' : ''}
                    className="text-xs text-emerald-600 dark:text-emerald-400 border border-[#C8E6C9] dark:border-emerald-700 px-2.5 py-1.5 rounded-lg hover:border-emerald-500 disabled:opacity-40 flex-shrink-0"
                  >
                    Náhled PDF
                  </button>
                )}
              </div>
            </div>

            {/* Inline editor for single template */}
            {singleMappedTemplate && !singleMappedTemplate.isSystem && (
              <InlineTechEditor
                template={singleMappedTemplate}
                plan={plan}
                htmlContent={htmlContent[singleMappedTemplate.id] ?? ''}
                saveStatus={inlineSaveStatus[singleMappedTemplate.id] ?? 'idle'}
                saving={inlineSaving[singleMappedTemplate.id] ?? false}
                sampleQuoteId={sampleQuoteId}
                onHtmlChange={v => handleInlineHtmlChange(singleMappedTemplate.id, v)}
                onConfigChange={(field, v) => updateConfig(singleMappedTemplate.id, field, v)}
                onSave={() => saveInline(singleMappedTemplate.id)}
              />
            )}
          </div>
        ) : (
          /* ── REŽIM B: Různé šablony podle technologie ── */
          <div className="divide-y divide-[#C8E6C9] dark:divide-[#1C3B1C]">
            {TECHNOLOGIES.map(tech => {
              const mappedId = getMappedTemplateId(tech.value)
              const mappedTemplate = mappedId ? templates.find(t => t.id === mappedId) ?? null : null
              const isExpanded = expandedTech === tech.value

              return (
                <div key={tech.value}>
                  {/* Tech row */}
                  <div
                    className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                      mappedTemplate ? 'cursor-pointer hover:bg-[#F4FAF4] dark:hover:bg-[#0A120A]' : ''
                    } ${isExpanded ? 'bg-[#F4FAF4] dark:bg-[#0A120A]' : ''}`}
                    onClick={() => mappedTemplate && handleTechExpand(tech.value, mappedId)}
                  >
                    {/* Icon + name */}
                    <div className="w-44 flex items-center gap-2 flex-shrink-0">
                      <span className="flex-shrink-0">{tech.icon}</span>
                      <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{tech.label}</span>
                    </div>

                    {/* Template select */}
                    <select
                      value={mappedId}
                      onChange={e => handleMappingChange(tech.value, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className={sel + ' flex-1'}
                    >
                      <option value="">— Použít výchozí —</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.nazev} ({TYP_LABELS[t.typ]})
                        </option>
                      ))}
                    </select>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {mappedTemplate && (
                        <button
                          onClick={e => { e.stopPropagation(); handlePreviewCard(mappedTemplate) }}
                          disabled={!sampleQuoteId}
                          title={!sampleQuoteId ? 'Nejprve vytvořte nabídku' : ''}
                          className="text-xs text-emerald-600 dark:text-emerald-400 border border-[#C8E6C9] dark:border-emerald-700 px-2.5 py-1.5 rounded-lg hover:border-emerald-500 disabled:opacity-40"
                        >
                          Náhled PDF
                        </button>
                      )}
                      {mappedTemplate && (
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                      {!mappedTemplate && (
                        <span className="w-4 h-4 flex-shrink-0" />
                      )}
                    </div>
                  </div>

                  {/* Inline accordion editor */}
                  {isExpanded && mappedTemplate && (
                    <InlineTechEditor
                      template={mappedTemplate}
                      plan={plan}
                      htmlContent={htmlContent[mappedTemplate.id] ?? ''}
                      saveStatus={inlineSaveStatus[mappedTemplate.id] ?? 'idle'}
                      saving={inlineSaving[mappedTemplate.id] ?? false}
                      sampleQuoteId={sampleQuoteId}
                      onHtmlChange={v => handleInlineHtmlChange(mappedTemplate.id, v)}
                      onConfigChange={(field, v) => updateConfig(mappedTemplate.id, field, v)}
                      onSave={() => saveInline(mappedTemplate.id)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── SEKCE 2: Moje šablony ─────────────────────────────────────────────── */}
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Moje šablony</h2>
        {templates.length === 0 ? (
          <div className="bg-white dark:bg-[#0D1A0E] rounded-xl border border-[#C8E6C9] dark:border-[#1C3B1C] p-8 text-center text-sm text-gray-400">
            Žádné šablony
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                isAssigned={isAssigned(t.id)}
                onEdit={() => handleEdit(t)}
                onPreview={() => handlePreviewCard(t)}
                onDelete={() => setDeleteTemplateId(t.id)}
                plan={plan}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Slide-over editor ────────────────────────────────────────────────── */}
      {editingId && editingTemplate && (
        <TemplateEditor
          template={editingTemplate}
          plan={plan}
          sampleQuoteId={sampleQuoteId}
          htmlContent={htmlContent[editingId] ?? ''}
          cssContent={cssContent[editingId] ?? (editingTemplate.htmlTemplate?.cssContent ?? '')}
          onHtmlChange={v => setHtmlContent(prev => ({ ...prev, [editingId]: v }))}
          onNameChange={v => setTemplates(prev => prev.map(t => t.id === editingId ? { ...t, nazev: v } : t))}
          onConfigChange={(field, v) => updateConfig(editingId, field, v)}
          onSave={handleSave}
          onLogoUpload={handleLogoUpload}
          onClose={() => { setEditingId(null); setError(null); setSuccess(null) }}
          saving={saving}
          logoUploading={logoUploading}
          error={error}
          success={success}
        />
      )}

      {/* ── New template modal ───────────────────────────────────────────────── */}
      {newModalOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setNewModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#0D1A0E] rounded-xl border border-[#C8E6C9] dark:border-[#1C3B1C] shadow-xl p-6 w-full max-w-sm space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Nová šablona</h3>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Název</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} className={sel} placeholder="Název šablony…" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Typ</label>
                <select value={newTyp} onChange={e => setNewTyp(e.target.value as 'BASE' | 'STANDARD' | 'CUSTOM_HTML')} className={sel}>
                  <option value="BASE">BASE — základní (Starter+)</option>
                  <option value="STANDARD">STANDARD — barvy + logo (Standard+)</option>
                  <option value="CUSTOM_HTML">CUSTOM HTML — plná kontrola (Pro+)</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => setNewModalOpen(false)} className="text-sm text-gray-500 px-3 py-2 rounded-lg hover:bg-[#F4FAF4] dark:hover:bg-[#0A120A]">Zrušit</button>
                <button onClick={handleNewTemplate} disabled={saving || !newName.trim()} className="text-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-2 rounded-lg">
                  {saving ? 'Vytvářím…' : 'Vytvořit'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  isAssigned,
  onEdit,
  onPreview,
  onDelete,
  plan,
}: {
  template: Template
  isAssigned: boolean
  onEdit: () => void
  onPreview: () => void
  onDelete: () => void
  plan: string
}) {
  const canEdit = canEditType(plan, template.typ)
  return (
    <div className={`bg-white dark:bg-[#0D1A0E] rounded-xl border transition-colors ${
      isAssigned
        ? 'border-emerald-400 dark:border-emerald-600 shadow-sm shadow-emerald-100 dark:shadow-emerald-900/30'
        : 'border-[#C8E6C9] dark:border-[#1C3B1C]'
    } p-4 flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 dark:text-white text-sm truncate">{template.nazev}</div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYP_COLORS[template.typ]}`}>{TYP_LABELS[template.typ]}</span>
            {template.isSystem && <span className="text-[10px] text-gray-400 dark:text-slate-500">interní</span>}
          </div>
        </div>
        {isAssigned && (
          <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Přiřazena
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-auto pt-1 border-t border-[#C8E6C9] dark:border-[#1C3B1C]">
        {canEdit && <button onClick={onEdit} className="text-xs text-gray-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 font-medium">Upravit</button>}
        {template.isSystem && <button onClick={onEdit} className="text-xs text-gray-500 dark:text-slate-400">Zobrazit</button>}
        <button onClick={onPreview} className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-medium">Náhled PDF</button>
        <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-600 ml-auto">Smazat</button>
      </div>
    </div>
  )
}
