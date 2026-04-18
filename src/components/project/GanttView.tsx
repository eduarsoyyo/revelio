// ═══ GANTT VIEW — Timeline by task or by consultant ═══
import { useState, useEffect, useMemo, useRef, useCallback } from 'preact/hooks';
import type { Task, Member } from '../../types/index';
import { loadOrgChart } from '../../data/team';
import { loadCalendarios, type Calendario } from '../../data/calendarios';
import { Icon } from '../common/Icon';

interface GanttViewProps {
  actions: Task[];
  sala: string;
  teamMembers: Member[];
  onUpdateActions: (actions: Task[]) => void;
  onOpenDetail: (task: Task) => void;
}

const STATUS_COLORS: Record<string, string> = {
  done: '#34C759', doing: '#007AFF', in_progress: '#007AFF', inprogress: '#007AFF',
  backlog: '#C7C7CC', todo: '#C7C7CC', pending: '#C7C7CC',
  blocked: '#FF3B30', cancelled: '#86868B', discarded: '#86868B',
};

const fd = (iso: string) => { const d = new Date(iso); return `${d.getDate()} ${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()]}`; };
const daysBetween = (a: string, b: string) => Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
const addDays = (d: string, days: number) => { const dt = new Date(d); dt.setDate(dt.getDate() + days); return dt.toISOString().slice(0, 10); };

