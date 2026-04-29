import { useEffect, useState } from 'react'
import { AlertTriangle, Shield, Users, TrendingUp, ChevronRight, Zap, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/data/supabase'
import { analyzeProject, analyzeCapacity, computeProjectKPIs, type Alert, type CapacityAlert, type ProjectKPI } from '@/domain/intelligence'

const SEV_COLOR = { critical: '#FF3B30', warning: '#FF9500', info: '#007AFF' }
const SEV_LABEL = { critical: 'Crítica', warning: 'Atención', info: 'Info' }

export function IntelligencePanel({ userId }: { userId?: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [capAlerts, setCapAlerts] = useState<CapacityAlert[]>([])
  const [kpis, setKpis] = useState<ProjectKPI[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    Promise.all([
      supabase.from('rooms').select('slug, name'),
      supabase.from('retros').select('sala, data').eq('status', 'active'),
      supabase.from('team_members').select('id, name, vacations'),
      supabase.from('org_chart').select('member_id, sala, dedication'),
    ]).then(([rR, retR, mR, oR]) => {
      const rooms = (rR.data || []) as Array<{ slug: string; name: string }>
      const retros = (retR.data || []) as Array<{ sala: string; data: Record<string, unknown> }>
      const team = (mR.data || []) as Array<{ id: string; name: string; vacations?: Array<{ from: string; to?: string }> }>
      const org = (oR.data || []) as Array<{ member_id: string; sala: string; dedication: number }>

      const allAlerts: Alert[] = []
      const allKpis: ProjectKPI[] = []

      rooms.forEach(room => {
        const retro = retros.find(r => r.sala === room.slug)
        const data = retro?.data || {}
        const items = ((data.actions || []) as Array<Record<string, string>>).map(a => ({ id: a.id || '', text: a.text || '', status: a.status || '', date: a.date, owner: a.owner, type: a.type, startDate: a.startDate, createdAt: a.createdAt, baselineEnd: a.baselineEnd }))
        const risks = ((data.risks || []) as Array<Record<string, unknown>>).map(r => ({ id: String(r.id || ''), title: String(r.title || r.text || ''), status: String(r.status || ''), prob: r.prob as string, impact: r.impact as string, escalation: r.escalation as { level?: string } }))

        allAlerts.push(...analyzeProject(room.slug, items, risks, today))
        allKpis.push(computeProjectKPIs(room.slug, room.name, items, risks, today))
      })

      const allItems = retros.flatMap(r => ((r.data?.actions || []) as Array<Record<string, string>>).map(a => ({ id: a.id || '', text: a.text || '', status: a.status || '', date: a.date, owner: a.owner, type: a.type })))
      const capacity = analyzeCapacity(team, org, allItems, today)

      setAlerts(allAlerts)
      setCapAlerts(capacity)
      setKpis(allKpis)
      setLoading(false)
    })
  }, [userId])

  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const warningCount = alerts.filter(a => a.severity === 'warning').length

  if (loading) return <div className="text-[10px] text-[#8E8E93] text-center py-6">Analizando proyectos...</div>

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiCard icon={AlertTriangle} color={criticalCount > 0 ? '#FF3B30' : '#34C759'} value={criticalCount} label="Alertas críticas" />
        <KpiCard icon={Shield} color={warningCount > 0 ? '#FF9500' : '#34C759'} value={warningCount} label="Atención" />
        <KpiCard icon={Users} color={capAlerts.filter(c => c.severity === 'critical').length > 0 ? '#FF3B30' : '#34C759'} value={capAlerts.length} label="Capacidad" />
        <KpiCard icon={TrendingUp} color="#007AFF" value={kpis.length} label="Proyectos" />
      </div>

      {/* Project health matrix */}
      <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
        <h4 className="text-[10px] font-semibold dark:text-revelio-dark-text flex items-center gap-1 mb-3"><Target className="w-3 h-3 text-revelio-blue" /> Salud de proyectos</h4>
        <div className="space-y-2">
          {kpis.sort((a, b) => a.health - b.health).map(k => {
            const hc = k.health >= 75 ? '#34C759' : k.health >= 50 ? '#FF9500' : '#FF3B30'
            return (
              <Link key={k.slug} to={`/project/${k.slug}`} className="flex items-center gap-3 py-1.5 hover:bg-revelio-bg/30 dark:hover:bg-revelio-dark-border/20 rounded-lg px-2 transition-colors">
                <div className="relative w-9 h-9 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="#F2F2F7" strokeWidth="2.5" className="dark:stroke-[#3A3A3C]" /><circle cx="18" cy="18" r="15" fill="none" stroke={hc} strokeWidth="2.5" strokeDasharray={`${k.health} ${100 - k.health}`} strokeLinecap="round" /></svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold" style={{ color: hc }}>{k.health}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium dark:text-revelio-dark-text">{k.name}</p>
                  <div className="flex gap-2 text-[8px] text-[#8E8E93]">
                    <span>{k.pctDone}% hecho</span>
                    {k.overdue > 0 && <span className="text-[#FF3B30]">{k.overdue} vencidos</span>}
                    {k.blocked > 0 && <span className="text-[#FF3B30]">{k.blocked} bloq.</span>}
                    {k.risks > 0 && <span className="text-[#FF9500]">{k.risks} riesgos</span>}
                  </div>
                </div>
                {k.alerts > 0 && <span className="text-[8px] font-bold text-[#FF3B30] bg-[#FF3B30]/10 px-1.5 py-0.5 rounded-full">{k.alerts}</span>}
                <ChevronRight className="w-3 h-3 text-[#C7C7CC]" />
              </Link>
            )
          })}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
          <h4 className="text-[10px] font-semibold dark:text-revelio-dark-text flex items-center gap-1 mb-3"><Zap className="w-3 h-3 text-[#FF9500]" /> Alertas automáticas ({alerts.length})</h4>
          <div className="space-y-1">
            {alerts.slice(0, 10).map(a => (
              <div key={a.id} className="flex items-start gap-2 py-1.5 border-b border-[#F2F2F7] dark:border-[#2C2C2E] last:border-0">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: SEV_COLOR[a.severity] }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium dark:text-revelio-dark-text">{a.title}</p>
                  <p className="text-[8px] text-[#8E8E93]">{a.detail}</p>
                </div>
                <span className="text-[7px] font-bold px-1 py-0.5 rounded flex-shrink-0" style={{ background: SEV_COLOR[a.severity] + '15', color: SEV_COLOR[a.severity] }}>{a.project}</span>
              </div>
            ))}
            {alerts.length > 10 && <p className="text-[8px] text-[#8E8E93] text-center pt-1">+{alerts.length - 10} alertas más</p>}
          </div>
        </div>
      )}

      {/* Capacity alerts */}
      {capAlerts.length > 0 && (
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
          <h4 className="text-[10px] font-semibold dark:text-revelio-dark-text flex items-center gap-1 mb-3"><Users className="w-3 h-3 text-[#5856D6]" /> Capacidad del equipo</h4>
          <div className="space-y-1">
            {capAlerts.map(c => (
              <div key={`${c.memberId}-${c.type}`} className="flex items-start gap-2 py-1.5 border-b border-[#F2F2F7] dark:border-[#2C2C2E] last:border-0">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: SEV_COLOR[c.severity] }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium dark:text-revelio-dark-text">{c.memberName}</p>
                  <p className="text-[8px] text-[#8E8E93]">{c.detail}</p>
                </div>
                <span className="text-[7px] font-bold px-1 py-0.5 rounded flex-shrink-0" style={{ background: SEV_COLOR[c.severity] + '15', color: SEV_COLOR[c.severity] }}>{SEV_LABEL[c.severity]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && capAlerts.length === 0 && (
        <div className="text-center py-6 rounded-card border border-revelio-green/20 bg-revelio-green/5">
          <Shield className="w-6 h-6 text-revelio-green mx-auto mb-1" />
          <p className="text-xs font-semibold text-revelio-green">Todo en orden</p>
          <p className="text-[9px] text-[#8E8E93]">Sin alertas detectadas en ningún proyecto</p>
        </div>
      )}
    </div>
  )
}

function KpiCard({ icon: Icon, color, value, label }: { icon: typeof AlertTriangle; color: string; value: number; label: string }) {
  return (
    <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3">
      <Icon className="w-4 h-4 mb-1" style={{ color }} />
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
      <p className="text-[7px] text-[#8E8E93] uppercase tracking-wide">{label}</p>
    </div>
  )
}
