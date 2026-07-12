'use client'

import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import Link from 'next/link'
import { formatCislo, formatKcPresne } from '@/lib/format'

// ─── Theme ────────────────────────────────────────────────────────────────────

type ThemeMode = 'felucia' | 'system'

type T = {
  bg: string; bgS: string; bgDrop: string
  ac: string; acL: string; acN: string; atx: string
  grad: string; gradH: string
  tp: string; ts: string; tm: string; tmm: string; tf: string
}

const THEMES: Record<ThemeMode, T> = {
  felucia: {
    bg: '#0A120A', bgS: '#0D1A0E', bgDrop: '#142014',
    ac: '#4CAF50', acL: '#81C784', acN: '76,175,80', atx: '#0A120A',
    grad: 'linear-gradient(135deg,#4CAF50,#81C784)',
    gradH: 'linear-gradient(90deg,#4CAF50,#81C784)',
    tp: '#E8F5E9', ts: '#C8E6C9', tm: '#7AAD7A', tmm: '#5A8A5A', tf: '#4A6B4A',
  },
  system: {
    bg: '#0F172A', bgS: '#111827', bgDrop: '#1E293B',
    ac: '#6366F1', acL: '#818CF8', acN: '99,102,241', atx: '#1E1B4B',
    grad: 'linear-gradient(135deg,#6366F1,#818CF8)',
    gradH: 'linear-gradient(90deg,#6366F1,#818CF8)',
    tp: '#F1F5F9', ts: '#CBD5E1', tm: '#94A3B8', tmm: '#64748B', tf: '#475569',
  },
}

const ThemeContext = createContext<T>(THEMES.felucia)
const useTheme = () => useContext(ThemeContext)

// ─── Types ────────────────────────────────────────────────────────────────────

type DealStatus = 'Zakázka' | 'Nabídka' | 'Před uzavřením' | 'Úspěch' | 'Propadlo'
type View = 'dashboard' | 'deals' | 'clients' | 'calendar' | 'activities' | 'products' | 'dasa' | 'analytics'

interface Deal {
  id: string; code: string; subject: string; client: string
  status: DealStatus; category: string; priceNoVat: string; priceVat: string
}
interface DasaMsg { role: 'user' | 'dasa'; text: string }

// ─── Data ─────────────────────────────────────────────────────────────────────

const CLIENTS = [
  { id: 1, name: 'Bc. Jakub Procházka',   email: 'jakub.prochazka@email.cz', phone: '603 441 872', city: 'Brno',           deals: 2 },
  { id: 2, name: 'Ing. Lenka Horáčková',  email: 'horáčková@stavmont.cz',    phone: '724 883 001', city: 'Olomouc',        deals: 1 },
  { id: 3, name: 'Pavel Šimánek',         email: 'pavel.simanek@gmail.com',  phone: '731 220 449', city: 'Ostrava',        deals: 1 },
  { id: 4, name: 'STAVMONT s.r.o.',       email: 'info@stavmont.cz',         phone: '596 112 233', city: 'Ostrava',        deals: 1 },
  { id: 5, name: 'Mgr. Tereza Blahová',   email: 't.blahova@centrum.cz',     phone: '777 334 892', city: 'Zlín',           deals: 1 },
  { id: 6, name: 'Radoslav Fiala',        email: 'r.fiala@seznam.cz',        phone: '608 771 223', city: 'Frýdek-Místek', deals: 1 },
  { id: 7, name: 'Ing. Miroslav Čech',    email: 'm.cech@techno.cz',         phone: '725 009 441', city: 'Opava',          deals: 1 },
  { id: 8, name: 'Jana Kovářová',         email: 'jana.kovarova@email.cz',   phone: '739 882 114', city: 'Karviná',        deals: 1 },
  { id: 9, name: 'THERMO PLUS s.r.o.',    email: 'info@thermoplus.cz',       phone: '596 774 003', city: 'Havířov',        deals: 1 },
  { id: 10, name: 'Petr Dostál',          email: 'p.dostal@gmail.com',       phone: '602 338 774', city: 'Bohumín',        deals: 1 },
]

const INITIAL_DEALS: Deal[] = [
  { id: '1',  code: 'OP-26-084', subject: 'TČ Viessmann 222-S',   client: 'Bc. Jakub Procházka',  status: 'Před uzavřením', category: 'Tepelné čerpadlo',  priceNoVat: '387 450 Kč', priceVat: '433 944 Kč' },
  { id: '2',  code: 'OP-26-081', subject: 'Rekuperace Zehnder',   client: 'Ing. Lenka Horáčková', status: 'Nabídka',        category: 'Rekuperace',        priceNoVat: '198 750 Kč', priceVat: '222 600 Kč' },
  { id: '3',  code: 'OP-26-079', subject: 'Klimatizace 3+1',      client: 'Pavel Šimánek',        status: 'Zakázka',        category: 'Klimatizace',       priceNoVat: '84 300 Kč',  priceVat: '101 964 Kč' },
  { id: '4',  code: 'OP-26-077', subject: 'VZT výrobní hala',     client: 'STAVMONT s.r.o.',      status: 'Nabídka',        category: 'Vzduchotechnika',   priceNoVat: '542 000 Kč', priceVat: '655 820 Kč' },
  { id: '5',  code: 'OP-26-074', subject: 'Podlahové topení',     client: 'Mgr. Tereza Blahová',  status: 'Zakázka',        category: 'Podlahové vytápění',priceNoVat: '167 800 Kč', priceVat: '187 936 Kč' },
  { id: '6',  code: 'OP-26-071', subject: 'TČ + ohřev TUV',       client: 'Radoslav Fiala',       status: 'Úspěch',         category: 'Tepelné čerpadlo',  priceNoVat: '412 600 Kč', priceVat: '462 112 Kč' },
  { id: '7',  code: 'OP-26-068', subject: 'Decentrální reku',     client: 'Ing. Miroslav Čech',   status: 'Zakázka',        category: 'Rekuperace',        priceNoVat: '63 400 Kč',  priceVat: '71 008 Kč'  },
  { id: '8',  code: 'OP-26-065', subject: 'Klima kanceláře',      client: 'THERMO PLUS s.r.o.',   status: 'Před uzavřením', category: 'Klimatizace',       priceNoVat: '229 900 Kč', priceVat: '278 179 Kč' },
  { id: '9',  code: 'OP-26-061', subject: 'Rekuperace RD',        client: 'Jana Kovářová',        status: 'Nabídka',        category: 'Rekuperace',        priceNoVat: '154 200 Kč', priceVat: '172 704 Kč' },
  { id: '10', code: 'OP-26-058', subject: 'TČ vzduch-voda',       client: 'Petr Dostál',          status: 'Zakázka',        category: 'Tepelné čerpadlo',  priceNoVat: '298 500 Kč', priceVat: '334 320 Kč' },
]

const ACTIVITIES = [
  { date: '30.3.', type: 'Hovor',   client: 'Bc. Jakub Procházka',  note: 'Klient potvrdil zájem, čeká na termín montáže' },
  { date: '29.3.', type: 'Email',   client: 'Ing. Lenka Horáčková', note: 'Odeslána aktualizovaná nabídka Zehnder ComfoAir Q' },
  { date: '28.3.', type: 'Schůzka', client: 'STAVMONT s.r.o.',      note: 'Prohlídka výrobní haly, zaměření VZT tras' },
  { date: '27.3.', type: 'Hovor',   client: 'Pavel Šimánek',        note: 'Domluvena montáž na 15.4., klient souhlasí s cenou' },
  { date: '26.3.', type: 'Úkol',    client: 'Mgr. Tereza Blahová',  note: 'Připravit výkres podlahového topení patro' },
  { date: '25.3.', type: 'Email',   client: 'THERMO PLUS s.r.o.',   note: 'Zaslána technická dokumentace klimatizace Gree' },
  { date: '24.3.', type: 'Schůzka', client: 'Petr Dostál',          note: 'Úvodní konzultace, prohlídka objektu Bohumín' },
  { date: '23.3.', type: 'Hovor',   client: 'Jana Kovářová',        note: 'Klientka má zájem o levnější variantu rekuperace' },
]

