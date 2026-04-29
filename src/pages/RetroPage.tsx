import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import {
  ArrowLeft, ClipboardCheck, MessageSquare, MessageCircle,
  AlertTriangle, ListChecks, BarChart3, ChevronLeft, ChevronRight,
  CheckSquare, Clock, Shield, ThumbsUp, Users, Plus, Send,
  Trash2,
} from 'lucide-react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/data/supabase'
import type { Room, Member } from '@/types'

// ── Config ──
const PHASES = [
  { id: 'review', label: 'Revisión', num: '01', icon: ClipboardCheck, desc: 'Revisa objetivo y tareas del periodo anterior.' },
  { id: 'individual', label: 'Individual', num: '02', icon: MessageSquare, desc: 'Cada persona escribe notas individuales.' },
  { id: 'discuss', label: 'Discusión', num: '03', icon: MessageCircle, desc: 'Comparte, vota y debate las notas.' },
  { id: 'risks', label: 'Riesgos', num: '04', icon: AlertTriangle, desc: 'Identifica riesgos y problemas.' },
  { id: 'actions', label: 'Accionables', num: '05', icon: ListChecks, desc: 'Convierte notas en tareas concretas.' },
  { id: 'summary', label: 'Resumen', num: '06', icon: BarChart3, desc: 'Revisa lo decidido y finaliza.' },
]

const NOTE_CATS = [
  { id: 'bien', label: 'Bien', color: '#34C759' },
  { id: 'mejorar', label: 'Mejorar', color: '#FF9500' },
  { id: 'idea', label: 'Idea', color: '#007AFF' },
  { id: 'problema', label: 'Problema', color: '#FF3B30' },
]

const RISK_TYPES = [
  { id: 'riesgo', label: 'Riesgo', color: '#FF9500' },
  { id: 'problema', label: 'Problema', color: '#FF3B30' },
  { id: 'oportunidad', label: 'Oportunidad', color: '#34C759' },
]

const CAT_COLORS: Record<string, string> = { bien: '#34C759', mejorar: '#FF9500', idea: '#007AFF', problema: '#FF3B30' }
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

interface Note { id: string; text: string; category: string; userName: string; userId: string; votes: string[]; createdAt: string }
interface Action { id: string; text: string; status: string; owner: string; date: string; priority: string; createdAt: string; [k: string]: unknown }
interface Risk { id: string; text: string; title: string; status: string; prob: string; impact: string; type: string; owner: string; escalation?: { level?: string }; createdAt: string }
interface TaskItem { text: string; done: boolean }

