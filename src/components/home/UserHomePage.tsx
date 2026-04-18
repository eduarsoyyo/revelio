// ═══ USER HOME PAGE — Redesigned with Wallet-style charts ═══
import { useState, useEffect, useMemo } from 'preact/hooks';
import type { AppUser, Room, Member, Task, Risk } from '@app-types/index';
import { loadTeamMembers } from '@data/team';
import { loadRooms } from '@data/rooms';
import { loadRetros } from '@data/retros';
import { loadCalendarios, calculateMonthlyBreakdown, calculateAnnualSummary, type Calendario } from '@data/calendarios';
import { Icon } from '@components/common/Icon';
import { Loading } from '@components/common/Feedback';
import { ProfileEditor } from '@components/common/ProfileEditor';
import { NotificationBell } from '@components/common/NotificationBell';
import { VacCalendarModal } from '@components/common/VacCalendarModal';
import { ANNUAL_VAC_DAYS, getAbsenceType, ABSENCE_TYPES } from '../../config/absenceTypes';
import { setUserPassword } from '../../data/auth';

// ─── Types ───
interface UserHomePageProps {
  user: AppUser;
  onLogout: () => void;
  onSelectProject: (slug: string, tipo: string) => void;
  onOpenAdmin: () => void;
}

// ─── Helpers ───
const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const fd = (iso: string | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';

const fdFull = (iso: string | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';

const healthColor = (pct: number) => pct >= 70 ? '#34C759' : pct >= 40 ? '#FF9500' : '#FF3B30';
const healthLabel = (pct: number) => pct >= 70 ? 'Buena' : pct >= 40 ? 'En riesgo' : 'Crítica';

const prioColor: Record<string, string> = { critical: '#FF3B30', high: '#FF9500', medium: '#007AFF', low: '#86868B' };
const prioLabel: Record<string, string> = { critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja' };

// ─── SVG Smooth Line Chart — Syncfusion spline-area style ───
function SmoothLineChart({ data, labels, color = '#007AFF', height = 200, secondaryData, secondaryColor = '#C7C7CC' }: {
  data: number[]; labels: string[]; color?: string; height?: number;
  secondaryData?: number[]; secondaryColor?: string;
}) {
  if (!data.length) return null;
  const w = 100, h = 60, padT = 8;
  const allVals = [...data, ...(secondaryData || [])];
  const max = Math.max(...allVals) * 1.08 || 1;
  const min = 0;
  const range = max - min || 1;

  const toPoint = (vals: number[]) => vals.map((v, i) => ({
    x: (i / Math.max(vals.length - 1, 1)) * w,
    y: padT + (h - padT) - ((v - min) / range) * (h - padT),
  }));

  // Catmull-Rom → Cubic Bezier for ultra-smooth spline
  const catmullRom = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return '';
    const tension = 0.35;
    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  };

  const pts = toPoint(data);
  const path = catmullRom(pts);
  const areaPath = `${path} L${pts[pts.length - 1].x},${h} L${pts[0].x},${h} Z`;

  const secPts = secondaryData ? toPoint(secondaryData) : null;
  const secPath = secPts ? catmullRom(secPts) : '';

  const curMonth = new Date().getMonth();
  const [hover, setHover] = useState<number | null>(null);
  const active = hover !== null ? hover : curMonth;

  // Y-axis ticks
  const yTicks = [0.25, 0.5, 0.75, 1].map(f => ({
    val: Math.round(max * f), y: padT + (h - padT) * (1 - f),
  }));

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`-8 -4 ${w + 16} ${h + 20}`} width="100%" height={height}
        style={{ overflow: 'visible' }}
        onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="sfGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        {/* Dashed grid */}
        {yTicks.map(t => (
          <g key={t.val}>
            <line x1={0} x2={w} y1={t.y} y2={t.y} stroke="#E5E5EA" strokeWidth={0.25} strokeDasharray="1.5,1.5" />
            <text x={-2} y={t.y + 1.2} textAnchor="end" fontSize={2.6} fill="#AEAEB2">{t.val}</text>
          </g>
        ))}
        <line x1={0} x2={w} y1={h} y2={h} stroke="#E8E8ED" strokeWidth={0.3} />
        {/* Secondary line (convenio) */}
        {secPath && (
          <path d={secPath} fill="none" stroke={secondaryColor} strokeWidth={0.6}
            strokeDasharray="2,1.5" opacity={0.5} />
        )}
        {/* Gradient fill */}
        <path d={areaPath} fill="url(#sfGrad)" />
        {/* Spline line */}
        <path d={path} fill="none" stroke={color} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
        {/* Data points + hit areas */}
        {pts.map((p, i) => {
          const isActive = i <= curMonth;
          const isCur = i === active;
          return (
            <g key={i}>
              <rect x={p.x - w / data.length / 2} y={-4} width={w / data.length} height={h + 20}
                fill="transparent" onMouseEnter={() => setHover(i)} />
              <circle cx={p.x} cy={p.y} r={isCur ? 2.2 : isActive ? 1.5 : 1}
                fill={isActive ? color : '#D1D1D6'} stroke="#FFF" strokeWidth={isCur ? 0.8 : 0.5}
                style={{ transition: 'all 0.15s' }} />
            </g>
          );
        })}
        {/* X labels */}
        {labels.map((l, i) => (
          <text key={i} x={pts[i]?.x || 0} y={h + 7}
            textAnchor="middle" fontSize={3} fill={i === active ? color : '#AEAEB2'}
            fontWeight={i === active ? 700 : 400}>{l}</text>
        ))}
        {/* Tooltip pill */}
        {pts[active] && (
          <g>
            <line x1={pts[active].x} y1={padT - 2} x2={pts[active].x} y2={h}
              stroke={color} strokeWidth={0.2} strokeDasharray="1,1" opacity={0.4} />
            <rect x={pts[active].x - 9} y={pts[active].y - 10} width={18} height={7}
              rx={3.5} fill={color} />
            <text x={pts[active].x} y={pts[active].y - 5.5} textAnchor="middle"
              fontSize={3.2} fill="#FFF" fontWeight={700}>{data[active]}</text>
            <polygon points={`${pts[active].x - 1.5},${pts[active].y - 3.2} ${pts[active].x + 1.5},${pts[active].y - 3.2} ${pts[active].x},${pts[active].y - 1.8}`} fill={color} />
            {secondaryData && (
              <text x={pts[active].x} y={pts[active].y - 13} textAnchor="middle"
                fontSize={2.5} fill="#86868B">conv: {secondaryData[active]}</text>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}

// ─── SVG Donut Chart ───
function DonutChart({ segments, size = 160, thickness = 24, centerLabel, centerValue }: {
  segments: { value: number; color: string; label: string }[];
  size?: number; thickness?: number;
  centerLabel?: string; centerValue?: string;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments.filter(s => s.value > 0).map(seg => {
    const pct = seg.value / total;
    const dash = pct * circ;
    const gap = circ - dash;
    const arc = { ...seg, dasharray: `${dash} ${gap}`, offset: -offset + circ * 0.25 };
    offset += dash;
    return arc;
  });

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F2F2F7" strokeWidth={thickness} />
        {arcs.map((a, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={a.color} strokeWidth={thickness}
            strokeDasharray={a.dasharray} strokeDashoffset={a.offset}
            style={{ transition: 'stroke-dasharray 0.5s ease' }} />
        ))}
        {centerValue && (
          <text x={cx} y={cy - 2} textAnchor="middle" fontSize={size * 0.2}
            fontWeight={800} fill="#1D1D1F" dominantBaseline="central">{centerValue}</text>
        )}
        {centerLabel && (
          <text x={cx} y={cy + size * 0.12} textAnchor="middle" fontSize={size * 0.09}
            fill="#86868B" fontWeight={500}>{centerLabel}</text>
        )}
      </svg>
      <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {segments.filter(s => s.value > 0).map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
            <span style={{ color: '#6E6E73' }}>{s.label}</span>
            <span style={{ fontWeight: 700, color: '#1D1D1F' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ MAIN COMPONENT ═══
export function UserHomePage({ user, onLogout, onSelectProject, onOpenAdmin }: UserHomePageProps) {
  const [section, setSection] = useState('dashboard');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [profile, setProfile] = useState<Member | null>(null);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showVacModal, setShowVacModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [allData, setAllData] = useState<Record<string, { actions?: Task[]; risks?: Risk[] }>>({});
  const [loading, setLoading] = useState(true);
  const [calendarios, setCalendarios] = useState<Calendario[]>([]);
  const [taskFilter, setTaskFilter] = useState<'today' | 'week' | 'all'>('today');
  const [projectFilter, setProjectFilter] = useState<'active' | 'closed' | 'all'>('active');
  const [personasView, setPersonasView] = useState<'grid' | 'list'>('grid');
  const [riskCollapsed, setRiskCollapsed] = useState<Record<string, boolean>>({});

  const isSM = user?.isSuperuser || (user as any)?._isAdmin;
  const today = new Date().toISOString().slice(0, 10);
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  useEffect(() => {
    Promise.all([loadRooms(), loadTeamMembers(), loadRetros(), loadCalendarios()]).then(([roomsR, membersR, retrosR, cals]) => {
      const rms = roomsR.ok ? roomsR.data : [];
      setRooms(rms);
      setCalendarios(cals);
      const members = membersR.ok ? membersR.data : [];
      setAllMembers(members);
      const uq = (user.username || user.name || '').toLowerCase().trim();
      const me = members.find(m =>
        (m.username && m.username.toLowerCase().trim() === uq) ||
        (m.name && m.name.toLowerCase().trim() === uq));
      setProfile(me || null);
      const snaps = retrosR.ok ? retrosR.data : [];
      const bySala: Record<string, { sala: string; created_at: string; data?: Record<string, unknown> }> = {};
      snaps.forEach(s => { const snap = s as any; if (!bySala[snap.sala] || snap.created_at > bySala[snap.sala].created_at) bySala[snap.sala] = snap; });
      const data: typeof allData = {};
      Object.entries(bySala).forEach(([sala, snap]) => { if (snap.data) data[sala] = snap.data as any; });
      setAllData(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!showAvatarMenu) return;
    const h = () => setShowAvatarMenu(false);
    setTimeout(() => document.addEventListener('click', h), 0);
    return () => document.removeEventListener('click', h);
  }, [showAvatarMenu]);

  if (loading) return <Loading />;

  // ─── Derived data ───
  const myRooms = rooms.filter(r => {
    if (!profile) return true;
    return (profile.rooms || []).includes(r.slug);
  });

  const allTasks = Object.entries(allData).flatMap(([slug, d]) =>
    (d.actions || []).map(a => ({ ...a, _room: rooms.find(r => r.slug === slug)?.name || slug, _slug: slug })));
  const myTasks = allTasks.filter(a => a.owner === user.name || a.createdBy === user.id);
  const pendingTasks = myTasks.filter(a => a.status !== 'done' && a.status !== 'archived' && a.status !== 'discarded' && a.status !== 'cancelled');
  const overdueTasks = pendingTasks.filter(a => a.date && a.date < today);

  const filteredTasks = (() => {
    if (taskFilter === 'today') return pendingTasks.filter(a => a.date && a.date <= today);
    if (taskFilter === 'week') return pendingTasks.filter(a => a.date && a.date <= weekAhead);
    return pendingTasks;
  })();

  const allRisks = Object.entries(allData).flatMap(([slug, d]) =>
    (d.risks || []).map(r => ({ ...r, _room: rooms.find(rm => rm.slug === slug)?.name || slug, _slug: slug })));
  const openRisks = allRisks.filter(r => r.status !== 'mitigated');
  const escalatedRisks = openRisks.filter(r => r.escalation?.level);
  const criticalRisks = openRisks.filter(r => r.impact === 'alto' && r.prob === 'alta');

  const projectHealth = (slug: string) => {
    const d = allData[slug]; if (!d) return 50;
    const tasks = d.actions || []; const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done' || t.status === 'archived').length;
    const risks = (d.risks || []).filter(r => r.status !== 'mitigated').length;
    if (total === 0) return 80;
    return Math.round(Math.max(0, Math.min(100, (done / total) * 70 + 30 - Math.min(risks * 5, 30))));
  };

  const projectProgress = (slug: string) => {
    const d = allData[slug]; if (!d) return 0;
    const tasks = d.actions || []; if (!tasks.length) return 0;
    return Math.round(tasks.filter(t => t.status === 'done' || t.status === 'archived').length / tasks.length * 100);
  };

  const projectStats = (slug: string) => {
    const d = allData[slug]; const tasks = d?.actions || [];
    const risks = (d?.risks || []).filter(r => r.status !== 'mitigated');
    const members = allMembers.filter(m => (m.rooms || []).includes(slug));
    return { tasks: tasks.length, done: tasks.filter(t => t.status === 'done' || t.status === 'archived').length, risks: risks.length, members: members.length };
  };

  const memberWorkload = (m: Member) => allTasks.filter(t => t.owner === m.name && t.status !== 'done' && t.status !== 'archived' && t.status !== 'discarded').length;
  const isOnVacation = (m: Member) => (m.vacations || []).some(v => v.from <= today && (!v.to || v.to >= today));

  const risksByProject = Object.entries(allData).map(([slug, d]) => ({
    slug, name: rooms.find(r => r.slug === slug)?.name || slug,
    risks: (d.risks || []).filter(r => r.status !== 'mitigated'),
  })).filter(p => p.risks.length > 0);

  const toggleCollapse = (slug: string) => setRiskCollapsed(p => ({ ...p, [slug]: !p[slug] }));

  // ─── Calendar data ───
  const myCal = calendarios.find(c => c.id === (profile as Record<string, unknown>)?.calendario_id);
  const calBreakdown = myCal ? calculateMonthlyBreakdown(myCal) : null;
  const calSummary = myCal ? calculateAnnualSummary(myCal) : null;

  // ─── Health donut ───
  const healthSegments = useMemo(() => {
    const good = myRooms.filter(r => projectHealth(r.slug) >= 70).length;
    const risk = myRooms.filter(r => { const h = projectHealth(r.slug); return h >= 40 && h < 70; }).length;
    const crit = myRooms.filter(r => projectHealth(r.slug) < 40).length;
    return [
      { value: good, color: '#34C759', label: 'Buena' },
      { value: risk, color: '#FF9500', label: 'En riesgo' },
      { value: crit, color: '#FF3B30', label: 'Crítica' },
    ];
  }, [myRooms, allData]);

  // ─── Styles ───
  const cardS = { background: '#FFF', borderRadius: 16, border: '1px solid #E8E8ED', padding: 16, boxShadow: '0 1px 3px #0000000a' } as const;
  const pillS = (active: boolean) => ({
    padding: '6px 14px', borderRadius: 8, border: 'none',
    background: active ? '#007AFF' : '#F2F2F7', color: active ? '#FFF' : '#6E6E73',
    fontSize: 12, fontWeight: 600 as const, cursor: 'pointer' as const, transition: 'all .15s',
  });
  const tagS = (bg: string, fg: string) => ({
    display: 'inline-block' as const, padding: '2px 8px', borderRadius: 6, fontSize: 10,
    fontWeight: 700 as const, background: bg, color: fg, lineHeight: '16px',
  });
  const kpiS = { ...cardS, display: 'flex' as const, alignItems: 'center' as const, gap: 10, padding: '14px 16px' };

  const navItems = [
    { id: 'dashboard', icon: 'Home', label: 'Inicio' },
    { id: 'proyectos', icon: 'FolderOpen', label: 'Proyectos' },
    { id: 'personas', icon: 'Users', label: 'Personas' },
    { id: 'riesgos', icon: 'AlertTriangle', label: 'Riesgos' },
    { id: 'perfil', icon: 'User', label: 'Mi perfil' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F5F5F7' }}>

      {/* ═══ HEADER (full-width) ═══ */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px', background: '#FFF', borderBottom: '1px solid #E8E8ED', flexShrink: 0, zIndex: 20 }}>
        <h1 style={{
          fontFamily: "'Comfortaa',sans-serif", fontSize: 18, fontWeight: 400,
          background: 'linear-gradient(90deg,#007AFF,#5856D6)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0,
        }}>revelio</h1>
        <div style={{ width: 1, height: 20, background: '#E5E5EA', margin: '0 4px' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F' }}>Home</span>
        <div style={{ flex: 1 }} />
        <NotificationBell user={user} global />
        {isSM && (
          <button onClick={onOpenAdmin}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid #E8E8ED', background: '#FFF', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#5856D6' }}>
            <Icon name="LayoutDashboard" size={13} color="#5856D6" /> Centro de control
          </button>
        )}
        <div style={{ position: 'relative' }}>
          <button onClick={(e) => { e.stopPropagation(); setShowAvatarMenu(!showAvatarMenu); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 4px', borderRadius: 10, border: '1px solid #E8E8ED', background: '#FFF', cursor: 'pointer' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: user.color || '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{user.avatar || '👤'}</div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F' }}>{user.name}</span>
            <Icon name="ChevronDown" size={12} color="#86868B" />
          </button>
          {showAvatarMenu && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#FFF', borderRadius: 12, border: '1px solid #E8E8ED', boxShadow: '0 8px 24px #0002', minWidth: 180, zIndex: 100, overflow: 'hidden' }}>
              <button onClick={() => { setSection('perfil'); setShowAvatarMenu(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: 'none', background: 'none', width: '100%', textAlign: 'left', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#1D1D1F' }}>
                <Icon name="User" size={14} color="#007AFF" /> Mi perfil
              </button>
              <div style={{ height: 1, background: '#F2F2F7' }} />
              <button onClick={onLogout}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: 'none', background: 'none', width: '100%', textAlign: 'left', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#FF3B30' }}>
                <Icon name="LogOut" size={14} color="#FF3B30" /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ═══ SIDEBAR ═══ */}
        <aside style={{ width: 220, background: '#FFF', borderRight: '1px solid #E8E8ED', padding: '16px 14px', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
          {navItems.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                border: 'none', background: section === s.id ? '#F2F2F7' : 'transparent',
                color: section === s.id ? '#007AFF' : '#6E6E73', fontSize: 13, fontWeight: section === s.id ? 700 : 500,
                cursor: 'pointer', marginBottom: 2, width: '100%', textAlign: 'left', transition: 'all .15s',
              }}>
              <Icon name={s.icon} size={16} color={section === s.id ? '#007AFF' : '#86868B'} />
              {s.label}
              {s.id === 'riesgos' && openRisks.length > 0 && (
                <span style={{ marginLeft: 'auto', background: '#FF3B30', color: '#FFF', fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 8 }}>{openRisks.length}</span>
              )}
            </button>
          ))}
          <div style={{ marginTop: 'auto' }} />
        </aside>

        {/* ═══ CONTENT ═══ */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

          {/* ═══ INICIO ═══ */}
          {section === 'dashboard' && (
            <div style={{ maxWidth: 840 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 2, color: '#1D1D1F' }}>
                {new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 20 ? 'Buenas tardes' : 'Buenas noches'}, {user.name.split(' ')[0]}
              </h1>
              <p style={{ fontSize: 13, color: '#86868B', marginBottom: 20 }}>
                {fdFull(today)} · {myRooms.length} proyecto{myRooms.length !== 1 ? 's' : ''} activo{myRooms.length !== 1 ? 's' : ''}
              </p>

              {overdueTasks.length > 0 && (
                <div style={{ ...cardS, borderColor: '#FF3B3030', borderLeft: '4px solid #FF3B30', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: '#FF3B30' }} />
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: '#FF3B30', margin: 0 }}>Requiere tu atención</h2>
                    <span style={{ fontSize: 11, color: '#86868B', marginLeft: 'auto' }}>{overdueTasks.length}</span>
                  </div>
                  {overdueTasks.slice(0, 4).map(a => (
                    <div key={a.id} onClick={() => onSelectProject((a as any)._slug, rooms.find(r => r.slug === (a as any)._slug)?.tipo || 'agile')}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: '#FFF5F5', marginBottom: 3, cursor: 'pointer' }}>
                      <Icon name="AlertCircle" size={13} color="#FF3B30" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{a.text}</div>
                        <div style={{ fontSize: 10, color: '#86868B' }}>{(a as any)._room} · Venció {fd(a.date)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {([['today', 'Hoy'], ['week', 'Esta semana'], ['all', 'Todo']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setTaskFilter(k)} style={pillS(taskFilter === k)}>
                    {l}
                    <span style={{ marginLeft: 4, opacity: 0.7 }}>
                      {k === 'today' ? pendingTasks.filter(a => a.date && a.date <= today).length
                        : k === 'week' ? pendingTasks.filter(a => a.date && a.date <= weekAhead).length
                        : pendingTasks.length}
                    </span>
                  </button>
                ))}
              </div>

              <div style={{ ...cardS, padding: 0 }}>
                {filteredTasks.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: '#86868B' }}>
                    <Icon name="CheckCircle" size={28} color="#34C759" />
                    <p style={{ fontSize: 13, marginTop: 8 }}>
                      {taskFilter === 'today' ? 'Nada pendiente para hoy' : taskFilter === 'week' ? 'Semana despejada' : 'Sin accionables pendientes'}
                    </p>
                  </div>
                ) : (
                  filteredTasks.sort((a, b) => (a.date || '9').localeCompare(b.date || '9')).map((t, i) => (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                      borderBottom: i < filteredTasks.length - 1 ? '1px solid #F2F2F7' : 'none',
                      cursor: 'pointer', transition: 'background .15s',
                    }}
                    onMouseOver={e => (e.currentTarget as HTMLElement).style.background = '#FAFAFA'}
                    onMouseOut={e => (e.currentTarget as HTMLElement).style.background = ''}
                    onClick={() => onSelectProject((t as any)._slug, rooms.find(r => r.slug === (t as any)._slug)?.tipo || 'agile')}>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: prioColor[t.priority] || '#86868B', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F' }}>{t.text}</div>
                        <div style={{ fontSize: 10, color: '#86868B', marginTop: 1 }}>
                          {(t as any)._room}{t.date ? ` · ${fdFull(t.date)}` : ''}{t.owner ? ` · ${t.owner}` : ''}
                        </div>
                      </div>
                      <span style={tagS(prioColor[t.priority] + '15', prioColor[t.priority])}>{prioLabel[t.priority] || t.priority}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ═══ PROYECTOS ═══ */}
          {section === 'proyectos' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Proyectos</h1>
                <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                  {(['active', 'closed', 'all'] as const).map(f => (
                    <button key={f} onClick={() => setProjectFilter(f)} style={pillS(projectFilter === f)}>
                      {f === 'active' ? 'Activos' : f === 'closed' ? 'Cerrados' : 'Todos'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, marginBottom: 20, alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { v: myRooms.length, l: 'Proyectos', c: '#007AFF', i: 'FolderOpen' },
                    { v: openRisks.length, l: 'Riesgos abiertos', c: openRisks.length > 0 ? '#FF9500' : '#34C759', i: 'AlertTriangle' },
                  ].map(k => (
                    <div key={k.l} style={kpiS}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: k.c + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name={k.i} size={16} color={k.c} />
                      </div>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: k.c }}>{k.v}</div>
                        <div style={{ fontSize: 10, color: '#86868B' }}>{k.l}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { v: escalatedRisks.length, l: 'Escalados', c: escalatedRisks.length > 0 ? '#FF3B30' : '#34C759', i: 'ArrowUpCircle' },
                    { v: `${Math.round(myRooms.reduce((s, r) => s + projectProgress(r.slug), 0) / Math.max(myRooms.length, 1))}%`, l: 'Avance medio', c: '#5856D6', i: 'TrendingUp' },
                  ].map(k => (
                    <div key={k.l} style={kpiS}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: k.c + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name={k.i} size={16} color={k.c} />
                      </div>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: k.c }}>{k.v}</div>
                        <div style={{ fontSize: 10, color: '#86868B' }}>{k.l}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ ...cardS, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                  <DonutChart segments={healthSegments} size={160} thickness={24}
                    centerValue={`${myRooms.length}`} centerLabel="proyectos" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
                {myRooms
                  .filter(r => {
                    const isClosed = (r.metadata as any)?.status === 'closed';
                    if (projectFilter === 'active') return !isClosed;
                    if (projectFilter === 'closed') return isClosed;
                    return true;
                  })
                  .map(r => {
                  const stats = projectStats(r.slug);
                  const health = projectHealth(r.slug);
                  const progress = projectProgress(r.slug);
                  const isClosed = (r.metadata as any)?.status === 'closed';
                  return (
                    <div key={r.slug} onClick={() => onSelectProject(r.slug, r.tipo)}
                      style={{ ...cardS, cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s', opacity: isClosed ? 0.6 : 1 }}
                      onMouseOver={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#007AFF'; el.style.boxShadow = '0 4px 12px #007AFF15'; }}
                      onMouseOut={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#E8E8ED'; el.style.boxShadow = '0 1px 3px #0000000a'; }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{r.name}</div>
                        {isClosed && <span style={tagS('#F2F2F7', '#86868B')}>Cerrado</span>}
                        <span style={tagS(healthColor(health) + '15', healthColor(health))}>{healthLabel(health)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#86868B', marginBottom: 10 }}>{r.tipo}</div>
                      <div style={{ height: 4, background: '#F2F2F7', borderRadius: 2, marginBottom: 10 }}>
                        <div style={{ height: 4, borderRadius: 2, background: '#007AFF', width: `${progress}%`, transition: 'width .3s' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#6E6E73' }}>
                        <span><strong style={{ color: '#1D1D1F' }}>{stats.done}</strong>/{stats.tasks} tareas</span>
                        <span><Icon name="AlertTriangle" size={11} color="#FF9500" /> {stats.risks}</span>
                        <span><Icon name="Users" size={11} color="#86868B" /> {stats.members}</span>
                        <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#007AFF' }}>{progress}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ PERSONAS ═══ */}
          {section === 'personas' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Personas</h1>
                <span style={{ fontSize: 12, color: '#86868B' }}>{allMembers.length} miembros</span>
                <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                  <button onClick={() => setPersonasView('grid')} style={pillS(personasView === 'grid')}>
                    <Icon name="LayoutGrid" size={12} color={personasView === 'grid' ? '#FFF' : '#6E6E73'} />
                  </button>
                  <button onClick={() => setPersonasView('list')} style={pillS(personasView === 'list')}>
                    <Icon name="List" size={12} color={personasView === 'list' ? '#FFF' : '#6E6E73'} />
                  </button>
                </div>
              </div>

              {personasView === 'grid' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {allMembers.map(m => {
                    const wl = memberWorkload(m);
                    const onVac = isOnVacation(m);
                    return (
                      <div key={m.id} style={{ ...cardS, textAlign: 'center', padding: 20, position: 'relative', transition: 'border-color .15s' }}
                        onMouseOver={e => (e.currentTarget as HTMLElement).style.borderColor = '#007AFF40'}
                        onMouseOut={e => (e.currentTarget as HTMLElement).style.borderColor = '#E8E8ED'}>
                        {onVac && <span style={{ position: 'absolute', top: 8, right: 8, ...tagS('#FF950020', '#FF9500') }}>Ausente</span>}
                        <div style={{ width: 48, height: 48, borderRadius: 14, background: m.color || '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 8px' }}>{m.avatar || '👤'}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: '#86868B', marginBottom: 6 }}>{m.role_label || '—'}{m.company ? ` · ${m.company}` : ''}</div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, fontSize: 10, color: '#6E6E73' }}>
                          <span><Icon name="FolderOpen" size={10} color="#86868B" /> {(m.rooms || []).length}</span>
                          <span style={{ color: wl > 5 ? '#FF3B30' : '#6E6E73' }}><Icon name="ClipboardList" size={10} color={wl > 5 ? '#FF3B30' : '#86868B'} /> {wl}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ ...cardS, padding: 0, overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid #E8E8ED', textAlign: 'left' }}>
                        {['Nombre', 'Rol', 'Empresa', 'Proyectos', 'Carga', 'Estado'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', fontSize: 10, color: '#86868B', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allMembers.map(m => {
                        const wl = memberWorkload(m);
                        const onVac = isOnVacation(m);
                        return (
                          <tr key={m.id} style={{ borderBottom: '1px solid #F2F2F7' }}>
                            <td style={{ padding: '8px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 24, height: 24, borderRadius: 7, background: m.color || '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{m.avatar || '👤'}</div>
                                <span style={{ fontWeight: 600 }}>{m.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '8px 10px', color: '#6E6E73' }}>{m.role_label || '—'}</td>
                            <td style={{ padding: '8px 10px', color: '#6E6E73' }}>{m.company || '—'}</td>
                            <td style={{ padding: '8px 10px' }}>{(m.rooms || []).length}</td>
                            <td style={{ padding: '8px 10px', color: wl > 5 ? '#FF3B30' : '#1D1D1F', fontWeight: wl > 5 ? 700 : 400 }}>{wl} tareas</td>
                            <td style={{ padding: '8px 10px' }}>
                              {onVac ? <span style={tagS('#FF950020', '#FF9500')}>Ausente</span>
                                : <span style={tagS('#34C75920', '#34C759')}>Disponible</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ═══ RIESGOS ═══ */}
          {section === 'riesgos' && (
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Riesgos</h1>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { v: openRisks.length, l: 'Abiertos', c: '#FF9500', i: 'AlertTriangle' },
                  { v: criticalRisks.length, l: 'Críticos', c: '#FF3B30', i: 'Flame' },
                  { v: escalatedRisks.length, l: 'Escalados', c: '#5856D6', i: 'ArrowUpCircle' },
                  { v: allRisks.filter(r => r.status === 'mitigated').length, l: 'Mitigados', c: '#34C759', i: 'Shield' },
                ].map(k => (
                  <div key={k.l} style={kpiS}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: k.c + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={k.i} size={16} color={k.c} />
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: k.c }}>{k.v}</div>
                      <div style={{ fontSize: 10, color: '#86868B' }}>{k.l}</div>
                    </div>
                  </div>
                ))}
              </div>

              {escalatedRisks.length > 0 && (
                <div style={{ ...cardS, borderColor: '#5856D620', borderLeft: '4px solid #5856D6', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Icon name="ArrowUpCircle" size={16} color="#5856D6" />
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: '#5856D6', margin: 0 }}>Escalados</h2>
                    <span style={{ fontSize: 11, color: '#86868B', marginLeft: 'auto' }}>{escalatedRisks.length}</span>
                  </div>
                  {escalatedRisks.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: '#F9F5FF', marginBottom: 3, cursor: 'pointer' }}
                      onClick={() => onSelectProject((r as any)._slug, rooms.find(rm => rm.slug === (r as any)._slug)?.tipo || 'agile')}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{r.title || (r as any).text}</div>
                        <div style={{ fontSize: 10, color: '#86868B' }}>{(r as any)._room} · {r.escalation?.level?.toUpperCase()} · {r.impact}/{r.prob}</div>
                      </div>
                      <span style={tagS(
                        (r.type === 'riesgo' ? '#FF9500' : r.type === 'problema' ? '#FF3B30' : '#34C759') + '15',
                        r.type === 'riesgo' ? '#FF9500' : r.type === 'problema' ? '#FF3B30' : '#34C759'
                      )}>{r.type}</span>
                    </div>
                  ))}
                </div>
              )}

              {risksByProject.map(p => (
                <div key={p.slug} style={{ ...cardS, marginBottom: 8 }}>
                  <button onClick={() => toggleCollapse(p.slug)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                    <Icon name={riskCollapsed[p.slug] ? 'ChevronRight' : 'ChevronDown'} size={14} color="#86868B" />
                    <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{p.name}</span>
                    <span style={tagS('#FF950015', '#FF9500')}>{p.risks.length}</span>
                  </button>
                  {!riskCollapsed[p.slug] && (
                    <div style={{ marginTop: 10 }}>
                      {p.risks.map(r => (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #F2F2F7', fontSize: 12 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 4, background: r.type === 'riesgo' ? '#FF9500' : r.type === 'problema' ? '#FF3B30' : '#34C759', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 600 }}>{r.title || (r as any).text}</span>
                            {r.owner && <span style={{ color: '#86868B', marginLeft: 6 }}>· {r.owner}</span>}
                          </div>
                          <span style={{ fontSize: 10, color: '#86868B' }}>{r.impact}/{r.prob}</span>
                          {r.escalation?.level && <Icon name="ArrowUpCircle" size={12} color="#5856D6" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {openRisks.length === 0 && (
                <div style={{ ...cardS, textAlign: 'center', padding: 40, color: '#86868B' }}>
                  <Icon name="Shield" size={32} color="#34C759" />
                  <p style={{ marginTop: 8, fontSize: 13 }}>Sin riesgos abiertos</p>
                </div>
              )}
            </div>
          )}

          {/* ═══ MI PERFIL ═══ */}
          {section === 'perfil' && profile && (
            <div style={{ maxWidth: 640 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>Mi perfil</h1>

              {/* Identity — full data, read only */}
              <div style={{ ...cardS, padding: 24, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: profile.color || '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{profile.avatar || '👤'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{profile.name}</div>
                    <div style={{ fontSize: 13, color: '#86868B' }}>{profile.role_label || '—'}{profile.company ? ` · ${profile.company}` : ''}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {([
                    { icon: 'User', label: 'Usuario', value: profile.username || '—' },
                    { icon: 'Mail', label: 'Email', value: profile.email || '—' },
                    { icon: 'Phone', label: 'Teléfono', value: profile.phone || '—' },
                    { icon: 'Briefcase', label: 'Empresa', value: profile.company || '—' },
                    { icon: 'Shield', label: 'Rol', value: profile.role_label || '—' },
                    { icon: 'Calendar', label: 'Calendario', value: myCal?.name || 'Sin asignar' },
                    { icon: 'FolderOpen', label: 'Proyectos', value: `${(profile.rooms || []).length} asignados` },
                    { icon: 'Hash', label: 'ID', value: profile.id?.slice(0, 8) || '—' },
                  ] as const).map(f => (
                    <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0' }}>
                      <Icon name={f.icon as string} size={12} color="#86868B" />
                      <div>
                        <div style={{ fontSize: 9, color: '#AEAEB2', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{f.label}</div>
                        <div style={{ fontSize: 12, color: '#1D1D1F', fontWeight: 500 }}>{f.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => setShowProfileEditor(true)}
                    style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #E8E8ED', background: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#007AFF', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="Edit" size={13} color="#007AFF" /> Editar perfil
                  </button>
                </div>

                {/* Cambiar clave */}
                <div style={{ marginTop: 14, padding: 14, background: '#F9F9FB', borderRadius: 12, border: '1px solid #E5E5EA' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#86868B', marginBottom: 8 }}>Cambiar contraseña</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="password" value={newPassword}
                      onInput={(e: Event) => { setNewPassword((e.target as HTMLInputElement).value); setPwMsg(''); }}
                      placeholder="Nueva contraseña…"
                      style={{ flex: 1, border: '1px solid #E5E5EA', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit', outline: 'none', background: '#FFF' }} />
                    <button disabled={!newPassword.trim() || pwSaving}
                      onClick={async () => {
                        setPwSaving(true);
                        const ok = await setUserPassword(profile.id, newPassword.trim());
                        setPwSaving(false);
                        setPwMsg(ok ? '✅ Actualizada' : '❌ Error');
                        if (ok) setNewPassword('');
                        setTimeout(() => setPwMsg(''), 3000);
                      }}
                      style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: newPassword.trim() ? '#1D1D1F' : '#E5E5EA', color: newPassword.trim() ? '#FFF' : '#AEAEB2', fontSize: 11, fontWeight: 600, cursor: newPassword.trim() ? 'pointer' : 'default' }}>
                      {pwSaving ? '…' : 'Guardar'}
                    </button>
                  </div>
                  {pwMsg && <div style={{ fontSize: 10, marginTop: 4, color: pwMsg.includes('✅') ? '#34C759' : '#FF3B30' }}>{pwMsg}</div>}
                </div>
              </div>

              {/* Notifications */}
              <div style={{ ...cardS, padding: 20, marginBottom: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="Bell" size={15} color="#007AFF" /> Preferencias de notificación
                </h3>
                {[
                  { label: 'Accionables vencidos', key: 'overdue' },
                  { label: 'Riesgos escalados', key: 'escalated' },
                  { label: 'Nuevas asignaciones', key: 'assigned' },
                ].map(n => (
                  <label key={n.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F2F2F7', fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: '#007AFF' }} />
                    {n.label}
                  </label>
                ))}
              </div>

              {/* Vacations — 4 KPIs + progress bar + Gestionar button */}
              {(() => {
                const yr = new Date().getFullYear();
                const myVacs = (profile.vacations || []);
                const cntVacDays = myVacs.filter(v => (v.type || 'vacaciones') === 'vacaciones' && v.from).reduce((sum, v) => {
                  let d = new Date(v.from); const to = new Date(v.to || v.from); let cnt = 0;
                  while (d <= to) { const dow = d.getDay(); if (d.getFullYear() === yr && dow !== 0 && dow !== 6) cnt++; d.setDate(d.getDate() + 1); }
                  return sum + cnt;
                }, 0);
                const annualD = profile.annual_vac_days || ANNUAL_VAC_DAYS;
                const prevP = profile.prev_year_pending || 0;
                const total = annualD + prevP;
                const remain = Math.max(0, total - cntVacDays);
                const pct = total > 0 ? Math.min(100, Math.round((cntVacDays / total) * 100)) : 0;
                return (
                  <div style={{ ...cardS, padding: 20, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="Calendar" size={15} color="#007AFF" /> Vacaciones {yr}
                      </h3>
                      <button onClick={() => setShowVacModal(true)}
                        style={{ fontSize: 11, fontWeight: 600, color: '#007AFF', background: '#007AFF12', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="CalendarPlus" size={12} color="#007AFF" /> Gestionar vacaciones
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                      {([
                        { v: annualD, l: 'Días/año', c: '#1D1D1F' },
                        { v: prevP, l: 'Año anterior', c: '#5856D6' },
                        { v: total, l: 'Total disp.', c: '#007AFF' },
                        { v: remain, l: 'Restantes', c: remain <= 5 ? '#FF3B30' : remain <= 10 ? '#FF9500' : '#34C759' },
                      ] as const).map(k => (
                        <div key={k.l} style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 10, background: '#FFF', border: `1px solid ${k.c}20` }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: k.c }}>{k.v}</div>
                          <div style={{ fontSize: 9, color: '#86868B', marginTop: 2, lineHeight: 1.2 }}>{k.l}</div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#86868B', marginBottom: 4 }}>
                        <span>Consumido: {cntVacDays}d de {total}d</span>
                        <span style={{ fontWeight: 700 }}>{pct}%</span>
                      </div>
                      <div style={{ background: '#E5E5EA', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 6,
                          background: pct < 50 ? '#FF3B30' : pct < 80 ? '#FF9500' : '#34C759' }} />
                      </div>
                    </div>
                    {myVacs.filter(v => new Date(v.from || '').getFullYear() === yr).length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.4 }}>Registro {yr}</div>
                        {[...myVacs].filter(v => new Date(v.from || '').getFullYear() === yr).sort((a, b) => (b.from || '').localeCompare(a.from || '')).slice(0, 6).map((v, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #F2F2F7', fontSize: 12 }}>
                            <Icon name="Calendar" size={12} color="#86868B" />
                            <span style={{ fontWeight: 600 }}>{fdFull(v.from)}{v.to && v.to !== v.from ? ` → ${fdFull(v.to)}` : ''}</span>
                            {v.type && <span style={tagS('#007AFF15', '#007AFF')}>{v.type}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Convenio chart */}
              {calBreakdown && calSummary && myCal && (
                <div style={{ ...cardS, padding: 20, marginBottom: 14 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="Clock" size={15} color="#007AFF" /> Jornada — {myCal.name}
                  </h3>
                  <p style={{ fontSize: 11, color: '#86868B', marginBottom: 14 }}>
                    {myCal.convenio_hours}h convenio · {calSummary.effectiveHours}h efectivas ·{' '}
                    <span style={{ color: calSummary.diff >= 0 ? '#34C759' : '#FF3B30', fontWeight: 700 }}>{calSummary.diff >= 0 ? '+' : ''}{calSummary.diff}h</span>
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                    <span style={tagS('#007AFF15', '#007AFF')}>L-J {myCal.daily_hours_lj}h</span>
                    <span style={tagS('#5856D615', '#5856D6')}>V {myCal.daily_hours_v}h</span>
                    <span style={tagS('#FF950015', '#FF9500')}>Intensiva {myCal.daily_hours_intensive}h</span>
                    <span style={tagS('#34C75915', '#34C759')}>{myCal.intensive_start?.replace('-', '/')} → {myCal.intensive_end?.replace('-', '/')}</span>
                    <span style={tagS('#F2F2F7', '#6E6E73')}>{myCal.vacation_days} vac</span>
                    {(myCal.free_days || 0) > 0 && <span style={tagS('#AF52DE15', '#AF52DE')}>{myCal.free_days} libre disp.</span>}
                    {(myCal.adjustment_days || 0) > 0 && <span style={tagS('#F2F2F7', '#6E6E73')}>{myCal.adjustment_days}d + {myCal.adjustment_hours}h ajuste</span>}
                  </div>

                  <SmoothLineChart
                    data={calBreakdown.map(m => Math.round(m.hours))}
                    labels={MONTHS}
                    color="#007AFF"
                    height={160}
                    secondaryData={calBreakdown.map(() => Math.round((myCal.convenio_hours || 1800) / 12))}
                    secondaryColor="#C7C7CC"
                  />
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, fontSize: 10, color: '#86868B' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 16, height: 2, background: '#007AFF', borderRadius: 1 }} /> Horas efectivas/mes</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 16, height: 2, background: '#C7C7CC', borderRadius: 1 }} /> Media convenio</span>
                  </div>

                  <div style={{ marginTop: 14, overflowX: 'auto' }}>
                    {(() => {
                      const yr = new Date().getFullYear();
                      const curM = new Date().getMonth();
                      const myVacs = profile ? (profile.vacations || []) : [];
                      const cntMonth = (month: number, isVac: boolean) => myVacs.reduce((sum, v) => {
                        const t = v.type || 'vacaciones';
                        if (isVac ? t !== 'vacaciones' : t === 'vacaciones') return sum;
                        if (!v.from) return sum;
                        let d = new Date(v.from); const to = new Date(v.to || v.from); let cnt = 0;
                        while (d <= to) { if (d.getFullYear() === yr && d.getMonth() === month && d.getDay() !== 0 && d.getDay() !== 6) cnt++; d.setDate(d.getDate() + 1); }
                        return sum + cnt;
                      }, 0);
                      // Tooltip: list absences per month with type, dates, note
                      const tooltipMonth = (month: number, isVac: boolean) => {
                        const entries = myVacs.filter(v => {
                          const t = v.type || 'vacaciones';
                          if (isVac ? t !== 'vacaciones' : t === 'vacaciones') return false;
                          if (!v.from) return false;
                          const from = new Date(v.from); const to = new Date(v.to || v.from);
                          return (from.getMonth() === month && from.getFullYear() === yr) || (to.getMonth() === month && to.getFullYear() === yr);
                        });
                        if (entries.length === 0) return undefined;
                        return entries.map(v => {
                          const at = getAbsenceType(v.type || 'vacaciones');
                          const fromD = v.from.slice(5).replace('-', '/');
                          const toD = v.to && v.to !== v.from ? ' → ' + v.to.slice(5).replace('-', '/') : '';
                          return `${at.initial} ${at.label.replace(/^[^\s]+\s/, '')}: ${fromD}${toD}${v.note ? ' — ' + v.note : ''}`;
                        }).join('\n');
                      };
                      const totalAus = Array.from({ length: 12 }, (_, i) => cntMonth(i, false)).reduce((a, b) => a + b, 0);
                      const totalVac = Array.from({ length: 12 }, (_, i) => cntMonth(i, true)).reduce((a, b) => a + b, 0);
                      return (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <thead>
                            <tr style={{ borderBottom: '1.5px solid #E8E8ED' }}>
                              {['MES', 'DÍAS', 'AUS.', 'VAC.', 'HORAS', 'ACUM.'].map(h => (
                                <th key={h} style={{ padding: '4px 6px', textAlign: h === 'MES' ? 'left' : 'center', fontSize: 9, color: '#86868B', fontWeight: 700 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {calBreakdown.map((m, i) => {
                              const acum = calBreakdown.slice(0, i + 1).reduce((s, x) => s + x.hours, 0);
                              const aus = cntMonth(i, false);
                              const vac = cntMonth(i, true);
                              const isCur = i === curM;
                              return (
                                <tr key={m.month} style={{ borderBottom: '1px solid #F2F2F7', background: isCur ? '#007AFF08' : 'transparent' }}>
                                  <td style={{ padding: '4px 6px', fontWeight: isCur ? 700 : 600, color: isCur ? '#007AFF' : '#1D1D1F' }}>{MONTHS[m.month - 1]}</td>
                                  <td style={{ padding: '4px 6px', textAlign: 'center', color: '#6E6E73' }}>{m.days}</td>
                                  <td title={tooltipMonth(i, false)} style={{ padding: '4px 6px', textAlign: 'center', color: aus > 0 ? '#FF9500' : '#D1D1D6', fontWeight: aus > 0 ? 600 : 400, cursor: aus > 0 ? 'help' : 'default' }}>{aus}</td>
                                  <td title={tooltipMonth(i, true)} style={{ padding: '4px 6px', textAlign: 'center', color: vac > 0 ? '#5856D6' : '#D1D1D6', fontWeight: vac > 0 ? 600 : 400, cursor: vac > 0 ? 'help' : 'default' }}>{vac}</td>
                                  <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 600, color: '#007AFF' }}>{m.hours}</td>
                                  <td style={{ padding: '4px 6px', textAlign: 'center', color: isCur ? '#007AFF' : '#86868B', fontWeight: isCur ? 700 : 400 }}>{Math.round(acum)}</td>
                                </tr>
                              );
                            })}
                            <tr style={{ borderTop: '1.5px solid #E8E8ED', fontWeight: 700 }}>
                              <td style={{ padding: '4px 6px' }}>TOTAL</td>
                              <td style={{ padding: '4px 6px', textAlign: 'center' }}>{calBreakdown.reduce((s, m) => s + m.days, 0)}</td>
                              <td style={{ padding: '4px 6px', textAlign: 'center', color: totalAus > 0 ? '#FF9500' : '#D1D1D6' }}>{totalAus}</td>
                              <td style={{ padding: '4px 6px', textAlign: 'center', color: totalVac > 0 ? '#5856D6' : '#D1D1D6' }}>{totalVac}</td>
                              <td style={{ padding: '4px 6px', textAlign: 'center', color: '#007AFF' }}>{Math.round(calBreakdown.reduce((s, m) => s + m.hours, 0))}</td>
                              <td style={{ padding: '4px 6px', textAlign: 'center', color: '#007AFF' }}>{Math.round(calBreakdown.reduce((s, m) => s + m.hours, 0))}</td>
                            </tr>
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </div>
              )}

              {!myCal && (
                <div style={{ ...cardS, padding: 20, marginBottom: 14, textAlign: 'center', color: '#86868B' }}>
                  <Icon name="Calendar" size={24} color="#C7C7CC" />
                  <p style={{ fontSize: 12, marginTop: 6 }}>Sin calendario asignado. Contacta con tu SM.</p>
                </div>
              )}

              {showProfileEditor && (
                <ProfileEditor user={user} profile={profile}
                  onClose={() => setShowProfileEditor(false)}
                  onSave={updated => { setProfile(updated); }} />
              )}
              {showVacModal && profile && (
                <VacCalendarModal profile={profile}
                  onClose={() => setShowVacModal(false)}
                  onSaved={updated => { setProfile(updated); }} />
              )}
            </div>
          )}

          {section === 'perfil' && !profile && (
            <div style={{ ...cardS, textAlign: 'center', padding: 40, color: '#86868B', maxWidth: 480 }}>
              <Icon name="User" size={32} color="#C7C7CC" />
              <p style={{ marginTop: 8, fontSize: 13 }}>No se encontró tu perfil en el directorio. Contacta con tu SM.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
