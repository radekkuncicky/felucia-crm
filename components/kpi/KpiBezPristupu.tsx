import EmptyState from '@/components/ui/EmptyState'

/**
 * Místo tichého přesměrování z /kpi (UX audit 3, bod 8): vysvětlí, proč KPI nejsou vidět.
 * `bezOpravneni` = uživatel nemá oprávnění KPI; jinak má, ale modul KPI je v organizaci vypnutý.
 */
export function KpiBezPristupu({ bezOpravneni, spravaUzivatelu }: { bezOpravneni: boolean; spravaUzivatelu: boolean }) {
  return (
    <div className="max-w-6xl mx-auto w-full">
      <EmptyState
        title="KPI vedení tu nevidíte"
        description={bezOpravneni
          ? 'KPI vedení jsou ve výchozím nastavení jen pro roli Jednatel. Přístup může přidělit správce u uživatele v Nastavení → Uživatelé (oprávnění „KPI vedení“).'
          : 'Modul KPI vedení není pro vaši organizaci zapnutý. Pro zapnutí napište podpoře Felucie.'}
        actionLabel={bezOpravneni && spravaUzivatelu ? 'Nastavit uživatele' : 'Zpět na Nástěnku'}
        actionHref={bezOpravneni && spravaUzivatelu ? '/settings/users' : '/dashboard'}
      />
    </div>
  )
}