export function RetroPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()
  const [room, setRoom] = useState<Room | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [risks, setRisks] = useState<Risk[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [objective, setObjective] = useState('')
  const [phase, setPhase] = useState(0)
  const [loading, setLoading] = useState(true)
  const [retroId, setRetroId] = useState<string | null>(null)

  // Form states
  const [noteText, setNoteText] = useState('')
  const [noteCat, setNoteCat] = useState('bien')
  const [actionText, setActionText] = useState('')
  const [actionOwner, setActionOwner] = useState('')
  const [actionDate, setActionDate] = useState('')
  const [riskText, setRiskText] = useState('')
  const [riskType, setRiskType] = useState('riesgo')
  const [riskProb, setRiskProb] = useState('media')
  const [riskImpact, setRiskImpact] = useState('medio')

  // Auto-save ref
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef({ notes, actions, risks, tasks, obj: { text: objective } })

  // Keep ref in sync
  useEffect(() => { stateRef.current = { notes, actions, risks, tasks, obj: { text: objective } } }, [notes, actions, risks, tasks, objective])

  // Load data
  useEffect(() => {
    if (!slug) return
    async function load() {
      const [roomR, membersR, retrosR] = await Promise.all([
        supabase.from('rooms').select('*').eq('slug', slug).single(),
        supabase.from('team_members').select('*').order('name'),
        supabase.from('retros').select('*').eq('sala', slug).eq('status', 'active').order('created_at', { ascending: false }).limit(1),
      ])
      if (roomR.data) setRoom(roomR.data)
      if (membersR.data) setMembers(membersR.data)
      if (retrosR.data?.[0]) {
        setRetroId(retrosR.data[0].id)
        const d = retrosR.data[0].data as Record<string, unknown>
        if (d) {
          setNotes((d.notes || []) as Note[])
          setActions((d.actions || []) as Action[])
          setRisks((d.risks || []) as Risk[])
          setTasks((d.tasks || []) as TaskItem[])
          setObjective(((d.obj as Record<string, string>)?.text) || '')
        }
      }
      setLoading(false)
    }
    load()
  }, [slug])

  // Auto-save (debounced 3s)
  const triggerSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!retroId || !slug) return
      const s = stateRef.current
      const hasData = s.notes.length > 0 || s.actions.length > 0 || s.risks.length > 0
      if (!hasData) return
      await supabase.from('retros').update({ data: s, updated_at: new Date().toISOString() }).eq('id', retroId)
    }, 3000)
  }, [retroId, slug])

  // Trigger save on state change
  useEffect(() => { if (retroId) triggerSave() }, [notes, actions, risks, tasks, objective, triggerSave, retroId])

  const teamMembers = useMemo(() => members.filter(m => (m.rooms || []).includes(slug || '')), [members, slug])
  const today = new Date().toISOString().slice(0, 10)
  const currentPhase = PHASES[phase]!
  const acts = useMemo(() => actions.filter(a => a.status !== 'discarded' && a.status !== 'cancelled'), [actions])
  const actDone = acts.filter(a => a.status === 'done' || a.status === 'archived').length
  const rOpen = risks.filter(r => r.status !== 'mitigated')

  const notesByCategory = useMemo(() => {
    const grouped: Record<string, Note[]> = {}
    notes.forEach(n => { const cat = n.category || 'bien'; if (!grouped[cat]) grouped[cat] = []; grouped[cat].push(n) })
    return grouped
  }, [notes])

  // ── Handlers ──
  const addNote = () => {
    if (!noteText.trim() || !user) return
    const note: Note = { id: uid(), text: noteText.trim(), category: noteCat, userName: user.name, userId: user.id, votes: [], createdAt: new Date().toISOString() }
    setNotes(prev => [...prev, note])
    setNoteText('')
  }

  const toggleVote = (noteId: string) => {
    if (!user) return
    setNotes(prev => prev.map(n => {
      if (n.id !== noteId) return n
      const hasVoted = n.votes.includes(user.id)
      return { ...n, votes: hasVoted ? n.votes.filter(v => v !== user.id) : [...n.votes, user.id] }
    }))
  }

  const deleteNote = (noteId: string) => {
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  const addAction = () => {
    if (!actionText.trim()) return
    const action: Action = { id: uid(), text: actionText.trim(), status: 'todo', owner: actionOwner, date: actionDate, priority: 'medium', createdAt: new Date().toISOString() }
    setActions(prev => [...prev, action])
    setActionText(''); setActionOwner(''); setActionDate('')
  }

  const toggleActionStatus = (id: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, status: a.status === 'done' ? 'todo' : 'done' } : a))
  }

  const deleteAction = (id: string) => {
    setActions(prev => prev.filter(a => a.id !== id))
  }

  const addRisk = () => {
    if (!riskText.trim()) return
    const risk: Risk = { id: uid(), text: riskText.trim(), title: riskText.trim(), status: 'open', prob: riskProb, impact: riskImpact, type: riskType, owner: '', createdAt: new Date().toISOString() }
    setRisks(prev => [...prev, risk])
    setRiskText(''); setRiskProb('media'); setRiskImpact('medio')
  }

  const toggleRiskMitigated = (id: string) => {
    setRisks(prev => prev.map(r => r.id === id ? { ...r, status: r.status === 'mitigated' ? 'open' : 'mitigated' } : r))
  }

  const deleteRisk = (id: string) => {
    setRisks(prev => prev.filter(r => r.id !== id))
  }

  const toggleTask = (i: number) => {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, done: !t.done } : t))
  }

  if (loading) return <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center"><div className="animate-pulse text-sm text-revelio-subtle dark:text-revelio-dark-subtle">Cargando retrospectiva...</div></div>
  if (!room) return <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center flex-col gap-3"><p className="text-sm text-revelio-subtle dark:text-revelio-dark-subtle">Proyecto no encontrado</p><Link to="/" className="text-xs text-revelio-blue hover:underline">Volver</Link></div>

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/project/${slug}`} className="w-7 h-7 rounded-lg border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:bg-revelio-dark-border transition-colors">
              <ArrowLeft className="w-3.5 h-3.5 text-revelio-subtle dark:text-revelio-dark-subtle" />
            </Link>
            <div>
              <h1 className="text-base font-semibold text-revelio-text dark:text-revelio-dark-text">{room.name}</h1>
              <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">Retrospectiva · Fase {phase + 1} de 6</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => phase > 0 && setPhase(phase - 1)} disabled={phase === 0} className="w-7 h-7 rounded-lg border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:bg-revelio-dark-border transition-colors disabled:opacity-30"><ChevronLeft className="w-4 h-4 text-revelio-subtle dark:text-revelio-dark-subtle" /></button>
            <div className="flex gap-1">
              {PHASES.map((p, i) => (
                <button key={p.id} onClick={() => setPhase(i)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 ${i === phase ? 'bg-revelio-blue text-white' : i < phase ? 'bg-revelio-green/10 text-revelio-green' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle hover:bg-revelio-border/50'}`}>
                  <p.icon className="w-3 h-3" /><span className="hidden sm:inline">{p.label}</span><span className="sm:hidden">{p.num}</span>
                </button>
              ))}
            </div>
            <button onClick={() => phase < 5 && setPhase(phase + 1)} disabled={phase === 5} className="w-7 h-7 rounded-lg border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:bg-revelio-dark-border transition-colors disabled:opacity-30"><ChevronRight className="w-4 h-4 text-revelio-subtle dark:text-revelio-dark-subtle" /></button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-revelio-subtle dark:text-revelio-dark-subtle"><Users className="w-3.5 h-3.5" /> {teamMembers.length}</div>
        </div>
      </div>

      {/* Phase guide */}
      <div className="shrink-0 bg-revelio-blue/5 border-b border-revelio-blue/10 px-6 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-revelio-blue">{currentPhase.num}</span>
          <span className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text">{currentPhase.label}</span>
          <span className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">— {currentPhase.desc}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">

          {/* ═══ FASE 1: Revisión ═══ */}
          {phase === 0 && (
            <div>
              <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-5 mb-4">
                <h3 className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text mb-2 flex items-center gap-1.5"><ClipboardCheck className="w-4 h-4 text-revelio-blue" /> Objetivo del periodo</h3>
                <input value={objective} onChange={e => setObjective(e.target.value)} placeholder="Define el objetivo de este periodo..."
                  className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-sm text-revelio-text dark:text-revelio-dark-text outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text transition-colors" />
              </div>
              {tasks.length > 0 && (
                <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-5">
                  <h3 className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text mb-3">Tareas ({tasks.filter(t => t.done).length}/{tasks.length})</h3>
                  <div className="space-y-1.5">
                    {tasks.map((t, i) => (
                      <button key={i} onClick={() => toggleTask(i)} className="flex items-center gap-2 py-1.5 w-full text-left">
                        <CheckSquare className={`w-4 h-4 ${t.done ? 'text-revelio-green' : 'text-revelio-border'}`} />
                        <span className={`text-sm ${t.done ? 'line-through text-revelio-subtle dark:text-revelio-dark-subtle' : 'text-revelio-text dark:text-revelio-dark-text'}`}>{t.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ FASE 2: Individual ═══ */}
          {phase === 1 && (
            <div>
              {/* Input form */}
              <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4 mb-5">
                <div className="flex gap-2 mb-3">
                  {NOTE_CATS.map(c => (
                    <button key={c.id} onClick={() => setNoteCat(c.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${noteCat === c.id ? 'text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}
                      style={noteCat === c.id ? { background: c.color } : undefined}>
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={noteText} onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addNote()}
                    placeholder="Escribe una nota..." className="flex-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-sm outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text transition-colors" />
                  <button onClick={addNote} disabled={!noteText.trim()}
                    className="px-4 py-2 rounded-lg bg-revelio-blue text-white text-sm font-medium disabled:opacity-30 hover:bg-revelio-blue/90 transition-colors flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5" /> Añadir
                  </button>
                </div>
              </div>

              {/* Notes by category */}
              <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mb-3">{notes.length} nota{notes.length !== 1 ? 's' : ''}</p>
              {Object.entries(notesByCategory).map(([cat, catNotes]) => (
                <div key={cat} className="mb-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: CAT_COLORS[cat] || '#86868B' }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: CAT_COLORS[cat] || '#86868B' }} /> {cat} ({catNotes.length})
                  </h4>
                  <div className="space-y-1.5">
                    {catNotes.map(n => (
                      <div key={n.id} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3 flex items-center gap-3 group">
                        <div className="w-1.5 h-6 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[n.category] || '#86868B' }} />
                        <span className="text-sm flex-1 text-revelio-text dark:text-revelio-dark-text">{n.text}</span>
                        <span className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">{n.userName?.split(' ')[0]}</span>
                        {user && n.userId === user.id && (
                          <button onClick={() => deleteNote(n.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-revelio-subtle dark:text-revelio-dark-subtle hover:text-revelio-red">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {notes.length === 0 && <EmptyPhase message="Nadie ha escrito notas aún. Usa el formulario de arriba." />}
            </div>
          )}

          {/* ═══ FASE 3: Discusión ═══ */}
          {phase === 2 && (
            <div>
              <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mb-4">Notas ordenadas por votos — pulsa para votar</p>
              {[...notes].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0)).map(n => {
                const hasVoted = user ? n.votes?.includes(user.id) : false
                return (
                  <div key={n.id} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3 mb-1.5 flex items-center gap-3">
                    <div className="w-1.5 h-6 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[n.category] || '#86868B' }} />
                    <span className="text-sm flex-1 text-revelio-text dark:text-revelio-dark-text">{n.text}</span>
                    <span className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">{n.userName?.split(' ')[0]}</span>
                    <button onClick={() => toggleVote(n.id)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${hasVoted ? 'bg-revelio-blue/15 text-revelio-blue' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle hover:bg-revelio-blue/10'}`}>
                      <ThumbsUp className="w-3 h-3" /> {n.votes?.length || 0}
                    </button>
                  </div>
                )
              })}
              {notes.length === 0 && <EmptyPhase message="Sin notas para discutir. Vuelve a la fase 2." />}
            </div>
          )}

          {/* ═══ FASE 4: Riesgos ═══ */}
          {phase === 3 && (
            <div>
              {/* Create risk form */}
              <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4 mb-5">
                <div className="flex gap-2 mb-3">
                  {RISK_TYPES.map(t => (
                    <button key={t.id} onClick={() => setRiskType(t.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${riskType === t.id ? 'text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}
                      style={riskType === t.id ? { background: t.color } : undefined}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mb-3">
                  <input value={riskText} onChange={e => setRiskText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addRisk()}
                    placeholder="Describe el riesgo o problema..." className="flex-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-sm outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text transition-colors" />
                  <button onClick={addRisk} disabled={!riskText.trim()}
                    className="px-4 py-2 rounded-lg bg-revelio-orange text-white text-sm font-medium disabled:opacity-30 hover:bg-revelio-orange/90 transition-colors flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Añadir
                  </button>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2 text-xs text-revelio-subtle dark:text-revelio-dark-subtle">
                    <span>Prob:</span>
                    {['baja', 'media', 'alta'].map(p => (
                      <button key={p} onClick={() => setRiskProb(p)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${riskProb === p ? 'bg-revelio-text text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-revelio-subtle dark:text-revelio-dark-subtle">
                    <span>Impacto:</span>
                    {['bajo', 'medio', 'alto'].map(i => (
                      <button key={i} onClick={() => setRiskImpact(i)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${riskImpact === i ? 'bg-revelio-text text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}>
                        {i}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mb-3">{risks.length} riesgo{risks.length !== 1 ? 's' : ''} · {rOpen.length} abiertos</p>
              <div className="space-y-2">
                {risks.map(r => {
                  const isOpen = r.status !== 'mitigated'
                  const isEsc = r.escalation?.level && r.escalation.level !== 'equipo'
                  return (
                    <div key={r.id} className={`rounded-card border bg-white dark:bg-revelio-dark-card p-4 group ${isEsc ? 'border-revelio-red/30 border-l-2 border-l-revelio-red' : isOpen ? 'border-revelio-border dark:border-revelio-dark-border' : 'border-revelio-border dark:border-revelio-dark-border opacity-60'}`}>
                      <div className="flex items-start gap-3">
                        <Shield className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isEsc ? 'text-revelio-red' : isOpen ? 'text-revelio-orange' : 'text-revelio-green'}`} />
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${isOpen ? 'text-revelio-text dark:text-revelio-dark-text' : 'text-revelio-subtle dark:text-revelio-dark-subtle line-through'}`}>{r.title || r.text}</p>
                          <div className="flex gap-3 mt-1 text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">
                            <span className="capitalize">{r.type || 'riesgo'}</span>
                            {r.prob && <span>Prob: {r.prob}</span>}
                            {r.impact && <span>Impacto: {r.impact}</span>}
                            {isEsc && <span className="text-revelio-red font-bold">Escalado: {r.escalation?.level}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => toggleRiskMitigated(r.id)}
                            className={`px-2 py-1 rounded text-[10px] font-medium ${isOpen ? 'bg-revelio-green/10 text-revelio-green' : 'bg-revelio-orange/10 text-revelio-orange'}`}>
                            {isOpen ? 'Mitigar' : 'Reabrir'}
                          </button>
                          <button onClick={() => deleteRisk(r.id)} className="text-revelio-subtle dark:text-revelio-dark-subtle hover:text-revelio-red">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {risks.length === 0 && <EmptyPhase message="Sin riesgos identificados. Usa el formulario de arriba." />}
            </div>
          )}

          {/* ═══ FASE 5: Accionables ═══ */}
          {phase === 4 && (
            <div>
              {/* Create action form */}
              <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4 mb-5">
                <div className="flex gap-2 mb-2">
                  <input value={actionText} onChange={e => setActionText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addAction()}
                    placeholder="Describe la acción..." className="flex-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-sm outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text transition-colors" />
                  <button onClick={addAction} disabled={!actionText.trim()}
                    className="px-4 py-2 rounded-lg bg-revelio-blue text-white text-sm font-medium disabled:opacity-30 hover:bg-revelio-blue/90 transition-colors flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Crear
                  </button>
                </div>
                <div className="flex gap-2">
                  <select value={actionOwner} onChange={e => setActionOwner(e.target.value)}
                    className="rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1.5 text-xs outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text">
                    <option value="">Responsable...</option>
                    {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                  <input type="date" value={actionDate} onChange={e => setActionDate(e.target.value)}
                    className="rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1.5 text-xs outline-none" />
                </div>
              </div>

              <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mb-3">{acts.length} accionable{acts.length !== 1 ? 's' : ''} · {actDone} completado{actDone !== 1 ? 's' : ''}</p>
              <div className="space-y-1.5">
                {acts.map(a => {
                  const isOverdue = a.status !== 'done' && a.date && a.date < today
                  const isDone = a.status === 'done' || a.status === 'archived'
                  return (
                    <div key={a.id} className={`rounded-card border bg-white dark:bg-revelio-dark-card p-3 flex items-center gap-3 group ${isOverdue ? 'border-revelio-red/30' : 'border-revelio-border dark:border-revelio-dark-border'}`}>
                      <button onClick={() => toggleActionStatus(a.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isDone ? 'bg-revelio-green border-revelio-green' : 'border-revelio-border dark:border-revelio-dark-border hover:border-revelio-blue'}`}>
                        {isDone && <CheckSquare className="w-3 h-3 text-white" />}
                      </button>
                      <span className={`text-sm flex-1 ${isDone ? 'line-through text-revelio-subtle dark:text-revelio-dark-subtle' : 'text-revelio-text dark:text-revelio-dark-text'}`}>{a.text}</span>
                      {a.owner && <span className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">{a.owner.split(' ')[0]}</span>}
                      {a.date && (
                        <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? 'text-revelio-red font-semibold' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}>
                          <Clock className="w-3 h-3" />{new Date(a.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                      <button onClick={() => deleteAction(a.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-revelio-subtle dark:text-revelio-dark-subtle hover:text-revelio-red">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
              {acts.length === 0 && <EmptyPhase message="Sin accionables. Crea tareas con el formulario de arriba." />}
            </div>
          )}

          {/* ═══ FASE 6: Resumen ═══ */}
          {phase === 5 && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { l: 'Notas', v: notes.length, icon: MessageSquare, c: 'text-revelio-blue', bg: 'bg-revelio-blue/10' },
                  { l: 'Accionables', v: acts.length, icon: ListChecks, c: 'text-revelio-violet', bg: 'bg-revelio-violet/10' },
                  { l: 'Riesgos', v: rOpen.length, icon: AlertTriangle, c: rOpen.length > 0 ? 'text-revelio-orange' : 'text-revelio-green', bg: rOpen.length > 0 ? 'bg-revelio-orange/10' : 'bg-revelio-green/10' },
                  { l: 'Participantes', v: [...new Set(notes.map(n => n.userName))].length, icon: Users, c: 'text-revelio-text dark:text-revelio-dark-text', bg: 'bg-revelio-bg dark:bg-revelio-dark-border' },
                ].map(s => (
                  <div key={s.l} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
                    <div className={`w-7 h-7 rounded-badge ${s.bg} flex items-center justify-center mb-2`}><s.icon className={`w-3.5 h-3.5 ${s.c}`} /></div>
                    <p className={`text-xl font-bold ${s.c}`}>{s.v}</p>
                    <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wide">{s.l}</p>
                  </div>
                ))}
              </div>

              {notes.length > 0 && (
                <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-5 mb-4">
                  <h3 className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text mb-3">Notas más votadas</h3>
                  {[...notes].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0)).slice(0, 5).map(n => (
                    <div key={n.id} className="flex items-center gap-2 py-1.5 border-b border-revelio-border dark:border-revelio-dark-border/50 last:border-0">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: CAT_COLORS[n.category] || '#86868B' }} />
                      <span className="text-xs flex-1 text-revelio-text dark:text-revelio-dark-text">{n.text}</span>
                      <span className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle flex items-center gap-0.5"><ThumbsUp className="w-3 h-3" /> {n.votes?.length || 0}</span>
                    </div>
                  ))}
                </div>
              )}

              {acts.filter(a => a.status !== 'done' && a.status !== 'archived').length > 0 && (
                <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-5">
                  <h3 className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text mb-3">Compromisos pendientes</h3>
                  {acts.filter(a => a.status !== 'done' && a.status !== 'archived').map(a => (
                    <div key={a.id} className="flex items-center gap-2 py-1.5 border-b border-revelio-border dark:border-revelio-dark-border/50 last:border-0">
                      <CheckSquare className="w-3.5 h-3.5 text-revelio-blue" />
                      <span className="text-xs flex-1 text-revelio-text dark:text-revelio-dark-text">{a.text}</span>
                      {a.owner && <span className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">{a.owner.split(' ')[0]}</span>}
                      {a.date && <span className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">{new Date(a.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>}
                    </div>
                  ))}
                </div>
              )}

              {notes.length === 0 && acts.length === 0 && <EmptyPhase message="Completa las fases anteriores." />}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

function EmptyPhase({ message }: { message: string }) {
  return (
    <div className="text-center py-16">
      <MessageSquare className="w-10 h-10 mx-auto mb-2 text-revelio-border" />
      <p className="text-sm text-revelio-subtle dark:text-revelio-dark-subtle">{message}</p>
    </div>
  )
}
