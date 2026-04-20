// ═══ CALENDAR PANEL — Multi-year calendars, modal editing, clone, copy holidays ═══
import { useState, useEffect, useMemo } from 'preact/hooks';
import type { Member } from '@app-types/index';
import { loadCalendarios, saveCalendario, deleteCalendario, assignCalendarioToMember, type Calendario, type Holiday } from '@data/calendarios';
import { loadTeamMembers } from '@data/team';
import { Icon } from '@components/common/Icon';

const MO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const DY = ['L','M','X','J','V','S','D'];
const cardS = { background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA' } as const;
const inputS = { padding: '8px 12px', borderRadius: 10, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit', background: '#F9F9FB' };
const labelS = { fontSize: 9, fontWeight: 700 as number, color: '#86868B', display: 'block', marginBottom: 2, textTransform: 'uppercase' as const };
const fmtDD = (iso: string) => { const p = iso.slice(5).split('-'); return `${p[1]}/${p[0]}`; };
const mmddToDdmm = (v: string) => { if (!v) return ''; const p = v.split('-'); return p.length === 2 ? `${p[1]}/${p[0]}` : v; };
const ddmmToMmdd = (v: string) => { if (!v) return ''; const p = v.replace(/\//g, '-').split('-'); return p.length === 2 ? `${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}` : v; };

export function CalendarPanel() {
  const [calendarios, setCalendarios] = useState<Calendario[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit/Create modal
  const [editModal, setEditModal] = useState(false);
  const [draft, setDraft] = useState<Calendario | null>(null);
  const [isCreate, setIsCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [holidayPopup, setHolidayPopup] = useState<{ date: string } | null>(null);
  const [holidayName, setHolidayName] = useState('');

  // Copy holidays modal
  const [showCopyHolidays, setShowCopyHolidays] = useState(false);
  const [copyHolidays, setCopyHolidays] = useState<(Holiday & { selected: boolean })[]>([]);
  const [copyTargetYear, setCopyTargetYear] = useState(new Date().getFullYear() + 1);

  // Clone calendar modal
  const [showClone, setShowClone] = useState(false);
  const [cloneSource, setCloneSource] = useState<Calendario | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [cloneAssign, setCloneAssign] = useState<Set<string>>(new Set());

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Calendario | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => {
    Promise.all([loadCalendarios(), loadTeamMembers()]).then(([cals, mR]) => {
      setCalendarios(cals); if (mR.ok) setMembers(mR.data); setLoading(false);
    });
  }, []);

  // ── CRUD ──
  const removeCal = async () => {
    if (!deleteTarget || deleteConfirm !== deleteTarget.name) return;
    await deleteCalendario(deleteTarget.id);
    setCalendarios(prev => prev.filter(c => c.id !== deleteTarget.id));
    setDeleteTarget(null); setDeleteConfirm('');
  };
  const handleAssign = async (memberId: string, calId: string) => {
    await assignCalendarioToMember(memberId, calId || null);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, calendario_id: calId } as Member : m));
  };

  // ── Open Create ──
  const openCreate = () => {
    setDraft({
      id: '', name: '', year: new Date().getFullYear(), region: '', holidays: [],
      weekly_hours_normal: 40, daily_hours_lj: 8, daily_hours_v: 8, daily_hours_intensive: 7,
      intensive_start: '08-01', intensive_end: '08-31', convenio_hours: 1800,
      vacation_days: 22, adjustment_days: 0, adjustment_hours: 0, free_days: 0,
      employee_type: 'all', seniority: 'all',
    } as Calendario);
    setViewYear(new Date().getFullYear());
    setIsCreate(true); setEditModal(true);
  };

  // ── Open Edit ──
  const openEdit = (cal: Calendario) => {
    setDraft(JSON.parse(JSON.stringify(cal)));
    // Show the year that has the most holidays, or current year
    const yearCounts: Record<number, number> = {};
    cal.holidays.forEach(h => { const y = parseInt(h.date.slice(0, 4)); yearCounts[y] = (yearCounts[y] || 0) + 1; });
    const bestYear = Object.entries(yearCounts).sort((a, b) => b[1] - a[1])[0];
    setViewYear(bestYear ? parseInt(bestYear[0]) : new Date().getFullYear());
    setIsCreate(false); setEditModal(true);
  };

  // ── Save ──
  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    const toSave = isCreate ? (({ id, ...rest }: any) => rest)(draft) : draft;
    const saved = await saveCalendario(toSave);
    if (saved) {
      if (isCreate) { setCalendarios(prev => [...prev, saved]); }
      else { setCalendarios(prev => prev.map(c => c.id === saved.id ? saved : c)); }
    }
    setSaving(false); setEditModal(false); setDraft(null);
  };

  // ── Holiday helpers (draft) ──
  const holidaysForYear = useMemo(() => {
    if (!draft) return [];
    return draft.holidays.filter(h => h.date.startsWith(String(viewYear)));
  }, [draft, viewYear]);

  const allYearsInCalendar = useMemo(() => {
    if (!draft) return [new Date().getFullYear()];
    const years = new Set(draft.holidays.map(h => parseInt(h.date.slice(0, 4))));
    years.add(new Date().getFullYear());
    return [...years].sort();
  }, [draft]);

  const isHol = (ds: string) => draft?.holidays.some(h => h.date === ds) || false;
  const getHol = (ds: string) => draft?.holidays.find(h => h.date === ds);
  const isIntens = (ds: string) => {
    if (!draft) return false;
    return ds >= `${viewYear}-${draft.intensive_start || '08-01'}` && ds <= `${viewYear}-${draft.intensive_end || '08-31'}`;
  };
  const addHoliday = () => {
    if (!draft || !holidayPopup || !holidayName.trim()) return;
    setDraft({ ...draft, holidays: [...draft.holidays.filter(h => h.date !== holidayPopup.date), { date: holidayPopup.date, name: holidayName.trim() }].sort((a, b) => a.date.localeCompare(b.date)) });
    setHolidayPopup(null); setHolidayName('');
  };
  const removeHoliday = (date: string) => { if (!draft) return; setDraft({ ...draft, holidays: draft.holidays.filter(h => h.date !== date) }); };

  // ── Copy holidays to next year (inside same calendar) ──
  const openCopyHolidays = () => {
    if (!draft) return;
    const sourceYear = viewYear;
    const targetYear = viewYear + 1;
    const sourceHols = draft.holidays.filter(h => h.date.startsWith(String(sourceYear)));
    setCopyHolidays(sourceHols.map(h => ({ ...h, date: h.date.replace(/^\d{4}/, String(targetYear)), selected: true })));
    setCopyTargetYear(targetYear);
    setShowCopyHolidays(true);
  };
  const handleCopyHolidays = () => {
    if (!draft) return;
    const selected = copyHolidays.filter(h => h.selected).map(({ selected, ...h }) => h);
    // Add to draft, avoiding duplicates
    const existing = new Set(draft.holidays.map(h => h.date));
    const newHols = selected.filter(h => !existing.has(h.date));
    setDraft({ ...draft, holidays: [...draft.holidays, ...newHols].sort((a, b) => a.date.localeCompare(b.date)) });
    setShowCopyHolidays(false);
    setViewYear(copyTargetYear); // Navigate to target year to see results
  };

  // ── Clone entire calendar ──
  const openClone = (cal: Calendario) => {
    setCloneSource(cal);
    setCloneName(cal.name + ' (copia)');
    const assigned = members.filter(m => (m as Record<string, unknown>).calendario_id === cal.id).map(m => m.id);
    setCloneAssign(new Set(assigned));
    setShowClone(true);
  };
  const handleClone = async () => {
    if (!cloneSource || !cloneName.trim()) return;
    const saved = await saveCalendario({
      name: cloneName.trim(), year: cloneSource.year, region: cloneSource.region, holidays: [...cloneSource.holidays],
      weekly_hours_normal: cloneSource.weekly_hours_normal, daily_hours_lj: cloneSource.daily_hours_lj, daily_hours_v: cloneSource.daily_hours_v,
      daily_hours_intensive: cloneSource.daily_hours_intensive, intensive_start: cloneSource.intensive_start, intensive_end: cloneSource.intensive_end,
      convenio_hours: cloneSource.convenio_hours, vacation_days: cloneSource.vacation_days, adjustment_days: cloneSource.adjustment_days,
      adjustment_hours: cloneSource.adjustment_hours, free_days: cloneSource.free_days, employee_type: cloneSource.employee_type, seniority: cloneSource.seniority,
    });
    if (saved) {
      setCalendarios(prev => [...prev, saved]);
      for (const mid of cloneAssign) { await assignCalendarioToMember(mid, saved.id); }
      setMembers(prev => prev.map(m => cloneAssign.has(m.id) ? { ...m, calendario_id: saved.id } as Member : m));
    }
    setShowClone(false); setCloneSource(null);
  };

  // ── Month grid ──
  const renderMonth = (mi: number, yr: number) => {
    const first = new Date(yr, mi, 1).getDay();
    const offset = first === 0 ? 6 : first - 1;
    const days = new Date(yr, mi + 1, 0).getDate();
    const today = new Date().toISOString().slice(0, 10);
    return (
      <div key={mi} style={{ background: '#FFF', borderRadius: 10, border: '1px solid #F2F2F7', padding: '6px 4px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textAlign: 'center', marginBottom: 4, color: '#1D1D1F' }}>{MO[mi]}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, textAlign: 'center' }}>
          {DY.map(d => <div key={d} style={{ fontSize: 7, color: '#C7C7CC', lineHeight: '12px' }}>{d}</div>)}
          {Array(offset).fill(null).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: days }, (_, i) => i + 1).map(d => {
            const ds = `${yr}-${String(mi + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dow = new Date(yr, mi, d).getDay();
            const wk = dow === 0 || dow === 6;
            const hol = isHol(ds);
            const holD = getHol(ds);
            const intens = isIntens(ds);
            const td = ds === today;
            return (
              <div key={d}
                onClick={() => { if (!wk && draft) { if (hol) { removeHoliday(ds); } else { setHolidayPopup({ date: ds }); setHolidayName(''); } } }}
                title={hol ? holD?.name : intens ? 'Intensiva' : undefined}
                style={{
                  width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 4, fontSize: 8, fontWeight: hol || td ? 700 : 400, cursor: wk ? 'default' : 'pointer',
                  background: hol ? '#FF3B30' : intens && !wk ? '#007AFF15' : td ? '#007AFF10' : 'transparent',
                  color: hol ? '#FFF' : wk ? '#D1D1D6' : intens ? '#007AFF' : td ? '#007AFF' : '#3A3A3C',
                  border: td && !hol ? '1px solid #007AFF' : '1px solid transparent',
                }}>
                {d}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando…</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>Calendario y Convenio</h2>
          <p style={{ fontSize: 12, color: '#86868B' }}>{calendarios.length} calendario{calendarios.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openCreate} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="Plus" size={12} color="#FFF" /> Nuevo calendario
        </button>
      </div>

      {/* ── Calendar list ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
        {calendarios.map(c => {
          const asgn = members.filter(m => (m as Record<string, unknown>).calendario_id === c.id);
          const years = [...new Set(c.holidays.map(h => h.date.slice(0, 4)))].sort();
          return (
            <div key={c.id} style={{ ...cardS, padding: 14 }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: '#86868B' }}>
                  {c.holidays.length} festivos · {c.region || 'Sin región'}
                  {years.length > 0 && <span> · {years.join(', ')}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 10, color: '#86868B' }}>
                <span>H/sem: <strong style={{ color: '#1D1D1F' }}>{(c as any).weekly_hours_normal || 40}</strong></span>
                <span>Vac: <strong style={{ color: '#1D1D1F' }}>{(c as any).vacation_days || 22}d</strong></span>
                <span>Conv: <strong style={{ color: '#1D1D1F' }}>{(c as any).convenio_hours || 1800}h</strong></span>
              </div>
              {asgn.length > 0 ? (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 8 }}>
                  {asgn.map(m => <span key={m.id} style={{ fontSize: 12 }} title={m.name}>{m.avatar || '👤'}</span>)}
                  <span style={{ fontSize: 9, color: '#86868B', alignSelf: 'center' }}>{asgn.length}</span>
                </div>
              ) : (
                <div style={{ fontSize: 10, color: '#C7C7CC', marginBottom: 8 }}>Sin personas asignadas</div>
              )}
              <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #F2F2F7', paddingTop: 8 }}>
                <button onClick={() => openEdit(c)}
                  style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: '1px solid #007AFF30', background: '#007AFF08', color: '#007AFF', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Icon name="Edit" size={11} color="#007AFF" /> Editar
                </button>
                <button onClick={() => openClone(c)}
                  style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: '1px solid #5856D630', background: '#5856D608', color: '#5856D6', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Icon name="Copy" size={11} color="#5856D6" /> Clonar
                </button>
                <button onClick={() => { setDeleteTarget(c); setDeleteConfirm(''); }}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="Trash2" size={12} color="#FF3B30" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ EDIT / CREATE MODAL ═══ */}
      {editModal && draft && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => { setEditModal(false); setDraft(null); }}>
          <div onClick={(e: Event) => e.stopPropagation()}
            style={{ background: '#FFF', borderRadius: 20, width: '95%', maxWidth: 820, maxHeight: '92vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700 }}>{isCreate ? 'Nuevo calendario' : `Editar: ${draft.name}`}</h3>
              <button onClick={() => { setEditModal(false); setDraft(null); }}
                style={{ border: 'none', background: '#F2F2F7', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="X" size={16} color="#86868B" />
              </button>
            </div>

            {/* Name + Region */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 2 }}><label style={labelS}>Nombre</label>
                <input value={draft.name} onInput={e => setDraft({ ...draft, name: (e.target as HTMLInputElement).value })} style={inputS} /></div>
              <div style={{ flex: 1 }}><label style={labelS}>Región</label>
                <input value={draft.region} onInput={e => setDraft({ ...draft, region: (e.target as HTMLInputElement).value })} style={inputS} /></div>
            </div>

            {/* Convenio */}
            <div style={{ background: '#F9F9FB', borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#86868B', marginBottom: 8, textTransform: 'uppercase' }}>JORNADA Y CONVENIO</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {([['H. convenio','convenio_hours',1800],['Vacaciones','vacation_days',22],['H/sem','weekly_hours_normal',40],['H/día int.','daily_hours_intensive',7],['H/día L-J','daily_hours_lj',8],['H/día V','daily_hours_v',8],['Ajuste días','adjustment_days',0],['Libre disp.','free_days',0]] as [string,string,number][]).map(([l,f,d]) => (
                  <div key={f}><label style={labelS}>{l}</label>
                    <input type="number" step="0.01" value={(draft as any)[f] ?? d}
                      onInput={e => setDraft({ ...draft, [f]: parseFloat((e.target as HTMLInputElement).value) || d })}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 12, outline: 'none' }} /></div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <div><label style={labelS}>Intensiva desde (dd/mm)</label>
                  <input value={mmddToDdmm(draft.intensive_start || '08-01')}
                    onInput={e => setDraft({ ...draft, intensive_start: ddmmToMmdd((e.target as HTMLInputElement).value) })}
                    placeholder="01/08" style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 12, outline: 'none' }} /></div>
                <div><label style={labelS}>Intensiva hasta (dd/mm)</label>
                  <input value={mmddToDdmm(draft.intensive_end || '08-31')}
                    onInput={e => setDraft({ ...draft, intensive_end: ddmmToMmdd((e.target as HTMLInputElement).value) })}
                    placeholder="31/08" style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 12, outline: 'none' }} /></div>
              </div>
            </div>

            {/* ── Year navigation ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <button onClick={() => setViewYear(y => y - 1)}
                style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="ChevronLeft" size={14} color="#86868B" />
              </button>
              <div style={{ display: 'flex', gap: 4 }}>
                {/* Show year tabs for years that have holidays + current viewYear range */}
                {(() => {
                  const yearsSet = new Set(allYearsInCalendar);
                  yearsSet.add(viewYear);
                  yearsSet.add(viewYear - 1);
                  yearsSet.add(viewYear + 1);
                  return [...yearsSet].sort().map(y => (
                    <button key={y} onClick={() => setViewYear(y)}
                      style={{
                        padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: viewYear === y ? 700 : 500, cursor: 'pointer',
                        border: viewYear === y ? 'none' : '1px solid #E5E5EA',
                        background: viewYear === y ? '#1D1D1F' : '#FFF',
                        color: viewYear === y ? '#FFF' : '#6E6E73',
                      }}>
                      {y}
                      {draft && draft.holidays.filter(h => h.date.startsWith(String(y))).length > 0 && (
                        <span style={{ fontSize: 8, marginLeft: 4, opacity: 0.7 }}>({draft.holidays.filter(h => h.date.startsWith(String(y))).length})</span>
                      )}
                    </button>
                  ));
                })()}
              </div>
              <button onClick={() => setViewYear(y => y + 1)}
                style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="ChevronRight" size={14} color="#86868B" />
              </button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button onClick={openCopyHolidays} disabled={holidaysForYear.length === 0}
                  style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #5856D630', background: '#5856D608', color: '#5856D6', fontSize: 10, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: holidaysForYear.length === 0 ? 0.4 : 1 }}>
                  <Icon name="Copy" size={10} color="#5856D6" /> Copiar festivos a {viewYear + 1}
                </button>
              </div>
            </div>

            {/* 12 months */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 8 }}>
              {Array.from({ length: 12 }, (_, i) => renderMonth(i, viewYear))}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 8, fontSize: 9, color: '#86868B', marginBottom: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: '#FF3B30' }} /> Festivo (clic para añadir/quitar)</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: '#007AFF20', border: '1px solid #007AFF40' }} /> Intensiva</span>
            </div>

            {/* Holiday list for current viewYear */}
            <div style={{ maxHeight: 130, overflowY: 'auto', marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', marginBottom: 4 }}>
                FESTIVOS {viewYear} ({holidaysForYear.length})
                {draft.holidays.length !== holidaysForYear.length && (
                  <span style={{ fontWeight: 400 }}> · {draft.holidays.length} total</span>
                )}
              </div>
              {holidaysForYear.length === 0 && <p style={{ fontSize: 10, color: '#C7C7CC' }}>Sin festivos en {viewYear}</p>}
              {holidaysForYear.map(h => (
                <div key={h.date} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: '1px solid #F9F9FB', fontSize: 11 }}>
                  <span style={{ fontWeight: 600, color: '#FF3B30', minWidth: 40 }}>{fmtDD(h.date)}</span>
                  <span style={{ flex: 1 }}>{h.name}</span>
                  <button onClick={() => removeHoliday(h.date)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><Icon name="X" size={10} color="#C7C7CC" /></button>
                </div>
              ))}
            </div>

            {/* Assign users (edit only) */}
            {!isCreate && (
              <div style={{ paddingTop: 10, borderTop: '1px solid #F2F2F7', marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', marginBottom: 4 }}>ASIGNAR USUARIOS</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {members.map(m => {
                    const isA = (m as Record<string, unknown>).calendario_id === draft.id;
                    return (
                      <button key={m.id} onClick={() => handleAssign(m.id, isA ? '' : draft.id)}
                        style={{ padding: '3px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: isA ? 'none' : '1px dashed #E5E5EA', background: isA ? '#34C759' : '#FFF', color: isA ? '#FFF' : '#86868B' }}>
                        {m.avatar || '👤'} {m.name.split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button onClick={handleSave} disabled={saving || !draft.name.trim()}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', background: '#007AFF', color: '#FFF', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando…' : isCreate ? 'Crear calendario' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ HOLIDAY POPUP ═══ */}
      {holidayPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 9300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setHolidayPopup(null)}>
          <div onClick={(e: Event) => e.stopPropagation()}
            style={{ background: '#FFF', borderRadius: 16, maxWidth: 340, width: '100%', padding: 20, boxShadow: '0 16px 48px rgba(0,0,0,.2)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Añadir festivo</h4>
            <p style={{ fontSize: 12, color: '#86868B', marginBottom: 10 }}>
              {new Date(holidayPopup.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <input value={holidayName} onInput={e => setHolidayName((e.target as HTMLInputElement).value)}
              onKeyDown={e => e.key === 'Enter' && addHoliday()} placeholder="Nombre del festivo" autoFocus style={inputS} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setHolidayPopup(null)} style={{ flex: 1, padding: 9, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={addHoliday} disabled={!holidayName.trim()} style={{ flex: 1, padding: 9, borderRadius: 8, border: 'none', background: '#FF3B30', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: holidayName.trim() ? 1 : 0.4 }}>Añadir</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ COPY HOLIDAYS TO NEXT YEAR ═══ */}
      {showCopyHolidays && draft && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 9300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowCopyHolidays(false)}>
          <div onClick={(e: Event) => e.stopPropagation()}
            style={{ background: '#FFF', borderRadius: 20, maxWidth: 480, width: '100%', maxHeight: '80vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Copiar festivos {viewYear} → {copyTargetYear}</h3>
            <p style={{ fontSize: 12, color: '#86868B', marginBottom: 14 }}>Selecciona los festivos a copiar al año {copyTargetYear} dentro de este calendario.</p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase' }}>
                FESTIVOS ({copyHolidays.filter(h => h.selected).length}/{copyHolidays.length})
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setCopyHolidays(prev => prev.map(h => ({ ...h, selected: true })))}
                  style={{ fontSize: 9, padding: '2px 8px', borderRadius: 5, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', color: '#007AFF', fontWeight: 600 }}>Todos</button>
                <button onClick={() => setCopyHolidays(prev => prev.map(h => ({ ...h, selected: false })))}
                  style={{ fontSize: 9, padding: '2px 8px', borderRadius: 5, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', color: '#86868B', fontWeight: 600 }}>Ninguno</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16, maxHeight: 250, overflowY: 'auto' }}>
              {copyHolidays.map(h => (
                <div key={h.date} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#F9F9FB', borderRadius: 8, opacity: h.selected ? 1 : 0.5 }}>
                  <input type="checkbox" checked={h.selected}
                    onChange={() => setCopyHolidays(prev => prev.map(x => x.date === h.date ? { ...x, selected: !x.selected } : x))}
                    style={{ accentColor: '#5856D6', cursor: 'pointer' }} />
                  <span style={{ fontWeight: 600, color: '#FF3B30', minWidth: 44, fontSize: 11 }}>{fmtDD(h.date)}</span>
                  <input value={h.name} onInput={e => setCopyHolidays(prev => prev.map(x => x.date === h.date ? { ...x, name: (e.target as HTMLInputElement).value } : x))}
                    style={{ flex: 1, border: '1px solid #E5E5EA', borderRadius: 6, padding: '3px 8px', fontSize: 12, outline: 'none' }} />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowCopyHolidays(false)}
                style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={handleCopyHolidays} disabled={copyHolidays.filter(h => h.selected).length === 0}
                style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: '#5856D6', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  opacity: copyHolidays.filter(h => h.selected).length === 0 ? 0.4 : 1 }}>
                Copiar {copyHolidays.filter(h => h.selected).length} festivos a {copyTargetYear}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CLONE CALENDAR MODAL ═══ */}
      {showClone && cloneSource && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 9200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => { setShowClone(false); setCloneSource(null); }}>
          <div onClick={(e: Event) => e.stopPropagation()}
            style={{ background: '#FFF', borderRadius: 20, maxWidth: 480, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Clonar calendario</h3>
            <p style={{ fontSize: 12, color: '#86868B', marginBottom: 14 }}>
              Se creará una copia de <strong>{cloneSource.name}</strong> con toda su configuración y {cloneSource.holidays.length} festivos.
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={labelS}>Nombre del nuevo calendario</label>
              <input value={cloneName} onInput={e => setCloneName((e.target as HTMLInputElement).value)}
                onKeyDown={e => e.key === 'Enter' && handleClone()} autoFocus style={inputS} />
            </div>

            <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', marginBottom: 6 }}>ASIGNAR PERSONAS ({cloneAssign.size})</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16, padding: 10, background: '#F9F9FB', borderRadius: 10 }}>
              {members.map(m => {
                const sel = cloneAssign.has(m.id);
                return (
                  <button key={m.id} onClick={() => { const n = new Set(cloneAssign); if (sel) { n.delete(m.id); } else { n.add(m.id); } setCloneAssign(n); }}
                    style={{ padding: '4px 10px', borderRadius: 10, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      border: sel ? 'none' : '1px dashed #E5E5EA', background: sel ? '#5856D6' : '#FFF', color: sel ? '#FFF' : '#86868B' }}>
                    {m.avatar || '👤'} {m.name.split(' ')[0]}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowClone(false); setCloneSource(null); }}
                style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={handleClone} disabled={!cloneName.trim()}
                style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: '#5856D6', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !cloneName.trim() ? 0.4 : 1 }}>
                Clonar calendario
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ═══ DELETE CONFIRMATION ═══ */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setDeleteTarget(null)}>
          <div onClick={(e: Event) => e.stopPropagation()}
            style={{ background: '#FFF', borderRadius: 20, maxWidth: 420, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Icon name="AlertTriangle" size={32} color="#FF3B30" />
              <h3 style={{ fontSize: 17, fontWeight: 700, marginTop: 10 }}>Eliminar calendario</h3>
              <p style={{ fontSize: 13, color: '#86868B', marginTop: 6 }}>
                Se eliminará <strong>{deleteTarget.name}</strong> de forma permanente.
              </p>
            </div>

            {/* Consequences */}
            <div style={{ background: '#FFF5F5', borderRadius: 10, padding: 12, marginBottom: 14, border: '1px solid #FF3B3020' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#FF3B30', textTransform: 'uppercase', marginBottom: 6 }}>CONSECUENCIAS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#1D1D1F' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="Calendar" size={12} color="#FF3B30" />
                  <span><strong>{deleteTarget.holidays.length}</strong> festivos se perderán</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="Users" size={12} color="#FF3B30" />
                  <span><strong>{members.filter(m => (m as Record<string, unknown>).calendario_id === deleteTarget.id).length}</strong> persona{members.filter(m => (m as Record<string, unknown>).calendario_id === deleteTarget.id).length !== 1 ? 's' : ''} quedarán sin calendario asignado</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="Clock" size={12} color="#FF3B30" />
                  <span>Los cálculos de FTEs y jornada de esas personas dejarán de funcionar</span>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelS}>Escribe <strong style={{ color: '#FF3B30' }}>{deleteTarget.name}</strong> para confirmar</label>
              <input value={deleteConfirm} onInput={e => setDeleteConfirm((e.target as HTMLInputElement).value)}
                onKeyDown={e => e.key === 'Enter' && deleteConfirm === deleteTarget.name && removeCal()}
                onKeyUp={e => { if (e.key === 'Escape') { setDeleteTarget(null); } }}
                placeholder={deleteTarget.name} autoFocus
                style={{ ...inputS, borderColor: deleteConfirm === deleteTarget.name ? '#FF3B30' : '#E5E5EA' }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ flex: 1, padding: 11, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>
                Cancelar
              </button>
              <button onClick={removeCal} disabled={deleteConfirm !== deleteTarget.name}
                style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: deleteConfirm === deleteTarget.name ? '#FF3B30' : '#E5E5EA', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