export function GanttView({ actions, sala, teamMembers, onUpdateActions, onOpenDetail }: GanttViewProps) {
  const [viewMode, setViewMode] = useState<'task' | 'consultant'>('task');
  const [zoom, setZoom] = useState<'week' | 'month' | 'quarter'>('month');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [offset, setOffset] = useState(0); // navigation: periods forward/back
  const [dragState, setDragState] = useState<{ taskId: string; mode: 'move' | 'resize'; startX: number; origStart: string; origEnd: string } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(900);
  const [otherProjectDed, setOtherProjectDed] = useState<Record<string, number>>({});

  // Load other-project dedication for consultant view
  useEffect(() => {
    if (viewMode !== 'consultant') return;
    import('../../data/rooms').then(({ loadRooms }) => {
      loadRooms().then(async rR => {
        if (!rR.ok) return;
        const otherRooms = rR.data.filter(r => r.slug !== sala);
        const dedMap: Record<string, number> = {};
        for (const room of otherRooms) {
          const orgR = await loadOrgChart(room.slug);
          if (orgR.ok) orgR.data.forEach((o: Record<string, unknown>) => {
            const mid = o.member_id as string;
            dedMap[mid] = (dedMap[mid] || 0) + ((o as Record<string, unknown>).dedication as number || 0);
          });
        }
        setOtherProjectDed(dedMap);
      });
    });
  }, [viewMode, sala]);

  // Measure container
  useEffect(() => {
    const measure = () => { if (chartRef.current) setContainerW(chartRef.current.clientWidth || 900); };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const tasks = useMemo(() => (actions || []).filter(a => a.status !== 'discarded' && a.status !== 'cancelled'), [actions]);
  const todayStr = new Date().toISOString().slice(0, 10);

  // Zoom-dependent window: always fills screen
  const { viewDays, minDate, maxDate, stepDays } = useMemo(() => {
    const today = new Date();
    if (zoom === 'week') {
      // 10 days: 3 before today + 7 after
      const start = new Date(today); start.setDate(start.getDate() - 3 + offset * 7);
      const end = new Date(start); end.setDate(end.getDate() + 10);
      return { viewDays: 10, minDate: start.toISOString().slice(0, 10), maxDate: end.toISOString().slice(0, 10), stepDays: 7 };
    } else if (zoom === 'month') {
      // ~8 weeks: 4 weeks back + 4 weeks forward
      const start = new Date(today); start.setDate(start.getDate() - 28 + offset * 28);
      const end = new Date(start); end.setDate(end.getDate() + 56);
      return { viewDays: 56, minDate: start.toISOString().slice(0, 10), maxDate: end.toISOString().slice(0, 10), stepDays: 28 };
    } else {
      // 3 months (~90 days)
      const start = new Date(today.getFullYear(), today.getMonth() - 1 + offset * 3, 1);
      const end = new Date(start); end.setMonth(end.getMonth() + 3);
      const days = daysBetween(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
      return { viewDays: days, minDate: start.toISOString().slice(0, 10), maxDate: end.toISOString().slice(0, 10), stepDays: 90 };
    }
  }, [zoom, offset, todayStr]);

  const labelW = 240;
  const dayWidth = Math.max(3, (containerW - 20) / viewDays);
  const chartWidth = viewDays * dayWidth;
  const dayToX = (d: string) => daysBetween(minDate, d) * dayWidth;
  const xToDate = (x: number) => addDays(minDate, Math.round(x / dayWidth));

  // Group by epic
  const epics = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    tasks.forEach(t => {
      const epic = (t as Record<string, unknown>).epicLink as string || 'Sin épica';
      if (!groups[epic]) groups[epic] = [];
      groups[epic].push(t);
    });
    return Object.entries(groups).sort(([a], [b]) => a === 'Sin épica' ? 1 : b === 'Sin épica' ? -1 : a.localeCompare(b));
  }, [tasks]);

  // Task progress (explicit field, fallback to status)
  const getProgress = (t: Task): number => {
    const explicit = (t as Record<string, unknown>).progress as number;
    if (typeof explicit === 'number' && explicit > 0) return explicit;
    if (t.status === 'done' || t.status === 'archived') return 100;
    if (t.status === 'doing' || t.status === 'in_progress' || t.status === 'inprogress') return 50;
    return 0;
  };

  // Dependencies (tasks linked to same risk)
  const dependencies = useMemo(() => {
    const deps: Array<{ from: string; to: string }> = [];
    const riskTasks: Record<string, string[]> = {};
    tasks.forEach(t => {
      if (t.riskId) {
        if (!riskTasks[t.riskId]) riskTasks[t.riskId] = [];
        riskTasks[t.riskId].push(t.id);
      }
    });
    Object.values(riskTasks).forEach(ids => {
      for (let i = 0; i < ids.length - 1; i++) deps.push({ from: ids[i], to: ids[i + 1] });
    });
    return deps;
  }, [tasks]);

  // Drag handlers
  const handleDragStart = useCallback((taskId: string, mode: 'move' | 'resize', clientX: number) => {
    const t = tasks.find(a => a.id === taskId);
    if (!t) return;
    setDragState({
      taskId, mode, startX: clientX,
      origStart: (t as Record<string, unknown>).startDate as string || t.date || todayStr,
      origEnd: t.date || (t as Record<string, unknown>).startDate as string || todayStr,
    });
  }, [tasks, todayStr]);

  const handleDragMove = useCallback((clientX: number) => {
    if (!dragState) return;
    const dx = clientX - dragState.startX;
    const daysDelta = Math.round(dx / dayWidth);
    if (daysDelta === 0) return;

    onUpdateActions(actions.map(a => {
      if (a.id !== dragState.taskId) return a;
      if (dragState.mode === 'move') {
        return { ...a, startDate: addDays(dragState.origStart, daysDelta), date: addDays(dragState.origEnd, daysDelta) } as Task;
      } else {
        return { ...a, date: addDays(dragState.origEnd, daysDelta) } as Task;
      }
    }));
  }, [dragState, dayWidth, actions, onUpdateActions]);

  const handleDragEnd = useCallback(() => setDragState(null), []);

  // Month headers
  const months = useMemo(() => {
    const result: Array<{ label: string; x: number; width: number }> = [];
    const start = new Date(minDate);
    while (start.toISOString().slice(0, 10) < maxDate) {
      const monthStart = start.toISOString().slice(0, 10);
      const label = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][start.getMonth()] + ' ' + start.getFullYear();
      const nextMonth = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      const monthEnd = nextMonth.toISOString().slice(0, 10) < maxDate ? nextMonth.toISOString().slice(0, 10) : maxDate;
      result.push({ label, x: dayToX(monthStart), width: daysBetween(monthStart, monthEnd) * dayWidth });
      start.setMonth(start.getMonth() + 1); start.setDate(1);
    }
    return result;
  }, [minDate, maxDate, dayWidth]);

  // Sub-header labels (days/weeks depending on zoom)
  const subLabels = useMemo(() => {
    const result: Array<{ label: string; x: number; isWeekend: boolean }> = [];
    const dayNames = ['D','L','M','X','J','V','S'];
    for (let i = 0; i < viewDays; i++) {
      const d = new Date(minDate); d.setDate(d.getDate() + i);
      const isWe = d.getDay() === 0 || d.getDay() === 6;
      if (zoom === 'week') {
        // Every day: "L12", "M13"
        result.push({ label: `${dayNames[d.getDay()]}${d.getDate()}`, x: i * dayWidth + dayWidth / 2, isWeekend: isWe });
      } else if (zoom === 'month') {
        // Show every day number
        result.push({ label: `${d.getDate()}`, x: i * dayWidth + dayWidth / 2, isWeekend: isWe });
      } else if (zoom === 'quarter') {
        // Every Monday → week number
        if (d.getDay() === 1) {
          const jan1 = new Date(d.getFullYear(), 0, 1);
          const wn = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
          result.push({ label: `S${wn}`, x: i * dayWidth + dayWidth * 3.5, isWeekend: false });
        }
      }
    }
    return result;
  }, [minDate, viewDays, dayWidth, zoom]);

  const ROW_H = 30;
  const HEADER_H = 52;
  const todayX = dayToX(todayStr);

  // Build row positions
  const rowMap: Record<string, number> = {};
  let rowIdx = 0;
  epics.forEach(([epic, group]) => {
    rowIdx++; // epic header
    if (!collapsed.has(epic)) group.forEach(t => { rowMap[t.id] = rowIdx; rowIdx++; });
  });
  const totalH = HEADER_H + rowIdx * ROW_H;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Timeline</h3>
          <p style={{ fontSize: 12, color: '#86868B' }}>{tasks.length} accionables · {viewMode === 'task' ? `${epics.length} épicas` : `${teamMembers.length} consultores`}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* View mode toggle */}
          <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1.5px solid #5856D6' }}>
            {([['task', 'Accionables'], ['consultant', 'Consultores']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setViewMode(id as 'task' | 'consultant')}
                style={{ padding: '5px 12px', fontSize: 11, fontWeight: viewMode === id ? 700 : 500, background: viewMode === id ? '#5856D6' : '#FFF', color: viewMode === id ? '#FFF' : '#5856D6', border: 'none', cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <button onClick={() => setOffset(o => o - 1)} style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="ChevronLeft" size={14} color="#86868B" />
          </button>
          <button onClick={() => setOffset(0)} style={{ padding: '4px 10px', borderRadius: 8, border: '1.5px solid #E5E5EA', background: offset === 0 ? '#1D1D1F' : '#FFF', color: offset === 0 ? '#FFF' : '#86868B', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
            Hoy
          </button>
          <button onClick={() => setOffset(o => o + 1)} style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="ChevronRight" size={14} color="#86868B" />
          </button>

          {/* Zoom */}
          <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1.5px solid #E5E5EA', marginLeft: 8 }}>
            {(['week', 'month', 'quarter'] as const).map(z => (
              <button key={z} onClick={() => { setZoom(z); setOffset(0); }}
                style={{ padding: '5px 12px', fontSize: 11, fontWeight: zoom === z ? 700 : 500, background: zoom === z ? '#1D1D1F' : '#FFF', color: zoom === z ? '#FFF' : '#6E6E73', border: 'none', cursor: 'pointer' }}>
                {z === 'week' ? 'Semana' : z === 'month' ? 'Mes' : 'Trimestre'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tasks.length === 0 && viewMode === 'task' ? (
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 32, textAlign: 'center' }}>
          <Icon name="Calendar" size={36} color="#C7C7CC" />
          <p style={{ fontSize: 13, fontWeight: 600, color: '#6E6E73', marginTop: 8 }}>Sin accionables</p>
        </div>
      ) : viewMode === 'task' ? (
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', overflow: 'hidden' }}
          onMouseMove={e => handleDragMove(e.clientX)} onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd}>
          <div style={{ display: 'flex', overflow: 'auto' }}>
            {/* Left labels */}
            <div style={{ width: labelW, flexShrink: 0, borderRight: '1px solid #E5E5EA', background: '#FAFAFA' }}>
              <div style={{ height: HEADER_H, borderBottom: '1px solid #E5E5EA', padding: '0 10px', display: 'flex', alignItems: 'flex-end', paddingBottom: 6, fontSize: 10, fontWeight: 700, color: '#86868B' }}>TAREA</div>
              {epics.map(([epic, group]) => {
                const isCol = collapsed.has(epic);
                const done = group.filter(t => t.status === 'done' || t.status === 'archived').length;
                const pct = group.length > 0 ? Math.round(done / group.length * 100) : 0;
                return (
                  <div key={epic}>
                    <div onClick={() => setCollapsed(prev => { const n = new Set(prev); if (n.has(epic)) n.delete(epic); else n.add(epic); return n; })}
                      style={{ height: ROW_H, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', cursor: 'pointer', borderBottom: '1px solid #F2F2F7', background: '#F5F5F7' }}>
                      <Icon name={isCol ? 'ChevronRight' : 'ChevronDown'} size={11} color="#86868B" />
                      <span style={{ fontSize: 11, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{epic}</span>
                      <span style={{ fontSize: 9, color: pct === 100 ? '#34C759' : '#86868B', fontWeight: 600 }}>{pct}%</span>
                    </div>
                    {!isCol && group.map(t => (
                      <div key={t.id} onClick={() => onOpenDetail(t)}
                        style={{ height: ROW_H, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px 0 24px', cursor: 'pointer', borderBottom: '1px solid #F9F9FB' }}>
                        <div style={{ width: 6, height: 6, borderRadius: 3, background: STATUS_COLORS[t.status || 'backlog'], flexShrink: 0 }} />
                        <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.status === 'done' || t.status === 'archived' ? '#86868B' : '#1D1D1F' }}>{t.text}</span>
                        <span style={{ fontSize: 9, color: '#C7C7CC' }}>{(t as Record<string, unknown>).startDate ? fd((t as Record<string, unknown>).startDate as string) : ''}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Timeline */}
            <div ref={chartRef} style={{ flex: 1, overflow: 'hidden', cursor: dragState ? 'grabbing' : 'default' }}>
              <svg width={Math.ceil(chartWidth)} height={totalH} style={{ display: 'block' }}>
                {/* Month headers */}
                {months.map((m, i) => (
                  <g key={i}>
                    <rect x={m.x} y={0} width={m.width} height={28} fill={i % 2 === 0 ? '#FAFAFA' : '#FFF'} />
                    <text x={m.x + 8} y={18} fontSize="10" fontWeight="600" fill="#86868B">{m.label}</text>
                    <line x1={m.x} y1={0} x2={m.x} y2={totalH} stroke="#F2F2F7" strokeWidth="1" />
                  </g>
                ))}

                {/* Sub-header: days/weeks */}
                {subLabels.map((s, i) => (
                  <text key={`sub-${i}`} x={s.x} y={43} textAnchor="middle" fontSize={zoom === 'week' ? '9' : '8'} fill={s.isWeekend ? '#C7C7CC' : '#AEAEB2'}>{s.label}</text>
                ))}

                {/* Today */}
                <line x1={todayX} y1={0} x2={todayX} y2={totalH} stroke="#FF3B30" strokeWidth="1.5" strokeDasharray="4 2" />
                <rect x={todayX - 14} y={2} width={28} height={14} rx={4} fill="#FF3B30" />
                <text x={todayX} y={12} textAnchor="middle" fontSize="8" fill="#FFF" fontWeight="700">Hoy</text>

                {/* Weekend stripes */}
                {Array.from({ length: viewDays }, (_, i) => {
                  const d = new Date(minDate); d.setDate(d.getDate() + i);
                  return d.getDay() === 0 || d.getDay() === 6 ? i : -1;
                }).filter(i => i >= 0).map(i => (
                  <rect key={i} x={i * dayWidth} y={HEADER_H} width={dayWidth} height={totalH - HEADER_H} fill="rgba(0,0,0,.015)" />
                ))}

                {/* Dependency arrows */}
                {dependencies.map((dep, i) => {
                  const fromRow = rowMap[dep.from];
                  const toRow = rowMap[dep.to];
                  if (fromRow == null || toRow == null) return null;
                  const fromTask = tasks.find(t => t.id === dep.from);
                  const toTask = tasks.find(t => t.id === dep.to);
                  if (!fromTask || !toTask) return null;
                  const fromEnd = dayToX(fromTask.date || todayStr) + dayWidth;
                  const toStart = dayToX((toTask as Record<string, unknown>).startDate as string || toTask.date || todayStr);
                  const fromY = HEADER_H + fromRow * ROW_H + ROW_H / 2;
                  const toY = HEADER_H + toRow * ROW_H + ROW_H / 2;
                  const midX = (fromEnd + toStart) / 2;
                  return (
                    <g key={`dep-${i}`}>
                      <path d={`M${fromEnd},${fromY} C${midX},${fromY} ${midX},${toY} ${toStart},${toY}`}
                        fill="none" stroke="#FF9500" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.6" />
                      <polygon points={`${toStart},${toY} ${toStart - 5},${toY - 3} ${toStart - 5},${toY + 3}`} fill="#FF9500" opacity="0.6" />
                    </g>
                  );
                })}

                {/* Task bars */}
                {(() => {
                  let rIdx = 0;
                  return epics.map(([epic, group]) => {
                    // Epic summary bar
                    const epicY = HEADER_H + rIdx * ROW_H;
                    let epicMinX = chartWidth, epicMaxX = 0;
                    group.forEach(t => {
                      const s = (t as Record<string, unknown>).startDate as string || t.date || todayStr;
                      const e = t.date || s;
                      const sx = dayToX(s); const ex = dayToX(e) + dayWidth;
                      if (sx < epicMinX) epicMinX = sx;
                      if (ex > epicMaxX) epicMaxX = ex;
                    });
                    rIdx++;

                    const epicBar = epicMinX < epicMaxX ? (
                      <rect x={epicMinX} y={epicY + 10} width={epicMaxX - epicMinX} height={10} rx={3} fill="#5856D6" opacity="0.15" />
                    ) : null;

                    const taskBars = !collapsed.has(epic) ? group.map(t => {
                      const start = (t as Record<string, unknown>).startDate as string || t.date || todayStr;
                      const end = t.date || start;
                      const sx = dayToX(start);
                      const w = Math.max(dayWidth * 2, dayToX(end) - sx + dayWidth);
                      const y = HEADER_H + rIdx * ROW_H + 5;
                      const h = ROW_H - 10;
                      rIdx++;

                      const color = STATUS_COLORS[t.status || 'backlog'];
                      const progress = getProgress(t);
                      const isDragging = dragState?.taskId === t.id;

                      return (
                        <g key={t.id} style={{ cursor: 'grab' }}>
                          {/* Background bar */}
                          <rect x={sx} y={y} width={w} height={h} rx={4}
                            fill={color + '20'} stroke={isDragging ? '#1D1D1F' : color} strokeWidth={isDragging ? 2 : 1} />
                          {/* Progress fill */}
                          {progress > 0 && (
                            <rect x={sx + 1} y={y + 1} width={Math.max(0, (w - 2) * progress / 100)} height={h - 2} rx={3} fill={color} opacity="0.3" />
                          )}
                          {/* Progress text */}
                          {w > 35 && (
                            <text x={sx + 6} y={y + h / 2 + 3} fontSize="8" fontWeight="700" fill={color}>{progress}%</text>
                          )}
                          {/* Label */}
                          {w > 80 && (
                            <text x={sx + (progress > 0 ? 30 : 6)} y={y + h / 2 + 3} fontSize="9" fill="#1D1D1F" fontWeight="500">
                              {t.text.slice(0, Math.floor((w - 40) / 5))}
                            </text>
                          )}
                          {/* Drag handle: move (main area) */}
                          <rect x={sx} y={y} width={w - 8} height={h} rx={4} fill="transparent"
                            onMouseDown={e => { e.stopPropagation(); handleDragStart(t.id, 'move', e.clientX); }} />
                          {/* Drag handle: resize (right edge) */}
                          <rect x={sx + w - 8} y={y} width={8} height={h} fill="transparent" style={{ cursor: 'ew-resize' }}
                            onMouseDown={e => { e.stopPropagation(); handleDragStart(t.id, 'resize', e.clientX); }} />
                          {/* Dates tooltip on hover via title */}
                          <title>{`${t.text}\n${fd(start)} → ${fd(end)}\nProgreso: ${progress}%`}</title>
                        </g>
                      );
                    }) : (() => { rIdx += group.length; return null; })();

                    return <g key={epic}>{epicBar}{taskBars}</g>;
                  });
                })()}
              </svg>
            </div>
          </div>
        </div>
      ) : (
        /* ═══ CONSULTANT VIEW ═══ */
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', overflow: 'hidden' }}>
          <div style={{ display: 'flex', overflow: 'auto' }}>
            {/* Left: consultant names + capacity */}
            <div style={{ width: labelW, flexShrink: 0, borderRight: '1px solid #E5E5EA', background: '#FAFAFA' }}>
              <div style={{ height: HEADER_H, borderBottom: '1px solid #E5E5EA', padding: '0 10px', display: 'flex', alignItems: 'flex-end', paddingBottom: 6, fontSize: 10, fontWeight: 700, color: '#86868B' }}>CONSULTOR</div>
              {teamMembers.map(m => {
                const myTasks = tasks.filter(t => t.owner === m.name);
                const otherDed = otherProjectDed[m.id] || 0;
                const myHours = myTasks.reduce((s, t) => s + ((t as Record<string, unknown>).hours as number || 0), 0);
                const totalDed = otherDed;
                return (
                  <div key={m.id} style={{ height: 52, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', borderBottom: '1px solid #F9F9FB' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: m.color || '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>{m.avatar || '👤'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      <div style={{ fontSize: 8, color: '#86868B' }}>{myTasks.length} acc. · {myHours}h</div>
                      {/* Capacity bar */}
                      <div style={{ display: 'flex', height: 3, borderRadius: 1.5, overflow: 'hidden', background: '#F2F2F7', marginTop: 2 }}>
                        <div style={{ width: `${Math.min(100, (1 - otherDed) * 100)}%`, background: '#007AFF' }} title="Este proyecto" />
                        {otherDed > 0 && <div style={{ width: `${Math.min(100, otherDed * 100)}%`, background: '#E5E5EA' }} title={`Otros: ${Math.round(otherDed * 100)}%`} />}
                      </div>
                    </div>
                    {otherDed > 0 && <span style={{ fontSize: 8, color: '#FF9500', fontWeight: 700 }}>+{Math.round(otherDed * 100)}%</span>}
                  </div>
                );
              })}
            </div>

            {/* Right: Gantt bars per consultant */}
            <div ref={chartRef} style={{ flex: 1, overflow: 'hidden' }}>
              <svg width={Math.ceil(chartWidth)} height={HEADER_H + teamMembers.length * 52}>
                {/* Month headers */}
                {months.map((m, i) => (
                  <g key={i}>
                    <rect x={m.x} y={0} width={m.width} height={28} fill={i % 2 === 0 ? '#FAFAFA' : '#FFF'} />
                    <text x={m.x + 8} y={18} fontSize="10" fontWeight="600" fill="#86868B">{m.label}</text>
                    <line x1={m.x} y1={0} x2={m.x} y2={HEADER_H + teamMembers.length * 52} stroke="#F2F2F7" strokeWidth="1" />
                  </g>
                ))}
                {subLabels.map((s, i) => (
                  <text key={`sub-${i}`} x={s.x} y={43} textAnchor="middle" fontSize={zoom === 'week' ? '9' : '8'} fill={s.isWeekend ? '#C7C7CC' : '#AEAEB2'}>{s.label}</text>
                ))}

                {/* Today marker */}
                {(() => { const tx = dayToX(todayStr); return tx >= 0 && tx <= chartWidth ? (
                  <g><line x1={tx} y1={0} x2={tx} y2={HEADER_H + teamMembers.length * 52} stroke="#FF3B30" strokeWidth="1.5" strokeDasharray="4 2" />
                  <rect x={tx - 14} y={2} width={28} height={14} rx={4} fill="#FF3B30" />
                  <text x={tx} y={12} textAnchor="middle" fontSize="8" fill="#FFF" fontWeight="700">Hoy</text></g>
                ) : null; })()}

                {/* Weekend stripes */}
                {Array.from({ length: viewDays }, (_, i) => {
                  const d = new Date(minDate); d.setDate(d.getDate() + i);
                  return (d.getDay() === 0 || d.getDay() === 6) ? <rect key={i} x={i * dayWidth} y={HEADER_H} width={dayWidth} height={teamMembers.length * 52} fill="rgba(0,0,0,.015)" /> : null;
                })}

                {/* Consultant rows */}
                {teamMembers.map((member, mi) => {
                  const y = HEADER_H + mi * 52;
                  const myTasks = tasks.filter(t => t.owner === member.name);
                  const otherDed = otherProjectDed[member.id] || 0;

                  return (
                    <g key={member.id}>
                      {/* Row separator */}
                      <line x1={0} y1={y} x2={chartWidth} y2={y} stroke="#F9F9FB" strokeWidth="1" />

                      {/* Ghost bar for other projects (skeleton) */}
                      {otherDed > 0 && (() => {
                        const ghostH = Math.min(8, 52 * otherDed);
                        return (
                          <rect x={0} y={y + 52 - ghostH - 2} width={chartWidth} height={ghostH} rx={2}
                            fill="repeating-linear-gradient(90deg,#E5E5EA 0,#E5E5EA 4px,transparent 4px,transparent 8px)"
                            style={{ fill: '#E5E5EA', opacity: 0.2 }} />
                        );
                      })()}

                      {/* Task bars */}
                      {myTasks.map((t, ti) => {
                        const start = (t as Record<string, unknown>).startDate as string || t.date || todayStr;
                        const end = t.date || start;
                        const sx = dayToX(start);
                        const w = Math.max(dayWidth * 2, dayToX(end) - sx + dayWidth);
                        const barY = y + 8 + ti * 14;
                        const barH = 12;
                        const progress = getProgress(t);
                        const color = STATUS_COLORS[t.status || 'backlog'];

                        if (barY + barH > y + 52 - 2) return null; // overflow protection

                        return (
                          <g key={t.id} onClick={() => onOpenDetail(t)} style={{ cursor: 'pointer' }}>
                            <rect x={sx} y={barY} width={w} height={barH} rx={3} fill={color + '25'} stroke={color} strokeWidth="0.8" />
                            {progress > 0 && <rect x={sx + 1} y={barY + 1} width={(w - 2) * progress / 100} height={barH - 2} rx={2} fill={color} opacity="0.35" />}
                            {w > 50 && <text x={sx + 4} y={barY + barH - 3} fontSize="7" fill="#1D1D1F" fontWeight="500">{t.text.slice(0, Math.floor(w / 5))}</text>}
                            <title>{`${t.text}\n${fd(start)} → ${fd(end)}\n${progress}% · ${(t as Record<string, unknown>).hours || 0}h`}</title>
                          </g>
                        );
                      })}

                      {/* Other project ghost indicator */}
                      {otherDed > 0 && (
                        <g>
                          <rect x={2} y={y + 42} width={chartWidth - 4} height={6} rx={2} fill="#E5E5EA" opacity="0.15" />
                          {/* Diagonal stripes pattern */}
                          {Array.from({ length: Math.floor(chartWidth / 12) }, (_, si) => (
                            <line key={si} x1={si * 12 + 2} y1={y + 42} x2={si * 12 + 8} y2={y + 48} stroke="#C7C7CC" strokeWidth="0.5" opacity="0.3" />
                          ))}
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
