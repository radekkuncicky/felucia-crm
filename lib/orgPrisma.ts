import { prismaApp, rlsActive } from './prisma'

/**
 * Modely s přímým sloupcem `orgId`. Drženo v sync se schema.prisma
 * testem tests/orgPrisma.models.test.ts — při přidání modelu s orgId
 * test spadne, dokud ho nepřidáš sem.
 *
 * Dětské tabulky bez orgId (QuoteItem, ZakazkaPolozka, …) jsou scopované
 * přes rodiče a extension jejich where/data nefiltruje — přistupuj k nim
 * přes rodiče (např. `deal: { orgId }`). App.org_id se pro ně přesto
 * nastavuje stejně jako pro tenantní modely, jinak by RLS na rodičovské
 * tabulce takový vztahový filtr tiše zablokovala.
 */
export const TENANT_MODELS = new Set([
  'User',
  'Client',
  'Category',
  'Deal',
  'Product',
  'Cenik',
  'Quote',
  'ContractTemplate',
  'QuoteTemplate',
  'OrgTemplateMapping',
  'Photo',
  'ApiKey',
  'AuditLog',
  'CustomField',
  'CustomFieldValue',
  'VisibilityNode',
  'Extension',
  'OrgSettings',
  'OrgEmailSettings',
  'Zarizeni',
  'ServisniKontrakt',
  'ServisniZakazka',
  'ServisniPolozka',
  'Notification',
  'Zakazka',
  'ZakazkaEtapa',
  'ZakázkaDokument',
  'ZakazkaKontakt',
  'SkladPohyb',
  'Predavak',
  'Vyuctovani',
  'Sod',
  'Document',
  'Lead',
  'AiUsageLog',
  'WebhookEndpoint',
  'WebhookOutbox',
])

// where přes AND: pokud volající pošle vlastní orgId, podmínky se sečtou —
// cizí orgId tak nikdy nic nevrátí, místo aby ho šlo přepsat
function scopeWhere(where: unknown, orgId: string) {
  return where ? { AND: [{ orgId }, where] } : { orgId }
}

function scopeData(data: unknown, orgId: string, model: string) {
  const d = data as Record<string, unknown>
  if (d.organization) {
    throw new Error(
      `orgPrisma: u modelu ${model} použij orgId místo relace organization`
    )
  }
  if (d.orgId !== undefined && d.orgId !== orgId) {
    throw new Error(
      `orgPrisma: pokus o zápis do ${model} s cizím orgId (${d.orgId})`
    )
  }
  return { ...d, orgId }
}

/**
 * Prisma client s automaticky vynuceným tenant scopem — dvě vrstvy:
 *
 * 1. Aplikační (extension): orgId se přidá do where / zvaliduje v datech.
 * 2. DB (Row Level Security, prisma/rls.sql): klient se připojuje jako role
 *    nanto_app a před dotazem nastaví app.org_id (set_config, transaction-
 *    local). Policy bez kontextu nevrátí nic (fail-closed) — chrání i vnořené
 *    zápisy relací a budoucí chyby v extension. Bez RLS_DB_* v env vrstva 2
 *    odpadá (fallback na owner klient).
 *
 * - čtení/update/delete: orgId se přidá do where (u unique dotazů jako
 *   extra filtr — záznam jiné org se tváří jako neexistující)
 * - create/createMany/upsert: orgId se doplní do dat; zápis s cizím
 *   orgId vyhodí chybu. Pozn.: vygenerované typy Prismy orgId v datech
 *   stále vyžadují — předávej ho explicitně, extension ho zvaliduje.
 *
 * Transakce: db.$transaction (obě formy) nastaví app.org_id na začátku
 * transakce; jednotlivé operace mimo transakci se balí do batch transakce
 * [set_config, query]. Raw dotazy ($queryRaw/$executeRaw) mimo transakci
 * kontext nemají — pod RLS nic nevrátí; používej je jen uvnitř
 * db.$transaction, nebo tabulky bez orgId.
 *
 * Použití v API route:
 *   const db = orgPrisma(session.user.orgId)
 *   const clients = await db.client.findMany({ where: { ... } })
 */
