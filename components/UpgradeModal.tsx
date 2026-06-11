'use client'

interface Props {
  onClose: () => void
  reason?: string
}

const FEATURES = [
  { label: 'Obchodní případy', starter: '20', standard: 'Neomezeno' },
  { label: 'Uživatelé', starter: '1', standard: '5' },
  { label: 'AI asistentka Dáša', starter: '✗', standard: '500 zpráv/měs' },
  { label: 'Šablony nabídek', starter: '1 šablona', standard: 'Všechny šablony' },
  { label: 'Prioritní podpora', starter: '48 h', standard: '24 h' },
  { label: 'Export PDF', starter: '✓', standard: '✓' },
]

export default function UpgradeModal({ onClose, reason }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-lg p-8">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🚀</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Přejděte na Standard
          </h2>
          {reason && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">{reason}</p>
          )}
          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
            Odemkněte plný potenciál Felucia CRM
          </p>
        </div>

        {/* Comparison table */}
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Funkce</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase text-center">Starter</th>
                <th className="px-4 py-3 text-xs font-semibold text-green-600 dark:text-green-400 uppercase text-center">Standard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {FEATURES.map(f => (
                <tr key={f.label} className="hover:bg-gray-50 dark:hover:bg-slate-700/20">
                  <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{f.label}</td>
                  <td className="px-4 py-3 text-center text-gray-500 dark:text-slate-400">{f.starter}</td>
                  <td className="px-4 py-3 text-center font-medium text-gray-900 dark:text-white">{f.standard}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Price + CTA */}
        <div className="text-center mb-6">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">999 Kč<span className="text-base font-normal text-gray-500 dark:text-slate-400">/měsíc</span></p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">bez DPH · měsíční předplatné · zrušení kdykoliv</p>
        </div>

        <a
          href="mailto:info@felucia.io?subject=Zájem o Standard plán Felucia CRM"
          className="block w-full text-center bg-[#4CAF50] hover:bg-[#43A047] text-white font-bold py-3.5 rounded-xl transition-colors text-sm"
        >
          Kontaktovat obchod →
        </a>

        <button
          onClick={onClose}
          className="block w-full text-center mt-3 text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
        >
          Zůstat na Starter plánu
        </button>
      </div>
    </div>
  )
}