const PRODUCTS = [
  { id: 'TC-001', name: 'Viessmann Vitocal 222-S E10', category: 'Tepelná čerpadla', price: 189500, cost: 124000, margin: 34.6 },
  { id: 'TC-002', name: 'Viessmann Vitocal 222-S E14', category: 'Tepelná čerpadla', price: 224900, cost: 148000, margin: 34.2 },
  { id: 'TC-003', name: 'Daikin Altherma 3 8kW',       category: 'Tepelná čerpadla', price: 167400, cost: 109000, margin: 34.9 },
  { id: 'TC-004', name: 'Daikin Altherma 3 12kW',      category: 'Tepelná čerpadla', price: 198700, cost: 131000, margin: 34.1 },
  { id: 'RK-001', name: 'Zehnder ComfoAir Q350',       category: 'Rekuperace',       price: 58900,  cost: 38000,  margin: 35.5 },
  { id: 'RK-002', name: 'Zehnder ComfoAir Q450',       category: 'Rekuperace',       price: 74200,  cost: 48500,  margin: 34.6 },
  { id: 'RK-003', name: 'Atrea Duplex 370 EC',         category: 'Rekuperace',       price: 42800,  cost: 27500,  margin: 35.7 },
  { id: 'RK-004', name: 'Paul Novus 300',              category: 'Rekuperace',       price: 51400,  cost: 33200,  margin: 35.4 },
  { id: 'KL-001', name: 'Mitsubishi MSZ-AP25VG',       category: 'Klimatizace',      price: 28900,  cost: 18500,  margin: 36.0 },
  { id: 'KL-002', name: 'Mitsubishi MSZ-AP35VG',       category: 'Klimatizace',      price: 34700,  cost: 22200,  margin: 36.0 },
  { id: 'KL-003', name: 'Daikin FTXM25R',             category: 'Klimatizace',      price: 27400,  cost: 17500,  margin: 36.1 },
  { id: 'KL-004', name: 'Daikin FTXM35R',             category: 'Klimatizace',      price: 32800,  cost: 20900,  margin: 36.3 },
  { id: 'KL-005', name: 'Gree Pular 2,5kW',           category: 'Klimatizace',      price: 18900,  cost: 11800,  margin: 37.6 },
  { id: 'KL-006', name: 'Gree Clivia 3,5kW',          category: 'Klimatizace',      price: 24600,  cost: 15400,  margin: 37.4 },
  { id: 'KL-007', name: 'Gree Fairy II 5kW',          category: 'Klimatizace',      price: 31200,  cost: 19600,  margin: 37.2 },
]

const CAL_EVENTS = [
  { day: 1,  time: '09:00', title: 'Montáž TČ Viessmann',          client: 'Bc. Jakub Procházka',  city: 'Brno',           type: 'montaz'  },
  { day: 2,  time: '14:00', title: 'Schůzka VZT',                  client: 'STAVMONT s.r.o.',      city: 'Ostrava',        type: 'schuzka' },
  { day: 7,  time: '10:00', title: 'Zaměření podlahového topení',  client: 'Mgr. Tereza Blahová',  city: 'Zlín',           type: 'schuzka' },
  { day: 8,  time: '08:00', title: 'Montáž klimatizace',           client: 'THERMO PLUS s.r.o.',   city: 'Havířov',        type: 'montaz'  },
  { day: 10, time: '15:00', title: 'Předání TČ Fiala',             client: 'Radoslav Fiala',       city: 'Frýdek-Místek', type: 'predani' },
  { day: 14, time: '09:00', title: 'Servis Zehnder',               client: 'Pavel Šimánek',        city: 'Ostrava',        type: 'servis'  },
  { day: 15, time: '11:00', title: 'Montáž klimatizace 3+1',       client: 'Pavel Šimánek',        city: 'Ostrava',        type: 'montaz'  },
  { day: 17, time: '13:00', title: 'Schůzka nabídka TČ',           client: 'Petr Dostál',          city: 'Bohumín',        type: 'schuzka' },
  { day: 22, time: '09:00', title: 'Montáž rekuperace',            client: 'Jana Kovářová',        city: 'Karviná',        type: 'montaz'  },
  { day: 25, time: '14:00', title: 'Předávací protokol VZT',       client: 'STAVMONT s.r.o.',      city: 'Ostrava',        type: 'predani' },
  { day: 28, time: '10:00', title: 'Konzultace TČ',                client: 'nový klient',          city: 'Opava',          type: 'schuzka' },
]

// ─── Style maps ───────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<DealStatus, { bg: string; color: string }> = {
  'Zakázka':         { bg: '#E8F5E9', color: '#2E7D32' },
  'Nabídka':         { bg: '#FFF3E0', color: '#E65100' },
  'Před uzavřením':  { bg: '#F3E5F5', color: '#6A1B9A' },
  'Úspěch':          { bg: '#4CAF50', color: 'white'   },
  'Propadlo':        { bg: '#FFEBEE', color: '#C62828' },
}

const CATEGORY_STYLE: Record<string, { bg: string; color: string }> = {
  'Tepelné čerpadlo':   { bg: '#FFF3E0', color: '#E65100' },
  'Klimatizace':        { bg: '#E3F2FD', color: '#1565C0' },
  'Rekuperace':         { bg: '#E8F5E9', color: '#2E7D32' },
  'Podlahové vytápění': { bg: '#FCE4EC', color: '#880E4F' },
  'Vzduchotechnika':    { bg: '#E8EAF6', color: '#283593' },
  'Tepelná čerpadla':   { bg: '#FFF3E0', color: '#E65100' },
}

const EVENT_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  montaz:  { bg: 'rgba(76,175,80,0.18)',   text: '#81C784', dot: '#4CAF50' },
  schuzka: { bg: 'rgba(66,165,245,0.15)',  text: '#64B5F6', dot: '#42A5F5' },
  servis:  { bg: 'rgba(255,112,67,0.15)',  text: '#FF8A65', dot: '#FF7043' },
  predani: { bg: 'rgba(206,147,216,0.15)', text: '#CE93D8', dot: '#AB47BC' },
}

const ALL_STATUSES: DealStatus[] = ['Zakázka', 'Nabídka', 'Před uzavřením', 'Úspěch', 'Propadlo']

// ─── Mock quotes ──────────────────────────────────────────────────────────────

interface QuoteItem { name: string; qty: number; unit: string; unitPrice: number }
interface MockQuote { name: string; items: QuoteItem[] }

const DEAL_MOCK_QUOTES: Record<string, MockQuote> = {
  '1': { name: 'NAB-26-084 · TČ Viessmann 222-S E10', items: [
    { name: 'Viessmann Vitocal 222-S E10', qty: 1, unit: 'ks', unitPrice: 189500 },
    { name: 'Zásobník teplé vody 300L', qty: 1, unit: 'ks', unitPrice: 28900 },
    { name: 'Hydraulická sestava + expanzní nádoba', qty: 1, unit: 'ks', unitPrice: 24800 },
    { name: 'Montáž TČ a uvedení do provozu', qty: 1, unit: 'kpl', unitPrice: 68000 },
    { name: 'Rozvody a elektroinstalace', qty: 1, unit: 'kpl', unitPrice: 42000 },
    { name: 'Projekt a revize', qty: 1, unit: 'kpl', unitPrice: 14250 },
  ]},
  '2': { name: 'NAB-26-081 · Rekuperace Zehnder ComfoAir Q350', items: [
    { name: 'Zehnder ComfoAir Q350 Luxe', qty: 1, unit: 'ks', unitPrice: 58900 },
    { name: 'Distribuční prvky, mřížky, ventily', qty: 1, unit: 'kpl', unitPrice: 34200 },
    { name: 'Potrubní rozvody Ø 160mm', qty: 42, unit: 'm', unitPrice: 680 },
    { name: 'Montáž a uvedení do provozu', qty: 1, unit: 'kpl', unitPrice: 52000 },
    { name: 'Regulace ComfoCool', qty: 1, unit: 'ks', unitPrice: 18500 },
    { name: 'Projekt a revize', qty: 1, unit: 'kpl', unitPrice: 12150 },
  ]},
  '3': { name: 'NAB-26-079 · Klimatizace 3+1', items: [
    { name: 'Mitsubishi MSZ-AP25VG (vnitřní j.)', qty: 3, unit: 'ks', unitPrice: 28900 },
    { name: 'Mitsubishi MXZ-3F68VF (venkovní j.)', qty: 1, unit: 'ks', unitPrice: 34200 },
    { name: 'Montáž + uvedení do provozu', qty: 1, unit: 'kpl', unitPrice: 18000 },
    { name: 'Spojovací sady a trubky 3/8"', qty: 1, unit: 'kpl', unitPrice: 8400 },
  ]},
  '4': { name: 'NAB-26-077 · VZT výrobní hala', items: [
    { name: 'VZT jednotka Remak AeroMaster XP 10', qty: 2, unit: 'ks', unitPrice: 148000 },
    { name: 'Přívodní a odvodní potrubí ocel', qty: 180, unit: 'm', unitPrice: 480 },
    { name: 'Distribuční prvky (mřížky, difuzory)', qty: 1, unit: 'kpl', unitPrice: 38000 },
    { name: 'Montáž a uvedení do provozu', qty: 1, unit: 'kpl', unitPrice: 98000 },
    { name: 'Projekt, PD dokumentace', qty: 1, unit: 'kpl', unitPrice: 24000 },
    { name: 'Revize elektrická', qty: 1, unit: 'kpl', unitPrice: 8000 },
  ]},
  '5': { name: 'NAB-26-074 · Podlahové topení celý dům', items: [
    { name: 'Potrubí REHAU Rautherm S 17×2', qty: 480, unit: 'm', unitPrice: 98 },
    { name: 'Rozdělovač REHAU HKV-D 8-okruhů', qty: 2, unit: 'ks', unitPrice: 8400 },
    { name: 'Tepelná izolace Mirelon 30mm', qty: 140, unit: 'm²', unitPrice: 180 },
    { name: 'Termoelektrické pohony', qty: 8, unit: 'ks', unitPrice: 890 },
    { name: 'Montáž a regulace', qty: 1, unit: 'kpl', unitPrice: 68000 },
    { name: 'Projekt a hydraulické vyvážení', qty: 1, unit: 'kpl', unitPrice: 12000 },
  ]},
  '6': { name: 'NAB-26-071 · TČ + ohřev TUV — Varianta A', items: [
    { name: 'Daikin Altherma 3 12kW', qty: 1, unit: 'ks', unitPrice: 198700 },
    { name: 'Zásobník kombinovaný 400L', qty: 1, unit: 'ks', unitPrice: 42000 },
    { name: 'Hydraulická sestava', qty: 1, unit: 'ks', unitPrice: 22400 },
    { name: 'Montáž a zprovoznění', qty: 1, unit: 'kpl', unitPrice: 78000 },
    { name: 'Zapojení elektro + jistič', qty: 1, unit: 'kpl', unitPrice: 28500 },
    { name: 'Projekt a revize', qty: 1, unit: 'kpl', unitPrice: 16000 },
  ]},
}

