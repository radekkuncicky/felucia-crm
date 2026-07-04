import { prisma } from './prisma'

/**
 * Modely s přímým sloupcem `orgId`. Drženo v sync se schema.prisma
 * testem tests/orgPrisma.models.test.ts — při přidání modelu s orgId
 * test spadne, dokud ho nepřidáš sem.
 *
 * Dětské tabulky bez orgId (QuoteItem, ZakazkaPolozka, …) jsou scopované
 * přes rodiče a extension je nefiltruje — přistupuj k nim přes rodiče.
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
 * Prisma client s automaticky vynuceným tenant scopem.
 *
 * - čtení/update/delete: orgId se přidá do where (u unique dotazů jako
 *   extra filtr — záznam jiné org se tváří jako neexistující)
 * - create/createMany/upsert: orgId se doplní do dat; zápis s cizím
 *   orgId vyhodí chybu. Pozn.: vygenerované typy Prismy orgId v datech
 *   stále vyžadují — předávej ho explicitně, extension ho zvaliduje.
 *
 * Nepokrývá: $queryRaw/$executeRaw a vnořené relace v include/select
 * (ty jsou org-konzistentní přes FK rodiče).
 *
 * Použití v API route:
 *   const db = orgPrisma(session.user.orgId)
 *   const clients = await db.client.findMany({ where: { ... } })
 */
export function orgPrisma(orgId: string) {
  if (!orgId) throw new Error('orgPrisma: orgId je povinné')

  return prisma.$extends({
    name: 'orgScope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args)

          const a = args as Record<string, unknown>

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

          return query(a)
        },
      },
    },
  })
}

export type OrgPrismaClient = ReturnType<typeof orgPrisma>
