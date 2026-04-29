import { useState } from 'react'
import {
  X, Save, Trash2, CheckSquare, Square, Plus, Clock, User, Flag,
  Tag, FileText, ListChecks, Zap, Hash, Calendar, AlertTriangle, Link2,
  MessageCircle, Pin, Send,
} from 'lucide-react'
import { RichEditor, RichTextDisplay } from '@/components/common/RichText'
import { soundCreate, soundDelete } from '@/lib/sounds'
import type { Member } from '@/types'

interface Action {
  id: string; text: string; status: string; owner: string; date: string
  priority: string; createdAt: string; description?: string; type?: string
  epicLink?: string; startDate?: string; storyPoints?: number | string | null
  hours?: number | null; checklist?: string; source?: string; riskId?: string | null
  blockedBy?: string[]; blocks?: string[]
  baselineStart?: string; baselineEnd?: string
  milestoneDate?: string
  comments?: Comment[]
  [k: string]: unknown
}

interface Comment { id: string; author: string; text: string; date: string; isDecision?: boolean }

interface CheckItem { id: string; text: string; done: boolean }

interface EpicItem { id: string; text: string }

interface TaskDetailModalProps {
  task: Action
  teamMembers: Member[]
  epics?: EpicItem[]
  allItems?: Array<{ id: string; text: string }>
  currentUser?: string
  onSave: (task: Action) => void
  onClose: () => void
  onDelete: (id: string) => void
}

const STATUSES = [
  { id: 'backlog', label: 'Backlog', color: '#86868B' },
  { id: 'todo', label: 'Pendiente', color: '#86868B' },
  { id: 'doing', label: 'En curso', color: '#007AFF' },
  { id: 'inprogress', label: 'En curso', color: '#007AFF' },
  { id: 'blocked', label: 'Bloqueado', color: '#FF3B30' },
  { id: 'done', label: 'Hecho', color: '#34C759' },
  { id: 'archived', label: 'Archivado', color: '#86868B' },
  { id: 'cancelled', label: 'Cancelado', color: '#86868B' },
]

const TYPES = [
  { id: 'epica', label: 'Épica', color: '#AF52DE' },
  { id: 'historia', label: 'Historia de Usuario', color: '#5856D6' },
  { id: 'tarea', label: 'Tarea', color: '#007AFF' },
  { id: 'bug', label: 'Bug', color: '#FF3B30' },
  { id: 'mejora', label: 'Mejora', color: '#34C759' },
  { id: 'hito', label: 'Hito', color: '#FF9500' },
  { id: 'accion_retro', label: 'Acción retro', color: '#8E8E93' },
]

const PRIORITIES = [
  { id: 'critical', label: 'Crítica', color: '#FF3B30' },
  { id: 'high', label: 'Alta', color: '#FF9500' },
  { id: 'medium', label: 'Media', color: '#007AFF' },
  { id: 'low', label: 'Baja', color: '#86868B' },
]

const uid = () => Math.random().toString(36).slice(2, 8)

function parseChecklist(raw?: string): CheckItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((c: Record<string, unknown>) => ({
      id: (c.id as string) || uid(),
      text: (c.text as string) || '',
      done: !!(c.done || c.checked),
    })) : []
  } catch { return [] }
}

function serializeChecklist(items: CheckItem[]): string {
  return JSON.stringify(items.map(c => ({ id: c.id, text: c.text, done: c.done })))
}

