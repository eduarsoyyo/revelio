import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import {
  ArrowLeft, LayoutDashboard, ListChecks, AlertTriangle, Users,
  CheckSquare, Clock, TrendingUp, ChevronLeft,
  FolderOpen, Shield, BarChart3, ClipboardCheck, MessageSquare, MessageCircle,
  ThumbsUp, Plus, Send, Trash2, CornerUpLeft, PartyPopper, History, Calendar as CalendarIcon, Umbrella,
} from 'lucide-react'
import { useParams, Link } from 'react-router-dom'
import { DashboardPanel } from '@/components/project/DashboardPanel'
import { FinancePanel } from '@/components/project/FinancePanel'
import { FTEsPanel } from '@/components/project/FTEsPanel'
import { RisksPanel } from '@/components/project/RisksPanel'
import { TaskDetailModal } from '@/components/project/TaskDetailModal'
import { TimelineView } from '@/components/project/TimelineView'
import { VacationsPanel } from '@/components/project/VacationsPanel'
import { Celebration } from '@/components/retro/Celebration'
import { RiskHeatmap } from '@/components/retro/RiskHeatmap'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/data/supabase'
import { useRetroRealtime } from '@/hooks/useRetroRealtime'
import type { Room, Member } from '@/types'
import { RetroHistory } from '@/components/retro/RetroHistory'
import { soundCreate, soundDrop, soundComplete, soundSuccess, soundDelete, soundSlide } from '@/lib/sounds'

// ── Types ──
interface Action { id: string; text: string; status: string; owner: string; date: string; priority: string; createdAt: string; [k: string]: unknown }
interface Risk { id: string; text: string; title: string; status: string; prob: string; impact: string; type: string; owner: string; escalation?: { level?: string }; createdAt: string }
interface Note { id: string; text: string; category: string; userName: string; userId: string; votes: string[]; createdAt: string }
interface TaskItem { text: string; done: boolean }

type Tab = 'resumen' | 'seguimiento' | 'riesgos' | 'equipo' | 'finanzas'

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { id: 'seguimiento', label: 'Seguimiento', icon: ListChecks },
  { id: 'riesgos', label: 'Riesgos', icon: AlertTriangle },
  { id: 'equipo', label: 'Equipo', icon: Users },
  { id: 'finanzas', label: 'Finanzas', icon: TrendingUp },
]

