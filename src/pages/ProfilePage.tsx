import { useEffect, useState, useMemo } from 'react'
import { Trophy, Shield, ListChecks, MessageCircle, Zap, Calendar, Moon, Save, Lock, Pencil } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { supabase } from '@/data/supabase'
import { BADGES, checkBadges } from '@/domain/gamification'

const AVATARS = ['🧙', '🦊', '🐲', '🦉', '🐺', '🦅', '🐍', '🦁', '🧝', '🧛', '🧚', '🧜', '🧞', '🦄', '🐼', '🐨', '🐻', '🐶', '🐱', '🐭', '🐹', '🐰', '🦝', '🦎', '🦋', '🌟', '⚡', '🔮', '🗡️', '🏰']
const COLORS = ['#007AFF', '#5856D6', '#FF9500', '#34C759', '#FF3B30', '#AF52DE', '#FF2D55', '#00C7BE', '#5AC8FA', '#FFCC00', '#8E8E93', '#1D1D1F']

export function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [stats, setStats] = useState({ retrosCompleted: 0, risksIdentified: 0, itemsCompleted: 0, notesCreated: 0, consecutiveGoodRetros: 0, hadPerfectRetro: false, outstandingCount: 0, allActionsOnTime: false })
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [avatar, setAvatar] = useState('👤')
  const [color, setColor] = useState('#007AFF')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // Password
  const [showPw, setShowPw] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState('')

  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      supabase.from('team_members').select('*').eq('id', user.id).single(),
      supabase.from('retros').select('sala, data, status'),
    ]).then(([pR, rR]) => {
      if (pR.data) { const p = pR.data as Record<string, unknown>; setProfile(p); setAvatar(String(p.avatar || '👤')); setColor(String(p.color || '#007AFF')) }
      if (rR.data) {
        let rc = 0, ri = 0, ic = 0, nc = 0
        ;(rR.data as Array<{ data: Record<string, unknown>; status: string }>).forEach(r => {
          if (r.status === 'closed') rc++
          const d = r.data || {}
          ic += ((d.actions || []) as Array<Record<string, unknown>>).filter(a => a.status === 'done' && a.owner === user.name).length
          ri += ((d.risks || []) as Array<Record<string, unknown>>).length
          nc += ((d.notes || d.positives || []) as unknown[]).length
        })
        setStats({ retrosCompleted: rc, risksIdentified: ri, itemsCompleted: ic, notesCreated: nc, consecutiveGoodRetros: 0, hadPerfectRetro: false, outstandingCount: 0, allActionsOnTime: false })
      }
      setLoading(false)
    })
  }, [user])

  const earned = useMemo(() => checkBadges(stats), [stats])

  const saveProfile = async () => {
    if (!user?.id) return
    setSaving(true)
    await supabase.from('team_members').update({ avatar, color }).eq('id', user.id)
    setSaving(false); setSaved(true); setEditing(false); setTimeout(() => setSaved(false), 2000)
  }

  const savePw = async () => {
    if (!user?.id || newPw.length < 6) { setPwMsg('Mínimo 6 caracteres'); return }
    setPwSaving(true); setPwMsg('')
    const { error } = await supabase.rpc('update_auth_password', { target_user_id: user.id, new_password: newPw })
    setPwSaving(false)
    if (error) { setPwMsg('Error: ' + error.message); return }
    setPwMsg('Contraseña actualizada'); setNewPw(''); setShowPw(false); setTimeout(() => setPwMsg(''), 3000)
  }

  if (loading || !profile) return <div className="text-sm text-revelio-subtle text-center py-10">Cargando...</div>

  const p = profile
  const rooms = ((p.rooms || []) as string[])

  return (
    <div className="max-w-3xl">
      {/* ═══ Main card — all user info ═══ */}
      <div className="rounded-2xl border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-6 mb-4">
        <div className="flex items-start gap-4 mb-4">
          {/* Avatar — clickable to edit */}
          <button onClick={() => setEditing(!editing)} className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl relative group" style={{ background: color + '20', color }}>
            {avatar}
            <div className="absolute inset-0 rounded-2xl bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Pencil className="w-4 h-4 text-white" /></div>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold dark:text-revelio-dark-text">{String(p.name)}</h1>
            <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">{String(p.role_label || 'Sin rol')} · {String(p.company || 'ALTEN')}</p>
          </div>
          {(p.is_superuser as boolean) && <span className="text-[9px] font-bold text-revelio-violet bg-revelio-violet/10 px-2 py-1 rounded-lg">ADMIN</span>}
          {saved && <span className="text-[9px] font-bold text-revelio-green bg-revelio-green/10 px-2 py-1 rounded-lg">Guardado</span>}
        </div>

        {/* Info grid — read only */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-[10px] mb-4">
          <div><span className="text-revelio-subtle block">Usuario</span><span className="dark:text-revelio-dark-text font-medium">@{String(p.username || '')}</span></div>
          <div><span className="text-revelio-subtle block">Email</span><span className="dark:text-revelio-dark-text font-medium">{String(p.email || '—')}</span></div>
          <div><span className="text-revelio-subtle block">Empresa</span><span className="dark:text-revelio-dark-text font-medium">{String(p.company || '—')}</span></div>
          <div><span className="text-revelio-subtle block">Rol</span><span className="dark:text-revelio-dark-text font-medium">{String(p.role_label || '—')}</span></div>
          <div><span className="text-revelio-subtle block">Contrato</span><span className="dark:text-revelio-dark-text font-medium">{String(p.contract_type || '—')}</span></div>
          <div><span className="text-revelio-subtle block">Fecha alta</span><span className="dark:text-revelio-dark-text font-medium">{String(p.hire_date || '—')}</span></div>
          {p.responsable_id ? <div><span className="text-revelio-subtle block">Responsable</span><span className="dark:text-revelio-dark-text font-medium">Asignado</span></div> : null}
        </div>

        {/* Edit avatar & color — toggle */}
        {editing && (
          <div className="border-t border-revelio-border/50 dark:border-revelio-dark-border/50 pt-4 mt-2">
            <p className="text-[10px] font-semibold text-revelio-subtle uppercase mb-1">Avatar</p>
            <div className="flex gap-1 flex-wrap mb-3">{AVATARS.map(a => <button key={a} onClick={() => setAvatar(a)} className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center ${avatar === a ? 'ring-2 ring-revelio-blue bg-revelio-blue/10' : 'hover:bg-revelio-bg dark:hover:bg-revelio-dark-border'}`}>{a}</button>)}</div>
            <p className="text-[10px] font-semibold text-revelio-subtle uppercase mb-1">Color</p>
            <div className="flex gap-1.5 flex-wrap mb-3">{COLORS.map(c => <button key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-revelio-blue' : ''}`} style={{ background: c }} />)}</div>
            <button onClick={saveProfile} disabled={saving} className="px-4 py-2 rounded-lg bg-revelio-blue text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"><Save className="w-3 h-3" /> {saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        )}

        {/* Password */}
        <div className="border-t border-revelio-border/50 dark:border-revelio-dark-border/50 pt-3 mt-3">
          {!showPw ? (
            <button onClick={() => setShowPw(true)} className="text-[10px] text-revelio-orange font-semibold flex items-center gap-1 hover:underline"><Lock className="w-3 h-3" /> Cambiar contraseña</button>
          ) : (
            <div className="flex gap-2 items-center">
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Nueva contraseña (mín. 6)" className="flex-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" autoFocus />
              <button onClick={savePw} disabled={pwSaving} className="px-3 py-2 rounded-lg bg-revelio-orange text-white text-xs font-semibold disabled:opacity-50">{pwSaving ? '...' : 'Cambiar'}</button>
              <button onClick={() => { setShowPw(false); setNewPw('') }} className="text-[10px] text-revelio-subtle">Cancelar</button>
            </div>
          )}
          {pwMsg && <p className={`text-[10px] mt-1 ${pwMsg.startsWith('Error') ? 'text-revelio-red' : 'text-revelio-green'}`}>{pwMsg}</p>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[{ l: 'Retros', v: stats.retrosCompleted, I: Calendar, c: '#007AFF' }, { l: 'Items', v: stats.itemsCompleted, I: ListChecks, c: '#34C759' }, { l: 'Riesgos', v: stats.risksIdentified, I: Shield, c: '#FF9500' }, { l: 'Notas', v: stats.notesCreated, I: MessageCircle, c: '#5856D6' }].map(s => (
          <div key={s.l} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3"><s.I className="w-4 h-4 mb-1" style={{ color: s.c }} /><p className="text-lg font-bold" style={{ color: s.c }}>{s.v}</p><p className="text-[8px] text-revelio-subtle uppercase">{s.l}</p></div>
        ))}
      </div>

      {/* Badges */}
      <div className="rounded-2xl border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-5 mb-4">
        <h3 className="text-xs font-semibold dark:text-revelio-dark-text flex items-center gap-1.5 mb-3"><Trophy className="w-4 h-4 text-[#FFD700]" /> Logros ({earned.length}/{BADGES.length})</h3>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">{BADGES.map(b => <div key={b.id} className={`rounded-lg p-2 text-center ${earned.includes(b.id) ? 'bg-[#FFD700]/5' : 'opacity-30'}`} title={`${b.label}: ${b.desc}`}><span className="text-lg">{b.emoji}</span></div>)}</div>
      </div>

      {/* Projects */}
      <div className="rounded-2xl border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-5 mb-4">
        <h3 className="text-xs font-semibold dark:text-revelio-dark-text flex items-center gap-1.5 mb-3"><Zap className="w-4 h-4 text-revelio-blue" /> Mis proyectos</h3>
        <div className="flex gap-2 flex-wrap">{rooms.length > 0 ? rooms.map(slug => <a key={slug} href={`/project/${slug}`} className="px-3 py-1.5 rounded-lg bg-revelio-blue/10 text-revelio-blue text-xs font-medium hover:bg-revelio-blue/20">{slug}</a>) : <p className="text-[10px] text-revelio-subtle">Sin proyectos asignados</p>}</div>
      </div>

      {/* Appearance */}
      <ThemeSelector />
    </div>
  )
}

