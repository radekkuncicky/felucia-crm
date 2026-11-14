/** Čas aktivity „HH:MM“ (00:00–23:59), jinak null */
export function parseCas(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim())
  if (!m) return null
  const h = Number(m[1]), min = Number(m[2])
  return h < 24 && min < 60 ? `${String(h).padStart(2, '0')}:${m[2]}` : null
}

/** Délka aktivity v minutách (5–720), jinak null */
export function parseTrvani(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isInteger(n) && n >= 5 && n <= 720 ? n : null
}
