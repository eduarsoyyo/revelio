import { useEffect, useState } from 'react'
import { AlertTriangle, Shield, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/data/supabase'

interface Risk { id: string; title?: string; text?: string; status: string; prob?: string; impact?: string; owner?: string; type?: string; escalation?: { level?: string }; _sala?: string }

export function RisksOverview() {
  const { user } = useAuth()
  const [risks, setRisks] = useState<Risk[]>([])
  const [rooms, setRooms] = useState<Array<{ slug: string; name: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('retros').select('sala, data').eq('status', 'active'),
      supabase.from('rooms').select('slug, name'),
    ]).then(([retR, rR]) => {
      if (rR.data) setRooms(rR.data)
      const all: Risk[] = []
      ;(retR.data || []).forEach((r: { sala: string; data: Record<string, unknown> }) => {
        ;((r.data?.risks || []) as Risk[]).forEach(rk => { if (rk.status !== 'cerrado' && rk.status !== 'mitigated') all.push({ ...rk, _sala: r.sala }) })
      })
      setRisks(all); setLoading(false)
    })
  }, [])

  const myRisks = risks.filter(r => r.owner === user?.name)
  const escalated = risks.filter(r => r.escalation?.level && r.escalation.level !== 'equipo')
  const critical = risks.filter(r => r.prob === 'alta' && r.impact === 'alto')

  if (loading) return <div className="text-sm text-revelio-subtle text-center py-20">Cargando riesgos...</div>

  return (
    <div className="max-w-4xl">
      <h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text mb-4">Riesgos</h2>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3 text-center"><p className="text-lg font-bold text-revelio-orange">{myRisks.length}</p><p className="text-[8px] text-revelio-subtle uppercase">Mis riesgos</p></div>
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3 text-center"><p className="text-lg font-bold text-revelio-red">{escalated.length}</p><p className="text-[8px] text-revelio-subtle uppercase">Escalados</p></div>
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3 text-center"><p className="text-lg font-bold text-revelio-red">{critical.length}</p><p className="text-[8px] text-revelio-subtle uppercase">Críticos</p></div>
      </div>

      {escalated.length > 0 && <RiskSection title="Escalados" risks={escalated} rooms={rooms} color="#FF3B30" icon={Shield} />}
      {myRisks.length > 0 && <RiskSection title="Mis riesgos" risks={myRisks} rooms={rooms} color="#FF9500" icon={AlertTriangle} />}
      {critical.length > 0 && <RiskSection title="Críticos (prob alta × impacto alto)" risks={critical} rooms={rooms} color="#FF3B30" icon={AlertTriangle} />}

      {risks.length === 0 && (
        <div className="text-center py-10 rounded-card border border-revelio-green/20 bg-revelio-green/5">
          <Shield className="w-6 h-6 text-revelio-green mx-auto mb-1" />
          <p className="text-xs font-semibold text-revelio-green">Sin riesgos abiertos</p>
        </div>
      )}
    </div>
  )
}

function RiskSection({ title, risks, rooms, color, icon: Icon }: { title: string; risks: Risk[]; rooms: Array<{ slug: string; name: string }>; color: string; icon: typeof AlertTriangle }) {
  return (
    <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4 mb-4">
      <h3 className="text-[10px] font-bold text-revelio-subtle uppercase flex items-center gap-1.5 mb-2"><Icon className="w-3.5 h-3.5" style={{ color }} /> {title} ({risks.length})</h3>
      <div className="space-y-1">
        {risks.map(r => (
          <Link key={r.id} to={`/project/${r._sala}`} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-revelio-bg/50 dark:hover:bg-revelio-dark-border/30">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-[10px] flex-1 dark:text-revelio-dark-text truncate">{r.title || r.text}</span>
            <span className="text-[8px] text-revelio-subtle">{rooms.find(rm => rm.slug === r._sala)?.name}</span>
            {r.escalation?.level && <span className="text-[7px] font-bold text-revelio-red bg-revelio-red/10 px-1 py-0.5 rounded">{r.escalation.level}</span>}
            <ChevronRight className="w-3 h-3 text-revelio-border flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
