// ═══ ESCALADO PANEL — Escalation global view with margin config + SM filter ═══
import { useState, useEffect, useMemo } from 'preact/hooks';
import type { Room, Member, Risk } from '@app-types/index';
import { loadRooms } from '@data/rooms';
import { loadTeamMembers } from '@data/team';
import { Icon } from '@components/common/Icon';

// Load retro snapshots for risk data
async function loadSnapshots(): Promise<Record<string, unknown>[]> {
  try {
    const { supabase } = await import('../../data/supabase');
    const { data } = await supabase.from('retros').select('sala,data,created_at').order('created_at', { ascending: false });
    return data ?? [];
  } catch { return []; }
}

// Load/save margin config from localStorage
const MARGIN_KEY = 'rf-escalation-margins';
interface Margins { critical: number; moderate: number; low: number; }
const defaultMargins: Margins = { critical: 2, moderate: 5, low: 10 };
const loadMargins = (): Margins => { try { return JSON.parse(localStorage.getItem(MARGIN_KEY) || '{}'); } catch { return defaultMargins; } };
const saveMargins = (m: Margins) => { try { localStorage.setItem(MARGIN_KEY, JSON.stringify(m)); } catch {} };

const LEVELS = [
  { id: 'equipo', label: 'Equipo', color: '#34C759', icon: 'Users' },
  { id: 'jp', label: 'Jefe Proyecto', color: '#FF9500', icon: 'UserCheck' },
  { id: 'sm', label: 'Service Manager', color: '#FF3B30', icon: 'Shield' },
  { id: 'dt', label: 'Dir. Técnica', color: '#5856D6', icon: 'Building' },
] as const;

