import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { ZakazkaStav } from '@prisma/client'
import { getPerms, forbidden } from '@/lib/permissions'

const validTransitions: Record<ZakazkaStav, ZakazkaStav[]> = {
  NOVA: ['PRIRAZENA'],
  PRIRAZENA: ['NOVA', 'V_REALIZACI'],
  V_REALIZACI: ['PRIRAZENA', 'PREDANA'],
  PREDANA: ['V_REALIZACI', 'VYUCTOVANA'],
  VYUCTOVANA: ['PREDANA', 'HOTOVO'],
  HOTOVO: ['VYUCTOVANA'],
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).zakazkyEdit) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const { stav } = await req.json()

  if (!stav) return NextResponse.json({ error: 'Chybí stav' }, { status: 400 })

  const zakazka = await db.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowed = validTransitions[zakazka.stav] ?? []
  if (!allowed.includes(stav)) {
    return NextResponse.json({ error: `Přechod ze stavu ${zakazka.stav} do ${stav} není povolen` }, { status: 422 })
  }

  const updated = await db.zakazka.update({
    where: { id: params.id },
    data: {
      stav,
      uzavreno: stav === 'HOTOVO' ? new Date() : undefined,
    },
  })

  await db.auditLog.create({
    data: {
      orgId,
      userId: session.user.id,
      typAkce: 'UPDATE',
      typZaznamu: 'Zakazka',
      zaznamId: params.id,
      zaznamNazev: zakazka.cislo,
      zmeny: { stavPred: zakazka.stav, stavPo: stav },
    },
  })

  return NextResponse.json(updated)
}
