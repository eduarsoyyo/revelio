// ═══ ADMIN ORG CHART — Global organigrama for Centro de Control ═══
import { useState, useEffect } from 'preact/hooks';
import type { Member, Room } from '@app-types/index';
import { loadTeamMembers } from '@data/team';
import { loadRooms } from '@data/rooms';
import { Icon } from '@components/common/Icon';
import { OrgChart } from '@components/project/OrgChart';

interface OrgEntry {
  id: string;
  sala: string;
  member_id: string;
  manager_id: string | null;
}

async function loadAllOrgChart(): Promise<OrgEntry[]> {
  try {
    const { supabase } = await import('../../data/supabase');
    const { data, error } = await supabase.from('org_chart').select('id, sala, member_id, manager_id');
    if (error) { console.error('loadAllOrgChart:', error); return []; }
    return data ?? [];
  } catch { return []; }
}

async function saveOrgNode(sala: string, memberId: string, managerId: string | null): Promise<void> {
  try {
    const { supabase } = await import('../../data/supabase');
    const { data: existing } = await supabase.from('org_chart')
      .select('id').eq('sala', sala).eq('member_id', memberId).maybeSingle();
    if (existing?.id) {
      await supabase.from('org_chart').update({ manager_id: managerId }).eq('id', existing.id);
    } else {
      await supabase.from('org_chart').insert({ sala, member_id: memberId, manager_id: managerId });
    }
  } catch (e) { console.error('saveOrgNode:', e); }
}

export function AdminOrgChart() {
  const [members, setMembers] = useState<Member[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [orgEntries, setOrgEntries] = useState<OrgEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSala, setSelectedSala] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadTeamMembers(), loadRooms(), loadAllOrgChart()]).then(([mR, rR, org]) => {
      if (mR.ok) setMembers(mR.data);
      if (rR.ok) setRooms(rR.data);
      setOrgEntries(org);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando organigrama…</div>;

  // Group org entries by sala
  const orgBySala: Record<string, Record<string, string | null>> = {};
  orgEntries.forEach(e => {
    if (!orgBySala[e.sala]) orgBySala[e.sala] = {};
    orgBySala[e.sala][e.member_id] = e.manager_id;
  });

  // Rooms that have org data, plus all rooms for empty state
  const roomsWithOrg = rooms.filter(r => orgBySala[r.slug] && Object.keys(orgBySala[r.slug]).length > 0);
  const roomsWithoutOrg = rooms.filter(r => !orgBySala[r.slug] || Object.keys(orgBySala[r.slug]).length === 0);

  const handleSetManager = async (sala: string, memberId: string, managerId: string | null) => {
    setSaving(true);
    await saveOrgNode(sala, memberId, managerId);
    // Update local state
    setOrgEntries(prev => {
      const filtered = prev.filter(e => !(e.sala === sala && e.member_id === memberId));
      return [...filtered, { id: crypto.randomUUID(), sala, member_id: memberId, manager_id: managerId }];
    });
    setSaving(false);
  };

  // Filter view
  const displayRooms = selectedSala
    ? rooms.filter(r => r.slug === selectedSala)
    : roomsWithOrg;

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="GitBranch" size={18} color="#5856D6" /> Organigrama
      </h2>
      <p style={{ fontSize: 13, color: '#86868B', marginBottom: 16 }}>
        Estructura jerárquica del equipo por proyecto. {roomsWithOrg.length} proyecto{roomsWithOrg.length !== 1 ? 's' : ''} con organigrama.
      </p>

      {/* Project filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          onClick={() => setSelectedSala(null)}
          style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            border: !selectedSala ? 'none' : '1.5px solid #E5E5EA',
            background: !selectedSala ? '#1D1D1F' : '#FFF',
            color: !selectedSala ? '#FFF' : '#6E6E73',
          }}>
          Todos
        </button>
        {rooms.map(r => (
          <button key={r.slug}
            onClick={() => setSelectedSala(selectedSala === r.slug ? null : r.slug)}
            style={{
              padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: selectedSala === r.slug ? 'none' : '1.5px solid #E5E5EA',
              background: selectedSala === r.slug ? '#5856D6' : '#FFF',
              color: selectedSala === r.slug ? '#FFF' : '#6E6E73',
            }}>
            {r.name}
          </button>
        ))}
      </div>

      {/* Orgcharts per project */}
      {displayRooms.map(room => {
        const org = orgBySala[room.slug] || {};
        const teamForRoom = members.filter(m => (m.rooms || []).includes(room.slug));
        // If no team filtered by room, show all members that have org entries for this room
        const orgMemberIds = Object.keys(org);
        const effectiveTeam = teamForRoom.length > 0
          ? teamForRoom
          : members.filter(m => orgMemberIds.includes(m.id));

        if (effectiveTeam.length === 0 && Object.keys(org).length === 0) return null;

        return (
          <div key={room.slug} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{room.name}</span>
              <span style={{ fontSize: 10, color: '#86868B', background: '#F2F2F7', padding: '2px 8px', borderRadius: 6 }}>{room.tipo}</span>
              <span style={{ fontSize: 10, color: '#86868B' }}>{effectiveTeam.length} personas</span>
            </div>
            <div style={{ overflowX: 'auto', padding: '8px 0' }}>
              <OrgChart
                team={effectiveTeam}
                org={org}
                onSetManager={(memberId, managerId) => handleSetManager(room.slug, memberId, managerId)}
                saving={saving}
              />
            </div>
          </div>
        );
      })}

      {/* Empty state for rooms without org data */}
      {selectedSala && !orgBySala[selectedSala] && (
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 24, textAlign: 'center' }}>
          <Icon name="GitBranch" size={32} color="#E5E5EA" />
          <p style={{ fontSize: 13, color: '#86868B', marginTop: 8 }}>
            Este proyecto no tiene organigrama. Asigna managers desde la ficha de cada usuario o haz clic en los nodos para editar.
          </p>
          {/* Add all room members as root nodes */}
          {(() => {
            const teamForRoom = members.filter(m => (m.rooms || []).includes(selectedSala));
            if (teamForRoom.length === 0) return <p style={{ fontSize: 11, color: '#C7C7CC', marginTop: 8 }}>No hay personas asignadas a este proyecto.</p>;
            return (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 11, color: '#86868B', marginBottom: 8 }}>Personas en este proyecto (pulsa para añadir al organigrama):</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {teamForRoom.map(m => (
                    <button key={m.id}
                      onClick={() => handleSetManager(selectedSala, m.id, null)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1px dashed #E5E5EA', background: '#FFF', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{m.avatar || '👤'}</span> {m.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Global empty */}
      {displayRooms.length === 0 && !selectedSala && (
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 40, textAlign: 'center' }}>
          <Icon name="GitBranch" size={40} color="#E5E5EA" />
          <p style={{ fontSize: 13, color: '#86868B', marginTop: 8 }}>
            Ningún proyecto tiene organigrama configurado. Selecciona un proyecto arriba para empezar.
          </p>
        </div>
      )}

      {/* Summary of rooms without org */}
      {!selectedSala && roomsWithoutOrg.length > 0 && roomsWithOrg.length > 0 && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: '#F9F9FB', borderRadius: 10 }}>
          <p style={{ fontSize: 11, color: '#86868B' }}>
            {roomsWithoutOrg.length} proyecto{roomsWithoutOrg.length !== 1 ? 's' : ''} sin organigrama:{' '}
            {roomsWithoutOrg.map(r => r.name).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
