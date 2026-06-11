import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-fel-bg dark:bg-fel-deepnight">
      <p className="text-6xl font-bold text-fel-green mb-2 font-space">404</p>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Stránka nenalezena</h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 max-w-md">
        Stránka, kterou hledáte, neexistuje nebo byla přesunuta.
      </p>
      <Link
        href="/dashboard"
        className="bg-fel-green hover:bg-fel-green-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        Zpět na nástěnku
      </Link>
    </div>
  )
}
