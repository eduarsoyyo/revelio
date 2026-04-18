// ═══ TAB FTEs — Unified: FTEs + Vacaciones + Ausencias (anual/mensual/semanal) ═══
import { useState, useEffect, useMemo } from 'preact/hooks';
import type { Member } from '@app-types/index';
import { loadOrgChart } from '@data/team';
import { loadCalendarios, type Calendario } from '@data/calendarios';
import { Icon } from '@components/common/Icon';
import { ANNUAL_VAC_DAYS, ABSENCE_TYPES, getAbsenceType } from '../../config/absenceTypes';

interface TabFTEsProps { team: Member[]; sala: string; }

const MO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MO_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DY = ['L','M','X','J','V','S','D'];
type ViewMode = 'anual' | 'mensual' | 'semanal';
const f1 = (n: number) => n.toFixed(1);

export function TabFTEs({ team, sala }: TabFTEsProps) {
  const [orgData, setOrgData] = useState<any[]>([]);
  const [calendarios, setCalendarios] = useState<Calendario[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('anual');
  const now = new Date();
  const [yr, setYr] = useState(now.getFullYear());
  const [mo, setMo] = useState(now.getMonth());
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    Promise.all([loadOrgChart(sala), loadCalendarios()]).then(([orgR, cals]) => {
      if (orgR.ok) setOrgData(orgR.data);
      setCalendarios(cals);
      setLoading(false);
    });
  }, [sala]);

  // Helpers
  const getOrg = (mid: string) => orgData.find(r => r.member_id === mid) || {};
  const isWk = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
  const fmtD = (d: string) => { const p = d.split('-'); return `${p[2]}/${p[1]}`; };

  // Get member's calendario
  const getCal = (m: Member): Calendario | null => {
    const cid = (m as Record<string, unknown>).calendario_id as string;
    return cid ? calendarios.find(c => c.id === cid) || null : calendarios[0] || null;
  };

  // Is date in intensive period?
  const isIntensive = (cal: Calendario | null, ds: string): boolean => {
    if (!cal) return false;
    const mmdd = ds.slice(5); // "MM-DD"
    const start = cal.intensive_start || '08-01';
    const end = cal.intensive_end || '08-31';
    return mmdd >= start && mmdd <= end;
  };

  // Is date a holiday in the member's calendario?
  const isHoliday = (m: Member, ds: string): boolean => {
    const cal = getCal(m);
    if (!cal) return false;
    return (cal.holidays || []).some(h => h.date === ds);
  };

  // Base hours for a date (ignores absences — for totals where vac/aus count as worked)
  const baseHoursForDay = (m: Member, ds: string): number => {
    const d = new Date(ds);
    if (isWk(d)) return 0;
    if (isHoliday(m, ds)) return 0; // festivos = 0 horas
    const cal = getCal(m);
    const org = getOrg(m.id);
    const ded = org.dedication ?? 1;
    const start = org.start_date || '2000-01-01';
    const end = org.end_date || '2099-12-31';
    if (ds < start || ds > end) return 0;

    let baseH = 8;
    if (cal) {
      if (isIntensive(cal, ds)) {
        baseH = cal.daily_hours_intensive || 7;
      } else {
        const dow = d.getDay();
        baseH = (dow >= 1 && dow <= 4) ? (cal.daily_hours_lj || 8) : (cal.daily_hours_v || 8);
      }
    }
    return baseH * ded;
  };

  // Actual worked hours (0 if absent or holiday — for cell display)
  const hoursForDay = (m: Member, ds: string): number => {
    if (isHoliday(m, ds)) return 0;
    const abs = (m.vacations || []).find(v => v.from <= ds && (!v.to || v.to >= ds));
    if (abs) return 0;
    return baseHoursForDay(m, ds);
  };

  // Get absence for a date
  const getAbsence = (mid: string, ds: string) => {
    const m = team.find(x => x.id === mid); if (!m) return null;
    return (m.vacations || []).find(v => v.from <= ds && (!v.to || v.to >= ds)) || null;
  };

  // Vacation stats per member for a year
  const vacStats = useMemo(() => {
    return team.map(m => {
      const vacs = m.vacations || [];
      let usedVac = 0, ausCount = 0;
      vacs.forEach(v => {
        if (!v.from) return;
        const isVac = (v.type || 'vacaciones') === 'vacaciones';
        let d = new Date(v.from); const to = new Date(v.to || v.from);
        while (d <= to) { if (d.getFullYear() === yr && !isWk(d)) { if (isVac) usedVac++; else ausCount++; } d.setDate(d.getDate() + 1); }
      });
      const annual = m.annual_vac_days || ANNUAL_VAC_DAYS;
      const prev = m.prev_year_pending || 0;
      const total = annual + prev;
      return { id: m.id, annual, prev, total, used: usedVac, remaining: Math.max(0, total - usedVac), ausencias: ausCount };
    });
  }, [team, yr]);

  // Monthly hours per member (vac+aus count as worked hours)
  const monthlyHours = useMemo(() => {
    const result: Record<string, number[]> = {};
    team.forEach(m => {
      const months: number[] = [];
      for (let mi = 0; mi < 12; mi++) {
        const daysN = new Date(yr, mi + 1, 0).getDate();
        let h = 0;
        for (let d = 1; d <= daysN; d++) {
          const ds = `${yr}-${String(mi + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          h += baseHoursForDay(m, ds);
        }
        months.push(Math.round(h * 10) / 10);
      }
      result[m.id] = months;
    });
    return result;
  }, [team, yr, orgData, calendarios]);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando…</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>FTEs, Vacaciones y Ausencias</h3>
          <p style={{ fontSize: 12, color: '#86868B', marginTop: 2 }}>{team.length} personas · Horas según convenio y dedicación</p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['anual', 'mensual', 'semanal'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: view === v ? '#1D1D1F' : '#F2F2F7', color: view === v ? '#FFF' : '#6E6E73', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ ANUAL ═══ */}
      {view === 'anual' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button onClick={() => setYr(y => y - 1)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="ChevronLeft" size={13} color="#6E6E73" /></button>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{yr}</span>
            <button onClick={() => setYr(y => y + 1)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="ChevronRight" size={13} color="#6E6E73" /></button>
          </div>
          <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: '#86868B', position: 'sticky', left: 0, background: '#FAFAFA', zIndex: 2, minWidth: 150, borderRight: '2px solid #E5E5EA', borderBottom: '2px solid #E5E5EA' }}>Persona</th>
                  <th style={{ padding: '4px', textAlign: 'center', fontSize: 8, fontWeight: 700, color: '#86868B', borderBottom: '2px solid #E5E5EA' }}>Ded%</th>
                  <th style={{ padding: '4px', textAlign: 'center', fontSize: 8, fontWeight: 700, color: '#86868B', borderBottom: '2px solid #E5E5EA' }}>Vac</th>
                  <th style={{ padding: '4px', textAlign: 'center', fontSize: 8, fontWeight: 700, color: '#86868B', borderBottom: '2px solid #E5E5EA' }}>Ant</th>
                  <th style={{ padding: '4px', textAlign: 'center', fontSize: 8, fontWeight: 700, color: '#86868B', borderBottom: '2px solid #E5E5EA' }}>Tot</th>
                  <th style={{ padding: '4px', textAlign: 'center', fontSize: 8, fontWeight: 700, color: '#86868B', borderBottom: '2px solid #E5E5EA' }}>Cons</th>
                  <th style={{ padding: '4px', textAlign: 'center', fontSize: 8, fontWeight: 700, color: '#34C759', borderBottom: '2px solid #E5E5EA' }}>Rest</th>
                  <th style={{ padding: '4px', textAlign: 'center', fontSize: 8, fontWeight: 700, color: '#FF9500', borderBottom: '2px solid #E5E5EA' }}>Aus</th>
                  {MO.map((m, i) => {
                    const isCur = yr === now.getFullYear() && i === now.getMonth();
                    return <th key={i} style={{ padding: '4px 2px', textAlign: 'center', fontSize: 8, fontWeight: 700, color: isCur ? '#007AFF' : '#86868B', background: isCur ? '#007AFF08' : '#FAFAFA', borderBottom: '2px solid #E5E5EA', minWidth: 38 }}>{m}</th>;
                  })}
                  <th style={{ padding: '4px', textAlign: 'center', fontSize: 8, fontWeight: 800, color: '#007AFF', borderBottom: '2px solid #E5E5EA' }}>Total h</th>
                </tr>
              </thead>
              <tbody>
                {team.map((m, ri) => {
                  const vs = vacStats.find(v => v.id === m.id)!;
                  const mh = monthlyHours[m.id] || Array(12).fill(0);
                  const totalH = mh.reduce((s, h) => s + h, 0);
                  const org = getOrg(m.id);
                  const ded = org.dedication ?? 1;
                  return (
                    <tr key={m.id} style={{ background: ri % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                      <td style={{ padding: '5px 8px', position: 'sticky', left: 0, background: ri % 2 === 0 ? '#FFF' : '#FAFAFA', zIndex: 1, borderRight: '2px solid #E5E5EA', borderBottom: '1px solid #F2F2F7' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: m.color || '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>{m.avatar || '👤'}</div>
                          <div><div style={{ fontSize: 10, fontWeight: 600 }}>{m.name}</div>{m.role_label && <div style={{ fontSize: 7, color: '#86868B' }}>{m.role_label}</div>}</div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', borderBottom: '1px solid #F2F2F7', fontWeight: 700, color: '#5856D6', fontSize: 10 }}>{Math.round(ded * 100)}%</td>
                      <td style={{ textAlign: 'center', borderBottom: '1px solid #F2F2F7' }}>{vs.annual}</td>
                      <td style={{ textAlign: 'center', borderBottom: '1px solid #F2F2F7', color: vs.prev > 0 ? '#007AFF' : '#D1D1D6' }}>{vs.prev}</td>
                      <td style={{ textAlign: 'center', borderBottom: '1px solid #F2F2F7', fontWeight: 600 }}>{vs.total}</td>
                      <td style={{ textAlign: 'center', borderBottom: '1px solid #F2F2F7', color: '#FF9500' }}>{vs.used}</td>
                      <td style={{ textAlign: 'center', borderBottom: '1px solid #F2F2F7', fontWeight: 700, color: vs.remaining <= 5 ? '#FF3B30' : vs.remaining <= 10 ? '#FF9500' : '#34C759' }}>{vs.remaining}</td>
                      <td style={{ textAlign: 'center', borderBottom: '1px solid #F2F2F7', color: vs.ausencias > 0 ? '#FF9500' : '#D1D1D6' }}>{vs.ausencias}</td>
                      {mh.map((h, mi) => {
                        const isCur = yr === now.getFullYear() && mi === now.getMonth();
                        return <td key={mi} style={{ textAlign: 'center', borderBottom: '1px solid #F2F2F7', padding: '3px 1px', background: isCur ? '#007AFF06' : 'transparent', fontWeight: h > 0 ? 600 : 400, color: h > 0 ? '#1D1D1F' : '#E5E5EA', fontSize: 9 }}>{h > 0 ? f1(h) : '—'}</td>;
                      })}
                      <td style={{ textAlign: 'center', borderBottom: '1px solid #F2F2F7', fontWeight: 800, color: '#007AFF', fontSize: 11 }}>{f1(totalH)}</td>
                    </tr>
                  );
                })}
                {/* Totals */}
                <tr style={{ background: '#F0F7FF', borderTop: '2px solid #007AFF20' }}>
                  <td colSpan={8} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, color: '#007AFF', position: 'sticky', left: 0, background: '#F0F7FF', borderRight: '2px solid #E5E5EA' }}>Total</td>
                  {Array.from({ length: 12 }, (_, mi) => {
                    const total = team.reduce((s, m) => s + (monthlyHours[m.id]?.[mi] || 0), 0);
                    return <td key={mi} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: total > 0 ? '#007AFF' : '#D1D1D6' }}>{total > 0 ? f1(total) : '—'}</td>;
                  })}
                  <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#007AFF' }}>{f1(team.reduce((s, m) => s + (monthlyHours[m.id] || []).reduce((a, b) => a + b, 0), 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ MENSUAL ═══ */}
      {view === 'mensual' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button onClick={() => { if (mo === 0) { setMo(11); setYr(y => y - 1); } else setMo(m => m - 1); }} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="ChevronLeft" size={13} color="#6E6E73" /></button>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{MO_FULL[mo]} {yr}</span>
            <button onClick={() => { if (mo === 11) { setMo(0); setYr(y => y + 1); } else setMo(m => m + 1); }} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="ChevronRight" size={13} color="#6E6E73" /></button>
          </div>
          <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', overflow: 'auto' }}>
            {(() => {
              const daysN = new Date(yr, mo + 1, 0).getDate();
              const days = Array.from({ length: daysN }, (_, i) => i + 1);
              const todayS = now.toISOString().slice(0, 10);
              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                  <thead>
                    <tr style={{ background: '#FAFAFA' }}>
                      <th style={{ padding: '5px 8px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: '#86868B', position: 'sticky', left: 0, background: '#FAFAFA', zIndex: 2, minWidth: 120, borderRight: '2px solid #E5E5EA' }}>Persona</th>
                      {days.map(d => {
                        const ds = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const wk = isWk(new Date(yr, mo, d));
                        const td = ds === todayS;
                        const hol = calendarios.length > 0 && (calendarios[0].holidays || []).some(h => h.date === ds);
                        return <th key={d} style={{ padding: '3px 1px', textAlign: 'center', fontSize: 7, fontWeight: td ? 800 : hol ? 700 : 500, color: wk ? '#D1D1D6' : hol ? '#FF3B30' : td ? '#007AFF' : '#86868B', background: td ? '#007AFF08' : wk ? '#F9F9FB' : hol ? '#FF3B3008' : '#FAFAFA', borderBottom: '2px solid #E5E5EA', minWidth: 16 }}>{d}</th>;
                      })}
                      <th style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 700, color: '#007AFF', borderBottom: '2px solid #E5E5EA', minWidth: 32 }}>Horas</th>
                      <th style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 700, color: '#34C759', borderBottom: '2px solid #E5E5EA', minWidth: 22 }}>Vac</th>
                      <th style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 700, color: '#FF9500', borderBottom: '2px solid #E5E5EA', minWidth: 22 }}>Aus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((m, i) => {
                      let totalH = 0, vacD = 0, ausD = 0;
                      return (
                        <tr key={m.id} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                          <td style={{ padding: '4px 6px', position: 'sticky', left: 0, background: i % 2 === 0 ? '#FFF' : '#FAFAFA', zIndex: 1, borderRight: '2px solid #E5E5EA', borderBottom: '1px solid #F2F2F7' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 11 }}>{m.avatar || '👤'}</span>
                              <span style={{ fontSize: 9, fontWeight: 600 }}>{m.name.split(' ')[0]}</span>
                            </div>
                          </td>
                          {days.map(d => {
                            const ds = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                            const wk = isWk(new Date(yr, mo, d));
                            const hol = isHoliday(m, ds);
                            const abs = getAbsence(m.id, ds);
                            const at = abs ? getAbsenceType(abs.type || 'vacaciones') : null;
                            if (abs && !wk && !hol) { if ((abs.type || 'vacaciones') === 'vacaciones') vacD++; else ausD++; }
                            const bh = baseHoursForDay(m, ds);
                            const h = hoursForDay(m, ds);
                            totalH += bh;
                            return (
                              <td key={d} title={hol ? 'Festivo' : at ? at.label : h > 0 ? `${h.toFixed(1)}h` : undefined}
                                style={{ textAlign: 'center', borderBottom: '1px solid #F2F2F7', borderLeft: '1px solid #F9F9FB', padding: 0, background: wk ? '#F9F9FB' : hol ? '#FF3B3012' : abs ? (at?.color || '#FF950020') : 'transparent', fontSize: 7 }}>
                                {wk ? null : hol ? <span style={{ fontWeight: 700, color: '#FF3B30' }}>F</span> : abs ? <span style={{ fontWeight: 700, color: '#FFF' }}>{at?.initial || 'V'}</span> : h > 0 ? <span style={{ color: '#6E6E73' }}>{f1(h)}</span> : null}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'center', borderBottom: '1px solid #F2F2F7', fontWeight: 700, color: '#007AFF', fontSize: 9 }}>{f1(totalH)}</td>
                          <td style={{ textAlign: 'center', borderBottom: '1px solid #F2F2F7', fontWeight: 600, color: vacD > 0 ? '#34C759' : '#E5E5EA', fontSize: 9 }}>{vacD || '—'}</td>
                          <td style={{ textAlign: 'center', borderBottom: '1px solid #F2F2F7', fontWeight: 600, color: ausD > 0 ? '#FF9500' : '#E5E5EA', fontSize: 9 }}>{ausD || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', fontSize: 8, color: '#86868B' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#FF3B3012', border: '1px solid #FF3B3030' }} /><strong style={{ color: '#FF3B30' }}>F</strong> Festivo</span>
            {ABSENCE_TYPES.slice(0, 8).map(at => (
              <span key={at.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: at.color }} />{at.initial} {at.label}</span>
            ))}
          </div>
        </div>
      )}

      {/* ═══ SEMANAL ═══ */}
      {view === 'semanal' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d.toISOString().slice(0, 10)); }} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="ChevronLeft" size={13} color="#6E6E73" /></button>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Semana del {fmtD(weekStart)}</span>
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d.toISOString().slice(0, 10)); }} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="ChevronRight" size={13} color="#6E6E73" /></button>
            <button onClick={() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); setWeekStart(d.toISOString().slice(0, 10)); }}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 10, fontWeight: 600, cursor: 'pointer', color: '#007AFF' }}>Hoy</button>
          </div>
          <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', overflow: 'auto' }}>
            {(() => {
              const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
              const todayS = now.toISOString().slice(0, 10);
              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#FAFAFA' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#86868B', position: 'sticky', left: 0, background: '#FAFAFA', zIndex: 2, minWidth: 140, borderRight: '2px solid #E5E5EA' }}>Persona</th>
                      {weekDays.map(d => {
                        const ds = d.toISOString().slice(0, 10);
                        const wk = isWk(d);
                        const td = ds === todayS;
                        return <th key={ds} style={{ padding: '6px', textAlign: 'center', fontSize: 10, fontWeight: td ? 800 : 600, color: wk ? '#D1D1D6' : td ? '#007AFF' : '#6E6E73', background: td ? '#007AFF08' : wk ? '#F9F9FB' : '#FAFAFA', borderBottom: '2px solid #E5E5EA', minWidth: 70 }}>
                          {DY[(d.getDay() + 6) % 7]} {d.getDate()}/{d.getMonth() + 1}
                        </th>;
                      })}
                      <th style={{ padding: '6px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#007AFF', borderBottom: '2px solid #E5E5EA' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((m, i) => {
                      let totalH = 0;
                      return (
                        <tr key={m.id} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                          <td style={{ padding: '6px 10px', position: 'sticky', left: 0, background: i % 2 === 0 ? '#FFF' : '#FAFAFA', zIndex: 1, borderRight: '2px solid #E5E5EA', borderBottom: '1px solid #F2F2F7' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 22, height: 22, borderRadius: 6, background: m.color || '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>{m.avatar || '👤'}</div>
                              <div style={{ fontSize: 11, fontWeight: 600 }}>{m.name.split(' ')[0]}</div>
                            </div>
                          </td>
                          {weekDays.map(d => {
                            const ds = d.toISOString().slice(0, 10);
                            const wk = isWk(d);
                            const hol = isHoliday(m, ds);
                            const abs = getAbsence(m.id, ds);
                            const at = abs ? getAbsenceType(abs.type || 'vacaciones') : null;
                            const h = hoursForDay(m, ds);
                            totalH += baseHoursForDay(m, ds);
                            return (
                              <td key={ds} style={{ textAlign: 'center', padding: '6px 4px', borderBottom: '1px solid #F2F2F7', background: wk ? '#F9F9FB' : hol ? '#FF3B3010' : abs ? (at?.color || '#FF950020') : 'transparent' }}>
                                {wk ? <span style={{ color: '#E5E5EA' }}>—</span> : hol ? (
                                  <div>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#FF3B30' }}>F</span>
                                    <div style={{ fontSize: 7, color: '#FF3B30', opacity: 0.7 }}>Festivo</div>
                                  </div>
                                ) : abs ? (
                                  <div>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#FFF' }}>{at?.initial || 'V'}</span>
                                    <div style={{ fontSize: 7, color: '#FFF', opacity: 0.8 }}>{at?.label}</div>
                                  </div>
                                ) : h > 0 ? (
                                  <span style={{ fontSize: 13, fontWeight: 700, color: '#34C759' }}>{f1(h)}</span>
                                ) : <span style={{ color: '#E5E5EA' }}>—</span>}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'center', padding: '6px', borderBottom: '1px solid #F2F2F7', fontWeight: 800, color: '#007AFF', fontSize: 12 }}>{f1(totalH)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
