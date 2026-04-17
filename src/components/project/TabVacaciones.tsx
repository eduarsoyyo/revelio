// ═══ TAB VACACIONES — Vacation management with calendar grid ═══
import { useState, useEffect } from 'preact/hooks';
import type { Member } from '@app-types/index';
import { loadTeamMembers, saveTeamMember } from '@data/team';
import { Icon } from '@components/common/Icon';
import { ABSENCE_TYPES } from '../../config/absenceTypes';

interface TabVacacionesProps {
  team: Member[];
  sala: string;
  onRefresh?: () => void;
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const HOLIDAYS_DEFAULT = ['01-01','01-06','05-01','08-15','10-12','11-01','12-06','12-08','12-25'];

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export function TabVacaciones({ team, sala, onRefresh }: TabVacacionesProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [newVac, setNewVac] = useState({ memberId: '', from: '', to: '', type: 'vacaciones', note: '' });
  const [saving, setSaving] = useState(false);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const todayStr = today.toISOString().slice(0, 10);

  // All vacations from team members
  const allVacs = team.flatMap(m =>
    (Array.isArray(m.vacations) ? m.vacations : []).map((v: Vacation) => ({ ...v, memberId: m.id, memberName: m.name })),
  );

  const isWeekend = (d: number) => { const w = new Date(viewYear, viewMonth, d).getDay(); return w === 0 || w === 6; };
  const isHoliday = (d: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return HOLIDAYS_DEFAULT.includes(`${mm}-${dd}`);
  };
  const isToday = (d: number) => todayStr === `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const getVacForDay = (memberId: string, d: number) => {
    const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return allVacs.find(v => v.memberId === memberId && v.from <= ds && (!v.to || v.to >= ds));
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  // Count vacation days used this year
  const countVacDays = (memberId: string) => {
    const yr = today.getFullYear();
    return allVacs.filter(v => v.memberId === memberId && (v.type === 'vacaciones' || !v.type)).reduce((sum, v) => {
      if (!v.from) return sum;
      let d = new Date(v.from);
      const to = new Date(v.to || v.from);
      let cnt = 0;
      while (d <= to) {
        const dow = d.getDay();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        if (d.getFullYear() === yr && dow !== 0 && dow !== 6 && !HOLIDAYS_DEFAULT.includes(`${mm}-${dd}`)) cnt++;
        d.setDate(d.getDate() + 1);
      }
      return sum + cnt;
    }, 0);
  };

  // Add vacation
  const addVac = async () => {
    if (!newVac.memberId || !newVac.from) return;
    setSaving(true);
    const member = team.find(m => m.id === newVac.memberId);
    if (!member) { setSaving(false); return; }

    const entry = { id: uid(), from: newVac.from, to: newVac.to || newVac.from, type: newVac.type, note: newVac.note };
    const updatedVacs = [...(Array.isArray(member.vacations) ? member.vacations : []), entry];

    const result = await saveTeamMember({ ...member, vacations: updatedVacs });
    setSaving(false);
    setNewVac({ memberId: '', from: '', to: '', type: 'vacaciones', note: '' });
    if (onRefresh) onRefresh();
  };

  // Delete vacation
  const delVac = async (memberId: string, vacId: string) => {
    const member = team.find(m => m.id === memberId);
    if (!member) return;
    const updatedVacs = (Array.isArray(member.vacations) ? member.vacations : []).filter((v: Vacation) => v.id !== vacId);
    await saveTeamMember({ ...member, vacations: updatedVacs });
    if (onRefresh) onRefresh();
  };

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🏖️ Vacaciones y ausencias</h3>

      {/* Month navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ border: 'none', background: '#F2F2F7', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="ChevronLeft" size={14} color="#6E6E73" />
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, minWidth: 140, textAlign: 'center' }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} style={{ border: 'none', background: '#F2F2F7', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="ChevronRight" size={14} color="#6E6E73" />
        </button>
        <button onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }}
          style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', color: '#007AFF', fontWeight: 600 }}>
          Hoy
        </button>
      </div>

      {/* Calendar grid */}
      <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', overflow: 'auto', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
          <thead>
            <tr style={{ background: '#F9F9FB' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#86868B', minWidth: 140, position: 'sticky', left: 0, background: '#F9F9FB', zIndex: 2 }}>Persona</th>
              <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#86868B', minWidth: 50 }}>Usados</th>
              {days.map(d => (
                <th key={d} style={{
                  padding: '4px 2px', textAlign: 'center', fontSize: 9, fontWeight: 600, minWidth: 22,
                  color: isToday(d) ? '#007AFF' : isWeekend(d) ? '#C7C7CC' : isHoliday(d) ? '#FF3B30' : '#86868B',
                  background: isToday(d) ? '#EEF5FF' : isWeekend(d) ? '#F9F9FB' : 'transparent',
                  borderBottom: isToday(d) ? '2px solid #007AFF' : '1px solid #E5E5EA',
                }}>
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {team.map((m, mi) => {
              const used = countVacDays(m.id);
              const total = m.annual_vac_days || 22;
              const pct = Math.round(used / total * 100);
              const pctColor = pct >= 80 ? '#34C759' : pct >= 40 ? '#FF9500' : '#FF3B30';

              return (
                <tr key={m.id} style={{ borderBottom: '1px solid #F2F2F7', background: mi % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                  <td style={{ padding: '6px 12px', position: 'sticky', left: 0, background: mi % 2 === 0 ? '#FFF' : '#FAFAFA', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{m.avatar || '👤'}</span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>{m.name.split(' ')[0]}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: pctColor }}>{used}/{total}</div>
                    <div style={{ width: 36, height: 3, background: '#F2F2F7', borderRadius: 2, margin: '2px auto', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: pctColor, borderRadius: 2 }} />
                    </div>
                  </td>
                  {days.map(d => {
                    const wknd = isWeekend(d);
                    const hol = isHoliday(d);
                    const vac = getVacForDay(m.id, d);
                    const absType = vac ? ABSENCE_TYPES.find(t => t.id === vac.type) : null;

                    return (
                      <td key={d} style={{
                        padding: 0, textAlign: 'center', fontSize: 8,
                        background: vac ? (absType?.color || '#FF9500') + '20' : wknd ? '#F9F9FB' : hol ? '#FFF5F5' : 'transparent',
                        borderLeft: '1px solid #F2F2F7',
                      }}>
                        {vac && (
                          <div title={`${absType?.label || 'Ausencia'}\n${vac.from} → ${vac.to || vac.from}`}
                            style={{ width: '100%', height: 20, background: (absType?.color || '#FF9500') + '40', cursor: 'pointer' }}
                            onClick={() => delVac(m.id, vac.id)}
                          />
                        )}
                        {!vac && hol && <span style={{ color: '#FF3B30' }}>•</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add vacation form */}
      <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Añadir ausencia</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={newVac.memberId} onChange={e => setNewVac({ ...newVac, memberId: (e.target as HTMLSelectElement).value })}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 12, outline: 'none', minWidth: 140 }}>
            <option value="">Seleccionar persona...</option>
            {team.map(m => <option key={m.id} value={m.id}>{m.avatar || '👤'} {m.name}</option>)}
          </select>
          <select value={newVac.type} onChange={e => setNewVac({ ...newVac, type: (e.target as HTMLSelectElement).value })}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 12, outline: 'none' }}>
            {ABSENCE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <input type="date" value={newVac.from} onInput={e => setNewVac({ ...newVac, from: (e.target as HTMLInputElement).value })}
            style={{ padding: '8px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 12 }} />
          <span style={{ fontSize: 11, color: '#86868B' }}>→</span>
          <input type="date" value={newVac.to} onInput={e => setNewVac({ ...newVac, to: (e.target as HTMLInputElement).value })}
            style={{ padding: '8px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 12 }} />
          <button onClick={addVac} disabled={!newVac.memberId || !newVac.from || saving}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', background: '#FF9500',
              color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              opacity: (!newVac.memberId || !newVac.from || saving) ? 0.4 : 1,
            }}>
            {saving ? 'Guardando…' : '+ Añadir'}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        {ABSENCE_TYPES.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#86868B' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: t.color + '40' }} />
            {t.label}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#86868B' }}>
          <span style={{ color: '#FF3B30' }}>•</span> Festivo
        </div>
      </div>
    </div>
  );
}
