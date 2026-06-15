'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { useEffect, useRef, useState } from 'react'
import { confirmDialog } from '@/components/ui/confirm'

// Tabulky a vlastní <style>/celé dokumenty TipTap (StarterKit) neumí — při
// převodu do rich režimu by se ztratily. Takový obsah otevíráme rovnou v HTML.
function looksRichUnsafe(html: string): boolean {
  return /<table|<style|<html|<!doctype/i.test(html)
}

export const SOD_PLACEHOLDERS: [string, string][] = [
  ['{{cislo_smlouvy}}', 'číslo smlouvy'],
  ['{{datum}}', 'dnešní datum'],
  ['{{klient_jmeno}}', 'celé jméno klienta'],
  ['{{klient_adresa}}', 'adresa klienta'],
  ['{{klient_email}}', 'e-mail klienta'],
  ['{{klient_telefon}}', 'telefon klienta'],
  ['{{klient_ico}}', 'IČO klienta'],
  ['{{klient_dic}}', 'DIČ klienta'],
  ['{{kontaktni_osoba}}', 'kontaktní osoba'],
  ['{{kontaktni_telefon}}', 'kontaktní telefon'],
  ['{{predmet}}', 'předmět díla'],
  ['{{adresa_dila}}', 'adresa díla'],
  ['{{obchodnik}}', 'obchodník'],
  ['{{termin_realizace}}', 'termín realizace'],
  ['{{termin_prevzeti}}', 'termín převzetí'],
  ['{{pocet_dni_realizace}}', 'počet dní realizace'],
  ['{{hodnota_zalohy}}', 'výše zálohy'],
  ['{{zaloha_splatnost}}', 'splatnost zálohy (dní)'],
  ['{{konecna_cena}}', 'cena bez DPH'],
  ['{{cena_s_dph}}', 'cena s DPH'],
  ['{{dph_sazba}}', 'sazba DPH'],
  ['{{kod_op}}', 'kód OP'],
  ['{{organizace}}', 'název organizace'],
  ['{{org_sidlo}}', 'sídlo organizace'],
  ['{{org_ico}}', 'IČO organizace'],
  ['{{org_dic}}', 'DIČ organizace'],
  ['{{zmena_term}}', 'změna termínu nejpozději do'],
  ['{{technologie}}', 'technologie (klimatizace, tepelné čerpadlo…)'],
]

// Highlights {{placeholder}} patterns with a chip-style decoration
const PlaceholderHighlight = Extension.create({
  name: 'sodPlaceholderHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('sodPlaceholderHighlight'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = []
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return
              const regex = /\{\{[^}]+\}\}/g
              let match
              while ((match = regex.exec(node.text)) !== null) {
                const from = pos + match.index
                const to = from + match[0].length
                decorations.push(Decoration.inline(from, to, { class: 'sod-ph' }))
              }
            })
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})

interface ToolbarBtnProps {
  active?: boolean
  title: string
  onClick: () => void
  children: React.ReactNode
}

