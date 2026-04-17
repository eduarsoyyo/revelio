// ═══ VAC CALENDAR MODAL — Monthly calendar for marking vacation/absence days ═══
import { useState } from 'preact/hooks';
import type { Member, Vacation } from '../../types/index';
import { saveTeamMember } from '../../data/team';
import { ABSENCE_TYPES, getAbsenceType } from '../../config/absenceTypes';
import { Icon } from './Icon';

interface VacCalendarModalProps {
  profile: Member;
  onClose: () => void;
  onSaved: (updated: Member) => void;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const DAYNAMES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const HOLIDAYS_FB = ['01-01', '01-06', '05-01', '08-15', '10-12', '11-01', '12-06', '12-08', '12-25'];

export function VacCalendarModal({ profile, onClose, onSaved }: VacCalendarModalProps) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selDays, setSelDays] = useState<Set<string>>(new Set());
  const [vacType, setVacType] = useState<string>('vacaciones');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAllTypes, setShowAllTypes] = useState(false);

  const myVacs = profile.vacations || [];

  // Find existing vacation entry for a given date
  const getExistingVac = (dateStr: string) =>
    myVacs.find(v => v.from <= dateStr && (!v.to || v.to >= dateStr)) || null;

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const makeDateStr = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const isWeekend = (day: number) => { const d = new Date(viewYear, viewMonth, day).getDay(); return d === 0 || d === 6; };
  const isHoliday = (day: number) => HOLIDAYS_FB.includes(`${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  const isToday = (day: number) => makeDateStr(day) === today.toISOString().slice(0, 10);

  const toggleDay = (day: number) => {
    if (isWeekend(day) || isHoliday(day)) return;
    const ds = makeDateStr(day);
    const next = new Set(selDays);
    if (next.has(ds)) next.delete(ds); else next.add(ds);
    setSelDays(next);
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const handleSave = async () => {
    if (selDays.size === 0) return;
    setSaving(true);
    const sorted = [...selDays].sort();
    const ranges: { from: string; to: string }[] = [];
    let start = sorted[0], prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      const diff = (new Date(sorted[i]).getTime() - new Date(prev).getTime()) / 86400000;
      if (diff <= 3) { prev = sorted[i]; } else { ranges.push({ from: start, to: prev }); start = sorted[i]; prev = sorted[i]; }
    }
    ranges.push({ from: start, to: prev });

    const newVacs: Vacation[] = ranges.map(r => ({
      id: uid(), type: vacType, from: r.from, to: r.to,
      note: note.trim() || undefined, reason: '',
    }));
    const updatedProfile = { ...profile, vacations: [...myVacs, ...newVacs] };
    const result = await saveTeamMember(updatedProfile);
    setSaving(false);
    onSaved(result.ok ? result.data : updatedProfile);
    onClose();
  };

  // Type display
  const selectedType = ABSENCE_TYPES.find(t => t.id === vacType) || ABSENCE_TYPES[0];
  const FREQUENT = ['vacaciones', 'baja_medica', 'asuntos_propios', 'formacion', 'permiso_retribuido'];
  const visibleTypes = showAllTypes ? ABSENCE_TYPES : ABSENCE_TYPES.filter(t => FREQUENT.includes(t.id));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 9200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}>
      <div onClick={(e: Event) => e.stopPropagation()}
        style={{ background: '#FFF', borderRadius: 22, maxWidth: 440, width: '100%',
          maxHeight: '92vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,.25)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="Calendar" size={18} color="#007AFF" /> Gestionar ausencias
            </h3>
            <button onClick={onClose}
              style={{ width: 30, height: 30, borderRadius: 15, border: 'none', background: '#F2F2F7', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="X" size={14} color="#86868B" />
            </button>
          </div>

          {/* Type selector */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
            {visibleTypes.map(t => (
              <button key={t.id} onClick={() => setVacType(t.id)}
                style={{ padding: '4px 9px', fontSize: 10, fontWeight: vacType === t.id ? 700 : 500, borderRadius: 7,
                  border: vacType === t.id ? `1.5px solid ${t.color}` : '1px solid #E5E5EA',
                  background: vacType === t.id ? `${t.color}15` : '#FFF', color: vacType === t.id ? t.color : '#6E6E73',
                  cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {t.initial} {t.label.replace(/^[^\s]+\s/, '')}
              </button>
            ))}
            <button onClick={() => setShowAllTypes(!showAllTypes)}
              style={{ padding: '4px 9px', fontSize: 10, fontWeight: 500, borderRadius: 7,
                border: '1px solid #E5E5EA', background: '#F9F9FB', color: '#86868B', cursor: 'pointer' }}>
              {showAllTypes ? '▲ Menos' : '▼ Todos'}
            </button>
          </div>

          {/* Note field */}
          <input value={note} onInput={(e: Event) => setNote((e.target as HTMLInputElement).value)}
            placeholder={`Nota para ${selectedType.label.replace(/^[^\s]+\s/, '')}…`}
            style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 8, padding: '7px 10px',
              fontSize: 11, fontFamily: 'inherit', outline: 'none', background: '#F9F9FB',
              boxSizing: 'border-box', marginBottom: 10 }} />

          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button onClick={prevMonth}
              style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="ChevronLeft" size={13} color="#6E6E73" />
            </button>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{MONTHS_ES[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth}
              style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="ChevronRight" size={13} color="#6E6E73" />
            </button>
          </div>
        </div>

        {/* Calendar grid — scrollable */}
        <div style={{ padding: '0 20px', flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
            {DAYNAMES.map(d => <div key={d} style={{ fontSize: 9, fontWeight: 700, color: '#AEAEB2', padding: '4px 0' }}>{d}</div>)}
            {Array(offset).fill(null).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const ds = makeDateStr(day);
              const wk = isWeekend(day);
              const hol = isHoliday(day);
              const sel = selDays.has(ds);
              const existVac = getExistingVac(ds);
              const existType = existVac ? getAbsenceType(existVac.type || 'vacaciones') : null;
              const td = isToday(day);
              return (
                <div key={day} onClick={() => !wk && !hol && toggleDay(day)}
                  title={existVac ? `${existType!.label.replace(/^[^\s]+\s/, '')}${existVac.note ? ' — ' + existVac.note : ''}` : undefined}
                  style={{ width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 10, fontSize: 11, fontWeight: sel || td || existVac ? 700 : 500,
                    cursor: wk || hol ? 'default' : 'pointer',
                    background: sel ? selectedType.color : existVac ? `${existType!.color}18` : hol ? '#FF3B3010' : td ? '#007AFF10' : 'transparent',
                    color: sel ? '#FFF' : wk ? '#D1D1D6' : hol ? '#FF3B30' : existVac ? existType!.color : td ? '#007AFF' : '#1D1D1F',
                    border: td && !sel ? '1.5px solid #007AFF' : '1.5px solid transparent',
                    transition: 'all .15s' }}>
                  {existVac && !sel ? (
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: -0.5 }}>{existType!.initial}</span>
                  ) : day}
                </div>
              );
            })}
          </div>

          {/* Legend — only types that appear in existing vacs */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, marginBottom: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { c: selectedType.color, l: `Seleccionado (${selectedType.initial})` },
              ...ABSENCE_TYPES
                .filter(t => myVacs.some(v => (v.type || 'vacaciones') === t.id))
                .map(t => ({ c: `${t.color}40`, l: `${t.initial} ${t.label.replace(/^[^\s]+\s/, '')}` })),
              { c: '#FF3B3010', l: 'Festivo' },
            ].map(({ c, l }) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 9, height: 9, borderRadius: 3, background: c }} />
                <span style={{ fontSize: 8, color: '#86868B' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px 16px', display: 'flex', gap: 8, flexShrink: 0, borderTop: '1px solid #F2F2F7' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={selDays.size === 0 || saving}
            style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none',
              background: selDays.size > 0 ? selectedType.color : '#E5E5EA',
              color: selDays.size > 0 ? '#FFF' : '#AEAEB2', fontSize: 12, fontWeight: 700,
              cursor: selDays.size > 0 ? 'pointer' : 'default' }}>
            {saving ? 'Guardando…' : `Guardar ${selDays.size} día${selDays.size !== 1 ? 's' : ''} · ${selectedType.initial}`}
          </button>
        </div>
      </div>
    </div>
  );
}
