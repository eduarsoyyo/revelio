import { useRef, useState, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, FolderOpen, X, AlertTriangle, Clock, CheckCircle2, Flag, Target, Filter, Eye, EyeOff } from 'lucide-react'

interface TLItem {
  id: string; text: string; status: string; owner: string; date: string
  priority: string; startDate?: string; type?: string; epicLink?: string
  dependsOn?: string[]; depType?: Record<string, string> // { itemId: 'FS'|'SS'|'FF'|'SF' }
  baselineStart?: string; baselineEnd?: string
  description?: string; storyPoints?: number | string | null
  [k: string]: unknown
}

interface TeamMember { id: string; name: string; avatar?: string; color?: string; vacations?: Array<{ from: string; to?: string; type?: string; label?: string }> }

interface TimelineViewProps {
  workItems: TLItem[]
  allActions: TLItem[]
  team: TeamMember[]
  risks?: Array<{ id: string; text?: string; title?: string; status?: string; prob?: string; impact?: string }>
  today: string
  zoom: 'week' | 'month' | 'quarter' | 'year'
  offset: number
  onZoomChange: (z: 'week' | 'month' | 'quarter' | 'year') => void
  onOffsetChange: (o: number) => void
  onItemClick: (a: TLItem) => void
  onItemUpdate: (updated: TLItem) => void
}

// ── Constants ──
const STATUS_CLR: Record<string, string> = { doing: '#007AFF', inprogress: '#007AFF', in_progress: '#007AFF', todo: '#8E8E93', pending: '#8E8E93', backlog: '#8E8E93', blocked: '#FF3B30', done: '#34C759', archived: '#34C759' }
const STATUS_LABEL: Record<string, string> = { doing: 'En curso', inprogress: 'En curso', in_progress: 'En curso', todo: 'Pendiente', pending: 'Pendiente', backlog: 'Backlog', blocked: 'Bloqueado', done: 'Hecho', archived: 'Archivado' }
const DEP_COLORS: Record<string, string> = { FS: '#FF9500', SS: '#5856D6', FF: '#007AFF', SF: '#FF3B30' }
const ZOOM_LABELS: Record<string, string> = { week: 'Sem', month: 'Mes', quarter: 'Trim', year: 'Año' }
type RiskFilter = 'overdue' | 'blocked' | 'critical' | 'noOwner' | 'baseline'

function fmtDate(ds: string) { return new Date(ds).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) }
function daysB(a: string, b: string) { return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) }

