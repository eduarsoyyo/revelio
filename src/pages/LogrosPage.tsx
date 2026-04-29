import { useEffect, useState, useMemo } from 'react'
import { Trophy } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/data/supabase'
import { BADGES, TIERS, checkBadges, housePoints } from '@/domain/gamification'

export function LogrosPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ retrosCompleted: 0, risksIdentified: 0, itemsCompleted: 0, notesCreated: 0, consecutiveGoodRetros: 0, hadPerfectRetro: false, outstandingCount: 0, allActionsOnTime: false })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    supabase.from('retros').select('sala, data, status').then(({ data: retR }) => {
      let retrosCompleted = 0, risksIdentified = 0, itemsCompleted = 0, notesCreated = 0
      ;(retR || []).forEach((r: { data: Record<string, unknown>; status: string }) => {
        if (r.status === 'closed') retrosCompleted++
        const d = r.data || {}
        itemsCompleted += ((d.actions || []) as Array<Record<string, unknown>>).filter(a => a.status === 'done' && a.owner === user.name).length
        risksIdentified += ((d.risks || []) as Array<Record<string, unknown>>).length
        notesCreated += ((d.notes || d.positives || []) as unknown[]).length
      })
      setStats({ retrosCompleted, risksIdentified, itemsCompleted, notesCreated, consecutiveGoodRetros: 0, hadPerfectRetro: false, outstandingCount: 0, allActionsOnTime: false })
      setLoading(false)
    })
  }, [user])

  const earned = useMemo(() => checkBadges(stats), [stats])
  const points = useMemo(() => housePoints(earned.length * 10), [earned])

  if (loading) return <div className="text-sm text-revelio-subtle text-center py-20">Cargando logros...</div>

  return (
    <div className="max-w-3xl">
      <h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text mb-1 flex items-center gap-2"><Trophy className="w-5 h-5 text-[#FFD700]" /> Logros Hogwarts</h2>
      <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mb-6">{earned.length} de {BADGES.length} logros desbloqueados · {points} puntos para tu casa</p>

      {/* Tiers */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {Object.entries(TIERS).map(([id, t]) => {
          const active = earned.length * 10 >= t.min
          return (
            <div key={id} className={`rounded-xl px-4 py-3 text-center flex-shrink-0 border ${active ? 'border-[#FFD700]/30 bg-[#FFD700]/5' : 'border-revelio-border dark:border-revelio-dark-border opacity-40'}`}>
              <span className="text-2xl block mb-1">{t.emoji}</span>
              <p className="text-[9px] font-semibold" style={{ color: t.color }}>{t.label}</p>
              <p className="text-[7px] text-revelio-subtle">{t.min}+ pts</p>
            </div>
          )
        })}
      </div>

      {/* Badges grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {BADGES.map(b => {
          const has = earned.includes(b.id)
          return (
            <div key={b.id} className={`rounded-xl p-4 text-center transition-all border ${has ? 'border-[#FFD700]/20 bg-[#FFD700]/5 shadow-sm' : 'border-revelio-border dark:border-revelio-dark-border bg-revelio-bg dark:bg-revelio-dark-border opacity-40'}`}>
              <span className="text-3xl block mb-2">{b.emoji}</span>
              <p className={`text-[10px] font-semibold ${has ? 'dark:text-revelio-dark-text' : 'text-revelio-subtle'}`}>{b.label}</p>
              <p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle mt-1">{b.desc}</p>
              {has && <p className="text-[7px] font-bold text-[#FFD700] mt-1">Desbloqueado</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
