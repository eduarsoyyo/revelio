// ═══ TASKS — Pure filtering/sorting logic ═══
import type { Task } from '@app-types/index';
import { PRIORITY_ORDER } from '../config/tasks';

export interface TaskFilters {
  search?: string;
  owner?: string;   // 'all' | 'mine' | specific name
  userId?: string;
  userName?: string;
  tagId?: string;
  tagAssignments?: Array<{ tag_id: string; entity_type: string; entity_id: string }>;
}

export type SortBy = 'priority' | 'date' | 'type' | 'status';

/**
 * Filter tasks by search, owner, and tag.
 * Pure function — no side effects.
 */
export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  let result = tasks;

  // Owner filter
  if (filters.owner === 'mine') {
    result = result.filter(a =>
      a.owner === filters.userName || a.createdBy === filters.userId,
    );
  } else if (filters.owner && filters.owner !== 'all') {
    result = result.filter(a => a.owner === filters.owner);
  }

  // Search
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(a =>
      a.text.toLowerCase().includes(q) ||
      (a.owner || '').toLowerCase().includes(q) ||
      ((a as any).description || '').toLowerCase().includes(q),
    );
  }

  // Tag
  if (filters.tagId && filters.tagAssignments) {
    result = result.filter(a =>
      filters.tagAssignments!.some(ta =>
        ta.tag_id === filters.tagId && ta.entity_type === 'action' && ta.entity_id === a.id,
      ),
    );
  }

  return result;
}

/**
 * Sort tasks by the given criteria.
 */
export function sortTasks(tasks: Task[], by: SortBy): Task[] {
  const sorted = [...tasks];
  switch (by) {
    case 'priority':
      return sorted.sort((a, b) =>
        (PRIORITY_ORDER[(b as any).priority] || 0) - (PRIORITY_ORDER[(a as any).priority] || 0),
      );
    case 'date':
      return sorted.sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
    case 'type':
      return sorted.sort((a, b) => ((a as any).type || 'tarea').localeCompare((b as any).type || 'tarea'));
    case 'status':
      return sorted.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
    default:
      return sorted;
  }
}

/**
 * Compute task metrics for a set of tasks.
 */
export function taskMetrics(tasks: Task[]) {
  const today = new Date().toISOString().slice(0, 10);
  const active = tasks.filter(a => a.status !== 'discarded' && a.status !== 'cancelled');
  const open = active.filter(a => a.status !== 'done');
  const done = active.filter(a => a.status === 'done' || a.status === 'archived');
  const overdue = open.filter(a => a.date && a.date < today);
  const blocked = open.filter(a => a.status === 'blocked');

  return {
    total: active.length,
    open: open.length,
    done: done.length,
    overdue: overdue.length,
    blocked: blocked.length,
    completionPct: active.length > 0 ? Math.round(done.length / active.length * 100) : 0,
  };
}

/**
 * Group tasks by kanban column status.
 */
export function groupByStatus(tasks: Task[]): Record<string, Task[]> {
  const groups: Record<string, Task[]> = {};
  tasks.forEach(t => {
    // Normalize statuses to kanban columns (backlog stays separate)
    let col = t.status || 'backlog';
    if (col === 'todo') col = 'pending';
    if (col === 'doing' || col === 'in_progress') col = 'inprogress';
    if (!groups[col]) groups[col] = [];
    groups[col].push(t);
  });
  return groups;
}

/** Check if task is effectively completed (done or archived) */
export function isDone(status: string | undefined): boolean {
  return status === 'done' || status === 'archived';
}