function ToolbarBtn({ active, title, onClick, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      className={`px-1.5 py-1 rounded text-sm font-medium min-w-[28px] transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
          : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div className="w-px h-5 bg-gray-200 dark:bg-slate-600 mx-0.5 self-center" />
}

interface Props {
  content: string
  onChange?: (html: string) => void
  showPlaceholders?: boolean
  readonly?: boolean
  minHeight?: string
}

export default function SodTemplateEditor({
  content,
  onChange,
  showPlaceholders = false,
  readonly = false,
  minHeight = '55vh',
}: Props) {
  const [mode, setMode] = useState<'rich' | 'html'>(() => (looksRichUnsafe(content) ? 'html' : 'rich'))
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      PlaceholderHighlight,
    ],
    content: content || '<p></p>',
    editable: !readonly,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
  })

  // Editor synchronizujeme jen v rich režimu — v HTML režimu je zdrojem pravdy
  // textarea a TipTap by obsah degradoval (zahodil tabulky/styly).
  useEffect(() => {
    if (!editor || mode !== 'rich') return
    if (content !== editor.getHTML()) {
      editor.commands.setContent(content || '<p></p>', { emitUpdate: false })
    }
  }, [content, editor, mode])

  async function toggleMode() {
    if (mode === 'rich') {
      setMode('html')
      return
    }
    // html → rich: varuj, pokud by se ztratily tabulky/styly
    if (looksRichUnsafe(content)) {
      const ok = await confirmDialog(
        'Šablona obsahuje tabulky nebo vlastní styly, které textový (vizuální) režim neumí zobrazit a při uložení by se ztratily. Přepnout přesto?',
        { title: 'Přepnout do vizuálního režimu?', confirmLabel: 'Přepnout', cancelLabel: 'Zůstat v HTML' },
      )
      if (!ok) return
    }
    setMode('rich')
  }

  function insertPlaceholder(ph: string) {
    if (mode === 'html') {
      const ta = textareaRef.current
      const start = ta?.selectionStart ?? content.length
      const end = ta?.selectionEnd ?? content.length
      onChange?.(content.slice(0, start) + ph + content.slice(end))
      requestAnimationFrame(() => {
        if (!ta) return
        ta.focus()
        ta.selectionStart = ta.selectionEnd = start + ph.length
      })
      return
    }
    editor?.chain().focus().insertContent(ph).run()
  }

  return (
    <div className="flex gap-3 items-start">
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        {/* Toolbar */}
        {!readonly && editor && (
          <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60">
            {mode === 'rich' && (<>
            <ToolbarBtn title="Normální text" active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>P</ToolbarBtn>
            <ToolbarBtn title="Nadpis 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</ToolbarBtn>
            <ToolbarBtn title="Nadpis 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarBtn>
            <ToolbarBtn title="Nadpis 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarBtn>
            <Sep />
            <ToolbarBtn title="Tučné (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
              <strong>B</strong>
            </ToolbarBtn>
            <ToolbarBtn title="Kurzíva (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <em>I</em>
            </ToolbarBtn>
            <ToolbarBtn title="Podtržení (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
              <span className="underline">U</span>
            </ToolbarBtn>
            <Sep />
            <ToolbarBtn title="Vlevo" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
              <AlignLeftIcon />
            </ToolbarBtn>
            <ToolbarBtn title="Na střed" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
              <AlignCenterIcon />
            </ToolbarBtn>
            <ToolbarBtn title="Vpravo" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
              <AlignRightIcon />
            </ToolbarBtn>
            <Sep />
            <ToolbarBtn title="Odrážkový seznam" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
              <ListIcon />
            </ToolbarBtn>
            <ToolbarBtn title="Číslovaný seznam" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              <OrderedListIcon />
            </ToolbarBtn>
            </>)}
            <button
              type="button"
              title={mode === 'rich' ? 'Přepnout na HTML zdroják (tabulky, vlastní styly)' : 'Přepnout na vizuální režim'}
              onMouseDown={e => { e.preventDefault(); toggleMode() }}
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              {mode === 'rich'
                ? <><CodeIcon /> HTML</>
                : <><EyeIcon /> Vizuální</>}
            </button>
          </div>
        )}

        <style>{`
          .sod-editor .ProseMirror {
            min-height: ${minHeight};
            padding: 1.25rem 1.5rem;
            outline: none;
            font-size: 0.875rem;
            line-height: 1.75;
          }
          .sod-editor .ProseMirror h1 { font-size: 1.35em; font-weight: 700; margin: 1em 0 0.5em; }
          .sod-editor .ProseMirror h2 { font-size: 1.15em; font-weight: 700; margin: 0.9em 0 0.4em; }
          .sod-editor .ProseMirror h3 { font-size: 1em; font-weight: 700; margin: 0.8em 0 0.3em; }
          .sod-editor .ProseMirror p { margin: 0 0 0.5em; }
          .sod-editor .ProseMirror ul,
          .sod-editor .ProseMirror ol { padding-left: 1.5em; margin: 0.4em 0; }
          .sod-editor .ProseMirror li { margin: 0.15em 0; }
          .sod-ph {
            padding: 1px 5px;
            border-radius: 3px;
            background: rgb(219 234 254);
            color: rgb(29 78 216);
            font-family: ui-monospace, monospace;
            font-size: 0.82em;
            white-space: nowrap;
          }
          .dark .sod-ph {
            background: rgba(30, 64, 175, 0.35);
            color: rgb(147 197 253);
          }
        `}</style>
        {mode === 'html' ? (
          <textarea
            ref={textareaRef}
            value={content}
            readOnly={readonly}
            onChange={e => onChange?.(e.target.value)}
            spellCheck={false}
            placeholder="<p>HTML zdroják smlouvy…</p>"
            className="block w-full resize-y border-0 px-4 py-3 font-mono text-xs leading-relaxed text-gray-800 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none"
            style={{ minHeight }}
          />
        ) : (
          <div className="sod-editor">
            <EditorContent editor={editor} />
          </div>
        )}
      </div>

      {/* Placeholder panel */}
      {showPlaceholders && !readonly && (
        <div className="w-56 shrink-0 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-100 dark:border-slate-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Symboly</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Kliknutím vložíš na kurzor</p>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-700/50 max-h-[70vh] overflow-y-auto">
            {SOD_PLACEHOLDERS.map(([ph, desc]) => (
              <button
                key={ph}
                type="button"
                onClick={() => insertPlaceholder(ph)}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <p className="font-mono text-xs text-blue-700 dark:text-blue-400">{ph}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AlignLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h12" />
    </svg>
  )
}
function AlignCenterIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M5 18h14" />
    </svg>
  )
}
function AlignRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M8 18h12" />
    </svg>
  )
}
function ListIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  )
}
function OrderedListIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5h11M9 12h11M9 19h11M4 5v.01M4 12v.01M4 19v.01" />
    </svg>
  )
}
function CodeIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  )
}
function EyeIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}
