// ═══ CROSS-PROJECT — Detect overload + cross-impact ═══
import { loadTeamMembers, loadOrgChart } from '../data/team';
import { loadRooms } from '../data/rooms';
import { loadRetros } from '../data/retros';
import type { Member, Room, Risk } from '../types/index';

export interface OverloadAlert {
  memberId: string;
  memberName: string;
  avatar: string;
  totalDedication: number;
  projects: Array<{ sala: string; name: string; dedication: number }>;
}

export interface CrossRiskAlert {
  memberId: string;
  memberName: string;
  risks: Array<{ sala: string; roomName: string; riskText: string; level: string }>;
}

export interface CrossProjectData {
  overloads: OverloadAlert[];
  crossRisks: CrossRiskAlert[];
  memberProjects: Array<{ member: Member; projects: Array<{ sala: string; name: string; dedication: number }> }>;
}

export async function loadCrossProjectData(): Promise<CrossProjectData> {
  const [membersR, roomsR, retrosR] = await Promise.all([
    loadTeamMembers(),
    loadRooms(),
    loadRetros(),
  ]);

  const members = membersR.ok ? membersR.data : [];
  const rooms = roomsR.ok ? roomsR.data : [];
  const retros = retrosR.ok ? retrosR.data : [];

  // Load org_chart for all rooms
  const orgCharts: Record<string, Array<{ member_id: string; dedication: number; start_date: string; end_date: string }>> = {};
  for (const room of rooms) {
    const result = await loadOrgChart(room.slug);
    if (result.ok) orgCharts[room.slug] = result.data.map(r => ({ member_id: r.member_id, dedication: (r as Record<string, unknown>).dedication as number || 1, start_date: (r as Record<string, unknown>).start_date as string || '', end_date: (r as Record<string, unknown>).end_date as string || '' }));
  }

  // Build member → projects map with dedication
  const memberProjects: CrossProjectData['memberProjects'] = [];
  const overloads: OverloadAlert[] = [];

  for (const member of members) {
    const memberRooms = (member.rooms || []);
    const projects: Array<{ sala: string; name: string; dedication: number }> = [];

    for (const sala of memberRooms) {
      const room = rooms.find(r => r.slug === sala);
      const orgEntries = (orgCharts[sala] || []).filter(o => o.member_id === member.id);
      // Sum dedication from all periods active today
      const today = new Date().toISOString().slice(0, 10);
      const activeDed = orgEntries.reduce((sum, e) => {
        const s = (e as any).start_date || '2000-01-01';
        const ed = (e as any).end_date || '2099-12-31';
        if (today >= s && today <= ed) return sum + ((e as any).dedication || 1);
        return sum;
      }, 0);
      projects.push({
        sala,
        name: room?.name || sala,
        dedication: activeDed || (orgEntries.length > 0 ? orgEntries[0].dedication : 1),
      });
    }

    if (projects.length > 0) {
      memberProjects.push({ member, projects });

      const totalDed = projects.reduce((sum, p) => sum + p.dedication, 0);
      if (totalDed > 1.05) { // threshold: more than 105% allocation
        overloads.push({
          memberId: member.id,
          memberName: member.name,
          avatar: member.avatar || '👤',
          totalDedication: totalDed,
          projects,
        });
      }
    }
  }

  // Cross-risk alerts: find members with escalated risks in multiple projects
  const crossRisks: CrossRiskAlert[] = [];
  const memberRiskMap: Record<string, Array<{ sala: string; roomName: string; riskText: string; level: string }>> = {};

  // Get latest retro data per room
  const latestByRoom: Record<string, Record<string, unknown>> = {};
  retros.forEach(r => {
    if (!latestByRoom[r.sala] || r.created_at > (latestByRoom[r.sala] as Record<string, unknown>).created_at as string) {
      latestByRoom[r.sala] = r as unknown as Record<string, unknown>;
    }
  });

  for (const [sala, retro] of Object.entries(latestByRoom)) {
    const data = retro.data as Record<string, unknown> || {};
    const risks = (data.risks || []) as Array<Record<string, unknown>>;
    const roomName = rooms.find(r => r.slug === sala)?.name || sala;

    risks.forEach(risk => {
      if (!risk.escalation) return;
      const esc = risk.escalation as Record<string, unknown>;
      if (!esc.level || esc.level === 'equipo') return;

      const owner = (risk.owner as string) || '';
      const memberName = (esc.memberName as string) || owner;
      if (!memberName) return;

      if (!memberRiskMap[memberName]) memberRiskMap[memberName] = [];
      memberRiskMap[memberName].push({
        sala,
        roomName,
        riskText: ((risk.title || risk.text) as string || '').slice(0, 60),
        level: (esc.levelLabel || esc.level) as string,
      });
    });
  }

  // Only flag members with escalated risks in 2+ projects
  for (const [name, risks] of Object.entries(memberRiskMap)) {
    const uniqueProjects = new Set(risks.map(r => r.sala));
    if (uniqueProjects.size >= 2) {
      const member = members.find(m => m.name === name);
      crossRisks.push({
        memberId: member?.id || '',
        memberName: name,
        risks,
      });
    }
  }

  return { overloads, crossRisks, memberProjects };
}
