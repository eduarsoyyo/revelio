// ═══ DASHBOARD SERVICE ═══
// Use case: orchestrates data loading + domain calculations for the dashboard.
// This layer sits between components and data/domain.
// Components call services. Services call data + domain. Nobody else.

import { loadTeamMembers, loadOrgChart } from '@data/team';
import { loadRooms } from '@data/rooms';
import { loadRetros } from '@data/retros';
import { loadSkillProfiles, loadMemberProfiles, loadMemberSkills, loadSkillActions } from '@data/skills';
import { calculateHealth, type HealthMetrics } from '@domain/health';
import { calculateCriticality } from '@domain/criticality';
import { memberFit } from '@domain/skills';
import { createLogger } from '@lib/logger';
import type { Room, Member, Risk, Task, HealthScore, ProjectMetrics } from '@app-types/index';

const log = createLogger('service:dashboard');

export interface DashboardData {
  rooms: Room[];
  members: Member[];
  allData: Record<string, { actions?: Task[]; risks?: Risk[]; notes?: unknown[] }>;
  health: HealthScore;
  projectMetrics: ProjectMetrics[];
  skillSummary: {
    totalFte: number;
    avgFit: number;
    criticalGaps: number;
    coveragePercent: number;
  };
}

/**
 * Load all data needed for the admin dashboard.
 * Single entry point — components never call data layer directly.
 */
export async function loadDashboardData(filterSlugs?: string[]): Promise<DashboardData> {
  log.info('Loading dashboard data', { filter: filterSlugs });

  // Parallel load
  const [roomsResult, membersResult, retrosResult] = await Promise.all([
    loadRooms(),
    loadTeamMembers(),
    loadRetros(),
  ]);

  const rooms = roomsResult.ok ? roomsResult.data : [];
  const members = membersResult.ok ? membersResult.data : [];

  // Build allData from retro snapshots
  const snaps = retrosResult.ok ? retrosResult.data : [];
  const bySala: Record<string, { data: unknown; created_at: string }> = {};
  (snaps as any[]).forEach((s: any) => {
    if (!bySala[s.sala] || s.created_at > bySala[s.sala].created_at) bySala[s.sala] = s;
  });
  const allData: Record<string, { actions?: Task[]; risks?: Risk[]; notes?: unknown[] }> = {};
  Object.entries(bySala).forEach(([sala, snap]: [string, any]) => {
    if (snap.data) allData[sala] = snap.data;
  });

  // Filter
  const fRooms = filterSlugs?.length ? rooms.filter(r => filterSlugs.includes(r.slug)) : rooms;
  const fSlugs = new Set(fRooms.map(r => r.slug));
  const fData: typeof allData = {};
  Object.entries(allData).forEach(([k, v]) => {
    if (!filterSlugs?.length || fSlugs.has(k)) fData[k] = v;
  });

  // Aggregate metrics
  const allTasks = Object.values(fData).flatMap(d => (d.actions || []).filter(a => a.status !== 'discarded' && a.status !== 'cancelled'));
  const allRisks = Object.values(fData).flatMap(d => d.risks || []);
  const tasksDone = allTasks.filter(a => a.status === 'done' || a.status === 'archived').length;
  const today = new Date().toISOString().slice(0, 10);
  const tasksOnTrack = allTasks.filter(a => a.status !== 'done' && (!a.date || a.date >= today)).length;
  const risksOpen = allRisks.filter(r => r.status !== 'mitigated');
  const risksMitigated = allRisks.filter(r => r.status === 'mitigated').length;
  const risksEscalated = risksOpen.filter(r => r.escalation?.level && r.escalation.level !== 'equipo').length;

  // Skill data (simplified — full implementation loads per-project)
  const skillSummary = { totalFte: 0, avgFit: 0, criticalGaps: 0, coveragePercent: 0 };

  const health = calculateHealth({
    totalTasks: allTasks.length,
    tasksDone,
    tasksOnTrack,
    risksOpen: risksOpen.length,
    risksMitigated,
    risksEscalated,
    risksTotal: allRisks.length,
    avgFitPercent: skillSummary.avgFit,
    coveragePercent: skillSummary.coveragePercent,
  });

  // Per-project metrics
  const projectMetrics: ProjectMetrics[] = fRooms.map(r => {
    const d = fData[r.slug] || {};
    const acts = ((d.actions || []) as Task[]).filter(a => a.status !== 'discarded' && a.status !== 'cancelled');
    const done = acts.filter(a => a.status === 'done' || a.status === 'archived').length;
    const overdue = acts.filter(a => a.status !== 'done' && a.date && a.date < today).length;
    const risks = (d.risks || []) as Risk[];
    const rOpen = risks.filter(x => x.status !== 'mitigated');
    return {
      slug: r.slug,
      name: r.name,
      tasks: { total: acts.length, done, overdue, pctDone: acts.length > 0 ? Math.round(done / acts.length * 100) : 0 },
      risks: {
        open: rOpen.length,
        mitigated: risks.filter(x => x.status === 'mitigated').length,
        escalated: rOpen.filter(x => x.escalation?.level && x.escalation.level !== 'equipo').length,
        critical: rOpen.filter(x => calculateCriticality(x.prob || 'media', x.impact || 'medio') === 'critical').length,
      },
      team: { total: members.filter(m => (m.rooms || []).includes(r.slug)).length, onVacation: 0, avgFit: null },
    };
  });

  log.info('Dashboard loaded', { rooms: rooms.length, members: members.length, health: health.score });

  return { rooms, members, allData: fData, health, projectMetrics, skillSummary };
}
