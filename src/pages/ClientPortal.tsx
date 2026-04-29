import { useEffect, useState } from 'react'
import { Target, CheckCircle2, Clock, AlertTriangle, Shield } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/data/supabase'

interface Action { id: string; text: string; status: string; date: string; type?: string; owner?: string }
interface Risk { id: string; title: string; text?: string; type: string; status: string; prob?: string; impact?: string; escalation?: { level?: string } }

export function ClientPortal() {
  const { slug } = useParams()
  const [room, setRoom] = useState<{ name: string; tipo: string } | null>(null)
  const [actions, setActions] = useState<Action[]>([])
  const [risks, setRisks] = useState<Risk[]>([])
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!slug) return
    Promise.all([
      supabase.from('rooms').select('name, tipo').eq('slug', slug).single(),
      supabase.from('retros').select('data').eq('sala', slug).eq('status', 'active').single(),
    ]).then(([rR, retR]) => {
      if (rR.data) setRoom(rR.data as { name: string; tipo: string })
      if (retR.data?.data) {
        const d = retR.data.data as Record<string, unknown>
        setActions((d.actions || []) as Action[])
        setRisks((d.risks || []) as Risk[])
      }
      setLoading(false)
    })
  }, [slug])

  if (loading) return <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center"><p className="text-sm text-[#8E8E93]">Cargando...</p></div>
  if (!room) return <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center"><p className="text-sm text-[#FF3B30]">Proyecto no encontrado</p></div>

  const milestones = actions.filter(a => (a.type || '') === 'hito')
  const items = actions.filter(a => a.status !== 'discarded' && a.status !== 'cancelled' && (a.type || '') !== 'epica')
  const done = items.filter(a => a.status === 'done' || a.status === 'archived')
  const pctDone = items.length > 0 ? Math.round(done.length / items.length * 100) : 0
  const overdue = items.filter(a => a.date && a.date < today && a.status !== 'done' && a.status !== 'archived').length
  const openRisks = risks.filter(r => r.status !== 'cerrado' && r.status !== 'mitigated')
  const escalated = openRisks.filter(r => r.escalation?.level && r.escalation.level !== 'equipo')

  const healthScore = Math.max(0, Math.min(100, 100 - overdue * 3 - escalated.length * 8))
  const healthColor = healthScore >= 75 ? '#34C759' : healthScore >= 50 ? '#FF9500' : '#FF3B30'

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E5EA] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#8E8E93] uppercase tracking-wider font-semibold">Portal de seguimiento</p>
            <h1 className="text-xl font-bold text-[#1D1D1F]">{room.name}</h1>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[#8E8E93]">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="text-[10px] text-[#007AFF] font-semibold mt-0.5">revelio</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <div className="relative w-14 h-14 mx-auto mb-2">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90"><circle cx="18" cy="18" r="15.5" fill="none" stroke="#F2F2F7" strokeWidth="3" /><circle cx="18" cy="18" r="15.5" fill="none" stroke={healthColor} strokeWidth="3" strokeDasharray={`${healthScore} ${100 - healthScore}`} strokeLinecap="round" /></svg>
              <div className="absolute inset-0 flex items-center justify-center"><span className="text-lg font-bold" style={{ color: healthColor }}>{healthScore}</span></div>
            </div>
            <p className="text-[9px] text-[#8E8E93] uppercase text-center">Salud</p>
          </Card>
          <Card><CheckCircle2 className="w-5 h-5 text-[#34C759] mx-auto mb-1" /><p className="text-2xl font-bold text-center text-[#34C759]">{pctDone}%</p><p className="text-[9px] text-[#8E8E93] uppercase text-center">Progreso</p></Card>
          <Card><Clock className="w-5 h-5 mx-auto mb-1" style={{ color: overdue > 0 ? '#FF3B30' : '#34C759' }} /><p className="text-2xl font-bold text-center" style={{ color: overdue > 0 ? '#FF3B30' : '#34C759' }}>{overdue}</p><p className="text-[9px] text-[#8E8E93] uppercase text-center">Vencidos</p></Card>
          <Card><AlertTriangle className="w-5 h-5 mx-auto mb-1" style={{ color: openRisks.length > 0 ? '#FF9500' : '#34C759' }} /><p className="text-2xl font-bold text-center" style={{ color: openRisks.length > 0 ? '#FF9500' : '#34C759' }}>{openRisks.length}</p><p className="text-[9px] text-[#8E8E93] uppercase text-center">Riesgos</p></Card>
        </div>

        {/* Progress bar */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-[#1D1D1F]">Progreso general</h3>
            <span className="text-xs font-bold" style={{ color: pctDone >= 70 ? '#34C759' : pctDone >= 40 ? '#FF9500' : '#FF3B30' }}>{pctDone}%</span>
          </div>
          <div className="h-2.5 bg-[#F2F2F7] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pctDone}%`, background: pctDone >= 70 ? '#34C759' : pctDone >= 40 ? '#FF9500' : '#FF3B30' }} />
          </div>
          <div className="flex gap-4 mt-2 text-[10px] text-[#8E8E93]">
            <span>{done.length} completados</span>
            <span>{items.length - done.length} pendientes</span>
            <span>{items.length} total</span>
          </div>
        </Card>

        {/* Milestones */}
        <Card>
          <h3 className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5 mb-3"><Target className="w-4 h-4 text-[#FF9500]" /> Hitos del proyecto</h3>
          {milestones.length > 0 ? (
            <div className="space-y-2">
              {[...milestones].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(m => {
                const isDone = m.status === 'done'
                const isOv = !isDone && m.date && m.date < today
                const dLeft = m.date ? Math.round((new Date(m.date).getTime() - new Date(today).getTime()) / 86400000) : 0
                return (
                  <div key={m.id} className="flex items-center gap-3 py-2 border-b border-[#F2F2F7] last:border-0">
                    <div className="w-3 h-3 rotate-45 flex-shrink-0" style={{ background: isDone ? '#34C759' : isOv ? '#FF3B30' : '#FF9500' }} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${isDone ? 'line-through text-[#8E8E93]' : 'text-[#1D1D1F]'}`}>{m.text}</p>
                      {m.owner && <p className="text-[9px] text-[#8E8E93]">{m.owner}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[#8E8E93]">{m.date ? new Date(m.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                      <p className={`text-[9px] font-semibold ${isDone ? 'text-[#34C759]' : isOv ? 'text-[#FF3B30]' : dLeft <= 7 ? 'text-[#FF9500]' : 'text-[#8E8E93]'}`}>
                        {isDone ? 'Completado' : isOv ? `${Math.abs(dLeft)}d tarde` : dLeft === 0 ? 'Hoy' : `en ${dLeft}d`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : <p className="text-[10px] text-[#8E8E93] text-center py-3">Sin hitos definidos</p>}
        </Card>

        {/* Escalated risks (client-visible) */}
        {escalated.length > 0 && (
          <Card>
            <h3 className="text-xs font-semibold text-[#FF3B30] flex items-center gap-1.5 mb-3"><Shield className="w-4 h-4" /> Riesgos escalados</h3>
            {escalated.map(r => (
              <div key={r.id} className="flex items-center gap-2 py-1.5 border-b border-[#F2F2F7] last:border-0">
                <Shield className="w-3 h-3 text-[#FF3B30] flex-shrink-0" />
                <span className="text-[10px] flex-1 text-[#1D1D1F]">{r.title || r.text}</span>
                <span className="text-[8px] font-bold text-[#FF3B30] bg-[#FF3B30]/10 px-1.5 py-0.5 rounded">{r.escalation?.level?.toUpperCase()}</span>
              </div>
            ))}
          </Card>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-[9px] text-[#C7C7CC]">Generado por revelio · Vista de solo lectura para seguimiento de cliente</p>
        </div>
      </div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[#E5E5EA] bg-white p-4 shadow-sm">{children}</div>
}
