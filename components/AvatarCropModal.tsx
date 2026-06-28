'use client'

import { useState, useRef, useEffect } from 'react'

const CROP_PX = 280      // průměr kruhového výřezu na obrazovce
const OUTPUT_PX = 256    // výsledný avatar
const MAX_ZOOM = 4

interface Props {
  file: File
  onClose: () => void
  onSave: (blob: Blob) => void
}

export default function AvatarCropModal({ file, onClose, onSave }: Props) {
  const [imgSrc, setImgSrc] = useState('')
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)          // 1 = cover, nahoru do MAX_ZOOM
  const [pos, setPos] = useState({ x: 0, y: 0 }) // posun středu obrázku vůči středu kruhu (display px)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImgSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // baseScale: při zoom=1 obrázek přesně vyplní kruh (cover)
  const baseScale = nat.w > 0 ? Math.max(CROP_PX / nat.w, CROP_PX / nat.h) : 1
  const effScale = baseScale * zoom
  const dispW = nat.w * effScale
  const dispH = nat.h * effScale

  // Clamp posunu tak, aby kruh nikdy nebyl prázdný na okraji.
  // Volitelně pro konkrétní zoom (při změně zoomu, kdy stav ještě nedoběhl).
  function clampPos(p: { x: number; y: number }, z = zoom) {
    const w = nat.w * baseScale * z
    const h = nat.h * baseScale * z
    const maxX = Math.max(0, (w - CROP_PX) / 2)
    const maxY = Math.max(0, (h - CROP_PX) / 2)
    return {
      x: Math.max(-maxX, Math.min(maxX, p.x)),
      y: Math.max(-maxY, Math.min(maxY, p.y)),
    }
  }

  function onImgLoad() {
    const img = imgRef.current
    if (!img) return
    setNat({ w: img.naturalWidth, h: img.naturalHeight })
    setZoom(1)
    setPos({ x: 0, y: 0 })
  }

  function applyZoom(next: number) {
    const z = Math.max(1, Math.min(MAX_ZOOM, next))
    setZoom(z)
    setPos(p => clampPos(p, z))
  }

  // ---- Drag myší ----
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }
  }
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!drag.current) return
      setPos(clampPos({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }))
    }
    function onUp() { drag.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispW, dispH])

  // ---- Touch: drag + pinch ----
  const touch = useRef<{ x: number; y: number; px: number; py: number; dist: number; z0: number } | null>(null)
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, px: pos.x, py: pos.y, dist: 0, z0: zoom }
    } else if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
      touch.current = { x: 0, y: 0, px: pos.x, py: pos.y, dist: d, z0: zoom }
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    const t = touch.current
    if (!t) return
    if (e.touches.length === 1 && t.dist === 0) {
      setPos(clampPos({ x: t.px + e.touches[0].clientX - t.x, y: t.py + e.touches[0].clientY - t.y }))
    } else if (e.touches.length === 2 && t.dist > 0) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
      applyZoom(t.z0 * d / t.dist)
    }
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    applyZoom(zoom * Math.exp(-e.deltaY * 0.0015))
  }

  function handleSave() {
    const img = imgRef.current
    if (!img || nat.w === 0) return

    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_PX
    canvas.height = OUTPUT_PX
    const ctx = canvas.getContext('2d')!

    ctx.beginPath()
    ctx.arc(OUTPUT_PX / 2, OUTPUT_PX / 2, OUTPUT_PX / 2, 0, Math.PI * 2)
    ctx.clip()

    // Levý/horní roh obrázku vůči levému/hornímu rohu kruhu (display px)
    const imgLeft = (CROP_PX - dispW) / 2 + pos.x
    const imgTop = (CROP_PX - dispH) / 2 + pos.y
    // Zdrojový obdélník v natural px, který se promítá do kruhu
    const srcX = -imgLeft / effScale
    const srcY = -imgTop / effScale
    const srcSize = CROP_PX / effScale

    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT_PX, OUTPUT_PX)
    canvas.toBlob(blob => { if (blob) onSave(blob) }, 'image/jpeg', 0.92)
  }

  const imgLeft = (CROP_PX - dispW) / 2 + pos.x
  const imgTop = (CROP_PX - dispH) / 2 + pos.y

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm">
        <h3 className="font-semibold text-gray-900 dark:text-white text-base mb-1">Upravit avatar</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">Přetáhněte fotku na obličej a nastavte přiblížení.</p>

        {/* Kruhový výřez */}
        <div className="flex justify-center mb-5">
          <div
            style={{ width: CROP_PX, height: CROP_PX, borderRadius: '50%', overflow: 'hidden', position: 'relative', cursor: 'grab', background: '#111827', touchAction: 'none', flexShrink: 0 }}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onWheel={onWheel}
          >
            {imgSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={imgSrc}
                alt=""
                draggable={false}
                onLoad={onImgLoad}
                style={{
                  position: 'absolute',
                  width: dispW,
                  height: dispH,
                  maxWidth: 'none',   // přebíjí Tailwind preflight (max-width:100%) → bez deformace
                  left: imgLeft,
                  top: imgTop,
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              />
            )}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: '50%', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.3)' }} />
          </div>
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 mb-5">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
          <input
            type="range"
            min={100}
            max={MAX_ZOOM * 100}
            value={Math.round(zoom * 100)}
            onChange={e => applyZoom(Number(e.target.value) / 100)}
            className="flex-1 accent-primary h-1.5"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            Zrušit
          </button>
          <button
            onClick={handleSave}
            disabled={nat.w === 0}
            className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            Uložit avatar
          </button>
        </div>
      </div>
    </div>
  )
}