function getMockQuote(deal: Deal): MockQuote {
  return DEAL_MOCK_QUOTES[deal.id] ?? {
    name: `NAB-${deal.code.slice(3)} · ${deal.subject}`,
    items: [
      { name: deal.subject, qty: 1, unit: 'kpl', unitPrice: Math.round(parseInt(deal.priceNoVat.replace(/\D/g, '')) * 0.55) },
      { name: 'Montáž a uvedení do provozu', qty: 1, unit: 'kpl', unitPrice: Math.round(parseInt(deal.priceNoVat.replace(/\D/g, '')) * 0.30) },
      { name: 'Materiál a spojovací prvky', qty: 1, unit: 'kpl', unitPrice: Math.round(parseInt(deal.priceNoVat.replace(/\D/g, '')) * 0.10) },
      { name: 'Projekt a dokumentace', qty: 1, unit: 'kpl', unitPrice: Math.round(parseInt(deal.priceNoVat.replace(/\D/g, '')) * 0.05) },
    ],
  }
}

// ─── Client contacts ──────────────────────────────────────────────────────────

const CLIENT_CONTACTS: Record<string, { phone: string; email: string; address: string }> = {
  'Bc. Jakub Procházka':  { phone: '603 441 872', email: 'jakub.prochazka@email.cz',  address: 'Mendlovo nám. 12, Brno' },
  'Ing. Lenka Horáčková': { phone: '724 883 001', email: 'horáčková@stavmont.cz',     address: 'Horní 44, Olomouc' },
  'Pavel Šimánek':        { phone: '731 220 449', email: 'pavel.simanek@gmail.com',   address: 'Nádražní 7, Ostrava' },
  'STAVMONT s.r.o.':      { phone: '596 112 233', email: 'info@stavmont.cz',          address: 'Průmyslová 18, Ostrava' },
  'Mgr. Tereza Blahová':  { phone: '777 334 892', email: 't.blahova@centrum.cz',      address: 'Masarykova 3, Zlín' },
  'Radoslav Fiala':       { phone: '608 771 223', email: 'r.fiala@seznam.cz',         address: 'Lesní 5, Frýdek-Místek' },
  'Ing. Miroslav Čech':   { phone: '725 009 441', email: 'm.cech@techno.cz',          address: 'Opavská 22, Opava' },
  'Jana Kovářová':        { phone: '739 882 114', email: 'jana.kovarova@email.cz',    address: 'Komenského 9, Karviná' },
  'THERMO PLUS s.r.o.':   { phone: '596 774 003', email: 'info@thermoplus.cz',        address: 'Havlíčkova 31, Havířov' },
  'Petr Dostál':          { phone: '602 338 774', email: 'p.dostal@gmail.com',        address: 'Bohumínská 14, Bohumín' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(n: number) {
  return formatCislo(n) + ' Kč'
}

function getDasaReply(msg: string): string {
  const l = msg.toLowerCase()
  if (l.includes('nabídka') || l.includes('nabídku') || l.includes('nabidka') || l.includes('nabidku'))
    return 'Rozumím — chcete vytvořit novou nabídku. V demo prostředí nemohu ukládat data, ale v reálném systému bych se zeptala: Pro kterého klienta? Jaká technologie? Mám použít vzorovou nabídku?'
  if (l.includes(' op') || l.includes('případ') || l.includes('pripad') || l.includes('zakázku') || l.includes('zakazku'))
    return 'Nový obchodní případ — super! Potřebuji vědět: jméno klienta, technologii a předmět zakázky. V reálném systému bych ho vytvořila přímo z této konverzace.'
  if (l.includes('servis') || l.includes('kontrakt'))
    return 'Servisní kontrakt je dostupný v plánu Platinum. Zahrnuje automatické plánování návštěv, evidenci zařízení a upomínky. Chcete vědět více?'
  if (l.includes('cena') || l.includes('produkt') || l.includes('katalog'))
    return 'V katalogu máme 15 produktů ve 3 kategoriích — tepelná čerpadla, rekuperace a klimatizace. Nejprodávanější je Viessmann Vitocal 222-S E10 za 189 500 Kč. Chcete sestavit nabídku?'
  return 'Jsem Dáša, AI asistentka Felucia CRM. V demo prostředí mám omezené možnosti, ale v reálném systému vám pomůžu vytvářet nabídky, spravovat zakázky a plánovat aktivity. Co vás zajímá?'
}

function activityIcon(type: string) {
  const paths: Record<string, string> = {
    Hovor:   'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
    Email:   'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    Schůzka: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    Úkol:    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  }
  return (
    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={paths[type] ?? paths.Úkol} />
    </svg>
  )
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status, onChange }: { status: DealStatus; onChange: (s: DealStatus) => void }) {
  const t = useTheme()
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const s = STATUS_STYLE[status]

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(o => !o)
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = () => setOpen(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  return (
    <div style={{ display: 'inline-block' }}>
      <button ref={btnRef} onClick={handleOpen}
        style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: s.bg, color: s.color, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
        {status}
        <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, background: t.bgDrop, border: `1px solid rgba(${t.acN},0.25)`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 9999, minWidth: 150, overflow: 'hidden' }}>
          {ALL_STATUSES.map(st => {
            const ss = STATUS_STYLE[st]
            return (
              <button key={st} onClick={() => { onChange(st); setOpen(false) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', fontFamily: 'Inter,sans-serif', fontSize: 12, background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = `rgba(${t.acN},0.1)`)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 5, background: ss.bg, color: ss.color, fontSize: 11, fontWeight: 600 }}>{st}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── SlideOver ────────────────────────────────────────────────────────────────

function SlideOver({ deal, onClose, onOpenDetail }: { deal: Deal | null; onClose: () => void; onOpenDetail: () => void }) {
  const t = useTheme()
  if (!deal) return null
  const s = STATUS_STYLE[deal.status]
  const slideActivities = deal.code === 'OP-26-084'
    ? [{ date: '30.3.', type: 'Hovor', note: 'Klient potvrdil zájem, čeká na termín montáže' }, { date: '22.3.', type: 'Email', note: 'Odeslána nabídka TČ Viessmann' }, { date: '15.3.', type: 'Schůzka', note: 'Prohlídka objektu, zaměření strojovny' }]
    : ACTIVITIES.filter(a => a.client === deal.client).slice(0, 3).map(a => ({ date: a.date, type: a.type, note: a.note }))

  return (
    <>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40, borderRadius: 20 }} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 480, maxWidth: '90%', background: t.bgS, borderLeft: `1px solid rgba(${t.acN},0.2)`, borderRadius: '0 20px 20px 0', zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'slideInRight 0.2s ease-out' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid rgba(${t.acN},0.1)`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: t.tf }}>{deal.code}</span>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: s.bg, color: s.color }}>{deal.status}</span>
            </div>
            <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, color: t.tp, margin: 0 }}>{deal.subject}</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={onOpenDetail}
              style={{ background: t.ac, border: 'none', borderRadius: 7, padding: '5px 12px', color: 'white', fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              Otevřít OP
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.tf, padding: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = t.tp)} onMouseLeave={e => (e.currentTarget.style.color = t.tf)}>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {/* Client */}
          <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.tf, marginBottom: 8 }}>Klient</p>
          <div style={{ background: `rgba(${t.acN},0.06)`, borderRadius: 10, padding: '12px 14px', border: `1px solid rgba(${t.acN},0.1)`, marginBottom: 18 }}>
            <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 14, fontWeight: 600, color: t.tp, margin: '0 0 5px' }}>{deal.client}</p>
            {deal.code === 'OP-26-084' && <>
              <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: t.tm, margin: '0 0 2px' }}>603 441 872</p>
              <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: t.tm, margin: 0 }}>jakub.prochazka@email.cz</p>
            </>}
          </div>
          {/* Prices */}
          <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.tf, marginBottom: 8 }}>Ceny</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 18 }}>
            {[['Kategorie', deal.category], ['Bez DPH', deal.priceNoVat], ['S DPH', deal.priceVat]].map(([l, v]) => (
              <div key={l} style={{ background: `rgba(${t.acN},0.04)`, borderRadius: 8, padding: '9px 11px', border: `1px solid rgba(${t.acN},0.08)` }}>
                <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, color: t.tf, margin: '0 0 3px' }}>{l}</p>
                <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 600, color: t.ts, margin: 0 }}>{v}</p>
              </div>
            ))}
          </div>
          {/* Quote */}
          <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.tf, marginBottom: 8 }}>Nabídky</p>
          <div style={{ background: `rgba(${t.acN},0.06)`, borderRadius: 10, padding: '11px 14px', border: `1px solid rgba(${t.acN},0.1)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 600, color: t.ts, margin: '0 0 2px' }}>{`NAB-${deal.code.slice(3)} · ${deal.subject}${deal.code === 'OP-26-084' ? ' E10' : ''}`}</p>
              <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: t.tm, margin: 0 }}>{deal.priceNoVat}</p>
            </div>
            <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: '#E8F5E9', color: '#2E7D32' }}>Aktivní</span>
          </div>
          {/* Activities */}
          <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.tf, marginBottom: 10 }}>Aktivity</p>
          {slideActivities.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < slideActivities.length - 1 ? 14 : 0 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: `rgba(${t.acN},0.1)`, border: `1px solid rgba(${t.acN},0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ac, flexShrink: 0 }}>
                {activityIcon(a.type)}
              </div>
              <div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 600, color: t.ts }}>{a.type}</span>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: t.tf }}>{a.date}</span>
                </div>
                <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: t.tm, margin: 0 }}>{a.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── DealDetailView ───────────────────────────────────────────────────────────

type DetailTab = 'prehled' | 'nabidky' | 'aktivity'

function DealDetailView({ deal, onBack, onStatusChange }: {
  deal: Deal
  onBack: () => void
  onStatusChange: (id: string, s: DealStatus) => void
}) {
  const t = useTheme()
  const [tab, setTab] = useState<DetailTab>('prehled')
  const [expandedQuote, setExpandedQuote] = useState(true)
  const s = STATUS_STYLE[deal.status]
  const cat = CATEGORY_STYLE[deal.category] ?? { bg: '#E8F5E9', color: '#2E7D32' }
  const contact = CLIENT_CONTACTS[deal.client]
  const quote = getMockQuote(deal)
  const quoteTotal = quote.items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0)
  const dealActivities = [...ACTIVITIES.filter(a => a.client === deal.client)]
  if (dealActivities.length === 0 && deal.code === 'OP-26-084') {
    dealActivities.push(
      { date: '30.3.', type: 'Hovor',   client: deal.client, note: 'Klient potvrdil zájem, čeká na termín montáže' },
      { date: '22.3.', type: 'Email',   client: deal.client, note: 'Odeslána nabídka TČ Viessmann' },
      { date: '15.3.', type: 'Schůzka', client: deal.client, note: 'Prohlídka objektu, zaměření strojovny' },
    )
  }

  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'prehled',  label: 'Přehled' },
    { id: 'nabidky',  label: 'Nabídky' },
    { id: 'aktivity', label: 'Aktivity' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.bg }}>
      {/* Header */}
      <div style={{ padding: '14px 22px', borderBottom: `1px solid rgba(${t.acN},0.12)`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button onClick={onBack}
            style={{ background: `rgba(${t.acN},0.08)`, border: `1px solid rgba(${t.acN},0.18)`, borderRadius: 7, padding: '4px 10px', color: t.tm, fontFamily: 'Inter,sans-serif', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            Zpět
          </button>
          <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: t.tf }}>{deal.code}</span>
          <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: s.bg, color: s.color }}>{deal.status}</span>
          <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: cat.bg, color: cat.color, marginLeft: 'auto' }}>{deal.category}</span>
        </div>
        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 19, fontWeight: 700, color: t.tp, margin: '0 0 12px', letterSpacing: '-0.01em' }}>{deal.subject}</h2>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: tab === tb.id ? 600 : 400, padding: '6px 14px', borderRadius: '7px 7px 0 0', background: tab === tb.id ? `rgba(${t.acN},0.15)` : 'transparent', border: tab === tb.id ? `1px solid rgba(${t.acN},0.2)` : '1px solid transparent', borderBottom: tab === tb.id ? `1px solid ${t.bg}` : '1px solid transparent', color: tab === tb.id ? t.ac : t.tf, cursor: 'pointer', marginBottom: -1 }}>
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>

        {/* ── Přehled ── */}
        {tab === 'prehled' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 900 }}>
            {/* Klient */}
            <div style={{ background: `rgba(${t.acN},0.04)`, border: `1px solid rgba(${t.acN},0.1)`, borderRadius: 12, padding: '16px 18px' }}>
              <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.tf, marginBottom: 12 }}>Klient</p>
              <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15, fontWeight: 700, color: t.tp, margin: '0 0 10px' }}>{deal.client}</p>
              {contact && <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <svg width="13" height="13" fill="none" stroke={t.tf} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: t.ts }}>{contact.phone}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <svg width="13" height="13" fill="none" stroke={t.tf} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: t.ts }}>{contact.email}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="13" height="13" fill="none" stroke={t.tf} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: t.ts }}>{contact.address}</span>
                </div>
              </>}
            </div>
            {/* Stav OP */}
            <div style={{ background: `rgba(${t.acN},0.04)`, border: `1px solid rgba(${t.acN},0.1)`, borderRadius: 12, padding: '16px 18px' }}>
              <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.tf, marginBottom: 12 }}>Stav obchodního případu</p>
              <div style={{ marginBottom: 12 }}>
                <StatusBadge status={deal.status} onChange={st => onStatusChange(deal.id, st)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['Kategorie', deal.category], ['Bez DPH', deal.priceNoVat], ['S DPH', deal.priceVat], ['Obchodník', 'Tomáš Novák']].map(([l, v]) => (
                  <div key={l} style={{ background: `rgba(${t.acN},0.04)`, borderRadius: 8, padding: '8px 10px' }}>
                    <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, color: t.tf, margin: '0 0 2px' }}>{l}</p>
                    <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 600, color: t.ts, margin: 0 }}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Poslední aktivity */}
            <div style={{ background: `rgba(${t.acN},0.04)`, border: `1px solid rgba(${t.acN},0.1)`, borderRadius: 12, padding: '16px 18px', gridColumn: '1 / -1' }}>
              <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.tf, marginBottom: 12 }}>Poslední aktivity</p>
              {dealActivities.length === 0 ? (
                <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: t.tf }}>Žádné aktivity</p>
              ) : dealActivities.slice(0, 3).map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < 2 ? 12 : 0, paddingBottom: i < 2 ? 12 : 0, borderBottom: i < 2 ? `1px solid rgba(${t.acN},0.07)` : 'none' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: `rgba(${t.acN},0.1)`, border: `1px solid rgba(${t.acN},0.18)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ac, flexShrink: 0 }}>
                    {activityIcon(a.type)}
                  </div>
                  <div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 600, color: t.ts }}>{a.type}</span>
                      <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: t.tf }}>{a.date}</span>
                    </div>
                    <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: t.tm, margin: 0 }}>{a.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Nabídky ── */}
        {tab === 'nabidky' && (
          <div style={{ maxWidth: 860 }}>
            <div style={{ background: `rgba(${t.acN},0.04)`, border: `1px solid rgba(${t.acN},0.12)`, borderRadius: 12, overflow: 'hidden' }}>
              {/* Quote header */}
              <div style={{ padding: '13px 18px', borderBottom: `1px solid rgba(${t.acN},0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => setExpandedQuote(e => !e)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="14" height="14" fill="none" stroke={t.ac} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 600, color: t.ts }}>{quote.name}</span>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: '#E8F5E9', color: '#2E7D32' }}>Aktivní</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 700, color: t.tp }}>{formatCislo(quoteTotal)} Kč</span>
                  <svg width="14" height="14" fill="none" stroke={t.tf} viewBox="0 0 24 24" style={{ transform: expandedQuote ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                </div>
              </div>
              {/* Quote items table */}
              {expandedQuote && <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 100px 110px', padding: '8px 18px', background: `rgba(${t.acN},0.04)`, borderBottom: `1px solid rgba(${t.acN},0.08)` }}>
                  {['POLOŽKA', 'MNŽ', 'JED', 'CENA/JED', 'CELKEM'].map(h => (
                    <span key={h} style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: t.tf }}>{h}</span>
                  ))}
                </div>
                {quote.items.map((item, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 100px 110px', padding: '10px 18px', borderBottom: i < quote.items.length - 1 ? `1px solid rgba(${t.acN},0.06)` : 'none', alignItems: 'center' }}
                    onMouseEnter={e => (e.currentTarget.style.background = `rgba(${t.acN},0.04)`)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: t.ts }}>{item.name}</span>
                    <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: t.tm }}>{item.qty}</span>
                    <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: t.tm }}>{item.unit}</span>
                    <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: t.tm }}>{formatCislo(item.unitPrice)} Kč</span>
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 600, color: t.tp }}>{formatKcPresne(item.qty * item.unitPrice)}</span>
                  </div>
                ))}
                {/* Totals */}
                <div style={{ padding: '12px 18px', borderTop: `1px solid rgba(${t.acN},0.12)`, background: `rgba(${t.acN},0.04)` }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 32 }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: t.tf, margin: '0 0 3px' }}>Celkem bez DPH</p>
                      <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 700, color: t.tp, margin: 0 }}>{formatCislo(quoteTotal)} Kč</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: t.tf, margin: '0 0 3px' }}>DPH 21 %</p>
                      <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 700, color: t.tm, margin: 0 }}>{Math.round(quoteTotal * 0.21).toLocaleString('cs-CZ')} Kč</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: t.tf, margin: '0 0 3px' }}>Celkem s DPH</p>
                      <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 800, color: t.ac, margin: 0 }}>{Math.round(quoteTotal * 1.21).toLocaleString('cs-CZ')} Kč</p>
                    </div>
                  </div>
                </div>
              </>}
            </div>
          </div>
        )}

        {/* ── Aktivity ── */}
        {tab === 'aktivity' && (
          <div style={{ maxWidth: 700 }}>
            {dealActivities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: t.tf, fontFamily: 'Inter,sans-serif', fontSize: 13 }}>
                Žádné aktivity pro tento obchodní případ
              </div>
            ) : dealActivities.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 16, paddingBottom: 16, borderBottom: i < dealActivities.length - 1 ? `1px solid rgba(${t.acN},0.08)` : 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: `rgba(${t.acN},0.1)`, border: `1px solid rgba(${t.acN},0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ac, flexShrink: 0 }}>
                  {activityIcon(a.type)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 600, color: t.ts }}>{a.type}</span>
                    <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: t.tf }}>{a.date}</span>
                  </div>
                  <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: t.tm, margin: 0, lineHeight: 1.5 }}>{a.note}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard() {
  const t = useTheme()
  const stats = [
    { label: 'Aktivní OP',          value: '18',            icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { label: 'Obrat YTD',           value: '3 240 000 Kč',  icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Úspěšnost',           value: '71 %',          icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Servisy / měsíc',     value: '5',             icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  ]
  const pipeline = [
    { label: 'Zakázka',         count: 5, value: '843 700 Kč',   pct: 36 },
    { label: 'Nabídka',         count: 3, value: '895 054 Kč',   pct: 38 },
    { label: 'Před uzavřením',  count: 2, value: '712 123 Kč',   pct: 30 },
  ]
  return (
    <div style={{ padding: '22px 26px', overflow: 'auto', height: '100%' }}>
      <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, fontWeight: 700, color: t.tp, margin: '0 0 18px' }}>Nástěnka</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(175px,1fr))', gap: 10, marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: `rgba(${t.acN},0.06)`, border: `1px solid rgba(${t.acN},0.12)`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: `rgba(${t.acN},0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ac }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} /></svg>
              </div>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: t.tf, fontWeight: 500 }}>{s.label}</span>
            </div>
            <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, fontWeight: 700, color: t.tp, margin: 0, letterSpacing: '-0.01em' }}>{s.value}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ background: `rgba(${t.acN},0.04)`, border: `1px solid rgba(${t.acN},0.1)`, borderRadius: 12, padding: '16px 18px' }}>
          <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 600, color: t.ts, margin: '0 0 14px' }}>Pipeline</h3>
          {pipeline.map(p => (
            <div key={p.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 500, color: t.ts }}>{p.label}</span>
                <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: t.tf }}>{p.count} OP · {p.value}</span>
              </div>
              <div style={{ height: 5, background: `rgba(${t.acN},0.1)`, borderRadius: 3 }}>
                <div style={{ height: '100%', width: `${p.pct}%`, background: t.gradH, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: `rgba(${t.acN},0.04)`, border: `1px solid rgba(${t.acN},0.1)`, borderRadius: 12, padding: '16px 18px' }}>
          <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 600, color: t.ts, margin: '0 0 14px' }}>Poslední aktivity</h3>
          {ACTIVITIES.slice(0, 5).map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 9 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: `rgba(${t.acN},0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ac, flexShrink: 0 }}>
                {activityIcon(a.type)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, fontWeight: 600, color: t.ts, whiteSpace: 'nowrap' }}>{a.date} {a.type}</span>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: t.tf, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.client}</span>
                </div>
                <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: t.tmm, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── DealsView ────────────────────────────────────────────────────────────────

function DealsView({ deals, onStatusChange, onSelect }: { deals: Deal[]; onStatusChange: (id: string, s: DealStatus) => void; onSelect: (d: Deal) => void }) {
  const t = useTheme()
  return (
    <div style={{ padding: '22px 26px', overflow: 'auto', height: '100%' }}>
      <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, fontWeight: 700, color: t.tp, margin: '0 0 18px' }}>Obchodní případy</h2>
      <div style={{ background: `rgba(${t.acN},0.04)`, border: `1px solid rgba(${t.acN},0.1)`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 155px 135px 135px 115px', padding: '9px 14px', borderBottom: `1px solid rgba(${t.acN},0.1)`, background: `rgba(${t.acN},0.06)` }}>
          {['KÓD','PŘEDMĚT','KLIENT','STAV','KATEGORIE','CENA S DPH'].map(h => (
            <span key={h} style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: t.tf }}>{h}</span>
          ))}
        </div>
        {deals.map(d => {
          const cat = CATEGORY_STYLE[d.category] ?? { bg: '#E8F5E9', color: '#2E7D32' }
          return (
            <div key={d.id} onClick={() => onSelect(d)}
              style={{ display: 'grid', gridTemplateColumns: '100px 1fr 155px 135px 135px 115px', padding: '10px 14px', borderBottom: `1px solid rgba(${t.acN},0.06)`, cursor: 'pointer', alignItems: 'center', transition: 'background 0.12s' }}
              onMouseEnter={e => (e.currentTarget.style.background = `rgba(${t.acN},0.06)`)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: t.ac, fontWeight: 600 }}>{d.code}</span>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: t.ts, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{d.subject}</span>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: t.tm, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{d.client}</span>
              <div onClick={e => e.stopPropagation()}>
                <StatusBadge status={d.status} onChange={s => onStatusChange(d.id, s)} />
              </div>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: cat.bg, color: cat.color, display: 'inline-block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 128 }}>{d.category}</span>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 600, color: t.tp }}>{d.priceVat}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── ClientsView ──────────────────────────────────────────────────────────────

function ClientsView() {
  const t = useTheme()
  return (
    <div style={{ padding: '22px 26px', overflow: 'auto', height: '100%' }}>
      <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, fontWeight: 700, color: t.tp, margin: '0 0 18px' }}>Klienti</h2>
      <div style={{ background: `rgba(${t.acN},0.04)`, border: `1px solid rgba(${t.acN},0.1)`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130px 110px 70px', padding: '9px 14px', borderBottom: `1px solid rgba(${t.acN},0.1)`, background: `rgba(${t.acN},0.06)` }}>
          {['JMÉNO','EMAIL','TELEFON','MĚSTO','POČET OP'].map(h => (
            <span key={h} style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: t.tf }}>{h}</span>
          ))}
        </div>
        {CLIENTS.map(c => (
          <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130px 110px 70px', padding: '10px 14px', borderBottom: `1px solid rgba(${t.acN},0.06)`, alignItems: 'center', cursor: 'pointer', transition: 'background 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.background = `rgba(${t.acN},0.06)`)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: `rgba(${t.acN},0.12)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700, color: t.ac, flexShrink: 0 }}>
                {c.name.split(' ').filter(w => /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(w)).slice(-2).map(w => w[0]).join('').slice(0,2)}
              </div>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: t.ts, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
            </div>
            <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: t.tmm, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{c.email}</span>
            <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: t.tm }}>{c.phone}</span>
            <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: t.tm }}>{c.city}</span>
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 700, color: t.ac }}>{c.deals}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── CalendarView ─────────────────────────────────────────────────────────────