export function TimelineView({ workItems, allActions, team, risks: _risks = [], today, zoom, offset, onZoomChange, onOffsetChange, onItemClick, onItemUpdate }: TimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showDeps, setShowDeps] = useState(true)
  const [showCapacity, setShowCapacity] = useState(false)
  const [drawer, setDrawer] = useState<TLItem | null>(null)
  const [filters, setFilters] = useState<Set<RiskFilter>>(new Set())
  const [showFilters, setShowFilters] = useState(false)

  const epicItems = allActions.filter(a => (a.type || '') === 'epica')
  const milestones = allActions.filter(a => (a.type || '') === 'hito' && a.date)
  const noDates = workItems.filter(a => !a.date && !a.startDate)

  // ── Apply risk filters ──
  const filteredWork = useMemo(() => {
    const items = workItems.filter(a => a.date || a.startDate)
    if (filters.size === 0) return items
    return items.filter(a => {
      if (filters.has('overdue') && a.date && a.date < today && a.status !== 'done' && a.status !== 'archived') return true
      if (filters.has('blocked') && a.status === 'blocked') return true
      if (filters.has('critical') && a.priority === 'critical') return true
      if (filters.has('noOwner') && !a.owner) return true
      if (filters.has('baseline') && a.baselineEnd && a.date && a.date !== a.baselineEnd) return true
      return false
    })
  }, [workItems, filters, today])

  // ── KPIs ──
  const kpis = useMemo(() => {
    const all = workItems
    const overdue = all.filter(a => a.date && a.date < today && a.status !== 'done' && a.status !== 'archived').length
    const blocked = all.filter(a => a.status === 'blocked').length
    const total = all.length || 1
    const onTime = all.filter(a => a.status === 'done' || a.status === 'archived' || !a.date || a.date >= today).length
    const pctOnTime = Math.round(onTime / total * 100)
    const upcoming = milestones.filter(m => m.date >= today && daysB(today, m.date) <= 14).length
    const devs = all.filter(a => a.baselineEnd && a.date).map(a => daysB(a.baselineEnd!, a.date))
    const avgDev = devs.length > 0 ? Math.round(devs.reduce((s, d) => s + d, 0) / devs.length) : 0
    // Single-person risk: items where only 1 person owns >3 active items
    const ownerCounts: Record<string, number> = {}
    all.filter(a => a.owner && a.status !== 'done' && a.status !== 'archived').forEach(a => { ownerCounts[a.owner] = (ownerCounts[a.owner] || 0) + 1 })
    const overloaded = Object.values(ownerCounts).filter(c => c > 3).length
    return { overdue, blocked, pctOnTime, upcoming, avgDev, overloaded }
  }, [workItems, milestones, today])

  // ── Date range ──
  const nowD = new Date()
  let startD: Date, endD: Date
  if (zoom === 'week') {
    const dow = (nowD.getDay() + 6) % 7
    startD = new Date(nowD); startD.setDate(startD.getDate() - dow - 7 + offset * 14)
    endD = new Date(startD); endD.setDate(endD.getDate() + 28)
  } else if (zoom === 'quarter') {
    const qStart = Math.floor(nowD.getMonth() / 3) * 3
    startD = new Date(nowD.getFullYear(), qStart - 3 + offset * 3, 1)
    endD = new Date(startD.getFullYear(), startD.getMonth() + 9, 0)
  } else if (zoom === 'year') {
    startD = new Date(nowD.getFullYear() + offset, 0, 1)
    endD = new Date(nowD.getFullYear() + offset, 11, 31)
  } else {
    startD = new Date(nowD.getFullYear(), nowD.getMonth() - 2 + offset * 3, 1)
    endD = new Date(nowD.getFullYear(), nowD.getMonth() + 4 + offset * 3, 0)
  }

  const totalDays = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / 86400000))
  const dayToX = (ds: string) => ((new Date(ds).getTime() - startD.getTime()) / 86400000) / totalDays * 100
  const todayX = dayToX(today)

  // ── Columns ──
  const cols: Array<{ label: string; highlight: boolean }> = []
  if (zoom === 'week') {
    const c = new Date(startD)
    while (c <= endD) {
      const twS = new Date(nowD); twS.setDate(twS.getDate() - (nowD.getDay() + 6) % 7)
      cols.push({ label: `${c.getDate()} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][c.getMonth()]}`, highlight: c >= twS && c < new Date(twS.getTime() + 7 * 86400000) })
      c.setDate(c.getDate() + 7)
    }
  } else if (zoom === 'year') {
    for (let q = 0; q < 4; q++) cols.push({ label: ['Ene–Mar','Abr–Jun','Jul–Sep','Oct–Dic'][q]!, highlight: Math.floor(nowD.getMonth() / 3) === q && nowD.getFullYear() === startD.getFullYear() })
  } else {
    const c = new Date(startD)
    while (c <= endD) {
      cols.push({ label: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][c.getMonth()]! + (c.getFullYear() !== nowD.getFullYear() ? ` '${c.getFullYear() % 100}` : ''), highlight: c.getMonth() === nowD.getMonth() && c.getFullYear() === nowD.getFullYear() })
      c.setMonth(c.getMonth() + 1)
    }
  }

  const colW = zoom === 'week' ? 90 : zoom === 'year' ? 200 : 120
  const minW = Math.max(cols.length * colW, 500)
  const periodLabel = zoom === 'year' ? String(startD.getFullYear()) : zoom === 'quarter' ? `${['Q1','Q2','Q3','Q4'][Math.floor(startD.getMonth() / 3)]} ${startD.getFullYear()}` : zoom === 'week' ? `${startD.getDate()}/${startD.getMonth() + 1} — ${endD.getDate()}/${endD.getMonth() + 1}` : `${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][startD.getMonth()]} — ${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][endD.getMonth()]} ${endD.getFullYear()}`

  // ── Resize ──
  const handleResize = useCallback((e: React.MouseEvent, id: string, edge: 'left' | 'right', origDate: string) => {
    e.stopPropagation(); e.preventDefault()
    const sx = e.clientX
    const onMove = (ev: MouseEvent) => {
      if (!containerRef.current) return
      const dx = ev.clientX - sx
      const dd = Math.round((dx / containerRef.current.getBoundingClientRect().width) * totalDays)
      if (!dd) return
      const d = new Date(origDate); d.setDate(d.getDate() + dd)
      const nd = d.toISOString().slice(0, 10)
      const item = allActions.find(a => a.id === id)
      if (item) onItemUpdate(edge === 'left' ? { ...item, startDate: nd } : { ...item, date: nd })
    }
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }, [allActions, totalDays, onItemUpdate])

  // ── Render rows ──
  const barPos: Record<string, { l: number; r: number; y: number }> = {}
  let rowI = 0
  const RH = 28

  const bar = (a: TLItem, isEpic?: boolean) => {
    const s = String(a.startDate || a.date || today), e = String(a.date || a.startDate || today)
    const l = dayToX(s), r = dayToX(e), w = Math.max(0.6, r - l)
    const done = a.status === 'done' || a.status === 'archived'
    const ov = !done && a.date && a.date < today
    const clr = isEpic ? '#AF52DE' : STATUS_CLR[a.status] || '#8E8E93'
    const rh = isEpic ? 32 : RH
    const cy = rowI * rh + rh / 2; barPos[a.id] = { l, r: l + w, y: cy }; rowI++
    const hasBL = !!(a.baselineStart && a.baselineEnd)
    const blL = hasBL ? dayToX(a.baselineStart!) : 0, blW = hasBL ? Math.max(0.4, dayToX(a.baselineEnd!) - blL) : 0

    return (
      <div key={a.id} className="relative border-b border-[#F2F2F7] dark:border-[#2C2C2E] group" style={{ height: rh }}>
        {hasBL && <div className="absolute rounded-sm" style={{ left: `${blL}%`, width: `${blW}%`, height: 3, top: '50%', marginTop: isEpic ? 7 : 5, background: '#8E8E93', opacity: 0.3 }} />}
        <div className={`absolute rounded-sm transition-all ${isEpic ? '' : 'group-hover:brightness-110'}`}
          style={{ left: `${Math.max(0, l)}%`, width: `${w}%`, height: isEpic ? 14 : 10, top: '50%', transform: 'translateY(-50%)', background: clr + (isEpic ? '30' : '18'), borderLeft: `${isEpic ? 3 : 2}px solid ${clr}`, borderRight: ov ? '2px solid #FF3B30' : undefined }}
          onClick={() => setDrawer(a)}>
          {!isEpic && <>
            <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/40 z-10" onMouseDown={ev => handleResize(ev, a.id, 'left', s)} />
            <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/40 z-10" onMouseDown={ev => handleResize(ev, a.id, 'right', e)} />
          </>}
          <span className={`absolute left-2 top-px font-medium truncate pr-3 leading-tight ${isEpic ? 'text-[9px]' : 'text-[8px]'}`} style={{ maxWidth: `${Math.max(40, w * 8)}px`, color: isEpic ? clr : undefined }}>{a.text}</span>
        </div>
        {ov && <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#FF3B30] animate-pulse" />}
        {a.owner && <span className="absolute right-1 text-[7px] text-[#8E8E93] opacity-0 group-hover:opacity-100 z-10" style={{ top: 2 }}>{a.owner.split(' ')[0]}</span>}
      </div>
    )
  }

  const milestone = (m: TLItem) => {
    const x = dayToX(m.date), done = m.status === 'done', ov = !done && m.date < today
    const clr = done ? '#34C759' : ov ? '#FF3B30' : '#FF9500'
    barPos[m.id] = { l: x, r: x, y: rowI * RH + RH / 2 }; rowI++
    return (
      <div key={m.id} className="relative border-b border-[#F2F2F7] dark:border-[#2C2C2E] group cursor-pointer" style={{ height: RH }} onClick={() => setDrawer(m)}>
        <div className="absolute" style={{ left: `${x}%`, top: '50%', transform: 'translate(-50%, -50%) rotate(45deg)', width: 9, height: 9, background: clr, opacity: done ? 0.5 : 1 }} />
        <span className="absolute text-[7px] font-semibold truncate" style={{ left: `${x + 1.5}%`, top: '50%', transform: 'translateY(-50%)', color: clr, maxWidth: 100 }}>{m.text}</span>
      </div>
    )
  }

  // Build rows
  const rows: JSX.Element[] = []; rowI = 0
  epicItems.forEach(ep => {
    const ch = filteredWork.filter(a => String(a.epicLink || '') === ep.id)
    const cDates = ch.flatMap(a => [String(a.startDate || a.date || ''), a.date || ''].filter(Boolean))
    const eS = cDates.length > 0 ? cDates.sort()[0]! : String(ep.startDate || ep.date || '')
    const eE = cDates.length > 0 ? cDates.sort().reverse()[0]! : String(ep.date || ep.startDate || '')
    if (eS && eE) rows.push(bar({ ...ep, startDate: eS, date: eE }, true))
    else { barPos[ep.id] = { l: 0, r: 0, y: rowI * 32 + 16 }; rowI++; rows.push(<div key={ep.id} className="h-8 flex items-center px-2 border-b border-[#F2F2F7] dark:border-[#2C2C2E] bg-[#AF52DE]/3"><FolderOpen className="w-3 h-3 text-[#AF52DE] mr-1" /><span className="text-[9px] font-semibold text-[#AF52DE]">{ep.text}</span></div>) }
    ch.forEach(a => rows.push(bar(a)))
  })
  milestones.forEach(m => rows.push(milestone(m)))
  const orphans = filteredWork.filter(a => !a.epicLink || !epicItems.some(e => e.id === a.epicLink))
  if (orphans.length > 0 && epicItems.length > 0) { rowI++; rows.push(<div key="oh" className="h-5 flex items-center px-2 border-b border-[#F2F2F7] dark:border-[#2C2C2E]"><span className="text-[7px] font-bold text-[#8E8E93] uppercase tracking-wider">Sin épica</span></div>) }
  orphans.forEach(a => rows.push(bar(a)))

  // ── Dependency arrows with curved paths ──
  const arrows: JSX.Element[] = []
  if (showDeps) {
    allActions.forEach(a => {
      const deps = (a.dependsOn as string[]) || []
      const depTypes = (a.depType as Record<string, string>) || {}
      deps.forEach(did => {
        const from = barPos[did], to = barPos[a.id]
        if (!from || !to) return
        const dtype = depTypes[did] || 'FS'
        const clr = DEP_COLORS[dtype] || '#FF9500'
        // FS: end of predecessor → start of successor
        // SS: start → start / FF: end → end / SF: start → end
        const x1 = dtype === 'SS' || dtype === 'SF' ? from.l : from.r
        const x2 = dtype === 'FF' || dtype === 'SF' ? to.r : to.l
        const y1 = from.y, y2 = to.y
        // Curved path
        const midX = (x1 + x2) / 2
        const path = `M ${x1}% ${y1} C ${midX + 2}% ${y1}, ${midX - 2}% ${y2}, ${x2}% ${y2}`
        arrows.push(
          <g key={`${did}-${a.id}`}>
            <path d={path} fill="none" stroke={clr} strokeWidth={1.2} strokeDasharray={dtype === 'FS' ? 'none' : '4 2'} opacity={0.5} markerEnd={`url(#ah-${dtype})`} />
            <title>{dtype}: {allActions.find(x => x.id === did)?.text} → {a.text}</title>
          </g>
        )
      })
    })
  }

  const toggleFilter = (f: RiskFilter) => {
    const next = new Set(filters)
    next.has(f) ? next.delete(f) : next.add(f)
    setFilters(next)
  }

  return (
    <div className="flex gap-0">
      <div className={`flex-1 min-w-0 ${drawer ? '' : ''}`}>
        {/* KPI bar */}
        <div className="flex gap-2 mb-2 flex-wrap">
          {[
            { v: `${kpis.pctOnTime}%`, l: 'A tiempo', c: kpis.pctOnTime >= 80 ? '#34C759' : kpis.pctOnTime >= 50 ? '#FF9500' : '#FF3B30', I: CheckCircle2 },
            { v: kpis.overdue, l: 'Vencidos', c: kpis.overdue > 0 ? '#FF3B30' : '#34C759', I: Clock },
            { v: kpis.blocked, l: 'Bloqueados', c: kpis.blocked > 0 ? '#FF3B30' : '#8E8E93', I: AlertTriangle },
            { v: kpis.upcoming, l: 'Hitos próx.', c: '#FF9500', I: Target },
            { v: `${kpis.avgDev > 0 ? '+' : ''}${kpis.avgDev}d`, l: 'Desviación', c: Math.abs(kpis.avgDev) > 3 ? '#FF3B30' : kpis.avgDev > 0 ? '#FF9500' : '#34C759', I: Flag },
            { v: kpis.overloaded, l: 'Sobreasig.', c: kpis.overloaded > 0 ? '#FF3B30' : '#8E8E93', I: AlertTriangle },
          ].map(k => (
            <div key={k.l} className="flex items-center gap-1.5 bg-white dark:bg-[#2C2C2E] border border-[#F2F2F7] dark:border-[#3A3A3C] rounded-lg px-2 py-1">
              <k.I className="w-3 h-3" style={{ color: k.c }} />
              <span className="text-[10px] font-bold" style={{ color: k.c }}>{k.v}</span>
              <span className="text-[7px] text-[#8E8E93]">{k.l}</span>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
          <div className="flex items-center gap-1">
            <button onClick={() => onOffsetChange(offset - 1)} className="w-5 h-5 rounded border border-[#E5E5EA] dark:border-[#3A3A3C] flex items-center justify-center hover:bg-[#F2F2F7] dark:hover:bg-[#3A3A3C]"><ChevronLeft className="w-3 h-3 text-[#8E8E93]" /></button>
            <span className="text-[10px] font-semibold dark:text-[#F5F5F7] min-w-[110px] text-center">{periodLabel}</span>
            <button onClick={() => onOffsetChange(offset + 1)} className="w-5 h-5 rounded border border-[#E5E5EA] dark:border-[#3A3A3C] flex items-center justify-center hover:bg-[#F2F2F7] dark:hover:bg-[#3A3A3C]"><ChevronRight className="w-3 h-3 text-[#8E8E93]" /></button>
            <button onClick={() => onOffsetChange(0)} className="text-[8px] text-[#007AFF] hover:underline ml-1">Hoy</button>
          </div>
          <div className="flex items-center gap-2">
            {/* Risk filters */}
            <div className="relative">
              <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-0.5 px-2 py-0.5 rounded text-[8px] font-semibold ${filters.size > 0 ? 'bg-[#FF9500]/10 text-[#FF9500]' : 'bg-[#F2F2F7] dark:bg-[#3A3A3C] text-[#8E8E93]'}`}>
                <Filter className="w-3 h-3" /> {filters.size > 0 ? `${filters.size} filtros` : 'Filtros'}
              </button>
              {showFilters && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#2C2C2E] border border-[#E5E5EA] dark:border-[#3A3A3C] rounded-lg shadow-lg z-30 py-1">
                  {([
                    { id: 'overdue' as RiskFilter, label: 'Vencidos', icon: Clock, c: '#FF3B30' },
                    { id: 'blocked' as RiskFilter, label: 'Bloqueados', icon: AlertTriangle, c: '#FF3B30' },
                    { id: 'critical' as RiskFilter, label: 'Prioridad crítica', icon: Flag, c: '#FF3B30' },
                    { id: 'noOwner' as RiskFilter, label: 'Sin responsable', icon: Target, c: '#FF9500' },
                    { id: 'baseline' as RiskFilter, label: 'Con desviación', icon: Flag, c: '#FF9500' },
                  ]).map(f => (
                    <button key={f.id} onClick={() => toggleFilter(f.id)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-[#F2F2F7] dark:hover:bg-[#3A3A3C]">
                      {filters.has(f.id) ? <Eye className="w-3 h-3" style={{ color: f.c }} /> : <EyeOff className="w-3 h-3 text-[#C7C7CC]" />}
                      <span className={filters.has(f.id) ? 'font-semibold dark:text-[#F5F5F7]' : 'text-[#8E8E93]'}>{f.label}</span>
                    </button>
                  ))}
                  {filters.size > 0 && (
                    <button onClick={() => setFilters(new Set())} className="w-full px-3 py-1.5 text-[9px] text-[#007AFF] hover:underline border-t border-[#F2F2F7] dark:border-[#3A3A3C] mt-1">Limpiar filtros</button>
                  )}
                </div>
              )}
            </div>

            {/* Dependencies toggle */}
            <label className="flex items-center gap-1 text-[8px] text-[#8E8E93] cursor-pointer select-none">
              <input type="checkbox" checked={showDeps} onChange={e => setShowDeps(e.target.checked)} className="w-3 h-3 accent-[#FF9500] rounded" />
              Deps
            </label>
            <label className="flex items-center gap-1 text-[8px] text-[#8E8E93] cursor-pointer select-none">
              <input type="checkbox" checked={showCapacity} onChange={e => setShowCapacity(e.target.checked)} className="w-3 h-3 accent-[#5856D6] rounded" />
              Capacidad
            </label>

            {/* Zoom */}
            <div className="flex gap-px bg-[#F2F2F7] dark:bg-[#3A3A3C] rounded-md overflow-hidden">
              {(['week', 'month', 'quarter', 'year'] as const).map(z => (
                <button key={z} onClick={() => { onZoomChange(z); onOffsetChange(0) }}
                  className={`px-2 py-0.5 text-[8px] font-semibold ${zoom === z ? 'bg-[#007AFF] text-white' : 'text-[#8E8E93]'}`}>
                  {ZOOM_LABELS[z]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="rounded-lg border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] overflow-auto" ref={containerRef}>
          <div className="flex border-b border-[#E5E5EA] dark:border-[#3A3A3C] sticky top-0 bg-white dark:bg-[#1C1C1E] z-20" style={{ minWidth: minW }}>
            {cols.map((c, i) => <div key={i} className={`flex-1 px-1.5 py-1 text-center text-[8px] font-semibold border-r border-[#F2F2F7]/50 dark:border-[#2C2C2E]/50 last:border-0 ${c.highlight ? 'bg-[#007AFF]/4 text-[#007AFF]' : 'text-[#8E8E93]'}`}>{c.label}</div>)}
          </div>
          <div className="relative" style={{ minWidth: minW }}>
            {/* Grid lines */}
            <div className="absolute inset-0 flex pointer-events-none">{cols.map((_, i) => <div key={i} className="flex-1 border-r border-[#F2F2F7]/30 dark:border-[#2C2C2E]/30 last:border-0" />)}</div>
            {/* Today */}
            {todayX >= 0 && todayX <= 100 && <div className="absolute top-0 bottom-0 z-10" style={{ left: `${todayX}%` }}><div className="w-px h-full bg-[#FF3B30]/25" /><div className="absolute -top-px -left-[3px] w-[7px] h-[7px] rounded-full bg-[#FF3B30]" /></div>}
            {/* SVG arrows */}
            {arrows.length > 0 && (
              <svg className="absolute inset-0 pointer-events-none z-10" style={{ width: '100%', height: '100%' }}>
                <defs>
                  {Object.entries(DEP_COLORS).map(([t, c]) => <marker key={t} id={`ah-${t}`} markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto"><polygon points="0 0, 6 2.5, 0 5" fill={c} opacity="0.6" /></marker>)}
                </defs>
                {arrows}
              </svg>
            )}
            {rows}
            {rows.length === 0 && <div className="text-center py-8 text-[10px] text-[#8E8E93]">Sin items en este período{filters.size > 0 ? ' (con filtros activos)' : ''}</div>}

            {/* Capacity / Absence overlay */}
            {showCapacity && team.length > 0 && (
              <div className="border-t-2 border-[#E5E5EA] dark:border-[#3A3A3C]">
                <div className="h-5 flex items-center px-2 bg-[#F2F2F7]/50 dark:bg-[#2C2C2E]/50">
                  <span className="text-[7px] font-bold text-[#8E8E93] uppercase tracking-wider">Capacidad del equipo</span>
                </div>
                {team.map(m => {
                  // Count active items per person in visible range
                  const myItems = workItems.filter(a => a.owner === m.name && (a.status === 'doing' || a.status === 'inprogress' || a.status === 'in_progress' || a.status === 'todo' || a.status === 'pending'))
                  const overloaded = myItems.length > 3
                  // Check absences in visible range
                  const sDs = startD.toISOString().slice(0, 10)
                  const eDs = endD.toISOString().slice(0, 10)
                  const absences = (m.vacations || []).filter(v => v.from <= eDs && (!v.to || v.to >= sDs))

                  return (
                    <div key={m.id} className="relative border-b border-[#F2F2F7] dark:border-[#2C2C2E]" style={{ height: 22 }}>
                      {/* Person label */}
                      <span className={`absolute left-1 top-1/2 -translate-y-1/2 text-[7px] font-medium z-10 ${overloaded ? 'text-[#FF3B30]' : 'text-[#8E8E93]'}`}>
                        {m.avatar || '·'} {m.name.split(' ')[0]} {overloaded ? `(${myItems.length})` : ''}
                      </span>
                      {/* Overload background */}
                      {overloaded && <div className="absolute inset-0 bg-[#FF3B30]/4" />}
                      {/* Absence bars */}
                      {absences.map((ab, ai) => {
                        const abStart = ab.from < sDs ? sDs : ab.from
                        const abEnd = (ab.to || ab.from) > eDs ? eDs : (ab.to || ab.from)
                        const aL = dayToX(abStart), aR = dayToX(abEnd)
                        const aW = Math.max(0.3, aR - aL)
                        const isVac = (ab.type || 'vacaciones') === 'vacaciones'
                        return (
                          <div key={ai} className="absolute rounded-sm" title={`${ab.type || 'Vacaciones'}: ${ab.label || ''} ${ab.from}→${ab.to || ab.from}`}
                            style={{ left: `${aL}%`, width: `${aW}%`, height: 6, top: '50%', transform: 'translateY(-50%)', background: isVac ? '#FF9500' + '30' : '#FF3B30' + '25', borderLeft: `1.5px solid ${isVac ? '#FF9500' : '#FF3B30'}` }} />
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-3 mt-1 text-[7px] text-[#8E8E93] flex-wrap">
          <span className="flex items-center gap-1"><span className="w-4 h-1 rounded-sm bg-[#007AFF]/20 border-l-[1.5px] border-[#007AFF]" />En curso</span>
          <span className="flex items-center gap-1"><span className="w-4 h-1 rounded-sm bg-[#34C759]/20 border-l-[1.5px] border-[#34C759]" />Hecho</span>
          <span className="flex items-center gap-1"><span className="w-4 h-1 rounded-sm bg-[#8E8E93]/15 border-l-[1.5px] border-[#8E8E93]" />Pendiente</span>
          <span className="flex items-center gap-1"><span className="w-4 h-[2px] bg-[#8E8E93]/30" />Base</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rotate-45 bg-[#FF9500] inline-block" />Hito</span>
          {showDeps && <>
            <span className="flex items-center gap-1"><span className="w-4 border-t border-[#FF9500]" />FS</span>
            <span className="flex items-center gap-1"><span className="w-4 border-t border-dashed border-[#5856D6]" />SS</span>
            <span className="flex items-center gap-1"><span className="w-4 border-t border-dashed border-[#007AFF]" />FF</span>
            <span className="flex items-center gap-1"><span className="w-4 border-t border-dashed border-[#FF3B30]" />SF</span>
          </>}
        </div>

        {noDates.length > 0 && <div className="mt-2"><p className="text-[7px] font-bold text-[#8E8E93] uppercase mb-1">Sin fechas ({noDates.length})</p><div className="flex gap-1 flex-wrap">{noDates.map(a => <span key={a.id} onClick={() => setDrawer(a)} className="text-[7px] bg-[#F2F2F7] dark:bg-[#3A3A3C] text-[#1D1D1F] dark:text-[#F5F5F7] px-1.5 py-0.5 rounded cursor-pointer hover:bg-[#E5E5EA]">{a.text}</span>)}</div></div>}
      </div>

      {/* ── Drawer ── */}
      {drawer && (
        <div className="w-64 flex-shrink-0 border-l border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] ml-2 rounded-lg overflow-y-auto" style={{ maxHeight: 480 }}>
          <div className="p-3.5">
            <div className="flex items-start justify-between mb-2.5">
              <div className="flex-1 min-w-0">
                <span className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: (STATUS_CLR[drawer.status] || '#8E8E93') + '15', color: STATUS_CLR[drawer.status] || '#8E8E93' }}>{STATUS_LABEL[drawer.status] || drawer.status}</span>
                <h4 className="text-xs font-semibold dark:text-[#F5F5F7] mt-1 leading-snug">{drawer.text}</h4>
              </div>
              <button onClick={() => setDrawer(null)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-[#F2F2F7] dark:hover:bg-[#3A3A3C] flex-shrink-0 ml-1"><X className="w-3 h-3 text-[#8E8E93]" /></button>
            </div>
            <div className="space-y-2 text-[9px]">
              {drawer.owner && <R l="Responsable" v={drawer.owner} />}
              {drawer.type && <R l="Tipo" v={drawer.type === 'historia' ? 'HU' : drawer.type === 'hito' ? 'Hito' : drawer.type} />}
              {drawer.startDate && <R l="Inicio" v={fmtDate(drawer.startDate)} />}
              {drawer.date && <R l="Vencimiento" v={fmtDate(drawer.date)} c={drawer.date < today && drawer.status !== 'done' ? '#FF3B30' : undefined} />}
              {drawer.baselineEnd && drawer.date && drawer.date !== drawer.baselineEnd && (
                <div className="bg-[#FF3B30]/5 border border-[#FF3B30]/15 rounded px-2 py-1.5">
                  <p className="text-[8px] font-semibold text-[#FF3B30]">Desviación: {daysB(drawer.baselineEnd, drawer.date) > 0 ? '+' : ''}{daysB(drawer.baselineEnd, drawer.date)}d</p>
                  <p className="text-[7px] text-[#8E8E93]">Base: {fmtDate(drawer.baselineStart || drawer.baselineEnd)} → {fmtDate(drawer.baselineEnd)}</p>
                </div>
              )}
              {drawer.priority && <R l="Prioridad" v={drawer.priority === 'critical' ? 'Crítica' : drawer.priority === 'high' ? 'Alta' : drawer.priority === 'medium' ? 'Media' : 'Baja'} c={drawer.priority === 'critical' ? '#FF3B30' : drawer.priority === 'high' ? '#FF9500' : undefined} />}
              {drawer.storyPoints && <R l="SP" v={String(drawer.storyPoints)} />}
              {drawer.description && <div><p className="text-[7px] font-bold text-[#8E8E93] uppercase mb-0.5">Descripción</p><p className="text-[9px] dark:text-[#F5F5F7] leading-relaxed">{String(drawer.description)}</p></div>}
              {((drawer.dependsOn as string[]) || []).length > 0 && (
                <div>
                  <p className="text-[7px] font-bold text-[#8E8E93] uppercase mb-0.5">Dependencias</p>
                  {((drawer.dependsOn as string[]) || []).map(did => {
                    const dep = allActions.find(x => x.id === did)
                    const dt = ((drawer.depType as Record<string, string>) || {})[did] || 'FS'
                    return dep ? (
                      <div key={did} className="flex items-center gap-1 text-[8px] dark:text-[#F5F5F7]">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_CLR[dep.status] || '#8E8E93' }} />
                        <span className="font-bold" style={{ color: DEP_COLORS[dt] }}>{dt}</span>
                        <span className="truncate">{dep.text}</span>
                      </div>
                    ) : null
                  })}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="mt-3 pt-2 border-t border-[#F2F2F7] dark:border-[#2C2C2E] space-y-1.5">
              <p className="text-[7px] font-bold text-[#8E8E93] uppercase">Acciones rápidas</p>

              {/* Status change */}
              <div className="flex gap-0.5 flex-wrap">
                {[
                  { s: 'todo', l: 'Pend.', c: '#8E8E93' },
                  { s: 'doing', l: 'Curso', c: '#007AFF' },
                  { s: 'blocked', l: 'Bloq.', c: '#FF3B30' },
                  { s: 'done', l: 'Hecho', c: '#34C759' },
                ].map(st => (
                  <button key={st.s} onClick={() => {
                    onItemUpdate({ ...drawer, status: st.s })
                    setDrawer({ ...drawer, status: st.s })
                  }} disabled={drawer.status === st.s}
                    className={`px-1.5 py-0.5 rounded text-[7px] font-semibold transition-colors ${drawer.status === st.s ? 'text-white' : 'bg-[#F2F2F7] dark:bg-[#3A3A3C] text-[#8E8E93]'}`}
                    style={drawer.status === st.s ? { background: st.c } : undefined}>
                    {st.l}
                  </button>
                ))}
              </div>

              {/* Reassign */}
              <select value={drawer.owner || ''} onChange={e => {
                onItemUpdate({ ...drawer, owner: e.target.value })
                setDrawer({ ...drawer, owner: e.target.value })
              }} className="w-full rounded border border-[#E5E5EA] dark:border-[#3A3A3C] px-1.5 py-0.5 text-[8px] outline-none bg-white dark:bg-[#2C2C2E] dark:text-[#F5F5F7]">
                <option value="">Sin responsable</option>
                {team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>

              {/* Save baseline */}
              {(drawer.startDate || drawer.date) && !drawer.baselineEnd && (
                <button onClick={() => {
                  const updated = { ...drawer, baselineStart: drawer.startDate || drawer.date, baselineEnd: drawer.date || drawer.startDate }
                  onItemUpdate(updated)
                  setDrawer(updated)
                }} className="w-full py-0.5 rounded text-[8px] font-semibold bg-[#8E8E93]/10 text-[#8E8E93] hover:bg-[#8E8E93]/20">
                  Fijar línea base
                </button>
              )}

              <div className="flex gap-1 pt-1">
                <button onClick={() => { onItemClick(drawer); setDrawer(null) }} className="flex-1 py-1 rounded bg-[#007AFF]/10 text-[#007AFF] text-[8px] font-semibold">Editar completo</button>
                <button onClick={() => setDrawer(null)} className="flex-1 py-1 rounded bg-[#F2F2F7] dark:bg-[#3A3A3C] text-[#8E8E93] text-[8px] font-semibold">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function R({ l, v, c }: { l: string; v: string; c?: string }) {
  return <div className="flex items-center justify-between"><span className="text-[7px] font-bold text-[#8E8E93] uppercase">{l}</span><span className="text-[9px] font-medium dark:text-[#F5F5F7]" style={c ? { color: c } : undefined}>{v}</span></div>
}
