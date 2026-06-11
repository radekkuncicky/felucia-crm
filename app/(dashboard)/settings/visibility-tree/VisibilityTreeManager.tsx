'use client'

import { useState } from 'react'

type Viditelnost = 'ALL' | 'OWN' | 'SELECTED'

const VID_LABELS: Record<Viditelnost, string> = {
  ALL: 'Vidí vše',
  OWN: 'Jen své',
  SELECTED: 'Své + vybraní',
}

const LINE = '#DDDDDD'

interface OrgUser { id: string; jmeno: string; email: string }

interface TreeNode {
  id: string
  nazev: string
  users: { userId: string; jmeno: string; viditelnost: Viditelnost }[]
  children: TreeNode[]
}

interface FlatNode {
  id: string
  parentId: string | null
  nazev: string
  poradi: number
  users: { userId: string; viditelnost: Viditelnost; user?: { id: string; jmeno: string; email: string } }[]
}

interface Props {
  initialNodes: FlatNode[]
  orgUsers: OrgUser[]
}

// ── helpers ──────────────────────────────────────────────────────────────────

let _counter = 0
const genId = () => `__new_${++_counter}`

function flatToTree(flat: FlatNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  for (const n of flat) {
    map.set(n.id, {
      id: n.id,
      nazev: n.nazev,
      users: n.users.map(u => ({ userId: u.userId, jmeno: u.user?.jmeno ?? '', viditelnost: u.viditelnost })),
      children: [],
    })
  }
  const roots: TreeNode[] = []
  for (const n of flat) {
    const node = map.get(n.id)!
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

function treeToFlat(
  nodes: TreeNode[],
  parentId: string | null = null,
  out: { id: string; parentId: string | null; nazev: string; poradi: number; users: { userId: string; viditelnost: Viditelnost }[] }[] = [],
  ctr = { v: 0 },
) {
  for (const n of nodes) {
    out.push({ id: n.id, parentId, nazev: n.nazev, poradi: ctr.v++, users: n.users.map(u => ({ userId: u.userId, viditelnost: u.viditelnost })) })
    treeToFlat(n.children, n.id, out, ctr)
  }
  return out
}

function updateNode(tree: TreeNode[], id: string, fn: (n: TreeNode) => TreeNode): TreeNode[] {
  return tree.map(n => n.id === id ? fn(n) : { ...n, children: updateNode(n.children, id, fn) })
}

function removeNode(tree: TreeNode[], id: string): TreeNode[] {
  return tree.filter(n => n.id !== id).map(n => ({ ...n, children: removeNode(n.children, id) }))
}

function addChild(tree: TreeNode[], parentId: string, child: TreeNode): TreeNode[] {
  return tree.map(n =>
    n.id === parentId
      ? { ...n, children: [...n.children, child] }
      : { ...n, children: addChild(n.children, parentId, child) }
  )
}

// ── component ─────────────────────────────────────────────────────────────────

export default function VisibilityTreeManager({ initialNodes, orgUsers }: Props) {
  const [tree, setTree] = useState<TreeNode[]>(() => flatToTree(initialNodes))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── mutations ──
  function commitRename(id: string) {
    if (editName.trim()) setTree(t => updateNode(t, id, n => ({ ...n, nazev: editName.trim() })))
    setEditingId(null)
  }

  function handleAddRootOrUnderRoot() {
    const id = genId()
    const child: TreeNode = { id, nazev: 'Nový uzel', users: [], children: [] }
    if (tree.length === 0) {
      setTree([child])
    } else {
      // Add under first root
      setTree(t => addChild(t, t[0].id, child))
    }
    setEditingId(id)
    setEditName('Nový uzel')
  }

  function handleAddChild(parentId: string) {
    const id = genId()
    const child: TreeNode = { id, nazev: 'Nový uzel', users: [], children: [] }
    setTree(t => addChild(t, parentId, child))
    setEditingId(id)
    setEditName('Nový uzel')
  }

  function handleDelete(id: string) {
    setTree(t => removeNode(t, id))
    if (editingId === id) setEditingId(null)
  }

  function handleAddUser(nodeId: string, userId: string) {
    const user = orgUsers.find(u => u.id === userId)
    if (!user) return
    setTree(t => updateNode(t, nodeId, n => ({
      ...n,
      users: n.users.some(u => u.userId === userId)
        ? n.users
        : [...n.users, { userId, jmeno: user.jmeno, viditelnost: 'ALL' }],
    })))
  }

  function handleRemoveUser(nodeId: string, userId: string) {
    setTree(t => updateNode(t, nodeId, n => ({ ...n, users: n.users.filter(u => u.userId !== userId) })))
  }

  function handleChangeVid(nodeId: string, userId: string, vid: Viditelnost) {
    setTree(t => updateNode(t, nodeId, n => ({
      ...n,
      users: n.users.map(u => u.userId === userId ? { ...u, viditelnost: vid } : u),
    })))
  }

  async function saveTree() {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/settings/visibility-tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: treeToFlat(tree) }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Chyba uložení')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Chyba')
    } finally {
      setSaving(false)
    }
  }

  // ── tree rendering ──
  function renderNode(node: TreeNode): JSX.Element {
    const assignedIds = new Set(node.users.map(u => u.userId))
    const available = orgUsers.filter(u => !assignedIds.has(u.id))
    const isEditing = editingId === node.id

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* ── Node card ─────────────────────────────── */}
        <div
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm"
          style={{ minWidth: 200, maxWidth: 260, width: 240, padding: 14 }}
        >
          {/* Name */}
          <div style={{ marginBottom: 10 }}>
            {isEditing ? (
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={() => commitRename(node.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitRename(node.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="w-full border border-blue-400 rounded-lg px-2 py-1 text-sm font-bold text-gray-900 dark:text-white bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            ) : (
              <span
                onClick={() => { setEditingId(node.id); setEditName(node.nazev) }}
                className="block text-sm font-bold text-gray-900 dark:text-white cursor-pointer hover:text-primary dark:hover:text-primary-light truncate"
                title="Klikněte pro přejmenování"
              >
                {node.nazev}
              </span>
            )}
          </div>

          {/* Users */}
          {node.users.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {node.users.map(u => (
                <div
                  key={u.userId}
                  className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-700 rounded-lg px-2 py-1"
                >
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(u.jmeno || '?')[0].toUpperCase()}
                  </div>
                  <span className="text-xs text-gray-700 dark:text-slate-300 flex-1 min-w-0 truncate">{u.jmeno}</span>
                  <select
                    value={u.viditelnost}
                    onChange={e => handleChangeVid(node.id, u.userId, e.target.value as Viditelnost)}
                    className="text-xs bg-transparent border-none text-gray-500 dark:text-slate-400 focus:outline-none cursor-pointer flex-shrink-0"
                    style={{ maxWidth: 80 }}
                  >
                    {(Object.keys(VID_LABELS) as Viditelnost[]).map(v => (
                      <option key={v} value={v}>{VID_LABELS[v]}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRemoveUser(node.id, u.userId)}
                    className="text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 text-base leading-none flex-shrink-0 px-0.5"
                    title="Odebrat uživatele"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add user */}
          {available.length > 0 && (
            <select
              value=""
              onChange={e => { if (e.target.value) handleAddUser(node.id, e.target.value) }}
              className="w-full text-xs border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary mb-2"
            >
              <option value="">+ Přidat uživatele…</option>
              {available.map(u => (
                <option key={u.id} value={u.id}>{u.jmeno}</option>
              ))}
            </select>
          )}

          {/* Actions */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => handleAddChild(node.id)}
              className="text-xs text-primary dark:text-primary-light border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded px-2 py-1"
            >
              + Přidat uzel pod
            </button>
            <button
              onClick={() => handleDelete(node.id)}
              className="text-xs text-red-400 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded px-2 py-1"
            >
              Smazat
            </button>
          </div>
        </div>

        {/* ── Children with connector lines ─────────── */}
        {node.children.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Stem: from card bottom down to horizontal bar */}
            <div style={{ width: 2, height: 20, background: LINE, flexShrink: 0 }} />

            {/* Children row */}
            <div style={{ display: 'flex' }}>
              {node.children.map((child, i) => {
                const isFirst = i === 0
                const isLast = i === node.children.length - 1
                return (
                  <div
                    key={child.id}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 12px', position: 'relative' }}
                  >
                    {/* Horizontal segment of the T-bar */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: isFirst ? '50%' : 0,
                      right: isLast ? '50%' : 0,
                      height: 2,
                      background: LINE,
                    }} />
                    {/* Vertical drop to card */}
                    <div style={{ width: 2, height: 20, background: LINE, flexShrink: 0 }} />
                    {renderNode(child)}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── render ──
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Viditelnost dat</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Nastavte hierarchii viditelnosti pro obchodníky</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAddRootOrUnderRoot}
            className="text-sm border border-blue-300 dark:border-blue-700 text-primary dark:text-primary-light hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-2 rounded-lg"
          >
            + Přidat uzel
          </button>
          <button
            onClick={saveTree}
            disabled={saving}
            className="text-sm font-medium bg-primary hover:bg-primary-hover disabled:opacity-50 text-white px-4 py-2 rounded-lg"
          >
            {saving ? 'Ukládám…' : 'Uložit strom'}
          </button>
        </div>
      </div>

      {saved && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2 text-sm text-green-700 dark:text-green-400">
          Strom viditelnosti byl uložen.
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Tree canvas */}
      {tree.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-12 text-center">
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Žádné uzly. Přidejte první uzel.</p>
          <button
            onClick={handleAddRootOrUnderRoot}
            className="text-sm font-medium bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg"
          >
            + Přidat uzel
          </button>
        </div>
      ) : (
        <div
          className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700"
          style={{ overflowX: 'auto', padding: '32px 24px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, minWidth: 'max-content', margin: '0 auto' }}>
            {tree.map(root => (
              <div key={root.id}>
                {renderNode(root)}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-slate-500 border-t border-gray-100 dark:border-slate-700 pt-4">
        Klikněte na název uzlu pro přejmenování. Změny se uloží po kliknutí na &quot;Uložit strom&quot;.
      </p>
    </div>
  )
}
