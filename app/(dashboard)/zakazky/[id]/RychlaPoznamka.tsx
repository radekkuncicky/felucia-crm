'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  zakazkaId: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any

declare global {
  interface Window {
    SpeechRecognition: AnySpeechRecognition
    webkitSpeechRecognition: AnySpeechRecognition
  }
}

export default function RychlaPoznamka({ zakazkaId }: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [listening, setListening] = useState(false)
  const [hasSpeech, setHasSpeech] = useState(false)
  const recRef = useRef<AnySpeechRecognition | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setHasSpeech(!!(window.SpeechRecognition || window.webkitSpeechRecognition))
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 50)
  }, [open])

  function startListening() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRec) return
    const rec = new SpeechRec()
    rec.lang = 'cs-CZ'
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e: AnySpeechRecognition) => {
      const transcript = e.results[0][0].transcript
      setText(prev => prev ? prev + ' ' + transcript : transcript)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
  }

  function stopListening() {
    recRef.current?.stop()
    setListening(false)
  }

  async function handleSave() {
    if (!text.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/zakazky/${zakazkaId}/komentare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })
      if (res.ok) {
        setDone(true)
        setText('')
        setTimeout(() => { setDone(false); setOpen(false) }, 1200)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Floating button — mobile only */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed bottom-6 right-4 z-40 w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg flex items-center justify-center transition-all active:scale-95"
        title="Rychlá poznámka"
        aria-label="Rychlá poznámka"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">Rychlá poznámka</span>
              </div>
              <button
                onClick={() => { setOpen(false); setText('') }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {done ? (
                <div className="flex flex-col items-center py-4 gap-2">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Uloženo!</p>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={text}
                      onChange={e => setText(e.target.value)}
                      rows={4}
                      placeholder="Napište poznámku z terénu…"
                      className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 pr-12"
                      style={{ fontSize: 16 }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave()
                      }}
                    />
                    {hasSpeech && (
                      <button
                        type="button"
                        onClick={listening ? stopListening : startListening}
                        className={`absolute right-2 bottom-2 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                          listening
                            ? 'bg-red-500 text-white animate-pulse'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600'
                        }`}
                        title={listening ? 'Zastavit nahrávání' : 'Diktovat'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {listening && (
                    <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      Naslouchám…
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => { setOpen(false); setText('') }}
                      className="flex-1 px-4 py-2.5 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      Zrušit
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !text.trim()}
                      className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl disabled:opacity-50 transition-colors active:scale-95"
                    >
                      {saving ? 'Ukládám…' : 'Uložit'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