function CalendarView() {
  const t = useTheme()
  const [tooltip, setTooltip] = useState<{ day: number; x: number; y: number } | null>(null)
  const eventsByDay: Record<number, typeof CAL_EVENTS[0][]> = {}
  CAL_EVENTS.forEach(e => { eventsByDay[e.day] = [...(eventsByDay[e.day] ?? []), e] })

  // April 2026: starts Wednesday (index 2, Mon=0)
  const startOffset = 2
  const daysInMonth = 30
  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  return (
    <div style={{ padding: '22px 26px', overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, fontWeight: 700, color: t.tp, margin: 0 }}>Kalendář</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={{ background: `rgba(${t.acN},0.08)`, border: `1px solid rgba(${t.acN},0.2)`, borderRadius: 7, padding: '5px 10px', color: t.tm, fontFamily: 'Inter,sans-serif', fontSize: 12, cursor: 'pointer' }}>← Březen</button>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, color: t.ts, minWidth: 100, textAlign: 'center' }}>Duben 2026</span>
          <button style={{ background: `rgba(${t.acN},0.08)`, border: `1px solid rgba(${t.acN},0.2)`, borderRadius: 7, padding: '5px 10px', color: t.tm, fontFamily: 'Inter,sans-serif', fontSize: 12, cursor: 'pointer' }}>Květen →</button>
        </div>
      </div>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 2 }}>
        {['Po','Út','St','Čt','Pá','So','Ne'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontFamily: 'Inter,sans-serif', fontSize: 11, fontWeight: 600, color: t.tf, padding: '5px 0', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{d}</div>
        ))}
      </div>
      {/* Weeks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {week.map((day, di) => {
              const evs = day ? (eventsByDay[day] ?? []) : []
              const isToday = day === 1
              return (
                <div key={di} style={{ height: 80, background: day ? `rgba(${t.acN},0.03)` : 'transparent', border: day ? `1px solid rgba(${t.acN},0.08)` : '1px solid transparent', borderRadius: 8, padding: '5px 6px', position: 'relative', overflow: 'hidden' }}>
                  {day && (
                    <>
                      <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? t.ac : t.tmm, display: 'block', marginBottom: 3 }}>{day}</span>
                      {evs.map((ev, ei) => {
                        const ec = EVENT_COLOR[ev.type]
                        return (
                          <div key={ei}
                            onMouseEnter={e => { const r = e.currentTarget.getBoundingClientRect(); setTooltip({ day: day, x: r.left, y: r.bottom }) }}
                            onMouseLeave={() => setTooltip(null)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 5px', borderRadius: 4, background: ec.bg, border: `1px solid ${ec.bg}`, marginBottom: 2, cursor: 'pointer', overflow: 'hidden' }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: ec.dot, flexShrink: 0 }} />
                            <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, color: ec.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{ev.time} {ev.title}</span>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      {/* Tooltip */}
      {tooltip && (() => {
        const ev = CAL_EVENTS.find(e => e.day === tooltip.day)
        if (!ev) return null
        return (
          <div style={{ position: 'fixed', top: tooltip.y + 6, left: Math.min(tooltip.x, window.innerWidth - 240), background: t.bgDrop, border: `1px solid rgba(${t.acN},0.3)`, borderRadius: 8, padding: '10px 13px', zIndex: 300, pointerEvents: 'none', minWidth: 200 }}>
            <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 600, color: t.tp, margin: '0 0 3px' }}>{ev.title}</p>
            <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: t.tm, margin: '0 0 2px' }}>{ev.time} · {ev.client}</p>
            <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: t.tf, margin: 0 }}>{ev.city}</p>
          </div>
        )
      })()}
    </div>
  )
}