const cardS = { background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA' } as const;

export function EscaladoPanel() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [allRisks, setAllRisks] = useState<Array<Risk & { _sala: string; _roomName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [margins, setMargins] = useState<Margins>({ ...defaultMargins, ...loadMargins() });
  const [filterSM, setFilterSM] = useState('');
  const [filterProject, setFilterProject] = useState('');

  useEffect(() => {
    Promise.all([loadRooms(), loadTeamMembers(), loadSnapshots()]).then(([roomsR, membersR, snaps]) => {
      const rms = roomsR.ok ? roomsR.data : [];
      const mbrs = membersR.ok ? membersR.data : [];
      setRooms(rms);
      setMembers(mbrs);

      // Latest snapshot per sala
      const bySala: Record<string, Record<string, unknown>> = {};
      snaps.forEach(s => {
        const sala = s.sala as string;
        if (!bySala[sala] || (s.created_at as string) > (bySala[sala].created_at as string)) bySala[sala] = s;
      });

      // Extract all escalated risks
      const risks: Array<Risk & { _sala: string; _roomName: string }> = [];
      Object.entries(bySala).forEach(([sala, snap]) => {
        const d = snap.data as Record<string, unknown>;
        if (!d?.risks) return;
        const roomName = rms.find(r => r.slug === sala)?.name || sala;
        ((d.risks as Risk[]) || []).forEach(r => {
          if (r.escalation?.level && r.escalation.level !== 'equipo') {
            risks.push({ ...r, _sala: sala, _roomName: roomName });
          }
        });
      });
      setAllRisks(risks);
      setLoading(false);
    });
  }, []);

  const updateMargin = (key: keyof Margins, val: number) => {
    const next = { ...margins, [key]: val };
    setMargins(next);
    saveMargins(next);
  };

  // SM list from room metadata
  const smList = useMemo(() => {
    const sms = new Set<string>();
    rooms.forEach(r => {
      const sm = (r.metadata as Record<string, unknown>)?.service_manager as string;
      if (sm) sms.add(sm);
    });
    return [...sms].sort();
  }, [rooms]);

  // Filter risks
  const filtered = useMemo(() => {
    let r = allRisks;
    if (filterSM) {
      const smRooms = new Set(rooms.filter(rm => (rm.metadata as Record<string, unknown>)?.service_manager === filterSM).map(rm => rm.slug));
      r = r.filter(x => smRooms.has(x._sala));
    }
    if (filterProject) r = r.filter(x => x._sala === filterProject);
    return r;
  }, [allRisks, filterSM, filterProject, rooms]);

  // Group by level
  const byLevel = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    LEVELS.forEach(l => { groups[l.id] = filtered.filter(r => r.escalation?.level === l.id); });
    return groups;
  }, [filtered]);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando…</div>;

  return (
    <div>
      {/* ── Margin config ── */}
      <div style={{ ...cardS, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Icon name="Clock" size={15} color="#86868B" />
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Tiempo de margen por criticidad de riesgo</h3>
        </div>
        <p style={{ fontSize: 11, color: '#86868B', marginBottom: 12 }}>Días antes de escalar automáticamente si el riesgo no se actualiza. Basado en la zona del mapa de calor.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {([
            { key: 'critical' as const, label: 'Crítico', color: '#FF3B30' },
            { key: 'moderate' as const, label: 'Moderado', color: '#FF9500' },
            { key: 'low' as const, label: 'Bajo', color: '#34C759' },
          ]).map(m => (
            <div key={m.key} style={{ padding: 14, borderRadius: 12, border: `1.5px solid ${m.color}20`, background: `${m.color}04` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: m.color, marginBottom: 8 }}>{m.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="number" min={1} max={30} value={margins[m.key]}
                  onInput={e => updateMargin(m.key, parseInt((e.target as HTMLInputElement).value) || 1)}
                  style={{ width: 60, padding: '6px 10px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 14, fontWeight: 700, outline: 'none', textAlign: 'center' }} />
                <span style={{ fontSize: 12, color: '#86868B' }}>días</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Header + Filters ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="TrendingUp" size={18} color="#FF3B30" /> Escalado Global
          </h2>
          <p style={{ fontSize: 12, color: '#86868B' }}>{filtered.length} riesgo{filtered.length !== 1 ? 's' : ''} en {rooms.length} proyectos</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={filterProject} onChange={e => setFilterProject((e.target as HTMLSelectElement).value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 11, outline: 'none', background: filterProject ? '#007AFF08' : '#FFF', color: filterProject ? '#007AFF' : '#6E6E73' }}>
            <option value="">Todos los proyectos</option>
            {rooms.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}
          </select>
          <select value={filterSM} onChange={e => setFilterSM((e.target as HTMLSelectElement).value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 11, outline: 'none', background: filterSM ? '#FF3B3008' : '#FFF', color: filterSM ? '#FF3B30' : '#6E6E73' }}>
            <option value="">Todos los SM</option>
            {smList.map(sm => <option key={sm} value={sm}>{sm}</option>)}
          </select>
        </div>
      </div>

      {/* ── Level KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${LEVELS.length},1fr)`, gap: 10, marginBottom: 16 }}>
        {LEVELS.map(l => {
          const count = byLevel[l.id]?.length || 0;
          return (
            <div key={l.id} style={{ ...cardS, padding: '14px 12px', textAlign: 'center', borderColor: `${l.color}30`, borderTopWidth: 3, borderTopColor: l.color }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: count > 0 ? l.color : '#D1D1D6' }}>{count > 0 ? count : '—'}</div>
              <div style={{ fontSize: 11, color: '#86868B', fontWeight: 600, marginTop: 2 }}>{l.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Risks by level ── */}
      {filtered.length === 0 && (
        <div style={{ ...cardS, padding: 32, textAlign: 'center' }}>
          <Icon name="CheckCircle" size={36} color="#34C759" />
          <p style={{ fontSize: 14, fontWeight: 600, color: '#34C759', marginTop: 10 }}>Sin riesgos escalados</p>
          <p style={{ fontSize: 12, color: '#86868B', marginTop: 4 }}>Todos los riesgos están controlados a nivel de equipo.</p>
        </div>
      )}

      {LEVELS.filter(l => l.id !== 'equipo' && (byLevel[l.id]?.length || 0) > 0).map(l => (
        <div key={l.id} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: l.color }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: l.color }}>{l.label}</span>
            <span style={{ fontSize: 12, color: '#86868B' }}>{byLevel[l.id].length} riesgo{byLevel[l.id].length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 8 }}>
            {byLevel[l.id].map(r => {
              const owner = r.escalation?.memberName || r.owner || '—';
              const status = r.escalation?.status || 'pendiente';
              const statusColor = status === 'resuelto' ? '#34C759' : status === 'en_proceso' ? '#007AFF' : '#FF9500';
              const daysSince = r.escalation?.escalatedAt ? Math.round((Date.now() - new Date(r.escalation.escalatedAt).getTime()) / 86400000) : null;
              return (
                <div key={r.id} style={{ ...cardS, padding: '12px 14px', borderLeftWidth: 3, borderLeftColor: l.color }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>{r.title || r.text}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 10, color: '#86868B' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Icon name="FolderOpen" size={10} color="#007AFF" />
                      <span style={{ color: '#007AFF', fontWeight: 600 }}>{r._roomName}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Icon name="User" size={10} color="#5856D6" />
                      <span style={{ color: '#5856D6', fontWeight: 600 }}>{owner}</span>
                    </span>
                    <span style={{ fontWeight: 600, color: statusColor, background: statusColor + '12', padding: '1px 6px', borderRadius: 4 }}>{status}</span>
                    {r.deadline && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Icon name="Calendar" size={10} color="#86868B" />
                        {new Date(r.deadline).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                      </span>
                    )}
                    {daysSince !== null && (
                      <span style={{ color: daysSince > (margins[l.id === 'dt' ? 'critical' : l.id === 'sm' ? 'moderate' : 'low'] || 5) ? '#FF3B30' : '#86868B', fontWeight: 600 }}>
                        hace {daysSince}d
                      </span>
                    )}
                  </div>
                  {r.description && (
                    <p style={{ fontSize: 11, color: '#6E6E73', marginTop: 6, lineHeight: 1.4 }}>{r.description.slice(0, 120)}{r.description.length > 120 ? '…' : ''}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
