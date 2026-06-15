import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { importContractFile, MAX_IMPORT_BYTES } from '@/lib/contractImport'
import { NextResponse } from 'next/server'

/**
 * Import šablony smlouvy z .docx (mammoth → HTML) nebo .html (raw).
 * Vrací sanitizované HTML; klient ho vloží do editoru a doplní {{placeholdery}}.
 * Neukládá — to dělá až POST /api/contract-templates (s plan limitem).
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Soubor chybí.' }, { status: 400 })
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return NextResponse.json({ error: 'Soubor je příliš velký (max 5 MB).' }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const result = await importContractFile(file.name, buf)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json(result)
}
