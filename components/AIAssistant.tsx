'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useOrgSettings } from '@/context/OrgSettingsContext'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  quickReplies?: string[]
}

interface Deal {
  id: string
  kod: string
  predmet: string | null
  technologie: string
  stav: string
  client?: { jmeno: string }
}

export default function AIAssistant() {
  const orgSettings = useOrgSettings()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [currentDeal, setCurrentDeal] = useState<Deal | null>(null)
  const [hasSpeechSupport, setHasSpeechSupport] = useState(false)
  const [canUseAI, setCanUseAI] = useState<boolean | null>(null)
  const [creditsUsed, setCreditsUsed] = useState<number | null>(null)
  const [creditsLimit, setCreditsLimit] = useState<number | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { resolvedTheme } = useTheme()
  const dk = resolvedTheme === 'dark'

  const c = {
    panelBg:          dk ? '#0D1A0E' : '#FAFAFA',
    panelBorder:      dk ? 'rgba(76,175,80,0.12)' : 'rgba(0,0,0,0.06)',
    panelShadow:      dk ? '0 12px 48px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)' : '0 12px 48px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)',
    headerBg:         dk ? '#0D1A0E' : '#fff',
    headerBorder:     dk ? '#1A2E1B' : '#F0F0F0',
    msgAreaBg:        dk ? '#0D1A0E' : '#FAFAFA',
    titleText:        dk ? '#f1f5f9' : '#111827',
    subtitleText:     dk ? '#81C784' : '#6B7280',
    hintBoxBg:        dk ? '#0A120A' : '#F9FAFB',
    hintBoxBorder:    dk ? '#1A2E1B' : '#E5E7EB',
    hintLabel:        dk ? '#f1f5f9' : '#111827',
    hintSub:          dk ? '#6B8C6B' : '#9CA3AF',
    chipBg:           dk ? '#0A120A' : '#fff',
    asstBubbleBg:     dk ? '#1A2E1B' : '#fff',
    asstBubbleBorder: dk ? '#2D4A2E' : '#EBEBEB',
    msgText:          dk ? '#f1f5f9' : '#111827',
    footerBg:         dk ? '#0D1A0E' : '#fff',
    footerBorder:     dk ? '#1A2E1B' : '#F0F0F0',
    inputBg:          dk ? '#0A120A' : '#FAFAFA',
    inputBorder:      dk ? '#2D4A2E' : '#E5E7EB',
    inputText:        dk ? '#f1f5f9' : '#111827',
    closeBtnBg:       dk ? '#1A2E1B' : '#F3F4F6',
    closeBtnText:     dk ? '#81C784' : '#6B7280',
    micBtnBg:         dk ? '#1A2E1B' : '#F3F4F6',
    iconColor:        dk ? '#81C784' : '#6B7280',
    sendDisabledBg:   dk ? '#1A2E1B' : '#E5E7EB',
    sendDisabledIcon: dk ? '#6B8C6B' : '#9CA3AF',
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHasSpeechSupport('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    }
  }, [])

  useEffect(() => {
    const handleOpen = () => setIsOpen(true)
    window.addEventListener('dasha:open', handleOpen)
    return () => window.removeEventListener('dasha:open', handleOpen)
  }, [])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('dasha:statechange', { detail: { open: isOpen } }))
  }, [isOpen])

  useEffect(() => {
    const dealMatch = pathname.match(/^\/deals\/([^/]+)$/)
    if (dealMatch) {
      fetch(`/api/deals/${dealMatch[1]}`)
        .then(r => (r.ok ? r.json() : null))
        .then(data => setCurrentDeal(data))
        .catch(() => setCurrentDeal(null))
    } else {
      setCurrentDeal(null)
    }
  }, [pathname])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    if (!isOpen) return
    fetch('/api/ai-assistant')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        setCanUseAI(data.canUseAI)
        setCreditsUsed(data.creditsUsed ?? null)
        setCreditsLimit(data.creditsLimit ?? null)
      })
      .catch(() => {})
  }, [isOpen])

  const sendMessage = useCallback(
    async (text?: string) => {
      const messageText = text ?? input.trim()
      if (!messageText || isLoading) return

      // Build page context (invisible to user, appended to API message)
      const pageContextParts: string[] = []
      const dealPathMatch = pathname.match(/^\/deals\/([^/?#]+)/)
      if (dealPathMatch) {
        pageContextParts.push(`dealId=${dealPathMatch[1]}`)
        if (currentDeal?.kod) pageContextParts.push(`dealKod=${currentDeal.kod}`)
      }
      const zakazkaPathMatch = pathname.match(/^\/zakazky\/([^/?#]+)/)
      if (zakazkaPathMatch) pageContextParts.push(`zakazkaId=${zakazkaPathMatch[1]}`)
      const klientPathMatch = pathname.match(/^\/clients\/([^/?#]+)/)
      if (klientPathMatch) pageContextParts.push(`klientId=${klientPathMatch[1]}`)

      const apiMessage = pageContextParts.length > 0
        ? `${messageText}\n[page-context: ${pageContextParts.join(', ')}]`
        : messageText

      const userMessage: ChatMessage = { role: 'user', content: messageText }
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      setMessages(prev => [...prev, userMessage])
      setInput('')
      setIsLoading(true)

      try {
        const res = await fetch('/api/ai-assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: apiMessage,
            context: {
              currentPage: pathname,
              currentDeal: currentDeal ?? null,
              currentUser: session?.user
                ? { id: session.user.id, jmeno: session.user.jmeno, role: session.user.role }
                : null,
              orgId: session?.user?.orgId,
            },
            history,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          setMessages(prev => [...prev, { role: 'assistant', content: data.error ?? 'Omlouvám se, nastala chyba.' }])
          return
        }

        if (data.creditsUsed !== undefined) setCreditsUsed(data.creditsUsed)
        if (data.creditsLimit !== undefined) setCreditsLimit(data.creditsLimit)

        const responseMessage = data.message ?? 'Omlouvám se, nastala chyba.'
        const quickReplies: string[] = Array.isArray(data.quickReplies) ? data.quickReplies : []

        setMessages(prev => [...prev, { role: 'assistant', content: responseMessage, quickReplies }])

        // Server-side navigation after action
        if (data.navigateTo) {
          setTimeout(() => {
            router.push(data.navigateTo)
            router.refresh()
          }, 600)
        } else {
          router.refresh()
        }
      } catch {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Omlouvám se, nastala chyba při komunikaci.' }])
      } finally {
        setIsLoading(false)
      }
    },
    [input, messages, isLoading, pathname, currentDeal, session, router]
  )

  const toggleRecording = useCallback(() => {
    if (!hasSpeechSupport) return
    if (isRecording) {
      recognitionRef.current?.stop()
      setIsRecording(false)
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognition.lang = 'cs-CZ'
    recognition.continuous = true
    recognition.interimResults = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setInput(prev => prev + transcript)
    }
    recognition.onend = () => setIsRecording(false)
    recognition.start()
    recognitionRef.current = recognition
    setIsRecording(true)
  }, [hasSpeechSupport, isRecording])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!orgSettings.modulDasa) return null

  if (session?.user?.isDemo) {
    return (
      <>
        <button
          className="dasha-btn dasha-fab hidden md:flex"
          onClick={() => setIsOpen(p => !p)}
          title="Dáša — AI asistentka (nedostupné v demo)"
          style={{ width: 56, height: 56, borderRadius: '50%', background: '#4CAF50', border: 'none', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(76,175,80,0.4)', transition: 'transform 0.15s' }}
        >
          <span style={{ fontSize: 24 }}>✦</span>
        </button>
        {isOpen && (
          <div style={{ position: 'fixed', bottom: 90, right: 24, width: 360, zIndex: 1000, background: '#0D1A0E', border: '1px solid rgba(76,175,80,0.2)', borderRadius: 16, padding: '28px 24px', boxShadow: '0 12px 48px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setIsOpen(false)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: '#6B8C6B', cursor: 'pointer', fontSize: 18 }}>✕</button>
            <div style={{ fontSize: 36 }}>✦</div>
            <p style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15, margin: 0, textAlign: 'center' }}>Dáša — AI asistentka</p>
            <p style={{ color: '#81C784', fontSize: 13, margin: 0, textAlign: 'center', lineHeight: 1.5 }}>V demo módu je vypnuta.</p>
            <a href="/#pricing" onClick={() => setIsOpen(false)} style={{ marginTop: 8, background: '#4CAF50', color: '#fff', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>Vyzkoušet 14 dní →</a>
          </div>
        )}
      </>
    )
  }

  const creditLabel = (() => {
    if (canUseAI === false) return 'Nedostupné'
    if (creditsUsed !== null && creditsLimit !== null) return `${creditsUsed}/${creditsLimit} kreditů`
    if (creditsUsed !== null) return `${creditsUsed} kreditů`
    return 'AI asistentka'
  })()

  return (
    <>
      <style>{`
        @keyframes dashaTyping {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        .dasha-dot { width: 8px; height: 8px; border-radius: 50%; background: #4CAF50; animation: dashaTyping 1.2s infinite; display: inline-block; }
        .dasha-dot:nth-child(2) { animation-delay: 0.2s; }
        .dasha-dot:nth-child(3) { animation-delay: 0.4s; }
        .dasha-btn:hover { transform: scale(1.08); }
        .dasha-fab { position: fixed; bottom: 96px; right: 24px; z-index: 1000; }
        @media (min-width: 768px) { .dasha-fab { bottom: 24px; } }
        .dasha-panel { position: fixed; bottom: 90px; right: 24px; width: 400px; height: 580px; z-index: 1000; }
        @media (max-width: 767px) {
          .dasha-fab { display: none; }
          .dasha-panel { bottom: 0 !important; left: 0 !important; right: 0 !important; width: 100% !important; height: 100dvh !important; border-radius: 0 !important; z-index: 1001; }
        }
        .dasha-md p { margin: 0 0 5px 0; }
        .dasha-md p:last-child { margin-bottom: 0; }
        .dasha-md ul, .dasha-md ol { margin: 3px 0 5px 18px; padding: 0; }
        .dasha-md li { margin-bottom: 2px; }
        .dasha-md strong { font-weight: 650; }
        .dasha-md h1, .dasha-md h2, .dasha-md h3 { font-weight: 700; font-size: 13px; margin: 10px 0 4px 0; letter-spacing: 0.01em; }
        .dasha-md h1:first-child, .dasha-md h2:first-child, .dasha-md h3:first-child { margin-top: 0; }
        .dasha-md table { border-collapse: collapse; width: 100%; font-size: 12.5px; margin: 6px 0; }
        .dasha-md th { background: rgba(76,175,80,0.12); padding: 5px 8px; border: 1px solid #e5e7eb; font-weight: 600; text-align: left; }
        .dark .dasha-md th { border-color: #2D4A2E; }
        .dasha-md td { padding: 4px 8px; border: 1px solid #e5e7eb; }
        .dark .dasha-md td { border-color: #2D4A2E; }
        .dasha-md tr:nth-child(even) td { background: rgba(0,0,0,0.025); }
        .dark .dasha-md tr:nth-child(even) td { background: rgba(255,255,255,0.05); }
        .dasha-md hr { border: none; border-top: 1px solid #e5e7eb; margin: 10px 0; }
        .dark .dasha-md hr { border-top-color: #2D4A2E; }
        .dasha-md code { background: rgba(0,0,0,0.06); border-radius: 4px; padding: 1px 5px; font-size: 12px; }
        .dark .dasha-md code { background: rgba(255,255,255,0.1); }
        .dasha-md a { color: #2E7D32; text-decoration: underline; }
        .dark .dasha-md a { color: #81C784; }
      `}</style>

      <button
        className="dasha-btn dasha-fab hidden md:flex"
        onClick={() => setIsOpen(p => !p)}
        title="Dáša — AI asistentka"
        style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#4CAF50', border: 'none', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(76,175,80,0.45)', fontSize: '22px', transition: 'transform 0.2s' }}
      >
        ✦
      </button>

      {isOpen && (
        <div className="dasha-panel" style={{ background: c.panelBg, borderRadius: '20px', boxShadow: c.panelShadow, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: `1px solid ${c.panelBorder}` }}>
          {/* Header */}
          <div style={{ background: c.headerBg, borderBottom: `1px solid ${c.headerBorder}`, padding: '12px 16px', paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#4CAF50', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, flexShrink: 0 }}>D</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: c.titleText, lineHeight: 1.2 }}>Dáša</div>
                <div style={{ fontSize: '11.5px', color: c.subtitleText, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: canUseAI === false ? '#EF4444' : '#22C55E', display: 'inline-block' }} />
                  {creditLabel}
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: c.closeBtnBg, border: 'none', cursor: 'pointer', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: c.closeBtnText }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px', background: c.msgAreaBg }}>
            {messages.length === 0 && (
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', marginBottom: '6px' }}>✦</div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: c.titleText }}>Ahoj, jsem Dáša</div>
                  <div style={{ fontSize: '13px', color: c.subtitleText, marginTop: '3px' }}>AI asistentka pro FELUCIA CRM</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                  {[
                    { icon: '📋', label: 'Obchodní případy', hint: 'Vytvoř, změň stav, přidej aktivitu' },
                    { icon: '💰', label: 'Nabídky', hint: 'Sestav CN s položkami' },
                    { icon: '🔍', label: 'Vyhledávání', hint: 'Klienti, OP, nabídky, katalog' },
                  ].map(({ icon, label, hint }) => (
                    <div key={label} style={{ background: c.hintBoxBg, border: `1px solid ${c.hintBoxBorder}`, borderRadius: '10px', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '16px', flexShrink: 0 }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: c.hintLabel }}>{label}</div>
                        <div style={{ fontSize: '12px', color: c.hintSub }}>{hint}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                  {['Co mám dnes?', 'Nový OP', 'Sestav nabídku'].map(chip => (
                    <button key={chip} onClick={() => sendMessage(chip)} style={{ background: c.chipBg, border: '1px solid #4CAF50', borderRadius: '20px', padding: '5px 12px', fontSize: '12.5px', color: '#2E7D32', cursor: 'pointer', fontWeight: 500 }}>{chip}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => {
              const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1
              return (
                <div key={i} style={{ marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: '8px' }}>
                    {msg.role === 'assistant' && (
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#4CAF50', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0, alignSelf: 'flex-end' }}>D</div>
                    )}
                    <div style={{ maxWidth: '78%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px', background: msg.role === 'user' ? '#4CAF50' : c.asstBubbleBg, border: msg.role === 'assistant' ? `1px solid ${c.asstBubbleBorder}` : 'none', fontSize: '13.5px', lineHeight: '1.55', color: msg.role === 'user' ? '#111827' : c.msgText, boxShadow: msg.role === 'assistant' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>
                      {msg.role === 'assistant' ? (
                        <div className="dasha-md">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                      )}
                    </div>
                  </div>

                  {isLastAssistant && !input && msg.quickReplies && msg.quickReplies.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px', paddingLeft: '36px' }}>
                      {msg.quickReplies.map((reply, ri) => (
                        <button
                          key={ri}
                          onClick={() => sendMessage(reply)}
                          style={{ background: 'transparent', border: '1px solid #4CAF50', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', color: '#2E7D32', cursor: 'pointer', fontWeight: 500, transition: 'background 0.15s' }}
                          onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = '#E8F5E9' }}
                          onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'transparent' }}
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {isLoading && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '6px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#4CAF50', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>D</div>
                <div style={{ background: c.asstBubbleBg, border: `1px solid ${c.asstBubbleBorder}`, borderRadius: '4px 18px 18px 18px', padding: '10px 16px', display: 'flex', gap: '4px', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <span className="dasha-dot" /><span className="dasha-dot" /><span className="dasha-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer */}
          <div style={{ background: c.footerBg, borderTop: `1px solid ${c.footerBorder}`, padding: '10px 12px', display: 'flex', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Napiš zprávu..."
              rows={1}
              style={{ flex: 1, resize: 'none', border: `1.5px solid ${c.inputBorder}`, borderRadius: '14px', padding: '9px 13px', fontSize: '13.5px', outline: 'none', maxHeight: '80px', lineHeight: '1.45', fontFamily: 'inherit', overflowY: 'auto', background: c.inputBg, color: c.inputText, transition: 'border-color 0.15s' }}
              onFocus={e => { e.target.style.borderColor = '#4CAF50' }}
              onBlur={e => { e.target.style.borderColor = c.inputBorder }}
            />
            {hasSpeechSupport && (
              <button onClick={toggleRecording} title={isRecording ? 'Zastavit' : 'Hlasový vstup'} style={{ background: isRecording ? '#EF4444' : c.micBtnBg, border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill={isRecording ? '#fff' : c.iconColor}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" stroke={isRecording ? '#fff' : c.iconColor} strokeWidth="2" fill="none" strokeLinecap="round" /><line x1="12" y1="19" x2="12" y2="23" stroke={isRecording ? '#fff' : c.iconColor} strokeWidth="2" strokeLinecap="round" /><line x1="9" y1="23" x2="15" y2="23" stroke={isRecording ? '#fff' : c.iconColor} strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            )}
            <button onClick={() => sendMessage()} disabled={!input.trim() || isLoading} style={{ background: input.trim() && !isLoading ? '#4CAF50' : c.sendDisabledBg, border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !isLoading ? '#1a1a1a' : c.sendDisabledIcon} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