// ─── ActivitiesView ───────────────────────────────────────────────────────────

function ActivitiesView() {
  const t = useTheme()
  return (
    <div style={{ padding: '22px 26px', overflow: 'auto', height: '100%' }}>
      <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, fontWeight: 700, color: t.tp, margin: '0 0 18px' }}>Aktivity</h2>
      <div style={{ maxWidth: 660 }}>
        {ACTIVITIES.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: i < ACTIVITIES.length - 1 ? 18 : 0, position: 'relative' }}>
            {i < ACTIVITIES.length - 1 && <div style={{ position: 'absolute', left: 18, top: 38, bottom: 0, width: 1, background: `rgba(${t.acN},0.12)` }} />}
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: `rgba(${t.acN},0.1)`, border: `1px solid rgba(${t.acN},0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ac, flexShrink: 0 }}>
              {activityIcon(a.type)}
            </div>
            <div style={{ flex: 1, background: `rgba(${t.acN},0.04)`, border: `1px solid rgba(${t.acN},0.08)`, borderRadius: 10, padding: '11px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 700, color: t.ts }}>{a.type}</span>
                <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: t.tf }}>{a.date}</span>
                <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: t.ac, fontWeight: 500 }}>{a.client}</span>
              </div>
              <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: t.tm, margin: 0, lineHeight: 1.5 }}>{a.note}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ProductsView ─────────────────────────────────────────────────────────────

function ProductsView() {
  const t = useTheme()
  const [catFilter, setCatFilter] = useState('Vše')
  const [search, setSearch] = useState('')
  const cats = ['Vše', 'Tepelná čerpadla', 'Rekuperace', 'Klimatizace']
  const filtered = PRODUCTS.filter(p =>
    (catFilter === 'Vše' || p.category === catFilter) &&
    (search === '' || p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
  )

  function marginColor(m: number) {
    if (m >= 35) return '#4CAF50'
    if (m >= 30) return '#FF9800'
    return '#F44336'
  }

  return (
    <div style={{ padding: '22px 26px', overflow: 'auto', height: '100%' }}>
      <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, fontWeight: 700, color: t.tp, margin: '0 0 16px' }}>Produkty</h2>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {cats.map(c => (
          <button key={c} onClick={() => setCatFilter(c)}
            style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 500, padding: '6px 14px', borderRadius: 8, border: '1px solid', borderColor: catFilter === c ? t.ac : `rgba(${t.acN},0.2)`, background: catFilter === c ? `rgba(${t.acN},0.12)` : 'transparent', color: catFilter === c ? t.ac : t.tm, cursor: 'pointer' }}>
            {c}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat produkt..."
          style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, padding: '6px 12px', borderRadius: 8, border: `1px solid rgba(${t.acN},0.2)`, background: `rgba(${t.acN},0.04)`, color: t.ts, outline: 'none', marginLeft: 'auto', width: 180 }} />
      </div>
      <div style={{ background: `rgba(${t.acN},0.04)`, border: `1px solid rgba(${t.acN},0.1)`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 130px 120px 115px 80px 70px', padding: '9px 14px', borderBottom: `1px solid rgba(${t.acN},0.1)`, background: `rgba(${t.acN},0.06)` }}>
          {['KÓD','NÁZEV','KAT.','CENA PRODEJNÍ','CENA NÁKUPNÍ','MARŽE','JEDN.'].map(h => (
            <span key={h} style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: t.tf }}>{h}</span>
          ))}
        </div>
        {filtered.map(p => {
          const cs = CATEGORY_STYLE[p.category] ?? { bg: '#E8F5E9', color: '#2E7D32' }
          return (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 130px 120px 115px 80px 70px', padding: '10px 14px', borderBottom: `1px solid rgba(${t.acN},0.06)`, alignItems: 'center', cursor: 'pointer', transition: 'background 0.12s' }}
              onMouseEnter={e => (e.currentTarget.style.background = `rgba(${t.acN},0.06)`)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: t.ac, fontWeight: 600 }}>{p.id}</span>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: t.ts, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{p.name}</span>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 5, background: cs.bg, color: cs.color, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 125 }}>{p.category}</span>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 600, color: t.tp }}>{fmtPrice(p.price)}</span>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: t.tm }}>{fmtPrice(p.cost)}</span>
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 700, color: marginColor(p.margin) }}>{p.margin.toFixed(1)} %</span>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: t.tf }}>ks</span>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'Inter,sans-serif', fontSize: 13, color: t.tf }}>Žádné produkty</div>
        )}
      </div>
    </div>
  )
}

// ─── DasaView ─────────────────────────────────────────────────────────────────

function DasaView() {
  const t = useTheme()
  const [messages, setMessages] = useState<DasaMsg[]>([
    { role: 'dasa', text: 'Ahoj! Jsem Dáša, vaše AI asistentka. Pomůžu vám vytvářet nabídky, spravovat obchodní případy a plánovat aktivity. Na co se ptáte?' },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const userMsgCount = messages.filter(m => m.role === 'user').length
  const limitHit = userMsgCount >= 3
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, typing])

  function send() {
    if (!input.trim() || limitHit || typing) return
    const txt = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: txt }])
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMessages(prev => [...prev, { role: 'dasa', text: getDasaReply(txt) }])
    }, 800)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 22px', borderBottom: `1px solid rgba(${t.acN},0.1)`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 700, color: t.atx }}>D</div>
        <div>
          <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 700, color: t.tp, margin: 0 }}>Dáša</p>
          <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: t.ac, margin: 0 }}>AI asistentka · online</p>
        </div>
      </div>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'dasa' && (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: t.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: t.atx, flexShrink: 0, marginRight: 8, marginTop: 2 }}>D</div>
            )}
            <div style={{ maxWidth: '72%', padding: '10px 14px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.role === 'user' ? t.ac : `rgba(${t.acN},0.08)`, border: m.role === 'user' ? 'none' : `1px solid rgba(${t.acN},0.15)`, color: m.role === 'user' ? 'white' : t.ts, fontFamily: 'Inter,sans-serif', fontSize: 13, lineHeight: 1.5 }}>
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: t.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: t.atx, flexShrink: 0 }}>D</div>
            <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 4px', background: `rgba(${t.acN},0.08)`, border: `1px solid rgba(${t.acN},0.15)`, display: 'flex', gap: 4, alignItems: 'center' }}>
              <style>{`@keyframes dotPulse{0%,80%,100%{opacity:.3;transform:scale(0.8)}40%{opacity:1;transform:scale(1)}}`}</style>
              {[0,1,2].map(i => (
                <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: t.ac, display: 'inline-block', animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        {limitHit && (
          <div style={{ background: `rgba(${t.acN},0.06)`, border: `1px solid rgba(${t.acN},0.2)`, borderRadius: 12, padding: '16px 18px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: t.ts, margin: '0 0 12px', lineHeight: 1.5 }}>
              Dosáhli jste limitu demo verze (3 zprávy). Vytvořte si účet pro neomezený přístup k Dáše.
            </p>
            <Link href="/auth/register" style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 8, background: t.ac, color: 'white', textDecoration: 'none', display: 'inline-block' }}>
              Začít zdarma →
            </Link>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {/* Input */}
      <div style={{ padding: '12px 22px 16px', borderTop: `1px solid rgba(${t.acN},0.1)`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send() }}
            disabled={limitHit || typing}
            placeholder={limitHit ? 'Limit demo verze — vytvořte si účet' : 'Napište zprávu Dáše...'}
            style={{ flex: 1, fontFamily: 'Inter,sans-serif', fontSize: 13, padding: '10px 14px', borderRadius: 10, border: `1px solid rgba(${t.acN},0.2)`, background: limitHit ? `rgba(${t.acN},0.02)` : `rgba(${t.acN},0.06)`, color: limitHit ? t.tf : t.ts, outline: 'none' }} />
          <button onClick={send} disabled={limitHit || typing || !input.trim()}
            style={{ padding: '10px 14px', borderRadius: 10, background: limitHit || !input.trim() ? `rgba(${t.acN},0.12)` : t.ac, border: 'none', cursor: limitHit || !input.trim() ? 'default' : 'pointer', color: limitHit || !input.trim() ? t.tf : 'white', display: 'flex', alignItems: 'center' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </div>
        <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: t.tf, margin: '6px 0 0', textAlign: 'right' }}>{userMsgCount} / 3 zpráv využito</p>
      </div>
    </div>
  )
}

// ─── AnalyticsView ────────────────────────────────────────────────────────────

function AnalyticsView() {
  const t = useTheme()
  const revenue = [
    { label: 'Říjen',    value: 580000  },
    { label: 'Listopad', value: 720000  },
    { label: 'Prosinec', value: 490000  },
    { label: 'Leden',    value: 850000  },
    { label: 'Únor',     value: 940000  },
    { label: 'Březen',   value: 1240000 },
  ]
  const maxRev = 1240000
  const techData = [
    { label: 'Tepelné čerpadlo', pct: 38, color: '#FF7043' },
    { label: 'Rekuperace',       pct: 31, color: '#4CAF50' },
    { label: 'Klimatizace',      pct: 22, color: '#42A5F5' },
    { label: 'Vzduchotechnika',  pct: 9,  color: '#7E57C2' },
  ]
  const pipeline = [
    { label: 'Zakázka',         count: 5,  color: '#4CAF50' },
    { label: 'Nabídka',         count: 3,  color: '#FF9800' },
    { label: 'Před uzavřením',  count: 2,  color: '#7E57C2' },
    { label: 'Úspěch (YTD)',    count: 8,  color: '#26C6DA' },
  ]
  const maxCount = 8

  return (
    <div style={{ padding: '22px 26px', overflow: 'auto', height: '100%' }}>
      <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, fontWeight: 700, color: t.tp, margin: '0 0 18px' }}>Analytiky</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Graf 1 — Obrat po měsících */}
        <div style={{ background: `rgba(${t.acN},0.04)`, border: `1px solid rgba(${t.acN},0.1)`, borderRadius: 12, padding: '16px 18px' }}>
          <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 600, color: t.ts, margin: '0 0 16px' }}>Obrat — posledních 6 měsíců</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {revenue.map(r => (
              <div key={r.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: t.tm }}>{r.label}</span>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, fontWeight: 600, color: t.ts }}>{(r.value / 1000).toFixed(0)} tis. Kč</span>
                </div>
                <div style={{ height: 6, background: `rgba(${t.acN},0.08)`, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(r.value / maxRev) * 100}%`, background: t.gradH, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Graf 2 — OP podle technologie */}
        <div style={{ background: `rgba(${t.acN},0.04)`, border: `1px solid rgba(${t.acN},0.1)`, borderRadius: 12, padding: '16px 18px' }}>
          <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 600, color: t.ts, margin: '0 0 16px' }}>OP podle technologie</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {techData.map(td => (
              <div key={td.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: td.color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: t.tm }}>{td.label}</span>
                  </div>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700, color: t.ts }}>{td.pct} %</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${td.pct}%`, background: td.color, borderRadius: 3, opacity: 0.8 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Graf 3 — Pipeline funnel */}
        <div style={{ background: `rgba(${t.acN},0.04)`, border: `1px solid rgba(${t.acN},0.1)`, borderRadius: 12, padding: '16px 18px' }}>
          <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 600, color: t.ts, margin: '0 0 16px' }}>Pipeline — počty OP</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {pipeline.map(p => (
              <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: t.tm, minWidth: 130 }}>{p.label}</span>
                <div style={{ flex: 1, height: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(p.count / maxCount) * 100}%`, background: p.color, borderRadius: 5, opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{p.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Graf 4 — Úspěšnost */}
        <div style={{ background: `rgba(${t.acN},0.04)`, border: `1px solid rgba(${t.acN},0.1)`, borderRadius: 12, padding: '16px 18px' }}>
          <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 600, color: t.ts, margin: '0 0 16px' }}>Výkonnost</h3>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 52, fontWeight: 800, color: t.ac, margin: 0, letterSpacing: '-0.03em', lineHeight: 1 }}>71 %</p>
            <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: t.tm, margin: '4px 0 0' }}>úspěšných OP</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[['Průměrný obchodní cyklus', '34 dní'], ['Průměrná hodnota OP', '287 400 Kč'], ['Celkem OP tento rok', '18']].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: `rgba(${t.acN},0.06)`, borderRadius: 7 }}>
                <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: t.tm }}>{l}</span>
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700, color: t.ts }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard',  label: 'Nástěnka',          icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'deals',      label: 'Obchodní případy',  icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { id: 'clients',    label: 'Klienti',            icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'calendar',   label: 'Kalendář',           icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'activities', label: 'Aktivity',           icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'products',   label: 'Produkty',           icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { id: 'dasa',       label: 'AI Dáša',            icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { id: 'analytics',  label: 'Analytiky',          icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
]