const RETRO_PHASES = [
  { id: 'review', label: 'Revisión', num: '01', icon: ClipboardCheck, desc: 'Revisa objetivo y tareas.' },
  { id: 'individual', label: 'Individual', num: '02', icon: MessageSquare, desc: 'Escribe notas individuales.' },
  { id: 'discuss', label: 'Discusión', num: '03', icon: MessageCircle, desc: 'Vota y debate las notas.' },
  { id: 'risks', label: 'Riesgos', num: '04', icon: AlertTriangle, desc: 'Identifica riesgos y problemas.' },
  { id: 'actions', label: 'Items', num: '05', icon: ListChecks, desc: 'Crea tareas concretas.' },
  { id: 'summary', label: 'Resumen', num: '06', icon: BarChart3, desc: 'Revisa y finaliza.' },
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
const STATUS_LABEL: Record<string, string> = { todo: 'Pendiente', backlog: 'Backlog', doing: 'En curso', in_progress: 'En curso', inprogress: 'En curso', done: 'Hecho', blocked: 'Bloqueado' }
const STATUS_COLOR: Record<string, string> = { todo: 'bg-gray-200 text-gray-600', backlog: 'bg-gray-200 text-gray-600', doing: 'bg-revelio-blue/15 text-revelio-blue', in_progress: 'bg-revelio-blue/15 text-revelio-blue', done: 'bg-revelio-green/15 text-revelio-green', blocked: 'bg-revelio-red/15 text-revelio-red' }
const PRIO_COLOR: Record<string, string> = { critical: 'text-revelio-red', high: 'text-revelio-orange', medium: 'text-revelio-blue', low: 'text-revelio-subtle dark:text-revelio-dark-subtle' }
const PRIO_BG: Record<string, string> = { critical: 'bg-revelio-red/10', high: 'bg-revelio-orange/10', medium: 'bg-revelio-blue/10', low: 'bg-revelio-bg dark:bg-revelio-dark-border' }
const KANBAN_COLS = [
  { id: 'todo', label: 'Pendiente', color: '#8E8E93' },
  { id: 'doing', label: 'En curso', color: '#007AFF' },
  { id: 'blocked', label: 'Bloqueado', color: '#FF3B30' },
  { id: 'done', label: 'Hecho', color: '#34C759' },
]
const PRIO_LABEL: Record<string, string> = { critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja' }
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export function ProjectPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()
  const [room, setRoom] = useState<Room | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [risks, setRisks] = useState<Risk[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [objective, setObjective] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('resumen')
  const [inRetro, setInRetro] = useState(false)
  const [retroPhase, setRetroPhase] = useState(0)
  const [retroId, setRetroId] = useState<string | null>(null)

  // Retro form states
  const [noteText, setNoteText] = useState('')
  const [noteCat, setNoteCat] = useState('bien')
  const [actionText, setActionText] = useState('')
  const [actionOwner, setActionOwner] = useState('')
  const [actionDate, setActionDate] = useState('')
  const [riskText, setRiskText] = useState('')
  const [riskType, setRiskType] = useState('riesgo')
  const [riskProb, setRiskProb] = useState('media')
  const [riskImpact, setRiskImpact] = useState('medio')
  const [showCelebration, setShowCelebration] = useState(false)
  const [detailAction, setDetailAction] = useState<Action | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [equipoView, setEquipoView] = useState<'team' | 'ftes' | 'vac'>('team')
  const [seguiView, setSeguiView] = useState<'list' | 'board' | 'timeline' | 'epics'>('list')
  const [tlZoom, setTlZoom] = useState<'week' | 'month' | 'quarter' | 'year'>('month')
  const [tlOffset, setTlOffset] = useState(0)
  const [listGroup, setListGroup] = useState<'status' | 'horizon'>('status')

  // Timer
  const [timer, setTimer] = useState(300) // 5 min default
  const [timerRunning, setTimerRunning] = useState(false)
  const timerStartedAt = useRef<number | null>(null)
  const [ghostMode, setGhostMode] = useState(false)

  // Realtime
  const { online, broadcastState, broadcastPhase, broadcastTimer: bcTimer } = useRetroRealtime({
    userId: user?.id || '',
    userName: user?.name || '',
    userAvatar: user?.avatar || '👤',
    userColor: user?.color || '#007AFF',
    sala: slug || '',
    enabled: inRetro && !!user,
    ghost: ghostMode,
    onStateReceived: (key, data) => {
      if (key === 'notes') setNotes(data as Note[])
      else if (key === 'actions') setActions(data as Action[])
      else if (key === 'risks') setRisks(data as Risk[])
      else if (key === 'tasks') setTasks(data as TaskItem[])
      else if (key === 'obj') setObjective(((data as Record<string, string>)?.text) || '')
    },
    onPhaseReceived: (p) => setRetroPhase(p),
    onTimerReceived: (secs, running, startedAt) => {
      if (running && startedAt) {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000)
        setTimer(Math.max(0, secs - elapsed))
        setTimerRunning(true)
        timerStartedAt.current = startedAt
      } else {
        setTimer(secs)
        setTimerRunning(false)
      }
    },
  })

  // Timer countdown
  useEffect(() => {
    if (!timerRunning) return
    const iv = setInterval(() => {
      setTimer(prev => { if (prev <= 1) { setTimerRunning(false); return 0 } return prev - 1 })
    }, 1000)
    return () => clearInterval(iv)
  }, [timerRunning])

  // Timer helpers
  const startTimer = (secs?: number) => {
    const s = secs || timer || 300
    setTimer(s); setTimerRunning(true)
    timerStartedAt.current = Date.now()
    bcTimer(s, true, Date.now())
  }
  const pauseTimer = () => { setTimerRunning(false); bcTimer(timer, false, null) }
  const resetTimer = (secs = 300) => { setTimer(secs); setTimerRunning(false); bcTimer(secs, false, null) }
  const fmtTimer = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  void startTimer; void pauseTimer; void resetTimer; void fmtTimer // used in retro broadcast

  // Auto-save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef({ notes, actions, risks, tasks, obj: { text: objective } })
  useEffect(() => { stateRef.current = { notes, actions, risks, tasks, obj: { text: objective } } }, [notes, actions, risks, tasks, objective])

  const triggerSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (!retroId) return
      const s = stateRef.current
      if (s.notes.length === 0 && s.actions.length === 0 && s.risks.length === 0) return
      await supabase.from('retros').update({ data: s, updated_at: new Date().toISOString() }).eq('id', retroId)
    }, 3000)
  }, [retroId])

  useEffect(() => { if (retroId) triggerSave() }, [notes, actions, risks, tasks, objective, triggerSave, retroId])

  // Load
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

  const teamMembers = useMemo(() => members.filter(m => (m.rooms || []).includes(slug || '')), [members, slug])
  const today = new Date().toISOString().slice(0, 10)
  const acts = useMemo(() => actions.filter(a => a.status !== 'discarded' && a.status !== 'cancelled'), [actions])
  const workItems = useMemo(() => acts.filter(a => (a.type || 'tarea') !== 'epica'), [acts])
  const actDone = workItems.filter(a => a.status === 'done' || a.status === 'archived').length
  const rOpen = risks.filter(r => r.status !== 'mitigated')

  const notesByCategory = useMemo(() => {
    const g: Record<string, Note[]> = {}
    notes.forEach(n => { const c = n.category || 'bien'; if (!g[c]) g[c] = []; g[c].push(n) })
    return g
  }, [notes])

  // Retro handlers (with broadcast)
  const addNote = () => { if (!noteText.trim() || !user) return; const next = [...notes, { id: uid(), text: noteText.trim(), category: noteCat, userName: user.name, userId: user.id, votes: [], createdAt: new Date().toISOString() }]; setNotes(next); broadcastState('notes', next); setNoteText('') }
  const toggleVote = (nid: string) => { if (!user) return; const next = notes.map(n => n.id === nid ? { ...n, votes: n.votes.includes(user.id) ? n.votes.filter(v => v !== user.id) : [...n.votes, user.id] } : n); setNotes(next); broadcastState('notes', next) }
  const deleteNote = (nid: string) => { const next = notes.filter(n => n.id !== nid); setNotes(next); broadcastState('notes', next) }
  const addAction = () => { if (!actionText.trim()) return; const next = [...actions, { id: uid(), text: actionText.trim(), status: 'todo', owner: actionOwner, date: actionDate, priority: 'medium', createdAt: new Date().toISOString() }]; setActions(next); broadcastState('actions', next); setActionText(''); setActionOwner(''); setActionDate(''); soundCreate() }
  const toggleActionStatus = (id: string) => { const next = actions.map(a => a.id === id ? { ...a, status: a.status === 'done' ? 'todo' : 'done' } : a); setActions(next); broadcastState('actions', next); soundSuccess() }
  const deleteAction = (id: string) => { const next = actions.filter(a => a.id !== id); setActions(next); broadcastState('actions', next); soundDelete() }
  const addRisk = () => { if (!riskText.trim()) return; const next = [...risks, { id: uid(), text: riskText.trim(), title: riskText.trim(), status: 'open', prob: riskProb, impact: riskImpact, type: riskType, owner: '', createdAt: new Date().toISOString() }]; setRisks(next); broadcastState('risks', next); setRiskText('') }
  const toggleRiskMitigated = (id: string) => { const next = risks.map(r => r.id === id ? { ...r, status: r.status === 'mitigated' ? 'open' : 'mitigated' } : r); setRisks(next); broadcastState('risks', next) }
  const deleteRisk = (id: string) => { const next = risks.filter(r => r.id !== id); setRisks(next); broadcastState('risks', next) }
  const toggleTask = (i: number) => { const next = tasks.map((t, idx) => idx === i ? { ...t, done: !t.done } : t); setTasks(next); broadcastState('tasks', next) }
  const changeRetroPhase = (p: number) => { setRetroPhase(p); broadcastPhase(p) }

  if (loading) return <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center"><div className="animate-pulse text-sm text-revelio-subtle dark:text-revelio-dark-subtle">Cargando proyecto...</div></div>
  if (!room) return <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center flex-col gap-3"><FolderOpen className="w-10 h-10 text-revelio-border" /><p className="text-sm text-revelio-subtle dark:text-revelio-dark-subtle">Proyecto no encontrado</p><Link to="/" className="text-xs text-revelio-blue hover:underline">Volver</Link></div>

  const rp = RETRO_PHASES[retroPhase]!

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* ═══ PROJECT SIDEBAR ═══ */}
      <aside className="w-[180px] flex-shrink-0 border-r border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card flex flex-col">
        {/* Project name */}
        <div className="px-3 py-3 border-b border-revelio-border dark:border-revelio-dark-border">
          <div className="flex items-center gap-2 mb-1">
            <Link to="/proyectos" className="w-5 h-5 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border">
              <ArrowLeft className="w-2.5 h-2.5 text-revelio-subtle" />
            </Link>
            <h1 className="text-xs font-bold text-revelio-text dark:text-revelio-dark-text truncate">{room.name}</h1>
          </div>
          <p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle pl-7">{room.tipo} · {teamMembers.length}p</p>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-2 space-y-0.5">
          {!inRetro ? (
            <>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-colors text-left ${tab === t.id ? 'bg-revelio-blue/10 text-revelio-blue' : 'text-revelio-subtle dark:text-revelio-dark-subtle hover:bg-revelio-bg dark:hover:bg-revelio-dark-border'}`}>
                  <t.icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              ))}
              <div className="h-px bg-revelio-border/50 dark:bg-revelio-dark-border/50 my-1.5" />
              <button onClick={() => setInRetro(true)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-medium text-revelio-violet bg-revelio-violet/5 hover:bg-revelio-violet/10 transition-colors text-left">
                <BarChart3 className="w-3.5 h-3.5" /> Retro
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setInRetro(false)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-medium text-revelio-blue hover:bg-revelio-blue/5 transition-colors text-left">
                <CornerUpLeft className="w-3.5 h-3.5" /> Volver a proyecto
              </button>
              <div className="h-px bg-revelio-border/50 dark:bg-revelio-dark-border/50 my-1.5" />
              {RETRO_PHASES.map((p, i) => (
                <button key={i} onClick={() => changeRetroPhase(i)} disabled={!user?.is_superuser && i !== retroPhase}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-colors text-left ${retroPhase === i ? 'bg-revelio-violet/10 text-revelio-violet' : i < retroPhase ? 'text-revelio-green' : 'text-revelio-subtle dark:text-revelio-dark-subtle'} ${!user?.is_superuser && i !== retroPhase ? 'opacity-40' : 'hover:bg-revelio-bg dark:hover:bg-revelio-dark-border'}`}>
                  <p.icon className="w-3.5 h-3.5" /> <span>{p.num} {p.label}</span>
                </button>
              ))}
              {/* Online users */}
              <div className="mt-3 px-1">
                <p className="text-[8px] text-revelio-subtle uppercase mb-1">Online</p>
                <div className="flex flex-wrap gap-1">
                  {online.map(u => (
                    <div key={u.id} className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] border-2 border-white" style={{ background: u.color }} title={u.name}>{u.avatar}</div>
                  ))}
                </div>
              </div>
              {/* Ghost mode */}
              {user?.is_superuser && (
                <button onClick={() => setGhostMode(!ghostMode)} className={`w-full mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] ${ghostMode ? 'text-revelio-subtle opacity-50' : 'text-revelio-blue'}`}>
                  {ghostMode ? '👻 Fantasma' : '👁️ Visible'}
                </button>
              )}
            </>
          )}
        </nav>
      </aside>

      {/* ═══ CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto p-5">

      {/* Phase guide bar (only in retro) */}
      {inRetro && !showHistory && (
        <div className="shrink-0 bg-revelio-blue/5 border-b border-revelio-blue/10 px-5 py-1.5 flex items-center gap-2">
          <span className="text-[10px] font-bold text-revelio-blue">{rp.num}</span>
          <span className="text-xs font-semibold text-revelio-text dark:text-revelio-dark-text">{rp.label}</span>
          <span className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">— {rp.desc}</span>
          <button onClick={() => setShowHistory(true)} className="ml-auto text-[10px] text-revelio-violet hover:underline flex items-center gap-0.5">
            <History className="w-3 h-3" /> Historial
          </button>
        </div>
      )}
      {inRetro && showHistory && (
        <div className="shrink-0 bg-revelio-violet/5 border-b border-revelio-violet/10 px-5 py-1.5 flex items-center gap-2">
          <button onClick={() => setShowHistory(false)} className="text-[10px] text-revelio-blue hover:underline flex items-center gap-0.5">
            <ChevronLeft className="w-3 h-3" /> Volver a la retro
          </button>
          <span className="text-xs font-semibold text-revelio-violet">Historial</span>
        </div>
      )}

      {/* ═══ CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="w-full max-w-[1600px] mx-auto px-4">

        {/* ═══ PROJECT TABS ═══ */}
        {!inRetro && <>

          {/* RESUMEN */}
          {tab === 'resumen' && (
            <DashboardPanel
              actions={actions}
              risks={risks}
              team={teamMembers}
              today={today}
              onTabChange={t => setTab(t as Tab)}
            />
          )}

          {/* SEGUIMIENTO */}
          {tab === 'seguimiento' && (
            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">{workItems.length} items · {actDone} completados</p>
                <div className="flex items-center gap-2">
                  <div className="flex bg-revelio-bg dark:bg-revelio-dark-border rounded-lg overflow-hidden">
                    <button onClick={() => setSeguiView('list')} className={`px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1 ${seguiView === 'list' ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}><ListChecks className="w-3 h-3" /> Lista</button>
                    <button onClick={() => setSeguiView('board')} className={`px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1 ${seguiView === 'board' ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}><LayoutDashboard className="w-3 h-3" /> Board</button>
                    <button onClick={() => setSeguiView('timeline')} className={`px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1 ${seguiView === 'timeline' ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}><TrendingUp className="w-3 h-3" /> Timeline</button>
                    <button onClick={() => setSeguiView('epics')} className={`px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1 ${seguiView === 'epics' ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}><FolderOpen className="w-3 h-3" /> Épicas</button>
                  </div>
                  <button onClick={() => {
                    const newItem: Action = { id: uid(), text: '', status: 'backlog', owner: '', date: '', priority: 'medium', createdAt: new Date().toISOString(), type: 'tarea' }
                    setDetailAction(newItem)
                  }} className="px-3 py-1.5 rounded-lg bg-revelio-blue text-white text-[10px] font-semibold flex items-center gap-1 hover:bg-revelio-blue/90 transition-colors">
                    <Plus className="w-3 h-3" /> Nuevo item
                  </button>
                </div>
              </div>

              {/* LIST VIEW */}
              {seguiView === 'list' && (
                <div>
                  {/* Group by toggle */}
                  <div className="flex gap-1 mb-3">
                    <span className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle self-center mr-1">Agrupar:</span>
                    <button onClick={() => setListGroup('status')} className={`px-2 py-0.5 rounded text-[8px] font-semibold ${listGroup === 'status' ? 'bg-revelio-blue text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}>Estado</button>
                    <button onClick={() => setListGroup('horizon')} className={`px-2 py-0.5 rounded text-[8px] font-semibold ${listGroup === 'horizon' ? 'bg-revelio-blue text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}>Horizonte</button>
                  </div>

                  {listGroup === 'status' && ['doing', 'todo', 'backlog', 'blocked', 'done'].map(status => {
                    const items = workItems.filter(a => { if (status === 'doing') return a.status === 'doing' || a.status === 'in_progress' || a.status === 'inprogress'; if (status === 'todo') return a.status === 'todo' || a.status === 'pending'; return a.status === status })
                    if (items.length === 0) return null
                    return (
                      <div key={status} className="mb-5">
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-revelio-subtle dark:text-revelio-dark-subtle mb-1.5 flex items-center gap-1.5"><span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${STATUS_COLOR[status] || 'bg-gray-100 text-gray-500'}`}>{STATUS_LABEL[status] || status}</span><span className="text-revelio-border">{items.length}</span></h4>
                        <div className="space-y-1">
                          {items.map(a => { const isOv = a.status !== 'done' && a.date && a.date < today; return (
                            <div key={a.id} onClick={() => setDetailAction(a)} className={`rounded-lg border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2 flex items-center gap-2.5 cursor-pointer hover:border-revelio-blue/30 transition-colors ${isOv ? 'border-revelio-red/30' : 'border-revelio-border'}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${a.status === 'done' ? 'bg-revelio-green' : a.status === 'blocked' ? 'bg-revelio-red' : 'bg-revelio-blue'}`} />
                              <span className={`text-xs flex-1 ${a.status === 'done' ? 'line-through text-revelio-subtle dark:text-revelio-dark-subtle' : 'text-revelio-text dark:text-revelio-dark-text'}`}>{a.text}</span>
                              {a.priority && <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${PRIO_BG[a.priority] || ''} ${PRIO_COLOR[a.priority] || ''}`}>{PRIO_LABEL[a.priority]}</span>}
                              {a.owner && <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{a.owner.split(' ')[0]}</span>}
                              {a.date && <span className={`text-[9px] ${isOv ? 'text-revelio-red font-semibold' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}>{new Date(a.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>}
                            </div>
                          ) })}
                        </div>
                      </div>
                    )
                  })}

                  {listGroup === 'horizon' && (() => {
                    const pending = workItems.filter(a => a.status !== 'done' && a.status !== 'archived')
                    const endOfToday = today
                    const endOfWeek = (() => { const d = new Date(); d.setDate(d.getDate() + (7 - d.getDay())); return d.toISOString().slice(0, 10) })()
                    const endOfMonth = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10) })()

                    const groups = [
                      { label: 'Vencido', color: '#FF3B30', items: pending.filter(a => a.date && a.date < endOfToday) },
                      { label: 'Hoy', color: '#FF9500', items: pending.filter(a => a.date === endOfToday) },
                      { label: 'Esta semana', color: '#007AFF', items: pending.filter(a => a.date && a.date > endOfToday && a.date <= endOfWeek) },
                      { label: 'Este mes', color: '#5856D6', items: pending.filter(a => a.date && a.date > endOfWeek && a.date <= endOfMonth) },
                      { label: 'Después', color: '#8E8E93', items: pending.filter(a => a.date && a.date > endOfMonth) },
                      { label: 'Sin fecha', color: '#C7C7CC', items: pending.filter(a => !a.date) },
                    ]

                    return groups.map(g => {
                      if (g.items.length === 0) return null
                      return (
                        <div key={g.label} className="mb-5">
                          <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold text-white" style={{ background: g.color }}>{g.label}</span>
                            <span className="text-revelio-border dark:text-revelio-dark-border">{g.items.length}</span>
                          </h4>
                          <div className="space-y-1">
                            {g.items.map(a => (
                              <div key={a.id} onClick={() => setDetailAction(a)} className={`rounded-lg border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2 flex items-center gap-2.5 cursor-pointer hover:border-revelio-blue/30 transition-colors ${g.label === 'Vencido' ? 'border-revelio-red/30' : 'border-revelio-border'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${a.status === 'blocked' ? 'bg-revelio-red' : a.status === 'doing' || a.status === 'inprogress' ? 'bg-revelio-blue' : 'bg-revelio-subtle'}`} />
                                <span className="text-xs flex-1 text-revelio-text dark:text-revelio-dark-text">{a.text}</span>
                                <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${STATUS_COLOR[a.status] || 'bg-gray-100 text-gray-500'}`}>{STATUS_LABEL[a.status] || a.status}</span>
                                {a.owner && <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{a.owner.split(' ')[0]}</span>}
                                {a.date && <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{new Date(a.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })
                  })()}

                  {workItems.length === 0 && <Empty message="Sin items." />}
                </div>
              )}

              {/* KANBAN BOARD */}
              {seguiView === 'board' && (
                <div>
                  {/* Kanban columns */}
                  <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 300 }}>
                  {KANBAN_COLS.map(col => {
                    const items = workItems.filter(a => {
                      if (col.id === 'doing') return a.status === 'doing' || a.status === 'in_progress' || a.status === 'inprogress'
                      if (col.id === 'todo') return a.status === 'todo' || a.status === 'pending'
                      return a.status === col.id
                    })
                    return (
                      <div key={col.id} className="flex-shrink-0 w-60 flex flex-col"
                        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-revelio-blue/30') }}
                        onDragLeave={e => { e.currentTarget.classList.remove('ring-2', 'ring-revelio-blue/30') }}
                        onDrop={e => {
                          e.currentTarget.classList.remove('ring-2', 'ring-revelio-blue/30')
                          const id = e.dataTransfer.getData('text/plain')
                          if (!id) return
                          const newStatus = col.id === 'doing' ? 'doing' : col.id === 'todo' ? 'todo' : col.id
                          const next = actions.map(a => a.id === id ? { ...a, status: newStatus, updatedAt: new Date().toISOString() } : a)
                          setActions(next)
                          broadcastState('actions', next)
                          soundDrop()
                        }}>
                        <div className="flex items-center gap-1.5 mb-2 px-1">
                          <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                          <span className="text-[10px] font-bold uppercase tracking-wider dark:text-revelio-dark-text">{col.label}</span>
                          <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle ml-auto bg-revelio-bg dark:bg-revelio-dark-border px-1.5 py-0.5 rounded-full">{items.length}</span>
                        </div>
                        <div className="flex-1 bg-revelio-bg/50 dark:bg-revelio-dark-border/30 rounded-xl p-1.5 space-y-1.5 min-h-[80px] transition-all">
                          {items.map(a => {
                            const isOv = a.status !== 'done' && a.date && a.date < today
                            return (
                              <div key={a.id} draggable
                                onDragStart={e => { e.dataTransfer.setData('text/plain', a.id); e.dataTransfer.effectAllowed = 'move'; soundSlide() }}
                                onClick={() => setDetailAction(a)}
                                className={`rounded-lg border bg-white dark:bg-revelio-dark-card p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-revelio-blue/30 transition-all ${isOv ? 'border-revelio-red/30' : 'border-revelio-border dark:border-revelio-dark-border'}`}>
                                <p className={`text-[11px] font-medium leading-snug mb-1.5 ${a.status === 'done' ? 'line-through text-revelio-subtle dark:text-revelio-dark-subtle' : 'dark:text-revelio-dark-text'}`}>{a.text}</p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {a.priority && <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${PRIO_BG[a.priority] || ''} ${PRIO_COLOR[a.priority] || ''}`}>{PRIO_LABEL[a.priority]}</span>}
                                  {a.owner && <span className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle bg-revelio-bg dark:bg-revelio-dark-border px-1 py-0.5 rounded">{a.owner.split(' ')[0]}</span>}
                                  {a.date && <span className={`text-[8px] ${isOv ? 'text-revelio-red font-bold' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}>{new Date(a.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>}
                                  {a.epicLink ? <span className="text-[8px] text-revelio-violet font-semibold">{String(a.epicLink)}</span> : null}
                                </div>
                              </div>
                            )
                          })}
                          {items.length === 0 && <p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle text-center py-4">—</p>}
                        </div>
                      </div>
                    )
                  })}
                  </div>

                  {/* Backlog — separate section below board */}
                  {(() => {
                    const blItems = workItems.filter(a => a.status === 'backlog')
                    if (blItems.length === 0) return null
                    return (
                      <div className="mt-4 rounded-card border border-dashed border-revelio-border dark:border-revelio-dark-border bg-revelio-bg/30 dark:bg-revelio-dark-border/20 p-4"
                        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-revelio-blue/30') }}
                        onDragLeave={e => { e.currentTarget.classList.remove('ring-2', 'ring-revelio-blue/30') }}
                        onDrop={e => { e.currentTarget.classList.remove('ring-2', 'ring-revelio-blue/30'); const id = e.dataTransfer.getData('text/plain'); if (!id) return; const next = actions.map(a => a.id === id ? { ...a, status: 'backlog', updatedAt: new Date().toISOString() } : a); setActions(next); broadcastState('actions', next) }}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-2 h-2 rounded-full bg-[#86868B]" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-revelio-subtle dark:text-revelio-dark-subtle">Backlog</span>
                          <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle ml-1 bg-revelio-bg dark:bg-revelio-dark-border px-1.5 py-0.5 rounded-full">{blItems.length}</span>
                        </div>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                          {blItems.map(a => (
                            <div key={a.id} draggable onDragStart={e => { e.dataTransfer.setData('text/plain', a.id); e.dataTransfer.effectAllowed = 'move'; soundSlide() }}
                              onClick={() => setDetailAction(a)}
                              className="rounded-lg border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2 cursor-grab active:cursor-grabbing hover:shadow-sm hover:border-revelio-blue/30 transition-all flex items-center gap-2">
                              <span className="text-[11px] flex-1 dark:text-revelio-dark-text">{a.text}</span>
                              {a.priority && <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${PRIO_BG[a.priority] || ''} ${PRIO_COLOR[a.priority] || ''}`}>{PRIO_LABEL[a.priority]}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
              {seguiView === 'timeline' && (
                <TimelineView
                  workItems={workItems}
                  allActions={actions}
                  team={teamMembers.map(m => ({ id: m.id, name: m.name, avatar: m.avatar, color: m.color, vacations: (m.vacations || []) as unknown as Array<{ from: string; to?: string; type?: string; label?: string }> }))}
                  risks={risks}
                  today={today}
                  zoom={tlZoom}
                  offset={tlOffset}
                  onZoomChange={z => { setTlZoom(z); setTlOffset(0) }}
                  onOffsetChange={setTlOffset}
                  onItemClick={a => setDetailAction(a as unknown as Action)}
                  onItemUpdate={updated => {
                    const next = actions.map(a => a.id === updated.id ? { ...a, ...updated } : a)
                    setActions(next)
                    broadcastState('actions', next)
                  }}
                />
              )}

              {seguiView === 'epics' && (() => {
                const epicItems = acts.filter(a => (a.type || '') === 'epica')
                const epicGroups = epicItems.map(epic => {
                  const children = acts.filter(a => String(a.epicLink || '') === epic.id)
                  const done = children.filter(a => a.status === 'done' || a.status === 'archived').length
                  const totalSP = children.reduce((s, a) => s + (Number(a.storyPoints) || 0), 0)
                  const doneSP = children.filter(a => a.status === 'done' || a.status === 'archived').reduce((s, a) => s + (Number(a.storyPoints) || 0), 0)
                  const totalH = children.reduce((s, a) => s + (Number(a.hours) || 0), 0)
                  const pct = children.length > 0 ? Math.round(done / children.length * 100) : 0
                  const epicStatus = epic.status === 'done' ? 'done' : pct === 100 && children.length > 0 ? 'done' : pct > 0 ? 'doing' : 'todo'
                  return { ...epic, children, done, total: children.length, totalSP, doneSP, totalH, pct, epicStatus }
                })
                const noEpic = acts.filter(a => (a.type || '') !== 'epica' && !a.epicLink)

                const dropOnEpic = (epicId: string, itemId: string) => {
                  const next = actions.map(a => a.id === itemId ? { ...a, epicLink: epicId } : a)
                  setActions(next)
                  broadcastState('actions', next)
                }
                const dropOffEpic = (itemId: string) => {
                  const next = actions.map(a => a.id === itemId ? { ...a, epicLink: undefined } : a)
                  setActions(next)
                  broadcastState('actions', next)
                }

                return (
                  <div className="space-y-3">
                    {epicGroups.length === 0 && (
                      <div className="text-center py-8">
                        <FolderOpen className="w-8 h-8 text-revelio-border dark:text-revelio-dark-border mx-auto mb-2" />
                        <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">Sin épicas definidas</p>
                        <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle mt-1">Pulsa "Nuevo item" y selecciona tipo Épica</p>
                      </div>
                    )}

                    {epicGroups.map(epic => (
                      <div key={epic.id} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card overflow-hidden"
                        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-[#AF52DE]/40') }}
                        onDragLeave={e => e.currentTarget.classList.remove('ring-2', 'ring-[#AF52DE]/40')}
                        onDrop={e => { e.currentTarget.classList.remove('ring-2', 'ring-[#AF52DE]/40'); const id = e.dataTransfer.getData('text/plain'); if (id && id !== epic.id) dropOnEpic(epic.id, id); soundDrop() }}>
                        <div className="px-4 py-3 border-b border-revelio-border/50 dark:border-revelio-dark-border/50 cursor-pointer hover:bg-revelio-bg/30 dark:hover:bg-revelio-dark-border/30" onClick={() => setDetailAction(epic)}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[#AF52DE]/10 flex items-center justify-center flex-shrink-0">
                              <FolderOpen className="w-4 h-4 text-[#AF52DE]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold text-[#AF52DE]">{epic.text || 'Sin título'}</h4>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${epic.epicStatus === 'done' ? 'bg-revelio-green/10 text-revelio-green' : epic.epicStatus === 'doing' ? 'bg-revelio-blue/10 text-revelio-blue' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}>{epic.epicStatus === 'done' ? 'Completada' : epic.epicStatus === 'doing' ? 'En progreso' : 'Pendiente'}</span>
                                <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{epic.done}/{epic.total} items</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <div className="flex-1 h-1.5 bg-revelio-bg dark:bg-revelio-dark-border rounded-full overflow-hidden max-w-[200px]">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${epic.pct}%`, background: epic.pct === 100 ? '#34C759' : epic.pct > 50 ? '#007AFF' : '#FF9500' }} />
                                </div>
                                <span className="text-[10px] font-bold" style={{ color: epic.pct === 100 ? '#34C759' : epic.pct > 50 ? '#007AFF' : '#FF9500' }}>{epic.pct}%</span>
                                {epic.totalSP > 0 && <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{epic.doneSP}/{epic.totalSP} SP</span>}
                                {epic.totalH > 0 && <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{epic.totalH}h</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                        {epic.children.length > 0 && (
                          <div className="divide-y divide-revelio-border/30 dark:divide-revelio-dark-border/30">
                            {epic.children.map(a => {
                              const isDone = a.status === 'done' || a.status === 'archived'
                              const typeInfo = [{ id: 'historia', l: 'HU', c: '#5856D6' }, { id: 'tarea', l: 'T', c: '#007AFF' }, { id: 'bug', l: 'B', c: '#FF3B30' }, { id: 'mejora', l: 'M', c: '#34C759' }].find(t => t.id === (a.type || 'tarea'))
                              return (
                                <div key={a.id} draggable onDragStart={e => { e.dataTransfer.setData('text/plain', a.id); e.dataTransfer.effectAllowed = 'move'; soundSlide() }}
                                  onClick={() => setDetailAction(a)} className="px-4 py-2 flex items-center gap-2.5 hover:bg-revelio-bg/50 dark:hover:bg-revelio-dark-border/30 cursor-grab active:cursor-grabbing transition-colors">
                                  {typeInfo && <span className="text-[8px] font-bold w-5 h-5 rounded flex items-center justify-center text-white flex-shrink-0" style={{ background: typeInfo.c }}>{typeInfo.l}</span>}
                                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDone ? 'bg-revelio-green' : a.status === 'blocked' ? 'bg-revelio-red' : 'bg-revelio-blue'}`} />
                                  <span className={`text-xs flex-1 ${isDone ? 'line-through text-revelio-subtle dark:text-revelio-dark-subtle' : 'dark:text-revelio-dark-text'}`}>{a.text}</span>
                                  {a.priority && <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${PRIO_BG[a.priority] || ''} ${PRIO_COLOR[a.priority] || ''}`}>{PRIO_LABEL[a.priority]}</span>}
                                  {a.owner && <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{a.owner.split(' ')[0]}</span>}
                                  {a.storyPoints ? <span className="text-[8px] font-bold text-revelio-violet bg-revelio-violet/10 px-1 py-0.5 rounded">{String(a.storyPoints)} SP</span> : null}
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {epic.children.length === 0 && <div className="px-4 py-3 text-center text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">Arrastra items aquí para asignarlos</div>}
                      </div>
                    ))}

                    {noEpic.length > 0 && (
                      <div className="rounded-card border border-dashed border-revelio-border dark:border-revelio-dark-border bg-revelio-bg/30 dark:bg-revelio-dark-border/20 p-4"
                        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-revelio-blue/30') }}
                        onDragLeave={e => e.currentTarget.classList.remove('ring-2', 'ring-revelio-blue/30')}
                        onDrop={e => { e.currentTarget.classList.remove('ring-2', 'ring-revelio-blue/30'); const id = e.dataTransfer.getData('text/plain'); if (id) dropOffEpic(id); soundDrop() }}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-revelio-subtle dark:text-revelio-dark-subtle">Sin épica</span>
                          <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle bg-revelio-bg dark:bg-revelio-dark-border px-1.5 py-0.5 rounded-full">{noEpic.length}</span>
                        </div>
                        <div className="space-y-1">
                          {noEpic.map(a => (
                            <div key={a.id} draggable onDragStart={e => { e.dataTransfer.setData('text/plain', a.id); e.dataTransfer.effectAllowed = 'move'; soundSlide() }}
                              onClick={() => setDetailAction(a)} className="flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-grab active:cursor-grabbing hover:bg-white dark:hover:bg-revelio-dark-card transition-colors">
                              <div className={`w-1.5 h-1.5 rounded-full ${a.status === 'done' ? 'bg-revelio-green' : 'bg-revelio-subtle'}`} />
                              <span className={`text-[11px] flex-1 ${a.status === 'done' ? 'line-through text-revelio-subtle dark:text-revelio-dark-subtle' : 'dark:text-revelio-dark-text'}`}>{a.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {/* RIESGOS */}
          {tab === 'riesgos' && (
            <RisksPanel
              risks={risks as Array<{ id: string; title: string; text?: string; description?: string; type: 'riesgo' | 'problema' | 'oportunidad'; status: string; prob?: string; impact?: string; owner?: string; createdAt: string; escalation?: { level?: string; by?: string; date?: string; reason?: string }; [k: string]: unknown }>}
              onUpdate={next => { setRisks(next as typeof risks); broadcastState('risks', next) }}
              currentUser={user?.name || ''}
              items={workItems.map(a => ({ id: a.id, text: a.text }))}
            />
          )}

          {/* EQUIPO */}
          {tab === 'equipo' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">{teamMembers.length} persona{teamMembers.length !== 1 ? 's' : ''}</p>
                <div className="flex bg-revelio-bg dark:bg-revelio-dark-border rounded-lg overflow-hidden">
                  <button onClick={() => setEquipoView('team')} className={`px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1 ${equipoView === 'team' ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}><Users className="w-3 h-3" /> Equipo</button>
                  <button onClick={() => setEquipoView('ftes')} className={`px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1 ${equipoView === 'ftes' ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}><CalendarIcon className="w-3 h-3" /> FTEs</button>
                  <button onClick={() => setEquipoView('vac')} className={`px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1 ${equipoView === 'vac' ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}><Umbrella className="w-3 h-3" /> Vac</button>
                </div>
              </div>

              {equipoView === 'team' && (
                <>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {teamMembers.map(m => {
                      const myActs = acts.filter(a => a.owner === m.name); const myDone = myActs.filter(a => a.status === 'done' || a.status === 'archived').length
                      const isOnVac = (m.vacations || []).some((v: unknown) => { const vr = v as { from?: string; to?: string }; return vr.from && vr.from <= today && (!vr.to || vr.to >= today) })
                      return (
                        <div key={m.id} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2.5 flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: m.color || '#007AFF' }}>{m.avatar || '👤'}</div>
                          <div className="flex-1 min-w-0"><p className="text-xs font-medium text-revelio-text dark:text-revelio-dark-text truncate">{m.name}</p><p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{m.role_label || '—'}</p></div>
                          {isOnVac ? <span className="text-[9px] font-semibold text-revelio-orange bg-revelio-orange/10 px-1.5 py-0.5 rounded">Vac</span> : myActs.length > 0 ? <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{myDone}/{myActs.length}</span> : null}
                        </div>
                      )
                    })}
                  </div>
                  {teamMembers.length === 0 && <Empty message="Nadie asignado." />}
                </>
              )}

              {equipoView === 'ftes' && <FTEsPanel team={teamMembers} sala={slug || ''} />}
              {equipoView === 'vac' && <VacationsPanel team={teamMembers} />}
            </div>
          )}

          {/* FINANZAS */}
          {tab === 'finanzas' && (
            <FinancePanel
              team={teamMembers}
              sala={slug || ''}
              roomData={room ? { billing_type: (room as unknown as Record<string, unknown>).billing_type as string || 'fixed', budget: Number((room as unknown as Record<string, unknown>).budget) || 0, sell_rate: Number((room as unknown as Record<string, unknown>).sell_rate) || 0, fixed_price: Number((room as unknown as Record<string, unknown>).fixed_price) || 0, planned_hours: Number((room as unknown as Record<string, unknown>).planned_hours) || 0, services: ((room as unknown as Record<string, unknown>).services as Array<{ id: string; name: string; from: string; to: string; cost: number; margin_pct: number; risk_pct: number }>) || [] } : undefined}
            />
          )}
        </>}

        {/* ═══ RETRO HISTORY ═══ */}
        {inRetro && showHistory && <RetroHistory sala={slug || ''} />}

        {/* ═══ RETRO PHASES ═══ */}
        {inRetro && !showHistory && <>

          {/* P1: Review */}
          {retroPhase === 0 && (
            <div>
              <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4 mb-3">
                <h3 className="text-xs font-semibold text-revelio-text dark:text-revelio-dark-text mb-1.5 flex items-center gap-1"><ClipboardCheck className="w-3.5 h-3.5 text-revelio-blue" /> Objetivo</h3>
                <input value={objective} onChange={e => setObjective(e.target.value)} placeholder="Objetivo del periodo..." className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-sm outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text" />
              </div>
              {tasks.length > 0 && (
                <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
                  <h3 className="text-xs font-semibold text-revelio-text dark:text-revelio-dark-text mb-2">Tareas ({tasks.filter(t => t.done).length}/{tasks.length})</h3>
                  {tasks.map((t, i) => (<button key={i} onClick={() => toggleTask(i)} className="flex items-center gap-2 py-1 w-full text-left"><CheckSquare className={`w-3.5 h-3.5 ${t.done ? 'text-revelio-green' : 'text-revelio-border'}`} /><span className={`text-xs ${t.done ? 'line-through text-revelio-subtle dark:text-revelio-dark-subtle' : 'text-revelio-text dark:text-revelio-dark-text'}`}>{t.text}</span></button>))}
                </div>
              )}
            </div>
          )}

          {/* P2: Individual */}
          {retroPhase === 1 && (
            <div>
              <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3.5 mb-4">
                <div className="flex gap-1.5 mb-2">{NOTE_CATS.map(c => (<button key={c.id} onClick={() => setNoteCat(c.id)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium ${noteCat === c.id ? 'text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`} style={noteCat === c.id ? { background: c.color } : undefined}>{c.label}</button>))}</div>
                <div className="flex gap-2"><input value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} placeholder="Escribe una nota..." className="flex-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-1.5 text-xs outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /><button onClick={addNote} disabled={!noteText.trim()} className="px-3 py-1.5 rounded-lg bg-revelio-blue text-white text-xs font-medium disabled:opacity-30 flex items-center gap-1"><Send className="w-3 h-3" /> Añadir</button></div>
              </div>
              {Object.entries(notesByCategory).map(([cat, cn]) => (
                <div key={cat} className="mb-4">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: CAT_COLORS[cat] || '#86868B' }}><div className="w-2 h-2 rounded-full" style={{ background: CAT_COLORS[cat] }} /> {cat} ({cn.length})</h4>
                  {cn.map(n => (<div key={n.id} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2 flex items-center gap-2 group mb-1"><div className="w-1 h-5 rounded-full" style={{ background: CAT_COLORS[n.category] }} /><span className="text-xs flex-1">{n.text}</span><span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{n.userName?.split(' ')[0]}</span>{user && n.userId === user.id && <button onClick={() => deleteNote(n.id)} className="opacity-0 group-hover:opacity-100 text-revelio-subtle dark:text-revelio-dark-subtle hover:text-revelio-red"><Trash2 className="w-3 h-3" /></button>}</div>))}
                </div>
              ))}
              {notes.length === 0 && <Empty message="Escribe notas con el formulario de arriba." />}
            </div>
          )}

          {/* P3: Discussion */}
          {retroPhase === 2 && (
            <div>
              <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle mb-3">Pulsa para votar</p>
              {[...notes].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0)).map(n => { const voted = user ? n.votes?.includes(user.id) : false; return (
                <div key={n.id} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2 mb-1 flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full" style={{ background: CAT_COLORS[n.category] || '#86868B' }} />
                  <span className="text-xs flex-1">{n.text}</span>
                  <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{n.userName?.split(' ')[0]}</span>
                  <button onClick={() => toggleVote(n.id)} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${voted ? 'bg-revelio-blue/15 text-revelio-blue' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}><ThumbsUp className="w-2.5 h-2.5" /> {n.votes?.length || 0}</button>
                </div>
              ) })}
              {notes.length === 0 && <Empty message="Sin notas. Vuelve a fase 2." />}
            </div>
          )}

          {/* P4: Risks */}
          {retroPhase === 3 && (
            <div>
              <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3.5 mb-4">
                <div className="flex gap-1.5 mb-2">{RISK_TYPES.map(t => (<button key={t.id} onClick={() => setRiskType(t.id)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium ${riskType === t.id ? 'text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`} style={riskType === t.id ? { background: t.color } : undefined}>{t.label}</button>))}</div>
                <div className="flex gap-2 mb-2"><input value={riskText} onChange={e => setRiskText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRisk()} placeholder="Describe el riesgo..." className="flex-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-1.5 text-xs outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /><button onClick={addRisk} disabled={!riskText.trim()} className="px-3 py-1.5 rounded-lg bg-revelio-orange text-white text-xs font-medium disabled:opacity-30 flex items-center gap-1"><Plus className="w-3 h-3" /> Añadir</button></div>
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5 text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle"><span>Prob:</span>{['baja', 'media', 'alta'].map(p => (<button key={p} onClick={() => setRiskProb(p)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${riskProb === p ? 'bg-revelio-text text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border'}`}>{p}</button>))}</div>
                  <div className="flex items-center gap-1.5 text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle"><span>Impacto:</span>{['bajo', 'medio', 'alto'].map(i => (<button key={i} onClick={() => setRiskImpact(i)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${riskImpact === i ? 'bg-revelio-text text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border'}`}>{i}</button>))}</div>
                </div>
              </div>
              {risks.length > 0 && <div className="mb-3"><RiskHeatmap risks={risks} /></div>}
              {risks.map(r => { const isOp = r.status !== 'mitigated'; return (
                <div key={r.id} className={`rounded-lg border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2.5 group mb-1.5 ${isOp ? 'border-revelio-border' : 'border-revelio-border opacity-60'}`}>
                  <div className="flex items-start gap-2"><Shield className={`w-3.5 h-3.5 mt-0.5 ${isOp ? 'text-revelio-orange' : 'text-revelio-green'}`} /><div className="flex-1"><p className={`text-xs font-medium ${isOp ? '' : 'line-through text-revelio-subtle dark:text-revelio-dark-subtle'}`}>{r.title || r.text}</p><div className="flex gap-2 mt-0.5 text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle"><span className="capitalize">{r.type}</span><span>P:{r.prob}</span><span>I:{r.impact}</span></div></div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100"><button onClick={() => toggleRiskMitigated(r.id)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${isOp ? 'bg-revelio-green/10 text-revelio-green' : 'bg-revelio-orange/10 text-revelio-orange'}`}>{isOp ? 'Mitigar' : 'Reabrir'}</button><button onClick={() => deleteRisk(r.id)} className="text-revelio-subtle dark:text-revelio-dark-subtle hover:text-revelio-red"><Trash2 className="w-3 h-3" /></button></div>
                  </div>
                </div>
              ) })}
              {risks.length === 0 && <Empty message="Sin riesgos. Usa el formulario." />}
            </div>
          )}

          {/* P5: Actions */}
          {retroPhase === 4 && (
            <div>
              <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3.5 mb-4">
                <div className="flex gap-2 mb-2"><input value={actionText} onChange={e => setActionText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAction()} placeholder="Describe la acción..." className="flex-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-1.5 text-xs outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /><button onClick={addAction} disabled={!actionText.trim()} className="px-3 py-1.5 rounded-lg bg-revelio-blue text-white text-xs font-medium disabled:opacity-30 flex items-center gap-1"><Plus className="w-3 h-3" /> Crear</button></div>
                <div className="flex gap-2"><select value={actionOwner} onChange={e => setActionOwner(e.target.value)} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-[10px] outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text"><option value="">Responsable...</option>{teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}</select><input type="date" value={actionDate} onChange={e => setActionDate(e.target.value)} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-[10px] outline-none" /></div>
              </div>
              {acts.map(a => { const isOv = a.status !== 'done' && a.date && a.date < today; const isDone = a.status === 'done' || a.status === 'archived'; return (
                <div key={a.id} className={`rounded-lg border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2 flex items-center gap-2 group mb-1 ${isOv ? 'border-revelio-red/30' : 'border-revelio-border'}`}>
                  <button onClick={() => toggleActionStatus(a.id)} className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-revelio-green border-revelio-green' : 'border-revelio-border dark:border-revelio-dark-border hover:border-revelio-blue'}`}>{isDone && <CheckSquare className="w-2.5 h-2.5 text-white" />}</button>
                  <span className={`text-xs flex-1 ${isDone ? 'line-through text-revelio-subtle dark:text-revelio-dark-subtle' : ''}`}>{a.text}</span>
                  {a.owner && <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{a.owner.split(' ')[0]}</span>}
                  {a.date && <span className={`text-[9px] flex items-center gap-0.5 ${isOv ? 'text-revelio-red font-semibold' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}><Clock className="w-2.5 h-2.5" />{new Date(a.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>}
                  <button onClick={() => deleteAction(a.id)} className="opacity-0 group-hover:opacity-100 text-revelio-subtle dark:text-revelio-dark-subtle hover:text-revelio-red"><Trash2 className="w-3 h-3" /></button>
                </div>
              ) })}
              {acts.length === 0 && <Empty message="Crea accionables." />}
            </div>
          )}

          {/* P6: Summary */}
          {retroPhase === 5 && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
                {[
                  { l: 'Notas', v: notes.length, icon: MessageSquare, c: 'text-revelio-blue', bg: 'bg-revelio-blue/10' },
                  { l: 'Items', v: acts.length, icon: ListChecks, c: 'text-revelio-violet', bg: 'bg-revelio-violet/10' },
                  { l: 'Riesgos', v: rOpen.length, icon: AlertTriangle, c: rOpen.length > 0 ? 'text-revelio-orange' : 'text-revelio-green', bg: rOpen.length > 0 ? 'bg-revelio-orange/10' : 'bg-revelio-green/10' },
                  { l: 'Participantes', v: [...new Set(notes.map(n => n.userName))].length, icon: Users, c: 'text-revelio-text dark:text-revelio-dark-text', bg: 'bg-revelio-bg dark:bg-revelio-dark-border' },
                ].map(s => (
                  <div key={s.l} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3.5"><div className={`w-6 h-6 rounded-badge ${s.bg} flex items-center justify-center mb-1.5`}><s.icon className={`w-3 h-3 ${s.c}`} /></div><p className={`text-lg font-bold ${s.c}`}>{s.v}</p><p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wide">{s.l}</p></div>
                ))}
              </div>
              {notes.length > 0 && (
                <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4 mb-3">
                  <h3 className="text-xs font-semibold mb-2">Notas más votadas</h3>
                  {[...notes].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0)).slice(0, 5).map(n => (<div key={n.id} className="flex items-center gap-1.5 py-1 border-b border-revelio-border dark:border-revelio-dark-border/50 last:border-0"><div className="w-1.5 h-1.5 rounded-full" style={{ background: CAT_COLORS[n.category] }} /><span className="text-[11px] flex-1">{n.text}</span><span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle flex items-center gap-0.5"><ThumbsUp className="w-2.5 h-2.5" /> {n.votes?.length || 0}</span></div>))}
                </div>
              )}
              {acts.filter(a => a.status !== 'done' && a.status !== 'archived').length > 0 && (
                <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
                  <h3 className="text-xs font-semibold mb-2">Items pendientes</h3>
                  {acts.filter(a => a.status !== 'done' && a.status !== 'archived').map(a => (<div key={a.id} className="flex items-center gap-1.5 py-1 border-b border-revelio-border dark:border-revelio-dark-border/50 last:border-0"><CheckSquare className="w-3 h-3 text-revelio-blue" /><span className="text-[11px] flex-1">{a.text}</span>{a.owner && <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{a.owner.split(' ')[0]}</span>}</div>))}
                </div>
              )}

              {/* Finalizar retro */}
              <button onClick={() => { setShowCelebration(true); soundComplete() }}
                className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-revelio-blue to-revelio-violet text-white text-sm font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-all active:scale-[0.98]">
                <PartyPopper className="w-4 h-4" /> Finalizar retrospectiva
              </button>
            </div>
          )}
        </>}

        </div>
      </div>

      {/* Celebration overlay */}
      <Celebration
        show={showCelebration}
        onClose={() => { setShowCelebration(false); setInRetro(false) }}
        stats={{
          notes: notes.length,
          actions: acts.length,
          risks: rOpen.length,
          participants: [...new Set(notes.map(n => n.userName))].length,
          actionsDone: actDone,
        }}
      />

      {/* Task detail modal */}
      {detailAction && (
        <TaskDetailModal
          task={detailAction}
          teamMembers={teamMembers}
          epics={acts.filter(a => (a.type || '') === 'epica').map(a => ({ id: a.id, text: a.text }))}
          allItems={workItems.map(a => ({ id: a.id, text: a.text }))}
          currentUser={user?.name || ''}
          onSave={updated => {
            const exists = actions.some(a => a.id === updated.id)
            const next = exists ? actions.map(a => a.id === updated.id ? updated : a) : [...actions, updated]
            setActions(next)
            broadcastState('actions', next)
            setDetailAction(null)
          }}
          onClose={() => setDetailAction(null)}
          onDelete={id => {
            // Also unlink children if deleting an epic
            const next = actions.filter(a => a.id !== id).map(a => String(a.epicLink || '') === id ? { ...a, epicLink: undefined } : a)
            setActions(next)
            broadcastState('actions', next)
            setDetailAction(null)
          }}
        />
      )}
      </div>
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return <div className="text-center py-12"><MessageSquare className="w-8 h-8 mx-auto mb-1.5 text-revelio-border" /><p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">{message}</p></div>
}
