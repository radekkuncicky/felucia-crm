'use client'

import { useState, useCallback } from 'react'
import type { OrgSettingsData } from '@/lib/orgSettings'
import { useUpdateOrgSettings } from '@/context/OrgSettingsContext'
import { IconWrench, IconSparkles, IconChart, IconDocument, IconCoins, IconBox, IconCheck, IconActivity, IconBell, IconCalendar, IconClipboard } from '@/components/ui/Icons'

interface Props {
  settings: OrgSettingsData
  plan: string
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (val: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#FFC93C] focus:ring-offset-2 ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      } ${checked ? 'bg-[#FFC93C]' : 'bg-gray-300 dark:bg-slate-600'}`}
    >
      <span
        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

interface ToggleRowProps {
  icon: React.ReactNode
  title: string
  description: string
  checked: boolean
  onChange: (val: boolean) => void
  disabled?: boolean
  badge?: string
}

function ToggleRow({ icon, title, description, checked, onChange, disabled, badge }: ToggleRowProps) {
  return (
    <div className="flex items-center gap-4 py-4 px-5">
      <div className="flex-shrink-0 w-8 flex justify-center text-gray-400 dark:text-slate-500">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-semibold ${disabled ? 'text-gray-400 dark:text-slate-500' : 'text-gray-900 dark:text-white'}`}>
            {title}
          </p>
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700">
        <h2 className="text-sm font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-slate-700">
        {children}
      </div>
    </div>
  )
}

export default function FeaturesClient({ settings, plan }: Props) {
  const [vals, setVals] = useState<OrgSettingsData>(settings)
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const updateOrgSettings = useUpdateOrgSettings()

  const isPremiumPlus = plan === 'STANDARD' || plan === 'PROFESSIONAL' || plan === 'ENTERPRISE'
  const isPlatinum = plan === 'PROFESSIONAL' || plan === 'ENTERPRISE'

  const save = useCallback(async (patch: Partial<OrgSettingsData>) => {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings/org-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        const updated = await res.json()
        setVals(updated)
        updateOrgSettings(patch) // propagate to context → sidebar + AI assistant update immediately
        setToast('Uloženo')
        setTimeout(() => setToast(null), 2000)
      }
    } finally {
      setSaving(false)
    }
  }, [saving, updateOrgSettings])

  function toggle(field: keyof OrgSettingsData) {
    return (val: boolean) => {
      setVals(v => ({ ...v, [field]: val }))
      save({ [field]: val })
    }
  }

  function numberChange(field: keyof OrgSettingsData, value: number) {
    setVals(v => ({ ...v, [field]: value }))
  }

  function numberBlur(field: keyof OrgSettingsData) {
    save({ [field]: vals[field] })
  }

  return (
    <>
      <div className="space-y-6">
        {/* Moduly */}
        <SectionCard title="Moduly">
          <ToggleRow
            icon={<IconWrench className="w-6 h-6" />}
            title="Servisní modul"
            description="Správa servisních kontraktů a plánování návštěv."
            checked={vals.modulServis}
            onChange={toggle('modulServis')}
            disabled={!isPlatinum}
            badge={!isPlatinum ? 'Professional' : undefined}
          />
          <ToggleRow
            icon={<IconSparkles className="w-6 h-6" />}
            title="AI asistentka Dáša"
            description="Hlasové a textové zadávání akcí v CRM."
            checked={vals.modulDasa}
            onChange={toggle('modulDasa')}
            disabled={!isPremiumPlus}
            badge={!isPremiumPlus ? 'Standard+' : undefined}
          />
          <ToggleRow
            icon={<IconChart className="w-6 h-6" />}
            title="Analytiky"
            description="Grafy výkonnosti, funnel prodeje, přehledy obchodníků."
            checked={vals.modulAnalytiky}
            onChange={toggle('modulAnalytiky')}
          />
          <ToggleRow
            icon={<IconDocument className="w-6 h-6" />}
            title="Dokumenty"
            description="Správa příloh, PDF exportů a fotek zakázek."
            checked={vals.modulDokumenty}
            onChange={toggle('modulDokumenty')}
          />
          <ToggleRow
            icon={<IconCoins className="w-6 h-6" />}
            title="Ceníky"
            description="Více cenových hladin per produkt."
            checked={vals.modulCeniky}
            onChange={toggle('modulCeniky')}
            disabled={!isPremiumPlus}
            badge={!isPremiumPlus ? 'Standard+' : undefined}
          />
          <ToggleRow
            icon={<IconBox className="w-6 h-6" />}
            title="Leady"
            description="Správa potenciálních zákazníků z webových formulářů a ručního zadávání."
            checked={vals.modulLeady}
            onChange={toggle('modulLeady')}
            disabled={!isPremiumPlus}
            badge={!isPremiumPlus ? 'Standard+' : undefined}
          />
        </SectionCard>

        {/* Obchodní proces */}
        <SectionCard title="Obchodní proces">
          <ToggleRow
            icon={<IconCheck className="w-6 h-6" />}
            title="Povinná aktivita před uzavřením OP"
            description="OP nelze přesunout do stavu Úspěch bez alespoň jedné aktivity typu Hovor nebo Schůzka."
            checked={vals.povinnaAktivitaUOP}
            onChange={toggle('povinnaAktivitaUOP')}
          />
          <ToggleRow
            icon={<IconActivity className="w-6 h-6" />}
            title="Automatický návrh servisního kontraktu"
            description="Po uzavření OP nabídnout vytvoření servisního kontraktu."
            checked={vals.automatickyServis}
            onChange={toggle('automatickyServis')}
            disabled={!isPlatinum}
            badge={!isPlatinum ? 'Professional' : undefined}
          />
          <ToggleRow
            icon={<IconActivity className="w-6 h-6" />}
            title="Schválení nabídky adminem"
            description="Nabídka musí být schválena adminem před odesláním klientovi."
            checked={vals.schvaleniNabidky}
            onChange={toggle('schvaleniNabidky')}
          />
        </SectionCard>

        {/* Upomínky */}
        <SectionCard title="Upomínky">
          <div className="py-4 px-5">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-8 flex justify-center text-gray-400 dark:text-slate-500"><IconBell className="w-6 h-6" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Upomínky OP bez aktivity</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-gray-500 dark:text-slate-400">Po kolika dnech upozornit:</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={vals.notifDniBezeAktivity}
                    onChange={e => numberChange('notifDniBezeAktivity', Number(e.target.value))}
                    onBlur={() => numberBlur('notifDniBezeAktivity')}
                    disabled={!vals.notifOpBezAktivity}
                    className="w-16 border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FFC93C] disabled:opacity-50"
                  />
                  <span className="text-xs text-gray-500 dark:text-slate-400">dní</span>
                </div>
              </div>
              <Toggle checked={vals.notifOpBezAktivity} onChange={toggle('notifOpBezAktivity')} />
            </div>
          </div>
          <ToggleRow
            icon={<IconCalendar className="w-6 h-6" />}
            title="Upomínky blížících se termínů"
            description="Upozornění na servisní návštěvy a termíny aktivit."
            checked={vals.notifBlizkTermin}
            onChange={toggle('notifBlizkTermin')}
          />
          <ToggleRow
            icon="🆕"
            title="Notifikace o nových OP"
            description="Zobrazit nové obchodní případy v posledních 24 hodinách."
            checked={vals.notifNovyOP}
            onChange={toggle('notifNovyOP')}
          />
          <ToggleRow
            icon={<IconBox className="w-6 h-6" />}
            title="Notifikace o nových leadech"
            description="Bell notifikace adminy a obchodníkům při novém leadu z webového formuláře."
            checked={vals.notifNovyLead}
            onChange={toggle('notifNovyLead')}
            disabled={!isPremiumPlus}
            badge={!isPremiumPlus ? 'Standard+' : undefined}
          />
        </SectionCard>

        {/* Nabídky */}
        <SectionCard title="Nabídky a produkty">
          <div className="py-4 px-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-8 flex justify-center text-gray-400 dark:text-slate-500"><IconClipboard className="w-6 h-6" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Výchozí sazba DPH</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Předvyplněná sazba pro nové nabídky a produkty.</p>
              </div>
              <select
                value={vals.defaultDphSazba}
                onChange={e => { numberChange('defaultDphSazba', Number(e.target.value)); save({ defaultDphSazba: Number(e.target.value) }) }}
                className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FFC93C]"
              >
                <option value={0}>0 %</option>
                <option value={12}>12 %</option>
                <option value={21}>21 %</option>
              </select>
            </div>
            <div className="flex items-center gap-4 border-t border-gray-100 dark:border-slate-700 pt-4">
              <div className="flex-shrink-0 text-2xl w-8 text-center">⏳</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Platnost nabídky</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Výchozí počet dní platnosti nabídky.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={vals.defaultPlatnostDni}
                  onChange={e => numberChange('defaultPlatnostDni', Number(e.target.value))}
                  onBlur={() => numberBlur('defaultPlatnostDni')}
                  className="w-20 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FFC93C]"
                />
                <span className="text-sm text-gray-500 dark:text-slate-400">dní</span>
              </div>
            </div>
          </div>
          <ToggleRow
            icon={<IconActivity className="w-6 h-6" />}
            title="Zobrazit nákladové ceny technikům"
            description="Technici uvidí nákupní ceny a marže produktů."
            checked={vals.zobrazitNakladoveCeny}
            onChange={toggle('zobrazitNakladoveCeny')}
          />
        </SectionCard>

        {/* Servis */}
        <SectionCard title="Servisní modul">
          <ToggleRow
            icon={<IconDocument className="w-6 h-6" />}
            title="Automaticky odesílat servisní protokol klientovi"
            description="Po dokončení návštěvy pošle systém email klientovi s PDF protokolem jako přílohou."
            checked={vals.sendServisniProtokolEmail}
            onChange={toggle('sendServisniProtokolEmail')}
            disabled={!isPlatinum}
            badge={!isPlatinum ? 'Professional' : undefined}
          />
        </SectionCard>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {toast}
        </div>
      )}
    </>
  )
}
