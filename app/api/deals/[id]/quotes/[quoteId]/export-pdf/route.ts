import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { formatDate, formatKcPresne } from '@/lib/format'

export async function GET(req: Request, { params }: { params: { id: string; quoteId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const quote = await db.quote.findFirst({
    where: { id: params.quoteId, dealId: params.id, orgId },
    include: {
      items: { orderBy: { id: 'asc' } },
      deal: {
        include: {
          client: true,
          organization: true,
        }
      }
    }
  })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const celkem = quote.items.reduce((s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus), 0)
  const dph = celkem * (quote.dphSazba / 100)
  const celkemSDph = celkem + dph
  const org = quote.deal.organization
  const client = quote.deal.client
  const deal = quote.deal

  const itemsHtml = quote.items.map((item, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#f8f9fa'}">
      <td style="padding:10px 14px;border-bottom:1px solid #eee">${idx + 1}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #eee">${item.nazev}${item.poznamky ? `<br><small style="color:#888">${item.poznamky}</small>` : ''}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:center">${Number(item.mnozstvi)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:right">${formatKcPresne(Number(item.cenaZaKus))}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:right;font-weight:500">${formatKcPresne((Number(item.mnozstvi) * Number(item.cenaZaKus)))}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<title>Nabídka - ${quote.nazev}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #1A1A2E; background: #fff; font-size: 14px; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px; }
  .header { border-bottom: 3px solid #E8340A; padding-bottom: 24px; margin-bottom: 32px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .doc-type { font-size: 28px; font-weight: 700; color: #E8340A; }
  .doc-meta { text-align: right; font-size: 13px; color: #666; }
  .kod { font-size: 18px; font-weight: 700; color: #1A1A2E; }
  .info-bar { margin-top: 8px; font-size: 12px; color: #888; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px; }
  .party-card { background: #f8f9fa; border-left: 4px solid #E8340A; padding: 16px; border-radius: 4px; }
  .party-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #E8340A; letter-spacing: 1px; margin-bottom: 8px; }
  .party-name { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
  .party-detail { font-size: 12px; color: #555; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { background: #1A1A2E; color: #fff; }
  thead th { padding: 12px 14px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; }
  thead th:last-child, thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
  thead th:nth-child(3) { text-align: center; }
  .total-section { margin-left: auto; width: 300px; }
  .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; font-size: 13px; }
  .total-final { display: flex; justify-content: space-between; padding: 12px 0; font-size: 16px; font-weight: 700; color: #E8340A; border-top: 2px solid #E8340A; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; }
  .sig-box { border-top: 1px solid #ccc; padding-top: 8px; font-size: 12px; color: #666; }
  @media print { .no-print { display: none; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <div class="no-print" style="margin-bottom:20px;padding:12px;background:#f0f4ff;border-radius:8px;display:flex;gap:12px;align-items:center">
    <button onclick="window.print()" style="background:#1A1A2E;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer">🖨 Tisknout / Uložit jako PDF</button>
    <span style="font-size:13px;color:#666">Pro uložení jako PDF: vyberte "Uložit jako PDF" v tiskovém dialogu</span>
  </div>

  <div class="header">
    <div class="header-top">
      <div>
        <div class="doc-type">CENOVÁ NABÍDKA</div>
        <div class="info-bar">Datum: ${formatDate(new Date())} &nbsp;|&nbsp; Platnost: 30 dní &nbsp;|&nbsp; ${quote.nazev}</div>
      </div>
      <div class="doc-meta">
        <div class="kod">${deal.kod ?? ''}</div>
      </div>
    </div>
  </div>

  <div class="parties">
    <div class="party-card">
      <div class="party-label">Zhotovitel</div>
      <div class="party-name">${org.nazev}</div>
      <div class="party-detail">
        ${org.ico ? `IČ: ${org.ico}<br>` : ''}
        ${org.sidlo ? `${org.sidlo}<br>` : ''}
        ${org.email ? `${org.email}<br>` : ''}
        ${org.telefon ? `${org.telefon}` : ''}
      </div>
    </div>
    <div class="party-card">
      <div class="party-label">Objednatel</div>
      <div class="party-name">${client.jmeno} ${client.prijmeni}</div>
      <div class="party-detail">
        ${client.email ? `${client.email}<br>` : ''}
        ${client.telefon ? `${client.telefon}<br>` : ''}
        ${deal.adresaDila ? `${deal.adresaDila}` : ''}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40px">#</th>
        <th>Popis produktu / služby</th>
        <th style="width:60px;text-align:center">Ks</th>
        <th style="width:130px;text-align:right">Cena / MJ</th>
        <th style="width:140px;text-align:right">Cena celkem</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="total-section">
    <div class="total-row"><span>Celkem bez DPH</span><span>${formatKcPresne(celkem)}</span></div>
    <div class="total-row"><span>DPH ${quote.dphSazba}%</span><span>${formatKcPresne(dph)}</span></div>
    <div class="total-final"><span>Cena celkem s DPH</span><span>${formatKcPresne(celkemSDph)}</span></div>
  </div>

  ${quote.popis ? `<div style="margin-top:24px;padding:16px;background:#fff8f8;border:1px solid #fcc;border-radius:4px"><p style="font-size:11px;font-weight:700;color:#E8340A;text-transform:uppercase;margin-bottom:6px">Poznámky</p><p style="font-size:13px">${quote.popis}</p></div>` : ''}

  <div class="signatures">
    <div class="sig-box">
      <p>Zhotovitel: ${org.nazev}</p><br><br><br>
      <p>Podpis: ________________________________</p>
      <p style="margin-top:4px">Datum: ________________</p>
    </div>
    <div class="sig-box">
      <p>Objednatel: ${client.jmeno} ${client.prijmeni}</p><br><br><br>
      <p>Podpis: ________________________________</p>
      <p style="margin-top:4px">Datum: ________________</p>
    </div>
  </div>
</div>
</body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    }
  })
}
