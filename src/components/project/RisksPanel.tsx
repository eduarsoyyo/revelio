import React, { useState, useMemo } from "react"
import {
  Shield, AlertTriangle, Lightbulb, Plus, X, ChevronRight, Download,
  ArrowUpRight, CheckCircle2,
} from 'lucide-react'
import { RichEditor } from '@/components/common/RichText'
import { soundCreate, soundDelete, soundDrop } from '@/lib/sounds'

// ── Types ──
interface Risk {
  id: string; title: string; text?: string; description?: string; type: 'riesgo' | 'problema' | 'oportunidad'
  status: string; prob?: string; impact?: string; owner?: string; createdAt: string
  escalation?: { level?: string; by?: string; date?: string; reason?: string }
  mitigation?: string; contingency?: string; rootCause?: string; resolution?: string
  linkedItems?: string[]; targetDate?: string; detectedDate?: string
  impactAreas?: string[]; comments?: Array<{ id: string; author: string; text: string; date: string; isDecision?: boolean }>
  [k: string]: unknown
}

type View = 'resumen' | 'registro' | 'heatmap' | 'tratamiento'

interface RisksPanelProps {
  risks: Risk[]
  onUpdate: (risks: Risk[]) => void
  currentUser: string
  items?: Array<{ id: string; text: string }>
}

// ── Constants ──
const TYPE_META = {
  riesgo: { label: 'Riesgo', icon: Shield, color: '#FF9500', bg: 'bg-[#FF9500]/10' },
  problema: { label: 'Problema', icon: AlertTriangle, color: '#FF3B30', bg: 'bg-[#FF3B30]/10' },
  oportunidad: { label: 'Oportunidad', icon: Lightbulb, color: '#34C759', bg: 'bg-[#34C759]/10' },
}

const RISK_STATUSES = ['identificado', 'analizado', 'mitigando', 'monitorizando', 'escalado', 'cerrado']
const PROBLEM_STATUSES = ['abierto', 'contenido', 'en_resolucion', 'resuelto', 'validado', 'cerrado']
const OPP_STATUSES = ['detectada', 'evaluada', 'aprobada', 'en_explotacion', 'capturada', 'descartada']

const PROB_LEVELS = ['baja', 'media', 'alta'] as const
const IMPACT_LEVELS = ['bajo', 'medio', 'alto'] as const

const ESC_LEVELS = ['equipo', 'sm', 'pm', 'direccion', 'cliente']
const ESC_LABELS: Record<string, string> = { equipo: 'Equipo', sm: 'Service Manager', pm: 'PM / Dirección', direccion: 'Dirección', cliente: 'Cliente' }

const IMPACT_AREAS = ['entrega', 'equipo', 'margen', 'cliente', 'calidad', 'compliance']

function uid() { return Math.random().toString(36).slice(2, 10) }
function criticality(prob?: string, impact?: string) {
  const p = prob === 'alta' ? 3 : prob === 'media' ? 2 : 1
  const i = impact === 'alto' ? 3 : impact === 'medio' ? 2 : 1
  return p * i
}
function critColor(c: number) { return c >= 6 ? '#FF3B30' : c >= 3 ? '#FF9500' : '#34C759' }
function critLabel(c: number) { return c >= 6 ? 'Crítico' : c >= 3 ? 'Medio' : 'Bajo' }
function fmtDate(ds: string) { return new Date(ds).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) }
function statusesFor(type: string) { return type === 'problema' ? PROBLEM_STATUSES : type === 'oportunidad' ? OPP_STATUSES : RISK_STATUSES }