export function TaskDetailModal({ task, teamMembers, epics = [], allItems = [], currentUser = '', onSave, onClose, onDelete }: TaskDetailModalProps) {
  const [f, setF] = useState({ ...task })
  const [checks, setChecks] = useState<CheckItem[]>(parseChecklist(task.checklist))
  const [newCheck, setNewCheck] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [comments, setComments] = useState<Comment[]>(task.comments || [])
  const [newComment, setNewComment] = useState('')
  const [editingDesc, setEditingDesc] = useState(!task.description)
  const isEpic = (f.type || 'tarea') === 'epica'

  const set = (key: string, val: unknown) => setF(prev => ({ ...prev, [key]: val }))

  const handleSave = () => {
    onSave({ ...f, checklist: serializeChecklist(checks), comments, updatedAt: new Date().toISOString() }); soundCreate()
  }

  const addComment = (isDecision = false) => {
    if (!newComment.trim()) return
    setComments(prev => [...prev, { id: uid(), author: currentUser || 'Anónimo', text: newComment.trim(), date: new Date().toISOString(), isDecision }])
    setNewComment('')
  }

  const toggleDecision = (cid: string) => setComments(prev => prev.map(c => c.id === cid ? { ...c, isDecision: !c.isDecision } : c))
  const deleteComment = (cid: string) => setComments(prev => prev.filter(c => c.id !== cid))

  const addCheck = () => {
    if (!newCheck.trim()) return
    setChecks(prev => [...prev, { id: uid(), text: newCheck.trim(), done: false }])
    setNewCheck('')
  }

  const toggleCheck = (id: string) => setChecks(prev => prev.map(c => c.id === id ? { ...c, done: !c.done } : c))
  const deleteCheck = (id: string) => setChecks(prev => prev.filter(c => c.id !== id))
  const checksDone = checks.filter(c => c.done).length

  const st = STATUSES.find(s => s.id === f.status) || STATUSES[0]!

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-revelio-dark-card rounded-2xl max-w-2xl w-full shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-revelio-border dark:border-revelio-dark-border">
          <div className="w-2 h-8 rounded-full" style={{ background: st.color }} />
          <input value={f.text} onChange={e => set('text', e.target.value)}
            className="flex-1 text-base font-semibold outline-none bg-transparent dark:text-revelio-dark-text"
            placeholder="Título del item..." />
          <button onClick={handleSave} className="px-3 py-1.5 rounded-lg bg-revelio-blue text-white text-xs font-medium flex items-center gap-1 hover:bg-revelio-blue/90">
            <Save className="w-3 h-3" /> Guardar
          </button>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border">
            <X className="w-4 h-4 text-revelio-subtle" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row">
          {/* Left: main content */}
          <div className="flex-1 p-6 space-y-5 overflow-y-auto" style={{ maxHeight: 520 }}>
            {/* Description — markdown preview + edit */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[9px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Descripción
                </label>
                <button onClick={() => setEditingDesc(!editingDesc)} className="text-[8px] text-revelio-blue hover:underline">
                  {editingDesc ? 'Vista previa' : 'Editar'}
                </button>
              </div>
              {editingDesc ? (
                <RichEditor value={f.description || ''} onChange={v => set('description', v)}
                  placeholder="Describe el item en detalle..."
                  minHeight={100} />
              ) : (
                f.description ? (
                  <div className="rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs dark:text-revelio-dark-text cursor-pointer hover:bg-revelio-bg/50 dark:hover:bg-revelio-dark-border/30 min-h-[40px]" onClick={() => setEditingDesc(true)}>
                    <RichTextDisplay html={f.description} className="text-xs leading-relaxed dark:text-revelio-dark-text" />
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-revelio-border dark:border-revelio-dark-border px-3 py-3 text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle text-center cursor-pointer hover:bg-revelio-bg/50 dark:hover:bg-revelio-dark-border/30" onClick={() => setEditingDesc(true)}>
                    Click para añadir descripción...
                  </div>
                )
              )}
            </div>

            {/* Checklist */}
            <div>
              <label className="text-[9px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider flex items-center gap-1 mb-1.5">
                <ListChecks className="w-3 h-3" /> Checklist {checks.length > 0 && `(${checksDone}/${checks.length})`}
              </label>
              {checks.length > 0 && (
                <div className="h-1 bg-revelio-bg dark:bg-revelio-dark-border rounded-full mb-2 overflow-hidden">
                  <div className="h-full bg-revelio-green rounded-full transition-all" style={{ width: `${checks.length > 0 ? (checksDone / checks.length) * 100 : 0}%` }} />
                </div>
              )}
              {checks.map(c => (
                <div key={c.id} className="flex items-center gap-2 py-1 group">
                  <button onClick={() => toggleCheck(c.id)} className="flex-shrink-0">
                    {c.done ? <CheckSquare className="w-4 h-4 text-revelio-green" /> : <Square className="w-4 h-4 text-revelio-border dark:text-revelio-dark-border" />}
                  </button>
                  <span className={`text-xs flex-1 ${c.done ? 'line-through text-revelio-subtle dark:text-revelio-dark-subtle' : 'dark:text-revelio-dark-text'}`}>{c.text}</span>
                  <button onClick={() => deleteCheck(c.id)} className="opacity-0 group-hover:opacity-100 text-revelio-subtle hover:text-revelio-red">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 mt-1">
                <input value={newCheck} onChange={e => setNewCheck(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCheck()}
                  className="flex-1 rounded-lg border border-dashed border-revelio-border dark:border-revelio-dark-border px-2.5 py-1.5 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text"
                  placeholder="Añadir subtarea..." />
                <button onClick={addCheck} disabled={!newCheck.trim()} className="px-2 py-1.5 rounded-lg text-revelio-blue text-xs font-medium disabled:opacity-30">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Decisions — pinned comments */}
            {comments.filter(c => c.isDecision).length > 0 && (
              <div>
                <label className="text-[9px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider flex items-center gap-1 mb-1.5">
                  <Pin className="w-3 h-3 text-revelio-green" /> Decisiones
                </label>
                {comments.filter(c => c.isDecision).map(c => (
                  <div key={c.id} className="flex items-start gap-2 bg-revelio-green/5 border border-revelio-green/20 rounded-lg px-3 py-2 mb-1">
                    <Pin className="w-3 h-3 text-revelio-green flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <RichTextDisplay html={c.text} className="text-[10px] dark:text-revelio-dark-text leading-relaxed" />
                      <p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle mt-0.5">{c.author} · {new Date(c.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Comments thread */}
            <div>
              <label className="text-[9px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider flex items-center gap-1 mb-1.5">
                <MessageCircle className="w-3 h-3" /> Conversación {comments.length > 0 && `(${comments.length})`}
              </label>
              {comments.filter(c => !c.isDecision).length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {comments.filter(c => !c.isDecision).map(c => (
                    <div key={c.id} className="group rounded-lg bg-revelio-bg dark:bg-revelio-dark-border px-3 py-2">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[9px] font-semibold dark:text-revelio-dark-text">{c.author}</span>
                        <span className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle">{new Date(c.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100">
                          <button onClick={() => toggleDecision(c.id)} title="Marcar como decisión" className="text-revelio-subtle hover:text-revelio-green"><Pin className="w-2.5 h-2.5" /></button>
                          <button onClick={() => deleteComment(c.id)} className="text-revelio-subtle hover:text-revelio-red"><X className="w-2.5 h-2.5" /></button>
                        </div>
                      </div>
                      <RichTextDisplay html={c.text} className="text-[10px] dark:text-revelio-dark-text leading-relaxed" />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5">
                <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment() } }}
                  className="flex-1 rounded-lg border border-dashed border-revelio-border dark:border-revelio-dark-border px-2.5 py-1.5 text-[10px] outline-none resize-none h-8 dark:bg-revelio-dark-bg dark:text-revelio-dark-text"
                  placeholder="Escribe un comentario... (Shift+Enter salto de línea)" rows={1} />
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => addComment()} disabled={!newComment.trim()} className="px-1.5 py-1 rounded text-revelio-blue disabled:opacity-30" title="Enviar">
                    <Send className="w-3 h-3" />
                  </button>
                  <button onClick={() => addComment(true)} disabled={!newComment.trim()} className="px-1.5 py-1 rounded text-revelio-green disabled:opacity-30" title="Enviar como decisión">
                    <Pin className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Risk link */}
            {f.riskId && (
              <div className="flex items-center gap-2 text-xs text-revelio-orange bg-revelio-orange/10 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="font-medium">Vinculado a riesgo</span>
              </div>
            )}
          </div>

          {/* Right: metadata sidebar */}
          <div className="w-full md:w-64 border-t md:border-t-0 md:border-l border-revelio-border dark:border-revelio-dark-border p-5 space-y-4">

            {/* Status */}
            <Field icon={<Zap className="w-3 h-3" />} label="Estado">
              <div className="flex gap-1 flex-wrap">
                {STATUSES.filter(s => !['inprogress', 'archived', 'cancelled'].includes(s.id)).map(s => (
                  <button key={s.id} onClick={() => set('status', s.id)}
                    className={`px-2 py-0.5 rounded text-[9px] font-semibold transition-colors ${f.status === s.id ? 'text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}
                    style={f.status === s.id ? { background: s.color } : undefined}>
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>

            {/* Priority */}
            <Field icon={<Flag className="w-3 h-3" />} label="Prioridad">
              <div className="flex gap-1">
                {PRIORITIES.map(p => (
                  <button key={p.id} onClick={() => set('priority', p.id)}
                    className={`px-2 py-0.5 rounded text-[9px] font-semibold transition-colors ${f.priority === p.id ? 'text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}
                    style={f.priority === p.id ? { background: p.color } : undefined}>
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>

            {/* Type */}
            <Field icon={<Tag className="w-3 h-3" />} label="Tipo">
              <select value={f.type || 'tarea'} onChange={e => set('type', e.target.value)}
                className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1.5 text-xs outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text">
                {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </Field>

            {/* Owner */}
            <Field icon={<User className="w-3 h-3" />} label="Responsable">
              <select value={f.owner || ''} onChange={e => set('owner', e.target.value)}
                className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1.5 text-xs outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text">
                <option value="">Sin asignar</option>
                {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </Field>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-2">
              <Field icon={<Calendar className="w-3 h-3" />} label="Inicio">
                <input type="date" value={f.startDate || ''} onChange={e => set('startDate', e.target.value)}
                  className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1.5 text-[10px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" />
              </Field>
              <Field icon={<Clock className="w-3 h-3" />} label="Vencimiento">
                <input type="date" value={f.date || ''} onChange={e => set('date', e.target.value)}
                  className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1.5 text-[10px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" />
              </Field>
            </div>

            {/* Baseline */}
            {(f.baselineStart || f.baselineEnd) ? (
              <div className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle bg-revelio-bg dark:bg-revelio-dark-border rounded-lg px-2.5 py-1.5">
                <span className="font-semibold">Línea base:</span> {f.baselineStart || '—'} → {f.baselineEnd || '—'}
                {f.startDate && f.baselineStart && f.startDate !== f.baselineStart && <span className="text-revelio-red ml-1">(desviación inicio)</span>}
                {f.date && f.baselineEnd && f.date !== f.baselineEnd && <span className="text-revelio-red ml-1">(desviación fin)</span>}
              </div>
            ) : (f.startDate || f.date) ? (
              <button onClick={() => { set('baselineStart', f.startDate || f.date); set('baselineEnd', f.date || f.startDate) }}
                className="text-[9px] text-revelio-blue hover:underline flex items-center gap-0.5">
                Fijar línea base actual
              </button>
            ) : null}

            {/* Epic — only show for non-epic items */}
            {!isEpic && (
              <Field icon={<Zap className="w-3 h-3" />} label="Épica padre">
                <select value={String(f.epicLink || '')} onChange={e => set('epicLink', e.target.value || undefined)}
                  className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1.5 text-xs outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text">
                  <option value="">Sin épica</option>
                  {epics.map(e => <option key={e.id} value={e.id}>{e.text}</option>)}
                </select>
              </Field>
            )}

            {/* Story points + Hours */}
            <div className="grid grid-cols-2 gap-2">
              <Field icon={<Hash className="w-3 h-3" />} label="Story Points">
                <input type="number" min={0} max={100} value={f.storyPoints || ''} onChange={e => set('storyPoints', e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1.5 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" placeholder="—" />
              </Field>
              <Field icon={<Clock className="w-3 h-3" />} label="Horas">
                <input type="number" min={0} max={999} value={f.hours || ''} onChange={e => set('hours', e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1.5 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" placeholder="—" />
              </Field>
            </div>

            {/* Dependencies */}
            {!isEpic && (
              <Field icon={<Link2 className="w-3 h-3" />} label="Dependencias">
                <div className="space-y-1">
                  {((f.dependsOn as string[]) || []).map((depId: string) => {
                    const dep = allItems.find(i => i.id === depId)
                    const depTypes = (f.depType as Record<string, string>) || {}
                    const dtype = depTypes[depId] || 'FS'
                    return dep ? (
                      <div key={depId} className="flex items-center gap-1 text-[10px] bg-revelio-bg dark:bg-revelio-dark-border rounded px-2 py-1">
                        <select value={dtype} onChange={e => {
                          const next = { ...depTypes, [depId]: e.target.value }
                          set('depType', next)
                        }} className="w-10 text-[8px] font-bold bg-transparent outline-none cursor-pointer" style={{ color: dtype === 'FS' ? '#FF9500' : dtype === 'SS' ? '#5856D6' : dtype === 'FF' ? '#007AFF' : '#FF3B30' }}>
                          <option value="FS">FS</option>
                          <option value="SS">SS</option>
                          <option value="FF">FF</option>
                          <option value="SF">SF</option>
                        </select>
                        <span className="flex-1 dark:text-revelio-dark-text truncate">{dep.text}</span>
                        <button onClick={() => {
                          set('dependsOn', ((f.dependsOn as string[]) || []).filter((d: string) => d !== depId))
                          const nt = { ...depTypes }; delete nt[depId]; set('depType', nt)
                        }} className="text-revelio-subtle hover:text-revelio-red"><X className="w-2.5 h-2.5" /></button>
                      </div>
                    ) : null
                  })}
                  <select value="" onChange={e => { if (e.target.value) { set('dependsOn', [...((f.dependsOn as string[]) || []), e.target.value]); const dt = (f.depType as Record<string, string>) || {}; set('depType', { ...dt, [e.target.value]: 'FS' }) } e.target.value = '' }}
                    className="w-full rounded-lg border border-dashed border-revelio-border dark:border-revelio-dark-border px-2 py-1.5 text-[10px] outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text">
                    <option value="">+ Añadir dependencia...</option>
                    {allItems.filter(i => i.id !== f.id && !((f.dependsOn as string[]) || []).includes(i.id)).map(i => <option key={i.id} value={i.id}>{i.text}</option>)}
                  </select>
                  <p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle">FS=Fin→Inicio · SS=Inicio→Inicio · FF=Fin→Fin · SF=Inicio→Fin</p>
                </div>
              </Field>
            )}

            {/* Delete */}
            <div className="pt-3 border-t border-revelio-border dark:border-revelio-dark-border">
              {!showDelete ? (
                <button onClick={() => setShowDelete(true)} className="text-xs text-revelio-red flex items-center gap-1 hover:underline">
                  <Trash2 className="w-3 h-3" /> Eliminar item
                </button>
              ) : (
                <div>
                  <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle mb-1">Escribe <strong className="text-revelio-red">{f.text.slice(0, 20)}</strong> para confirmar</p>
                  <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && deleteConfirm === f.text.slice(0, 20)) { onDelete(f.id); soundDelete() } }}
                    className="w-full rounded-lg border border-revelio-red/30 px-2 py-1.5 text-xs outline-none mb-1.5 dark:bg-revelio-dark-bg dark:text-revelio-dark-text" />
                  <div className="flex gap-1">
                    <button onClick={() => setShowDelete(false)} className="flex-1 py-1 rounded-lg text-[10px] border border-revelio-border dark:border-revelio-dark-border text-revelio-subtle">Cancelar</button>
                    <button onClick={() => { onDelete(f.id); soundDelete() }} disabled={deleteConfirm !== f.text.slice(0, 20)}
                      className="flex-1 py-1 rounded-lg text-[10px] bg-revelio-red text-white disabled:opacity-30">Eliminar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[9px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider flex items-center gap-1 mb-1">
        {icon} {label}
      </label>
      {children}
    </div>
  )
}
