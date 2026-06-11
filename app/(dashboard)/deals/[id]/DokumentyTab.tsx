'use client'

export default function DokumentyTab({ dealKod }: { dealKod: string | null }) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-gray-900">Dokumenty a export</p>
          <p className="text-sm text-gray-500 mt-1">Funkce exportu PDF bude dostupná v příští verzi.</p>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            disabled
            className="opacity-40 cursor-not-allowed flex items-center gap-2 bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportovat nabídku PDF
          </button>
          <button
            disabled
            className="opacity-40 cursor-not-allowed flex items-center gap-2 border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportovat smlouvu PDF
          </button>
        </div>
        {dealKod && (
          <p className="text-xs text-gray-400">Kód OP: {dealKod}</p>
        )}
      </div>
    </div>
  )
}