export function orgPrisma(orgId: string) {
  if (!orgId) throw new Error('orgPrisma: orgId je povinné')

  const setOrgContext = () =>
    prismaApp.$executeRaw`SELECT set_config('app.org_id', ${orgId}, true)`

  const extended = prismaApp.$extends({
    name: 'orgScope',
    query: {
      $allModels: {
        async $allOperations(params) {
          const { model, operation, args, query } = params
          const a = args as Record<string, unknown>

          // Dětské tabulky bez orgId (QuoteItem, …) tady where/data nedostávají
          // (nemají sloupec orgId) — scopují se ručně v route přes vztah na
          // rodiče (např. `deal: { orgId }`). I tak ale musí mít nastavený
          // app.org_id níž, jinak RLS na rodičovské (tenantní) tabulce ten
          // vztah tiše zablokuje a dotaz nikdy nic nevrátí (fail-closed).
          if (TENANT_MODELS.has(model)) {
            switch (operation) {
              case 'findMany':
              case 'findFirst':
              case 'findFirstOrThrow':
              case 'count':
              case 'aggregate':
              case 'groupBy':
              case 'updateMany':
              case 'updateManyAndReturn':
              case 'deleteMany':
                a.where = scopeWhere(a.where, orgId)
                break

              // unique dotazy: orgId jako dodatečný filtr vedle unique klíče
              case 'findUnique':
              case 'findUniqueOrThrow':
              case 'update':
              case 'delete':
                a.where = { ...(a.where as object), orgId }
                break

              case 'create':
                a.data = scopeData(a.data, orgId, model)
                break

              case 'createMany':
              case 'createManyAndReturn': {
                const data = a.data
                a.data = Array.isArray(data)
                  ? data.map((d) => scopeData(d, orgId, model))
                  : scopeData(data, orgId, model)
                break
              }

              case 'upsert':
                a.where = { ...(a.where as object), orgId }
                a.create = scopeData(a.create, orgId, model)
                break
            }
          }

          // RLS kontext: operace už běžící v transakci ho dostala od
          // proxovaného $transaction; samostatnou operaci zabalíme do
          // batch transakce se set_config (oficiální Prisma RLS vzor).
          // __internalParams je interní API — hlídá ho tests/rls.test.ts.
          const inTransaction = Boolean(
            (params as unknown as { __internalParams?: { transaction?: unknown } })
              .__internalParams?.transaction
          )
          if (!rlsActive || inTransaction) return query(a)

          const client = prismaApp as unknown as { $transaction(ops: unknown[]): Promise<unknown[]> }
          const [, result] = await client.$transaction([setOrgContext(), query(a)])
          return result
        },
      },
    },
  })

  if (!rlsActive) return extended

  // db.$transaction musí nastavit app.org_id na svém začátku (set_config
  // s is_local=true platí do konce transakce). Interní operace transakci
  // detekují přes __internalParams a znovu se nebalí.
  type TxClient = Parameters<Parameters<typeof extended.$transaction>[0]>[0]
  return new Proxy(extended, {
    get(target, prop, receiver) {
      if (prop !== '$transaction') return Reflect.get(target, prop, receiver)

      return (
        arg: unknown[] | ((tx: TxClient) => Promise<unknown>),
        opts?: object,
      ) => {
        if (typeof arg === 'function') {
          return target.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.org_id', ${orgId}, true)`
            return arg(tx)
          }, opts)
        }
        return target
          .$transaction(
            [target.$executeRaw`SELECT set_config('app.org_id', ${orgId}, true)`, ...arg] as never,
            opts,
          )
          .then((results: unknown[]) => results.slice(1))
      }
    },
  }) as typeof extended
}

export type OrgPrismaClient = ReturnType<typeof orgPrisma>
