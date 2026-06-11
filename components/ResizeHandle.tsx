'use client'

import { useRef } from 'react'

export function ResizeHandle({ onResize }: { onResize: (delta: number) => void }) {
  const startX = useRef(0)
  const dragging = useRef(false)
  const onResizeRef = useRef(onResize)
  onResizeRef.current = onResize

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    startX.current = e.clientX
    dragging.current = true

    function onMove(e: MouseEvent) {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      startX.current = e.clientX
      onResizeRef.current(delta)
    }

    function onUp() {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div
      onMouseDown={onMouseDown}
      className="hidden md:block group"
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: '6px',
        cursor: 'col-resize',
        zIndex: 10,
      }}
    >
      <div
        className="group-hover:bg-green-400"
        style={{
          position: 'absolute',
          right: '2px',
          top: '20%',
          bottom: '20%',
          width: '2px',
          borderRadius: '2px',
          background: 'transparent',
          transition: 'background 0.15s',
        }}
      />
    </div>
  )
}
