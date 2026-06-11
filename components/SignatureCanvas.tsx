'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  onChange: (dataUrl: string | null) => void
  existingDataUrl?: string | null
  disabled?: boolean
}

function getPos(e: MouseEvent | Touch, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect()
  const clientX = (e as Touch).clientX ?? (e as MouseEvent).clientX
  const clientY = (e as Touch).clientY ?? (e as MouseEvent).clientY
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  }
}

function attachDrawing(
  canvas: HTMLCanvasElement,
  lineWidth: number,
  onStrokeEnd: () => void,
  onFirstStroke: () => void,
) {
  const ctx = canvas.getContext('2d')!
  ctx.strokeStyle = '#1A2E1B'
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const drawing = { current: false }
  let stroked = false

  function onStart(e: MouseEvent | TouchEvent) {
    e.preventDefault()
    drawing.current = true
    const touch = 'touches' in e ? (e as TouchEvent).touches[0] : (e as MouseEvent)
    const pos = getPos(touch, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  function onMove(e: MouseEvent | TouchEvent) {
    e.preventDefault()
    if (!drawing.current) return
    const touch = 'touches' in e ? (e as TouchEvent).touches[0] : (e as MouseEvent)
    const pos = getPos(touch, canvas)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    if (!stroked) { stroked = true; onFirstStroke() }
  }

  function onEnd() {
    if (!drawing.current) return
    drawing.current = false
    onStrokeEnd()
  }

  canvas.addEventListener('mousedown', onStart)
  canvas.addEventListener('mousemove', onMove)
  canvas.addEventListener('mouseup', onEnd)
  canvas.addEventListener('mouseleave', onEnd)
  canvas.addEventListener('touchstart', onStart, { passive: false })
  canvas.addEventListener('touchmove', onMove, { passive: false })
  canvas.addEventListener('touchend', onEnd)

  return () => {
    canvas.removeEventListener('mousedown', onStart)
    canvas.removeEventListener('mousemove', onMove)
    canvas.removeEventListener('mouseup', onEnd)
    canvas.removeEventListener('mouseleave', onEnd)
    canvas.removeEventListener('touchstart', onStart)
    canvas.removeEventListener('touchmove', onMove)
    canvas.removeEventListener('touchend', onEnd)
  }
}

// Crop canvas to bounding box of drawn pixels + padding, white background
function cropToBounds(canvas: HTMLCanvasElement, padding = 40): string {
  const { width, height } = canvas
  const data = canvas.getContext('2d')!.getImageData(0, 0, width, height).data

  let minX = width, minY = height, maxX = 0, maxY = 0, found = false

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        found = true
      }
    }
  }

  if (!found) return canvas.toDataURL('image/png')

  const x = Math.max(0, minX - padding)
  const y = Math.max(0, minY - padding)
  const w = Math.min(width, maxX + padding + 1) - x
  const h = Math.min(height, maxY + padding + 1) - y

  const tmp = document.createElement('canvas')
  tmp.width = w
  tmp.height = h
  const ctx = tmp.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h)
  return tmp.toDataURL('image/png')
}

