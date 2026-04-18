// ═══ RETRO CONSTANTS ═══
import type { BadgeStats } from '../types/index';

export const PHASES = [
  { id: 'review',     label: 'Repaso',      num: '01', guide: 'Revisa el objetivo de la iteración y las tareas comprometidas. Marca las completadas y evalúa el cumplimiento.' },
  { id: 'individual', label: 'Individual',  num: '02', guide: 'Cada persona escribe notas en privado (Good/Bad/Start/Stop). Sin hablar — enfoque individual. 5-8 min.' },
  { id: 'discuss',    label: 'En común',    num: '03', guide: 'Se comparten las notas por categoría. Vota las más relevantes. Debate breve — no resolver, solo entender.' },
  { id: 'actions',    label: 'Accionables', num: '04', guide: 'Convierte las notas más votadas en tareas concretas con responsable y fecha. Cada acción debe ser accionable.' },
  { id: 'risks',      label: 'Riesgos',     num: '05', guide: 'Identifica riesgos y problemas surgidos. Asigna impacto y probabilidad. Escala los críticos.' },
  { id: 'session',    label: 'Resumen',     num: '06', guide: 'Revisa lo decidido: accionables, riesgos, compromisos. Finalizar archiva la retro y lanza la celebración.' },
] as const;

export const DEFAULT_TASKS: Record<string, Array<{ text: string; done: boolean }>> = {
  agile: [
    { text: 'Revisión del Sprint Backlog', done: false },
    { text: 'Demo de funcionalidades completadas', done: false },
    { text: 'Revisión de criterios de aceptación', done: false },
    { text: 'Actualización del Product Backlog', done: false },
    { text: 'Revisión de impedimentos', done: false },
    { text: 'Velocity y métricas del sprint', done: false },
    { text: 'Feedback del Product Owner', done: false },
  ],
  waterfall: [
    { text: 'Revisión de entregables de la fase', done: false },
    { text: 'Verificación de criterios de salida', done: false },
    { text: 'Revisión de riesgos del proyecto', done: false },
    { text: 'Actualización del cronograma', done: false },
    { text: 'Revisión de cambios aprobados', done: false },
    { text: 'Estado de dependencias externas', done: false },
    { text: 'Validación de calidad (QA)', done: false },
  ],
  itil: [
    { text: 'Revisión de incidencias del periodo', done: false },
    { text: 'Estado de problemas abiertos', done: false },
    { text: 'Revisión de cambios implementados', done: false },
    { text: 'Cumplimiento de SLAs', done: false },
    { text: 'Revisión de disponibilidad del servicio', done: false },
    { text: 'Estado de solicitudes pendientes', done: false },
    { text: 'Mejora continua — acciones del periodo', done: false },
  ],
  kanban: [
    { text: 'Revisión del flujo de trabajo', done: false },
    { text: 'Análisis de WIP y cuellos de botella', done: false },
    { text: 'Lead time y cycle time del periodo', done: false },
    { text: 'Tareas bloqueadas o en espera', done: false },
    { text: 'Priorización del backlog', done: false },
    { text: 'Revisión de políticas del tablero', done: false },
  ],
};

export const MAIN_TABS = [
  { id: 'resumen',     label: 'Resumen',     lucide: 'LayoutDashboard' },
  { id: 'trabajo',     label: 'Seguimiento', lucide: 'ClipboardList' },
  { id: 'retro',       label: 'Retro',       lucide: 'RotateCcw' },
  { id: 'riesgos',     label: 'Riesgos',     lucide: 'AlertTriangle' },
  { id: 'prediccion',  label: 'Predicción',  lucide: 'TrendingUp' },
  { id: 'metricas',    label: 'Métricas',    lucide: 'BarChart3' },
  { id: 'hechizos',    label: 'Hechizos',    lucide: 'Sparkles' },
  { id: 'equipo',      label: 'Equipo',      lucide: 'Users' },
] as const;

export const REACTIONS = ['🔥', '💡', '❤️', '😂', '🎯', '🤯'] as const;

export const NOTE_CATEGORIES = [
  { id: 'good',  label: 'Good',  emoji: '✅', color: '#34C759', bg: '#F0FFF4' },
  { id: 'bad',   label: 'Bad',   emoji: '❌', color: '#FF3B30', bg: '#FFF5F5' },
  { id: 'start', label: 'Start', emoji: '🚀', color: '#007AFF', bg: '#EBF5FF' },
  { id: 'stop',  label: 'Stop',  emoji: '🛑', color: '#FF9500', bg: '#FFF8EB' },
] as const;

export const AVATARS = ['🦊','🐻','🐼','🦁','🦉','🐍','🦡','🦅','🐉','🦄','🧙','⚡','🔮','🏰','🪄','🐺','🦋','🐝'] as const;

export const NOTE_COLORS = ['#007AFF','#FF3B30','#34C759','#FF9500','#AF52DE','#FF2D55','#5856D6','#00C7BE'] as const;

export const BADGES = [
  { id: 'first',    label: 'Primera Nota', icon: '🏅', check: (s: BadgeStats) => s.n >= 1 },
  { id: 'prolific', label: 'Prolífico',    icon: '📝', check: (s: BadgeStats) => s.n >= 5 },
  { id: 'voter',    label: 'Votante',      icon: '🗳️', check: (s: BadgeStats) => s.vg >= 3 },
  { id: 'hero',     label: 'Action Hero',  icon: '⚡', check: (s: BadgeStats) => s.a >= 1 },
  { id: 'balanced', label: 'Equilibrado',  icon: '⚖️', check: (s: BadgeStats) => s.cats >= 4 },
  { id: 'star',     label: 'Superstar',    icon: '⭐', check: (s: BadgeStats) => s.n >= 8 && s.vg >= 5 },
] as const;

export const DEFAULT_TIMER = 900; // 15 minutes in seconds