export function RisksPanel({ risks, onUpdate, currentUser, items = [] }: RisksPanelProps) {
  const [view, setView] = useState<View>('resumen')
  const [detail, setDetail] = useState<Risk | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createType, setCreateType] = useState<'riesgo' | 'problema' | 'oportunidad'>('riesgo')

  const open = useMemo(() => risks.filter(r => r.status !== 'cerrado' && r.status !== 'descartada'), [risks])
  const filtered = typeFilter ? open.filter(r => r.type === typeFilter) : open
  const escalated = open.filter(r => r.escalation?.level && r.escalation.level !== 'equipo')
  const critical = open.filter(r => criticality(r.prob, r.impact) >= 6)

  const save = (r: Risk) => { onUpdate(risks.map(x => x.id === r.id ? r : x)); setDetail(r) }
  const add = (r: Risk) => { onUpdate([...risks, r]); setDetail(r); setShowCreate(false); soundCreate() }
  const remove = (id: string) => { onUpdate(risks.filter(r => r.id !== id)); setDetail(null); soundDelete() }

  // ═══ RESUMEN VIEW ═══
  const renderResumen = () => (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { l: 'Abiertos', v: open.length, c: '#007AFF', I: Shield },
          { l: 'Críticos', v: critical.length, c: critical.length > 0 ? '#FF3B30' : '#34C759', I: AlertTriangle },
          { l: 'Escalados', v: escalated.length, c: escalated.length > 0 ? '#FF3B30' : '#8E8E93', I: ArrowUpRight },
          { l: 'Problemas', v: open.filter(r => r.type === 'problema').length, c: '#FF3B30', I: AlertTriangle },
          { l: 'Oportunidades', v: open.filter(r => r.type === 'oportunidad').length, c: '#34C759', I: Lightbulb },
        ].map(k => (
          <div key={k.l} className="rounded-card border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] p-3">
            <k.I className="w-4 h-4 mb-1" style={{ color: k.c }} />
            <p className="text-lg font-bold" style={{ color: k.c }}>{k.v}</p>
            <p className="text-[8px] text-[#8E8E93] uppercase tracking-wide">{k.l}</p>
          </div>
        ))}
      </div>

      {/* Critical items */}
      {critical.length > 0 && (
        <div className="rounded-card border border-[#FF3B30]/20 bg-[#FF3B30]/3 dark:bg-[#FF3B30]/5 p-4">
          <h4 className="text-[10px] font-semibold text-[#FF3B30] uppercase mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Requieren atención inmediata</h4>
          {critical.slice(0, 5).map(r => <RiskRow key={r.id} r={r} onClick={() => setDetail(r)} />)}
        </div>
      )}

      {/* Escalated */}
      {escalated.length > 0 && (
        <div className="rounded-card border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] p-4">
          <h4 className="text-[10px] font-semibold text-[#FF9500] uppercase mb-2 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> Escalados</h4>
          {escalated.map(r => <RiskRow key={r.id} r={r} onClick={() => setDetail(r)} showEscalation />)}
        </div>
      )}

      {/* Recent by type */}
      <div className="grid sm:grid-cols-3 gap-3">
        {(['riesgo', 'problema', 'oportunidad'] as const).map(type => {
          const tm = TYPE_META[type]
          const typeItems = open.filter(r => r.type === type).slice(0, 4)
          return (
            <div key={type} className="rounded-card border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-semibold uppercase flex items-center gap-1" style={{ color: tm.color }}><tm.icon className="w-3 h-3" /> {tm.label}s</h4>
                <button onClick={() => { setTypeFilter(type); setView('registro') }} className="text-[8px] text-[#007AFF] hover:underline flex items-center gap-0.5">Ver <ChevronRight className="w-2 h-2" /></button>
              </div>
              {typeItems.length > 0 ? typeItems.map(r => <RiskRow key={r.id} r={r} onClick={() => setDetail(r)} compact />) : <p className="text-[9px] text-[#8E8E93] text-center py-2">Sin {tm.label.toLowerCase()}s abiertos</p>}
            </div>
          )
        })}
      </div>
    </div>
  )

  // ═══ REGISTRO VIEW ═══
  const renderRegistro = () => (
    <div>
      <div className="flex gap-1 mb-3">
        <button onClick={() => setTypeFilter(null)} className={`px-2.5 py-1 rounded text-[9px] font-semibold ${!typeFilter ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] dark:bg-[#3A3A3C] text-[#8E8E93]'}`}>Todos ({open.length})</button>
        {(['riesgo', 'problema', 'oportunidad'] as const).map(t => {
          const count = open.filter(r => r.type === t).length
          return <button key={t} onClick={() => setTypeFilter(typeFilter === t ? null : t)} className={`px-2.5 py-1 rounded text-[9px] font-semibold ${typeFilter === t ? 'text-white' : 'bg-[#F2F2F7] dark:bg-[#3A3A3C] text-[#8E8E93]'}`} style={typeFilter === t ? { background: TYPE_META[t].color } : undefined}>{TYPE_META[t].label} ({count})</button>
        })}
      </div>
      <div className="space-y-1">
        {filtered.map(r => <RiskRow key={r.id} r={r} onClick={() => setDetail(r)} showEscalation />)}
        {filtered.length === 0 && <p className="text-[10px] text-[#8E8E93] text-center py-6">Sin registros</p>}
      </div>
    </div>
  )

  // ═══ HEATMAP VIEW ═══
  const renderHeatmap = () => {
    const riskItems = open.filter(r => r.type !== 'oportunidad')
    const grid: Record<string, Risk[]> = {}
    PROB_LEVELS.forEach(p => IMPACT_LEVELS.forEach(i => { grid[`${p}-${i}`] = [] }))
    riskItems.forEach(r => { const k = `${r.prob || 'media'}-${r.impact || 'medio'}`; if (grid[k]) grid[k]!.push(r) })

    const CELL_BG: Record<string, string> = { 'alta-alto': 'bg-[#FF3B30]/15', 'alta-medio': 'bg-[#FF9500]/12', 'alta-bajo': 'bg-[#FF9500]/8', 'media-alto': 'bg-[#FF9500]/12', 'media-medio': 'bg-[#FF9500]/8', 'media-bajo': 'bg-[#34C759]/8', 'baja-alto': 'bg-[#FF9500]/8', 'baja-medio': 'bg-[#34C759]/8', 'baja-bajo': 'bg-[#34C759]/5' }

    return (
      <div>
        <div className="flex"><div className="flex flex-col items-center justify-center mr-2"><span className="text-[7px] font-bold text-[#8E8E93] uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">Probabilidad</span></div>
        <div className="flex-1"><div className="grid grid-cols-[50px_1fr_1fr_1fr] gap-0">
          <div />{IMPACT_LEVELS.map(i => <div key={i} className="text-center pb-1"><span className="text-[8px] font-semibold text-[#8E8E93] uppercase">{i}</span></div>)}
          {PROB_LEVELS.map(p => (<>
            <div key={`l-${p}`} className="flex items-center pr-2"><span className="text-[8px] font-semibold text-[#8E8E93] uppercase">{p}</span></div>
            {IMPACT_LEVELS.map(i => { const k = `${p}-${i}`; const its = grid[k] || []; return (
              <div key={k} className={`min-h-[80px] border border-[#E5E5EA]/40 dark:border-[#3A3A3C]/40 rounded-lg p-1.5 m-0.5 ${CELL_BG[k] || ''}`}>
                <div className="flex flex-wrap gap-1">{its.map(r => {
                  const tm = TYPE_META[r.type] || TYPE_META.riesgo
                  return <button key={r.id} onClick={() => setDetail(r)} title={r.title} className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-sm hover:scale-125 transition-transform" style={{ background: tm.color }}>{(r.title || '?')[0]?.toUpperCase()}</button>
                })}</div>
                {its.length === 0 && <span className="text-[8px] text-[#C7C7CC] block text-center mt-6">—</span>}
                {its.length > 0 && <span className="text-[7px] text-[#8E8E93] block text-center mt-1">{its.length}</span>}
              </div>
            ) })}
          </>))}
        </div>
        <div className="text-center mt-1"><span className="text-[7px] font-bold text-[#8E8E93] uppercase tracking-widest">Impacto</span></div>
        </div></div>
        <div className="flex gap-3 mt-3 text-[8px] text-[#8E8E93]">
          {Object.entries(TYPE_META).filter(([k]) => k !== 'oportunidad').map(([, m]) => <span key={m.label} className="flex items-center gap-1"><div className="w-3 h-3 rounded-full" style={{ background: m.color }} />{m.label}</span>)}
        </div>
      </div>
    )
  }

  // ═══ TRATAMIENTO VIEW (board) ═══
  const renderTratamiento = () => {
    const cols = [
      { id: 'new', label: 'Nuevos', items: open.filter(r => ['identificado', 'abierto', 'detectada'].includes(r.status)) },
      { id: 'analysis', label: 'En análisis', items: open.filter(r => ['analizado', 'contenido', 'evaluada'].includes(r.status)) },
      { id: 'treatment', label: 'En tratamiento', items: open.filter(r => ['mitigando', 'en_resolucion', 'aprobada', 'en_explotacion', 'monitorizando'].includes(r.status)) },
      { id: 'escalated', label: 'Escalados', items: open.filter(r => r.status === 'escalado' || (r.escalation?.level && r.escalation.level !== 'equipo')) },
      { id: 'closed', label: 'Cerrados', items: risks.filter(r => ['cerrado', 'resuelto', 'validado', 'capturada', 'descartada'].includes(r.status)).slice(0, 10) },
    ]
    return (
      <div className="flex gap-2 overflow-x-auto pb-2" style={{ minHeight: 200 }}>
        {cols.map(col => (
          <div key={col.id} className="flex-shrink-0 w-52"
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-[#007AFF]/30') }}
            onDragLeave={e => e.currentTarget.classList.remove('ring-2', 'ring-[#007AFF]/30')}
            onDrop={e => {
              e.currentTarget.classList.remove('ring-2', 'ring-[#007AFF]/30')
              const rid = e.dataTransfer.getData('text/plain')
              if (!rid) return
              const r = risks.find(x => x.id === rid)
              if (!r) return
              const sts = statusesFor(r.type)
              const newStatus = col.id === 'new' ? sts[0]! : col.id === 'analysis' ? sts[1]! : col.id === 'treatment' ? sts[2]! : col.id === 'escalated' ? 'escalado' : 'cerrado'
              onUpdate(risks.map(x => x.id === rid ? { ...x, status: newStatus } : x))
              soundDrop()
            }}>
            <div className="flex items-center gap-1 mb-1.5 px-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#8E8E93]">{col.label}</span>
              <span className="text-[8px] text-[#C7C7CC] bg-[#F2F2F7] dark:bg-[#3A3A3C] px-1 py-0.5 rounded-full">{col.items.length}</span>
            </div>
            <div className="bg-[#F2F2F7]/50 dark:bg-[#2C2C2E]/50 rounded-xl p-1 space-y-1 min-h-[60px]">
              {col.items.map(r => {
                const tm = TYPE_META[r.type] || TYPE_META.riesgo
                return (
                  <div key={r.id} draggable onDragStart={e => e.dataTransfer.setData('text/plain', r.id)}
                    onClick={() => setDetail(r)}
                    className="rounded-lg border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] p-2 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-1 mb-0.5">
                      <tm.icon className="w-2.5 h-2.5" style={{ color: tm.color }} />
                      <span className="text-[9px] font-medium dark:text-[#F5F5F7] flex-1 truncate">{r.title}</span>
                    </div>
                    <div className="flex gap-1 text-[7px]">
                      {r.prob && r.impact && <span className="font-bold" style={{ color: critColor(criticality(r.prob, r.impact)) }}>{critLabel(criticality(r.prob, r.impact))}</span>}
                      {r.owner && <span className="text-[#8E8E93]">{r.owner.split(' ')[0]}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ═══ DETAIL DRAWER ═══
  const renderDetail = () => {
    if (!detail) return null
    const tm = TYPE_META[detail.type] || TYPE_META.riesgo
    const sts = statusesFor(detail.type)
    const crit = criticality(detail.prob, detail.impact)
    // const comments = detail.comments || []

    return (
      <div className="w-80 flex-shrink-0 border-l border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] ml-3 rounded-lg overflow-y-auto" style={{ maxHeight: 600 }}>
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <tm.icon className="w-3.5 h-3.5" style={{ color: tm.color }} />
                <span className="text-[8px] font-bold uppercase" style={{ color: tm.color }}>{tm.label}</span>
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: critColor(crit) + '15', color: critColor(crit) }}>{critLabel(crit)}</span>
              </div>
              <input value={detail.title} onChange={e => save({ ...detail, title: e.target.value })}
                className="text-sm font-semibold dark:text-[#F5F5F7] bg-transparent outline-none w-full" />
            </div>
            <button onClick={() => setDetail(null)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-[#F2F2F7] dark:hover:bg-[#3A3A3C]"><X className="w-3 h-3 text-[#8E8E93]" /></button>
          </div>

          {/* Status flow */}
          <div>
            <label className="text-[7px] font-bold text-[#8E8E93] uppercase">Estado</label>
            <div className="flex gap-0.5 flex-wrap mt-0.5">
              {sts.map(s => (
                <button key={s} onClick={() => save({ ...detail, status: s })}
                  className={`px-1.5 py-0.5 rounded text-[7px] font-semibold transition-colors ${detail.status === s ? 'text-white' : 'bg-[#F2F2F7] dark:bg-[#3A3A3C] text-[#8E8E93]'}`}
                  style={detail.status === s ? { background: tm.color } : undefined}>
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Evaluation */}
          {detail.type !== 'oportunidad' && (
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[7px] font-bold text-[#8E8E93] uppercase">Probabilidad</label>
                <select value={detail.prob || 'media'} onChange={e => save({ ...detail, prob: e.target.value })} className="w-full rounded border border-[#E5E5EA] dark:border-[#3A3A3C] px-1.5 py-1 text-[9px] outline-none bg-white dark:bg-[#2C2C2E] dark:text-[#F5F5F7]">
                  {PROB_LEVELS.map(p => <option key={p} value={p}>{p}</option>)}
                </select></div>
              <div><label className="text-[7px] font-bold text-[#8E8E93] uppercase">Impacto</label>
                <select value={detail.impact || 'medio'} onChange={e => save({ ...detail, impact: e.target.value })} className="w-full rounded border border-[#E5E5EA] dark:border-[#3A3A3C] px-1.5 py-1 text-[9px] outline-none bg-white dark:bg-[#2C2C2E] dark:text-[#F5F5F7]">
                  {IMPACT_LEVELS.map(i => <option key={i} value={i}>{i}</option>)}
                </select></div>
            </div>
          )}

          {/* Owner + Date */}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[7px] font-bold text-[#8E8E93] uppercase">Responsable</label>
              <input value={detail.owner || ''} onChange={e => save({ ...detail, owner: e.target.value })} className="w-full rounded border border-[#E5E5EA] dark:border-[#3A3A3C] px-1.5 py-1 text-[9px] outline-none dark:bg-[#2C2C2E] dark:text-[#F5F5F7]" /></div>
            <div><label className="text-[7px] font-bold text-[#8E8E93] uppercase">Fecha objetivo</label>
              <input type="date" value={detail.targetDate || ''} onChange={e => save({ ...detail, targetDate: e.target.value })} className="w-full rounded border border-[#E5E5EA] dark:border-[#3A3A3C] px-1.5 py-1 text-[9px] outline-none dark:bg-[#2C2C2E] dark:text-[#F5F5F7]" /></div>
          </div>

          {/* Impact areas */}
          <div>
            <label className="text-[7px] font-bold text-[#8E8E93] uppercase">Áreas de impacto</label>
            <div className="flex gap-1 flex-wrap mt-0.5">
              {IMPACT_AREAS.map(a => (
                <button key={a} onClick={() => { const curr = detail.impactAreas || []; save({ ...detail, impactAreas: curr.includes(a) ? curr.filter(x => x !== a) : [...curr, a] }) }}
                  className={`px-1.5 py-0.5 rounded text-[7px] font-semibold ${(detail.impactAreas || []).includes(a) ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] dark:bg-[#3A3A3C] text-[#8E8E93]'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Description — rich editor */}
          <div>
            <label className="text-[7px] font-bold text-[#8E8E93] uppercase">Descripción</label>
            <RichEditor value={detail.description || ''} onChange={v => save({ ...detail, description: v })} placeholder="Describe el riesgo/problema/oportunidad..." minHeight={60} />
          </div>

          {/* Type-specific fields */}
          {detail.type === 'riesgo' && (
            <div className="space-y-2">
              <div><label className="text-[7px] font-bold text-[#8E8E93] uppercase">Mitigación</label>
                <RichEditor value={detail.mitigation || ''} onChange={v => save({ ...detail, mitigation: v })} placeholder="Acciones de mitigación..." minHeight={40} /></div>
              <div><label className="text-[7px] font-bold text-[#8E8E93] uppercase">Contingencia</label>
                <RichEditor value={detail.contingency || ''} onChange={v => save({ ...detail, contingency: v })} placeholder="Plan de contingencia..." minHeight={40} /></div>
            </div>
          )}
          {detail.type === 'problema' && (
            <div className="space-y-2">
              <div><label className="text-[7px] font-bold text-[#8E8E93] uppercase">Causa raíz</label>
                <RichEditor value={detail.rootCause || ''} onChange={v => save({ ...detail, rootCause: v })} placeholder="Causa raíz del problema..." minHeight={40} /></div>
              <div><label className="text-[7px] font-bold text-[#8E8E93] uppercase">Resolución</label>
                <RichEditor value={detail.resolution || ''} onChange={v => save({ ...detail, resolution: v })} placeholder="Cómo se resolvió o se está resolviendo..." minHeight={40} /></div>
            </div>
          )}

          {/* Escalation workflow */}
          <div>
            <label className="text-[7px] font-bold text-[#8E8E93] uppercase">Escalado</label>
            <div className="flex gap-0.5 flex-wrap mt-0.5">
              {ESC_LEVELS.map(l => (
                <button key={l} onClick={() => save({ ...detail, escalation: { ...detail.escalation, level: l, by: currentUser, date: new Date().toISOString() } })}
                  className={`px-1.5 py-0.5 rounded text-[7px] font-semibold ${(detail.escalation?.level || 'equipo') === l ? 'bg-[#FF3B30] text-white' : 'bg-[#F2F2F7] dark:bg-[#3A3A3C] text-[#8E8E93]'}`}>
                  {ESC_LABELS[l]}
                </button>
              ))}
            </div>
            {detail.escalation?.level && detail.escalation.level !== 'equipo' && (
              <div className="text-[8px] text-[#8E8E93] mt-1">Escalado por {detail.escalation.by} · {detail.escalation.date ? fmtDate(detail.escalation.date) : ''}</div>
            )}
          </div>

          {/* Linked items */}
          <div>
            <label className="text-[7px] font-bold text-[#8E8E93] uppercase">Items vinculados</label>
            {(detail.linkedItems || []).map(lid => {
              const item = items.find(i => i.id === lid)
              return item ? <div key={lid} className="flex items-center gap-1 text-[9px] dark:text-[#F5F5F7]"><CheckCircle2 className="w-2.5 h-2.5 text-[#007AFF]" />{item.text}<button onClick={() => save({ ...detail, linkedItems: (detail.linkedItems || []).filter(x => x !== lid) })} className="text-[#C7C7CC] hover:text-[#FF3B30]"><X className="w-2 h-2" /></button></div> : null
            })}
            <select value="" onChange={e => { if (e.target.value) save({ ...detail, linkedItems: [...(detail.linkedItems || []), e.target.value] }); e.target.value = '' }} className="w-full rounded border border-dashed border-[#E5E5EA] dark:border-[#3A3A3C] px-1.5 py-1 text-[8px] outline-none bg-white dark:bg-[#2C2C2E] dark:text-[#F5F5F7] mt-1">
              <option value="">+ Vincular item...</option>
              {items.filter(i => !(detail.linkedItems || []).includes(i.id)).map(i => <option key={i.id} value={i.id}>{i.text}</option>)}
            </select>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-[#F2F2F7] dark:border-[#3A3A3C] flex gap-1">
            <button onClick={() => remove(detail.id)} className="flex-1 py-1 rounded text-[8px] font-semibold text-[#FF3B30] bg-[#FF3B30]/5 hover:bg-[#FF3B30]/10">Eliminar</button>
            <button onClick={() => setDetail(null)} className="flex-1 py-1 rounded text-[8px] font-semibold text-[#8E8E93] bg-[#F2F2F7] dark:bg-[#3A3A3C]">Cerrar</button>
          </div>
        </div>
      </div>
    )
  }

  // ═══ CREATE MODAL ═══
  const renderCreate = () => (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowCreate(false)}>
      <div className="bg-white dark:bg-[#2C2C2E] rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold dark:text-[#F5F5F7] mb-3">Nuevo registro</h3>
        <div className="flex gap-1 mb-3">
          {(['riesgo', 'problema', 'oportunidad'] as const).map(t => (
            <button key={t} onClick={() => setCreateType(t)} className={`flex-1 py-2 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 ${createType === t ? 'text-white' : 'bg-[#F2F2F7] dark:bg-[#3A3A3C] text-[#8E8E93]'}`} style={createType === t ? { background: TYPE_META[t].color } : undefined}>
              {React.createElement(TYPE_META[t].icon, { className: 'w-3 h-3' })} {TYPE_META[t].label}
            </button>
          ))}
        </div>
        <input id="new-risk-title" placeholder="Título..." className="w-full rounded-lg border border-[#E5E5EA] dark:border-[#3A3A3C] px-3 py-2 text-xs outline-none mb-2 dark:bg-[#1C1C1E] dark:text-[#F5F5F7]"
          onKeyDown={e => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); if (v) add({ id: uid(), title: v, type: createType, status: statusesFor(createType)[0]!, prob: 'media', impact: 'medio', owner: '', createdAt: new Date().toISOString() }) } }} />
        <button onClick={() => { const el = document.getElementById('new-risk-title') as HTMLInputElement; const v = el?.value.trim(); if (v) add({ id: uid(), title: v, type: createType, status: statusesFor(createType)[0]!, prob: 'media', impact: 'medio', owner: '', createdAt: new Date().toISOString() }) }}
          className="w-full py-2 rounded-lg text-xs font-semibold text-white" style={{ background: TYPE_META[createType].color }}>Crear {TYPE_META[createType].label.toLowerCase()}</button>
      </div>
    </div>
  )

  return (
    <div className="flex gap-0">
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex gap-0.5 bg-[#F2F2F7] dark:bg-[#3A3A3C] rounded-lg overflow-hidden">
            {([
              { id: 'resumen' as View, label: 'Resumen' },
              { id: 'registro' as View, label: 'Registro' },
              { id: 'heatmap' as View, label: 'Heatmap' },
              { id: 'tratamiento' as View, label: 'Tratamiento' },
            ]).map(v => (
              <button key={v.id} onClick={() => setView(v.id)} className={`px-2.5 py-1 text-[9px] font-semibold ${view === v.id ? 'bg-[#007AFF] text-white' : 'text-[#8E8E93]'}`}>{v.label}</button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => { import('@/lib/exports').then(({ exportRisksPDF }) => exportRisksPDF('Proyecto', risks.map(r => ({ title: r.title, type: r.type, status: r.status, prob: r.prob, impact: r.impact, owner: r.owner })))) }} className="px-2.5 py-1.5 rounded-lg border border-[#E5E5EA] dark:border-[#3A3A3C] text-[10px] font-semibold text-[#8E8E93] flex items-center gap-1 hover:bg-[#F2F2F7] dark:hover:bg-[#3A3A3C]"><Download className="w-3 h-3" /> PDF</button>
            <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 rounded-lg bg-[#FF9500] text-white text-[10px] font-semibold flex items-center gap-1"><Plus className="w-3 h-3" /> Nuevo</button>
          </div>
        </div>

        {view === 'resumen' && renderResumen()}
        {view === 'registro' && renderRegistro()}
        {view === 'heatmap' && renderHeatmap()}
        {view === 'tratamiento' && renderTratamiento()}
      </div>

      {renderDetail()}
      {showCreate && renderCreate()}
    </div>
  )
}

// ── Risk row component ──
function RiskRow({ r, onClick, compact, showEscalation }: { r: Risk; onClick: () => void; compact?: boolean; showEscalation?: boolean }) {
  const tm = TYPE_META[r.type] || TYPE_META.riesgo
  const crit = criticality(r.prob, r.impact)
  return (
    <div onClick={onClick} className="flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer hover:bg-[#F2F2F7] dark:hover:bg-[#3A3A3C]/50 transition-colors border-b border-[#F2F2F7]/50 dark:border-[#2C2C2E]/50 last:border-0">
      <tm.icon className="w-3 h-3 flex-shrink-0" style={{ color: tm.color }} />
      <span className={`flex-1 truncate dark:text-[#F5F5F7] ${compact ? 'text-[9px]' : 'text-[10px] font-medium'}`}>{r.title}</span>
      {!compact && r.prob && r.impact && <span className="text-[7px] font-bold px-1 py-0.5 rounded" style={{ background: critColor(crit) + '15', color: critColor(crit) }}>{critLabel(crit)}</span>}
      {!compact && <span className="text-[7px] text-[#8E8E93] capitalize">{r.status.replace('_', ' ')}</span>}
      {showEscalation && r.escalation?.level && r.escalation.level !== 'equipo' && <span className="text-[6px] font-bold text-[#FF3B30] bg-[#FF3B30]/10 px-1 py-0.5 rounded">ESC:{ESC_LABELS[r.escalation.level]?.slice(0, 3)}</span>}
      {r.owner && <span className="text-[7px] text-[#8E8E93]">{r.owner.split(' ')[0]}</span>}
    </div>
  )
}