export function SignatureCanvas({ onChange, existingDataUrl, disabled = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fullCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isEmpty, setIsEmpty] = useState(!existingDataUrl)
  const [fullscreen, setFullscreen] = useState(false)
  const [fullEmpty, setFullEmpty] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [confirmReplace, setConfirmReplace] = useState(false)
  // Track whether we just confirmed from fullscreen to skip re-draw from prop update
  const skipNextExistingLoad = useRef(false)

  useEffect(() => { setMounted(true) }, [])

  // Load existing signature into inline preview (only when prop changes externally)
  useEffect(() => {
    if (skipNextExistingLoad.current) {
      skipNextExistingLoad.current = false
      return
    }
    const canvas = canvasRef.current
    if (!canvas || !existingDataUrl) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const img = new Image()
    img.onload = () => { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); setIsEmpty(false) }
    img.src = existingDataUrl
  }, [existingDataUrl])

  const emitChange = useCallback((canvas: HTMLCanvasElement) => {
    onChange(canvas.toDataURL('image/png'))
  }, [onChange])

  // Inline canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || disabled) return
    return attachDrawing(
      canvas,
      2.5,
      () => emitChange(canvas),
      () => setIsEmpty(false),
    )
  }, [disabled, emitChange])

  // Fullscreen canvas drawing
  useEffect(() => {
    if (!fullscreen) return
    const canvas = fullCanvasRef.current
    if (!canvas) return
    return attachDrawing(
      canvas,
      3.5,
      () => {},
      () => setFullEmpty(false),
    )
  }, [fullscreen])

  function clearInline() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
    onChange(null)
  }

  function clearFull() {
    const canvas = fullCanvasRef.current
    if (!canvas) return
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setFullEmpty(true)
  }

  async function doOpenFullscreen() {
    setFullscreen(true)
    setFullEmpty(true)
    try { await document.documentElement.requestFullscreen?.() } catch {}
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (screen.orientation as any)?.lock?.('landscape')
    } catch {}
  }

  function openFullscreen() {
    if (!isEmpty) {
      setConfirmReplace(true)
    } else {
      doOpenFullscreen()
    }
  }

  function closeFullscreen() {
    setFullscreen(false)
    try { document.exitFullscreen?.() } catch {}
    try { screen.orientation?.unlock?.() } catch {}
  }

  function confirmFullscreen() {
    const canvas = fullCanvasRef.current
    if (!canvas || fullEmpty) return

    // Crop to the actual signature bounding box
    const dataUrl = cropToBounds(canvas, 40)

    // Render cropped signature into inline preview, letter-boxed
    const inline = canvasRef.current
    if (inline) {
      const ctx = inline.getContext('2d')!
      ctx.clearRect(0, 0, inline.width, inline.height)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, inline.width, inline.height)
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(inline.width / img.width, inline.height / img.height)
        const dw = img.width * scale
        const dh = img.height * scale
        ctx.drawImage(img, (inline.width - dw) / 2, (inline.height - dh) / 2, dw, dh)
      }
      img.src = dataUrl
    }

    // Skip the next existingDataUrl effect so it doesn't overdraw what we just drew
    skipNextExistingLoad.current = true
    setIsEmpty(false)
    onChange(dataUrl)
    closeFullscreen()
  }

  return (
    <div className="space-y-2">
      {/* Inline preview canvas */}
      <div className={`rounded-xl border-2 border-dashed overflow-hidden ${disabled ? 'border-gray-200 dark:border-slate-700' : 'border-green-300 dark:border-green-800'}`}>
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          className="w-full bg-white"
          style={{ height: 'clamp(160px, 30vw, 220px)', touchAction: 'none', cursor: disabled ? 'default' : 'crosshair', display: 'block' }}
        />
      </div>

      {!disabled && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={clearInline}
            className="text-xs text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            Vymazat podpis
          </button>
          {/* Fullscreen button — mobile only */}
          <button
            type="button"
            onClick={openFullscreen}
            className="md:hidden inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#1B5E20] hover:bg-green-800 px-3 py-2 rounded-lg transition-colors min-h-[44px]"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            Podepsat na celou obrazovku
          </button>
        </div>
      )}

      {isEmpty && !disabled && (
        <p className="text-xs text-gray-400 dark:text-slate-500 italic">Klient se podepíše prstem nebo myší</p>
      )}

      {/* Confirm replace modal */}
      {confirmReplace && mounted && createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Přepsat podpis?</h3>
            <p className="text-sm text-gray-500 mb-6">Klient se již podepsal. Chcete podpis nahradit novým?</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmReplace(false)}
                className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-3 text-sm font-medium"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={() => { setConfirmReplace(false); clearInline(); doOpenFullscreen() }}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 text-sm font-semibold"
              >
                Přepsat
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Fullscreen signing overlay */}
      {mounted && fullscreen && createPortal(
        <div
          className="fixed inset-0 bg-white flex flex-col"
          style={{ zIndex: 9999, touchAction: 'none' }}
        >
          {/* Header bar */}
          <div
            className="flex-shrink-0 flex items-center justify-between px-5 bg-white border-b border-gray-200"
            style={{ height: 56, paddingTop: 'env(safe-area-inset-top)' }}
          >
            <span className="font-semibold text-gray-900 text-base">Podpis klienta</span>
            <div className="flex items-center gap-5">
              {!fullEmpty && (
                <button type="button" onClick={clearFull} className="text-sm font-medium text-red-500">
                  Vymazat
                </button>
              )}
              <button type="button" onClick={closeFullscreen} className="text-sm text-gray-500">
                Zrušit
              </button>
            </div>
          </div>

          {/* Drawing area */}
          <div className="relative flex-1 bg-gray-50 overflow-hidden">
            <canvas
              ref={fullCanvasRef}
              width={1600}
              height={900}
              className="absolute inset-0 bg-white"
              style={{ width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair', display: 'block' }}
            />
            {fullEmpty && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                <div className="text-center">
                  <svg className="w-10 h-10 mx-auto text-gray-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <p className="text-gray-300 text-lg font-light">Podepište se prstem</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer bar */}
          <div
            className="flex-shrink-0 px-4 bg-white border-t border-gray-200"
            style={{ padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            <button
              type="button"
              onClick={confirmFullscreen}
              disabled={fullEmpty}
              className="w-full bg-[#1B5E20] text-white rounded-xl font-semibold text-base transition-opacity disabled:opacity-30"
              style={{ minHeight: 52 }}
            >
              Potvrdit podpis
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