function ThemeSelector() {
  const { mode, setMode, schedule, setSchedule } = useTheme()
  return (
    <div className="rounded-2xl border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-5">
      <h3 className="text-xs font-semibold dark:text-revelio-dark-text flex items-center gap-1.5 mb-3"><Moon className="w-4 h-4 text-revelio-violet" /> Apariencia</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {([{ id: 'light' as const, l: 'Claro', e: '☀️' }, { id: 'dark' as const, l: 'Oscuro', e: '🌙' }, { id: 'auto' as const, l: 'Auto', e: '💻' }, { id: 'schedule' as const, l: 'Programado', e: '🕐' }]).map(t => (
          <button key={t.id} onClick={() => setMode(t.id)} className={`rounded-xl p-3 text-center border ${mode === t.id ? 'border-revelio-blue bg-revelio-blue/5' : 'border-revelio-border dark:border-revelio-dark-border hover:bg-revelio-bg dark:hover:bg-revelio-dark-border'}`}><span className="text-xl block mb-1">{t.e}</span><p className="text-[10px] font-semibold dark:text-revelio-dark-text">{t.l}</p></button>
        ))}
      </div>
      {mode === 'schedule' && <div className="flex items-center gap-3 bg-revelio-bg dark:bg-revelio-dark-border rounded-xl px-4 py-3"><span className="text-[10px] text-revelio-subtle">Oscuro de</span><input type="time" value={schedule.darkFrom} onChange={e => setSchedule({ ...schedule, darkFrom: e.target.value })} className="rounded-lg border border-revelio-border px-2 py-1 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /><span className="text-[10px] text-revelio-subtle">a</span><input type="time" value={schedule.darkTo} onChange={e => setSchedule({ ...schedule, darkTo: e.target.value })} className="rounded-lg border border-revelio-border px-2 py-1 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>}
    </div>
  )
}
