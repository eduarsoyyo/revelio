import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, ArrowRight, Users, FolderOpen, ListChecks, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/data/supabase'

interface SearchResult {
  id: string; label: string; sublabel?: string; type: 'project' | 'person' | 'action' | 'nav'
  icon: typeof Search; color: string; href?: string
}

const NAV_ITEMS: SearchResult[] = [
  { id: 'nav-home', label: 'Inicio', type: 'nav', icon: FolderOpen, color: '#007AFF', href: '/' },
  { id: 'nav-admin', label: 'Centro de Control', type: 'nav', icon: Settings, color: '#8E8E93', href: '/admin' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [projects, setProjects] = useState<Array<{ slug: string; name: string }>>([])
  const [members, setMembers] = useState<Array<{ id: string; name: string; avatar?: string; role_label?: string }>>([])
  const [items, setItems] = useState<Array<{ id: string; text: string; sala: string }>>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Load data once
  useEffect(() => {
    Promise.all([
      supabase.from('rooms').select('slug, name').order('name'),
      supabase.from('team_members').select('id, name, avatar, role_label').order('name'),
      supabase.from('retros').select('sala, data').eq('status', 'active'),
    ]).then(([rR, mR, retR]) => {
      if (rR.data) setProjects(rR.data)
      if (mR.data) setMembers(mR.data)
      const all: Array<{ id: string; text: string; sala: string }> = []
      ;(retR.data || []).forEach((r: { sala: string; data: Record<string, unknown> }) => {
        ((r.data?.actions || []) as Array<Record<string, string>>).forEach(a => {
          if (a.text && a.id && a.status !== 'discarded') all.push({ id: a.id!, text: a.text!, sala: r.sala })
        })
      })
      setItems(all)
    })
  }, [])

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(true); setQuery(''); setSelectedIdx(0) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])

  const results = useMemo(() => {
    if (!query.trim()) return NAV_ITEMS
    const q = query.toLowerCase()
    const r: SearchResult[] = []

    // Projects
    projects.filter(p => p.name.toLowerCase().includes(q)).forEach(p => {
      r.push({ id: `proj-${p.slug}`, label: p.name, sublabel: 'Proyecto', type: 'project', icon: FolderOpen, color: '#007AFF', href: `/project/${p.slug}` })
    })

    // People
    members.filter(m => m.name.toLowerCase().includes(q)).forEach(m => {
      r.push({ id: `pers-${m.id}`, label: m.name, sublabel: m.role_label || 'Equipo', type: 'person', icon: Users, color: '#5856D6' })
    })

    // Items
    items.filter(i => i.text.toLowerCase().includes(q)).slice(0, 8).forEach(i => {
      const projName = (projects.find(p => p.slug === i.sala)?.name ?? i.sala)
      r.push({ id: `item-${i.id}`, label: i.text, sublabel: projName, type: 'action', icon: ListChecks, color: '#34C759', href: `/project/${i.sala}` })
    })

    // Nav
    NAV_ITEMS.filter(n => n.label.toLowerCase().includes(q)).forEach(n => r.push(n))

    return r.slice(0, 12)
  }, [query, projects, members, items])

  useEffect(() => setSelectedIdx(0), [query])

  const go = (result: SearchResult) => {
    setOpen(false)
    if (result.href) navigate(result.href)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[selectedIdx]) { go(results[selectedIdx]) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div onClick={e => e.stopPropagation()} className="relative w-full max-w-lg bg-white dark:bg-revelio-dark-card rounded-2xl shadow-2xl overflow-hidden border border-revelio-border dark:border-revelio-dark-border">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-revelio-border dark:border-revelio-dark-border">
          <Search className="w-4 h-4 text-revelio-subtle dark:text-revelio-dark-subtle flex-shrink-0" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Buscar proyectos, personas, items..."
            className="flex-1 text-sm outline-none bg-transparent dark:text-revelio-dark-text placeholder:text-revelio-subtle dark:placeholder:text-revelio-dark-subtle" />
          <kbd className="text-[8px] px-1.5 py-0.5 rounded bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle border border-revelio-border dark:border-revelio-dark-border">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto py-1">
          {results.length === 0 && (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">Sin resultados para "{query}"</p>
            </div>
          )}
          {results.map((r, i) => (
            <button key={r.id} onClick={() => go(r)} onMouseEnter={() => setSelectedIdx(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === selectedIdx ? 'bg-revelio-blue/5 dark:bg-revelio-blue/10' : 'hover:bg-revelio-bg/50 dark:hover:bg-revelio-dark-border/30'}`}>
              <r.icon className="w-4 h-4 flex-shrink-0" style={{ color: r.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium dark:text-revelio-dark-text truncate">{r.label}</p>
                {r.sublabel && <p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{r.sublabel}</p>}
              </div>
              {r.href && <ArrowRight className="w-3 h-3 text-revelio-subtle dark:text-revelio-dark-subtle" />}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-revelio-border/50 dark:border-revelio-dark-border/50 flex gap-3 text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle">
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>esc cerrar</span>
        </div>
      </div>
    </div>
  )
}
