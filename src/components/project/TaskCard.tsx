// ═══ TASK CARD — Visual task card for kanban/list views ═══
import type { Task, Member } from '@app-types/index';
import { ITEM_TYPE_MAP, PRIORITY_MAP } from '../../config/tasks';
import { Icon } from '@components/common/Icon';

interface Tag { id: string; name: string; color: string; }

interface TaskCardProps {
  task: Task;
  compact?: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  teamMembers?: Member[];
  tags?: Tag[];
  onOpenDetail: (task: Task) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

const fd = (iso: string | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '';

export function TaskCard({
  task, compact = false, draggable = false, isDragging = false,
  teamMembers = [], tags = [], onOpenDetail, onDragStart, onDragEnd,
}: TaskCardProps) {
  const today = new Date().toISOString().slice(0, 10);
  const tp = ITEM_TYPE_MAP[(task as any).type || 'tarea'] || ITEM_TYPE_MAP.tarea;
  const pr = PRIORITY_MAP[(task as any).priority || 'medium'] || PRIORITY_MAP.medium;
  const overdue = task.status !== 'done' && task.status !== 'cancelled' && task.date && task.date < today;
  const avatar = teamMembers.find(m => m.name === task.owner)?.avatar || '👤';

  return (
    <div
      class="card-hover"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpenDetail({ ...task })}
      style={{
        background: '#FFF',
        borderRadius: compact ? 8 : 12,
        padding: compact ? '7px 9px' : '10px 12px',
        border: `1px solid ${overdue ? '#FF3B3025' : '#E5E5EA'}`,
        borderLeft: `3px solid ${tp.color}`,
        boxShadow: '0 1px 4px rgba(0,0,0,.04)',
        cursor: 'pointer',
        opacity: isDragging ? 0.4 : task.status === 'cancelled' ? 0.5 : 1,
        marginBottom: compact ? 4 : 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* Type icon + priority */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', flexShrink: 0, minWidth: 20 }}>
          <span title={tp.label}><Icon name={tp.lucide} size={compact ? 12 : 14} color={tp.color} /></span>
          <span style={{ fontSize: 9, fontWeight: 800, color: pr.color }}>{pr.icon}</span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: compact ? 11 : 12, fontWeight: 600,
            textDecoration: task.status === 'done' || task.status === 'cancelled' ? 'line-through' : 'none',
            color: task.status === 'cancelled' ? '#C7C7CC' : '#1D1D1F',
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: compact ? 1 : 2, WebkitBoxOrient: 'vertical',
          }}>
            {task.text}
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
            {task.owner && task.owner !== 'Sin asignar' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#007AFF' }}>
                <span style={{ fontSize: 12 }}>{avatar}</span>
                {!compact && task.owner.split(' ')[0]}
              </span>
            )}
            {task.date && (
              <span style={{ fontSize: 10, color: overdue ? '#FF3B30' : '#86868B', fontWeight: overdue ? 700 : 400 }}>
                {overdue && '▲ '}{fd(task.date)}
              </span>
            )}
            {(task as any).hours && (
              <span style={{ fontSize: 9, fontWeight: 700, color: '#5856D6', background: '#5856D610', padding: '1px 5px', borderRadius: 4 }}>
                {(task as any).hours}h
              </span>
            )}
            {(task as any).epicLink && (
              <span style={{ fontSize: 9, fontWeight: 600, color: '#AF52DE', background: '#AF52DE10', padding: '1px 5px', borderRadius: 4 }}>
                {(task as any).epicLink}
              </span>
            )}
            {task.riskId && (
              <span style={{ fontSize: 9, color: '#FF9500', fontWeight: 600 }}>Riesgo vinculado</span>
            )}
          </div>

          {/* Progress bar */}
          {(task as any).progress > 0 && (task as any).progress < 100 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <div style={{ flex: 1, height: 3, borderRadius: 1.5, background: '#F2F2F7' }}>
                <div style={{ width: `${(task as any).progress}%`, height: 3, borderRadius: 1.5, background: '#007AFF', transition: 'width .3s' }} />
              </div>
              <span style={{ fontSize: 8, fontWeight: 700, color: '#86868B' }}>{(task as any).progress}%</span>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 }}>
              {tags.map(t => (
                <span key={t.id} style={{
                  fontSize: 8, fontWeight: 600, padding: '1px 5px', borderRadius: 4,
                  background: t.color + '15', color: t.color,
                }}>
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
