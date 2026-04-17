// ═══ CALENDAR PANEL — Unified Calendar + Convenio — 12 months view ═══
import { useState, useEffect } from 'preact/hooks';
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

export function CalendarPanel() {
  const [calendarios, setCalendarios] = useState<Calendario[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCal, setEditCal] = useState<Calendario | null>(null);
  const [holidayPopup, setHolidayPopup] = useState<{ date: string } | null>(null);
  const [holidayName, setHolidayName] = useState('');
  const [showClone, setShowClone] = useState(false);
  const [cloneHolidays, setCloneHolidays] = useState<Holiday[]>([]);
  const [cloneAssign, setCloneAssign] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([loadCalendarios(), loadTeamMembers()]).then(([cals, mR]) => {
      setCalendarios(cals); if (mR.ok) setMembers(mR.data); setLoading(false);
    });
  }, []);

  const createCal = async () => {
    const yr = new Date().getFullYear();
    const saved = await saveCalendario({ name: `Calendario ${yr}`, year: yr, region: '', holidays: [], weekly_hours_normal: 40, daily_hours_lj: 8, daily_hours_v: 8, daily_hours_intensive: 7, intensive_start: '08-01', intensive_end: '08-31', convenio_hours: 1800, vacation_days: 22, adjustment_days: 0, adjustment_hours: 0, free_days: 0, employee_type: 'all', seniority: 'all' });
    if (saved) { setCalendarios(prev => [...prev, saved]); setEditCal(saved); }
  };
  const updateCal = async (cal: Calendario) => {
    const saved = await saveCalendario(cal);
    if (saved) { setCalendarios(prev => prev.map(c => c.id === saved.id ? saved : c)); setEditCal(saved); }
  };
  const removeCal = async (id: string) => {
    await deleteCalendario(id); setCalendarios(prev => prev.filter(c => c.id !== id));
    if (editCal?.id === id) setEditCal(null);
  };
  const handleAssign = async (memberId: string, calId: string) => {
    await assignCalendarioToMember(memberId, calId || null);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, calendario_id: calId } as Member : m));
  };

  // Holiday helpers
  const isHol = (ds: string) => editCal?.holidays.some(h => h.date === ds) || false;
  const getHol = (ds: string) => editCal?.holidays.find(h => h.date === ds);
  const isIntens = (ds: string) => {
    if (!editCal) return false;
    const yr = editCal.year || new Date().getFullYear();
    return ds >= `${yr}-${editCal.intensive_start || '08-01'}` && ds <= `${yr}-${editCal.intensive_end || '08-31'}`;
  };
  const addHoliday = () => {
    if (!editCal || !holidayPopup || !holidayName.trim()) return;
    const u = { ...editCal, holidays: [...editCal.holidays.filter(h => h.date !== holidayPopup.date), { date: holidayPopup.date, name: holidayName.trim() }].sort((a, b) => a.date.localeCompare(b.date)) };
    updateCal(u); setHolidayPopup(null); setHolidayName('');
  };
  const removeHoliday = (date: string) => { if (!editCal) return; updateCal({ ...editCal, holidays: editCal.holidays.filter(h => h.date !== date) }); };

  // Clone
  const calYear = editCal?.year || new Date().getFullYear();
  const openClone = () => {
    if (!editCal) return;
    const ny = calYear + 1;
    setCloneHolidays(editCal.holidays.map(h => ({ ...h, date: h.date.replace(/^\d{4}/, String(ny)) })));
    // Pre-select currently assigned members
    const assigned = members.filter(m => (m as Record<string, unknown>).calendario_id === editCal.id).map(m => m.id);
    setCloneAssign(new Set(assigned));
    setShowClone(true);
  };
  const handleClone = async () => {
    if (!editCal) return;
    const ny = calYear + 1;
    const saved = await saveCalendario({
      name: editCal.name.replace(/\d{4}/, String(ny)), year: ny, region: editCal.region, holidays: cloneHolidays,
      weekly_hours_normal: editCal.weekly_hours_normal, daily_hours_lj: editCal.daily_hours_lj, daily_hours_v: editCal.daily_hours_v,
      daily_hours_intensive: editCal.daily_hours_intensive, intensive_start: editCal.intensive_start, intensive_end: editCal.intensive_end,
      convenio_hours: editCal.convenio_hours, vacation_days: editCal.vacation_days, adjustment_days: editCal.adjustment_days,
      adjustment_hours: editCal.adjustment_hours, free_days: editCal.free_days, employee_type: editCal.employee_type, seniority: editCal.seniority,
    });
    if (saved) {
      setCalendarios(prev => [...prev, saved]);
      // Assign selected members
      for (const mid of cloneAssign) { await assignCalendarioToMember(mid, saved.id); }
      setMembers(prev => prev.map(m => cloneAssign.has(m.id) ? { ...m, calendario_id: saved.id } as Member : m));
    }
    setShowClone(false);
  };

  // Mini month grid renderer
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
                onClick={() => { if (!wk && editCal) { if (hol) removeHoliday(ds); else { setHolidayPopup({ date: ds }); setHolidayName(''); } } }}
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>Calendario y Convenio</h2>
          <p style={{ fontSize: 12, color: '#86868B' }}>{calendarios.length} calendario{calendarios.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={createCal} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="Plus" size={12} color="#FFF" /> Nuevo calendario
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: editCal ? '220px 1fr' : '1fr', gap: 12 }}>
        {/* Left: list */}
        <div>
          {calendarios.map(c => {
            const asgn = members.filter(m => (m as Record<string, unknown>).calendario_id === c.id);
            return (
              <div key={c.id} onClick={() => setEditCal(c)}
                style={{ ...cardS, padding: 12, marginBottom: 8, cursor: 'pointer', borderColor: editCal?.id === c.id ? '#007AFF' : '#E5E5EA', background: editCal?.id === c.id ? '#007AFF06' : '#FFF' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: '#86868B' }}>{c.holidays.length} festivos · {c.region || 'Sin región'}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); removeCal(c.id); }}
                    style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="Trash2" size={10} color="#FF3B30" />
                  </button>
                </div>
                {asgn.length > 0 && <div style={{ display: 'flex', gap: 2, marginTop: 6, flexWrap: 'wrap' }}>{asgn.map(m => <span key={m.id} style={{ fontSize: 13 }} title={m.name}>{m.avatar || '👤'}</span>)}</div>}
              </div>
            );
          })}
        </div>

        {/* Right: editor */}
        {editCal && (
          <div style={{ ...cardS, padding: 16, overflow: 'auto' }}>
            {/* Name + Region */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <input value={editCal.name} onInput={e => { const u = { ...editCal, name: (e.target as HTMLInputElement).value }; setEditCal(u); updateCal(u); }}
                style={{ ...inputS, flex: 2, minWidth: 150, fontWeight: 700 }} />
              <input value={editCal.region} onInput={e => { const u = { ...editCal, region: (e.target as HTMLInputElement).value }; setEditCal(u); updateCal(u); }}
                placeholder="Región" style={{ ...inputS, flex: 1, minWidth: 80 }} />
            </div>

            {/* Convenio fields */}
            <div style={{ background: '#F9F9FB', borderRadius: 10, padding: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#86868B', marginBottom: 6, textTransform: 'uppercase' }}>JORNADA Y CONVENIO</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, fontSize: 11 }}>
                {([['H. convenio','convenio_hours',1800],['Vacaciones','vacation_days',22],['H/sem','weekly_hours_normal',40],['H/día int.','daily_hours_intensive',7],['H/día L-J','daily_hours_lj',8],['H/día V','daily_hours_v',8],['Ajuste días','adjustment_days',0],['Libre disp.','free_days',0]] as const).map(([l,f,d])=>(
                  <div key={f}><label style={labelS}>{l}</label>
                    <input type="number" step="0.5" value={(editCal as Record<string,unknown>)[f] as number ?? d}
                      onInput={e=>{const u={...editCal,[f]:parseFloat((e.target as HTMLInputElement).value)||d};setEditCal(u);updateCal(u);}}
                      style={{ width:'100%',padding:'4px 6px',borderRadius:6,border:'1px solid #E5E5EA',fontSize:11,outline:'none' }}/></div>))}
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginTop:8 }}>
                <div><label style={labelS}>Intensiva desde (dd/mm)</label>
                  <input value={editCal.intensive_start||'01-08'} onInput={e=>{const u={...editCal,intensive_start:(e.target as HTMLInputElement).value};setEditCal(u);updateCal(u);}}
                    placeholder="01-08" style={{width:'100%',padding:'4px 6px',borderRadius:6,border:'1px solid #E5E5EA',fontSize:11,outline:'none'}}/></div>
                <div><label style={labelS}>Intensiva hasta (dd/mm)</label>
                  <input value={editCal.intensive_end||'31-08'} onInput={e=>{const u={...editCal,intensive_end:(e.target as HTMLInputElement).value};setEditCal(u);updateCal(u);}}
                    placeholder="31-08" style={{width:'100%',padding:'4px 6px',borderRadius:6,border:'1px solid #E5E5EA',fontSize:11,outline:'none'}}/></div>
              </div>
            </div>

            {/* ── 12 MONTHS GRID ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 12 }}>
              {Array.from({ length: 12 }, (_, i) => renderMonth(i, calYear))}
            </div>

            {/* Legend + Clone */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, fontSize: 9, color: '#86868B' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: '#FF3B30' }} /> Festivo</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: '#007AFF20', border: '1px solid #007AFF40' }} /> Intensiva</span>
              </div>
              <button onClick={openClone}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #5856D630', background: '#5856D608', color: '#5856D6', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="Copy" size={12} color="#5856D6" /> Copiar a {calYear + 1}
              </button>
            </div>

            {/* Holiday list dd/mm */}
            <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', marginBottom: 4 }}>{editCal.holidays.length} FESTIVOS</div>
              {editCal.holidays.map(h => (
                <div key={h.date} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: '1px solid #F9F9FB', fontSize: 11 }}>
                  <span style={{ fontWeight: 600, color: '#FF3B30', minWidth: 40 }}>{fmtDD(h.date)}</span>
                  <span style={{ flex: 1 }}>{h.name}</span>
                  <button onClick={() => removeHoliday(h.date)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><Icon name="X" size={10} color="#C7C7CC" /></button>
                </div>
              ))}
            </div>

            {/* Assign users */}
            <div style={{ paddingTop: 10, borderTop: '1px solid #F2F2F7' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', marginBottom: 4 }}>ASIGNAR USUARIOS</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {members.map(m => {
                  const isA = (m as Record<string, unknown>).calendario_id === editCal.id;
                  return (
                    <button key={m.id} onClick={() => handleAssign(m.id, isA ? '' : editCal.id)}
                      style={{ padding: '3px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: isA ? 'none' : '1px dashed #E5E5EA', background: isA ? '#34C759' : '#FFF', color: isA ? '#FFF' : '#86868B' }}>
                      {m.avatar || '👤'} {m.name.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Holiday popup ── */}
      {holidayPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 9200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
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

      {/* ── Clone modal with user assignment ── */}
      {showClone && editCal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 9200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowClone(false)}>
          <div onClick={(e: Event) => e.stopPropagation()}
            style={{ background: '#FFF', borderRadius: 20, maxWidth: 520, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Copiar a {calYear + 1}</h3>
            <p style={{ fontSize: 12, color: '#86868B', marginBottom: 14 }}>Revisa los festivos y selecciona las personas a asignar al nuevo calendario.</p>

            {/* Holidays */}
            <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', marginBottom: 4 }}>FESTIVOS ({cloneHolidays.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14, maxHeight: 200, overflowY: 'auto' }}>
              {cloneHolidays.map(h => (
                <div key={h.date} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#F9F9FB', borderRadius: 8 }}>
                  <span style={{ fontWeight: 600, color: '#FF3B30', minWidth: 44, fontSize: 11 }}>{fmtDD(h.date)}</span>
                  <input value={h.name} onInput={e => setCloneHolidays(prev => prev.map(x => x.date === h.date ? { ...x, name: (e.target as HTMLInputElement).value } : x))}
                    style={{ flex: 1, border: '1px solid #E5E5EA', borderRadius: 6, padding: '3px 8px', fontSize: 12, outline: 'none' }} />
                  <button onClick={() => setCloneHolidays(prev => prev.filter(x => x.date !== h.date))} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                    <Icon name="X" size={12} color="#C7C7CC" />
                  </button>
                </div>
              ))}
            </div>

            {/* User assignment */}
            <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', marginBottom: 6 }}>
              ASIGNAR PERSONAS AL NUEVO CALENDARIO ({cloneAssign.size})
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16, padding: 10, background: '#F9F9FB', borderRadius: 10 }}>
              {members.map(m => {
                const sel = cloneAssign.has(m.id);
                return (
                  <button key={m.id} onClick={() => { const n = new Set(cloneAssign); if (sel) n.delete(m.id); else n.add(m.id); setCloneAssign(n); }}
                    style={{ padding: '4px 10px', borderRadius: 10, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      border: sel ? 'none' : '1px dashed #E5E5EA', background: sel ? '#5856D6' : '#FFF', color: sel ? '#FFF' : '#86868B' }}>
                    {m.avatar || '👤'} {m.name.split(' ')[0]}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowClone(false)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={handleClone} style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: '#5856D6', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Crear {calYear + 1} · {cloneHolidays.length} festivos · {cloneAssign.size} personas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