function Sidebar({ active, setActive }: { active: View; setActive: (v: View) => void }) {
  const t = useTheme()
  return (
    <div style={{ width: 200, flexShrink: 0, background: t.bgS, borderRight: `1px solid rgba(${t.acN},0.12)`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '18px 14px 14px', borderBottom: `1px solid rgba(${t.acN},0.1)`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
            <path d="M20 4C14 4 9 9.5 9 16c0 4 1.5 7.5 4 10l7 10 7-10c2.5-2.5 4-6 4-10 0-6.5-5-12-11-12z" fill={t.ac}/>
            <path d="M20 10 C20 10 15 14 15 18 C15 20.5 17.5 22 20 22 C20 22 20 16 20 10Z" fill={t.bgS} opacity="0.8"/>
            <path d="M20 10 C20 10 25 14 25 18 C25 20.5 22.5 22 20 22 C20 22 20 16 20 10Z" fill={t.bgS} opacity="0.5"/>
          </svg>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15, fontWeight: 700, color: t.tp, letterSpacing: '-0.02em' }}>felucia</span>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '10px 7px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => {
          const isActive = active === item.id
          return (
            <button key={item.id} onClick={() => setActive(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 9px', borderRadius: 7, marginBottom: 1, background: isActive ? `rgba(${t.acN},0.15)` : 'transparent', border: isActive ? `1px solid rgba(${t.acN},0.2)` : '1px solid transparent', cursor: 'pointer', color: isActive ? t.ac : t.tf, fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: isActive ? 600 : 400, textAlign: 'left', transition: 'all 0.12s' }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = `rgba(${t.acN},0.06)`; e.currentTarget.style.color = t.tm } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.tf } }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2 : 1.5} d={item.icon} />
              </svg>
              {item.label}
              {item.id === 'dasa' && <span style={{ marginLeft: 'auto', fontFamily: 'Inter,sans-serif', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: `rgba(${t.acN},0.2)`, color: t.ac }}>AI</span>}
            </button>
          )
        })}
      </nav>
      <div style={{ padding: '10px 10px 14px', borderTop: `1px solid rgba(${t.acN},0.1)`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: `rgba(${t.acN},0.15)`, border: `1px solid rgba(${t.acN},0.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk',sans-serif", fontSize: 10, fontWeight: 700, color: t.ac, flexShrink: 0 }}>TN</div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, fontWeight: 600, color: t.ts, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Tomáš Novák</p>
            <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, color: t.tf, margin: 0 }}>Obchodník</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── DemoApp ──────────────────────────────────────────────────────────────────
// Reusable CRM shell — used by DemoModal (as a popup) and by the landing page
// (embedded inline in a browser-chrome frame). onClose is optional: present
// when running inside the modal so Escape / × can dismiss it; absent otherwise.

export interface DemoAppProps { onClose?: () => void }

export function DemoApp({ onClose }: DemoAppProps) {
  const [activeView, setActiveView] = useState<View>('dashboard')
  const [deals, setDeals] = useState<Deal[]>(INITIAL_DEALS)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [detailDeal, setDetailDeal] = useState<Deal | null>(null)
  const [themeMode, setThemeMode] = useState<ThemeMode>('felucia')
  const t = THEMES[themeMode]

  // Escape: first unwind inner navigation, then close if provided
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (detailDeal) { setDetailDeal(null); return }
      if (selectedDeal) { setSelectedDeal(null); return }
      onClose?.()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectedDeal, detailDeal, onClose])

  const handleStatusChange = useCallback((id: string, status: DealStatus) => {
    setDeals(prev => prev.map(d => d.id === id ? { ...d, status } : d))
    setSelectedDeal(prev => prev?.id === id ? { ...prev, status } : prev)
    setDetailDeal(prev => prev?.id === id ? { ...prev, status } : prev)
  }, [])

  return (
    <ThemeContext.Provider value={t}>
      <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

      {/* Banner */}
      <div style={{ background: `rgba(${t.acN},0.07)`, borderBottom: `1px solid rgba(${t.acN},0.14)`, padding: '9px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: t.tm, fontWeight: 500 }}>
          ✦ Demo prostředí — data jsou fiktivní
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setThemeMode(m => m === 'felucia' ? 'system' : 'felucia')}
            title={themeMode === 'felucia' ? 'Přepnout na systémový tmavý režim' : 'Přepnout na Felucia téma'}
            style={{ background: `rgba(${t.acN},0.1)`, border: `1px solid rgba(${t.acN},0.2)`, borderRadius: 7, padding: '4px 10px', color: t.tm, fontFamily: 'Inter,sans-serif', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = `rgba(${t.acN},0.18)`; e.currentTarget.style.color = t.tp }}
            onMouseLeave={e => { e.currentTarget.style.background = `rgba(${t.acN},0.1)`; e.currentTarget.style.color = t.tm }}>
            {themeMode === 'felucia'
              ? <><svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>Systém</>
              : <><svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" strokeWidth={2}/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>Felucia</>
            }
          </button>
          <Link href="/auth/register" style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 600, padding: '5px 13px', borderRadius: 7, background: t.ac, color: 'white', textDecoration: 'none' }}>
            Vyzkoušet 14 dní →
          </Link>
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.tf, padding: 3, display: 'flex' }}
              onMouseEnter={e => (e.currentTarget.style.color = t.tp)}
              onMouseLeave={e => (e.currentTarget.style.color = t.tf)}>
              <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <Sidebar active={activeView} setActive={v => { setActiveView(v); setSelectedDeal(null); setDetailDeal(null) }} />
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: t.bg }}>
          {activeView === 'dashboard'  && <Dashboard />}
          {activeView === 'deals'      && !detailDeal && <DealsView deals={deals} onStatusChange={handleStatusChange} onSelect={setSelectedDeal} />}
          {activeView === 'deals'      && detailDeal  && <DealDetailView deal={detailDeal} onBack={() => setDetailDeal(null)} onStatusChange={handleStatusChange} />}
          {activeView === 'clients'    && <ClientsView />}
          {activeView === 'calendar'   && <CalendarView />}
          {activeView === 'activities' && <ActivitiesView />}
          {activeView === 'products'   && <ProductsView />}
          {activeView === 'dasa'       && <DasaView />}
          {activeView === 'analytics'  && <AnalyticsView />}
        </div>
        {/* SlideOver as sibling so it overlaps content without clipping */}
        {activeView === 'deals' && <SlideOver deal={selectedDeal} onClose={() => setSelectedDeal(null)} onOpenDetail={() => { if (selectedDeal) { setDetailDeal(selectedDeal); setSelectedDeal(null) } }} />}
      </div>
    </ThemeContext.Provider>
  )
}

// ─── DemoModal ────────────────────────────────────────────────────────────────

interface DemoModalProps { isOpen: boolean; onClose: () => void }

export default function DemoModal({ isOpen, onClose }: DemoModalProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isOpen) requestAnimationFrame(() => setVisible(true))
    else setVisible(false)
  }, [isOpen])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      <style>{`@keyframes demoFadeIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}`}</style>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div onClick={e => e.stopPropagation()}
          style={{ width: '95vw', maxWidth: 1200, height: '90vh', background: THEMES.felucia.bg, borderRadius: 20, border: '1px solid rgba(76,175,80,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: visible ? 'demoFadeIn 0.2s ease-out forwards' : 'none', opacity: visible ? undefined : 0 }}>
          <DemoApp onClose={onClose} />
        </div>
      </div>
    </>
  )
}
