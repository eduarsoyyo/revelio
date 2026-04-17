// ═══ ROOM PICKER — Centro de Control shell ═══
// Header + Sidebar (4 secciones) + Content panels

import { useState, useEffect } from 'preact/hooks';
import type { Room, Member, AppUser } from '@app-types/index';
import { loadRooms } from '@data/rooms';
import { loadTeamMembers } from '@data/team';
import { AdminDashboard } from './AdminDashboard';
import { MaestrosPanel } from './AdminPanels';
import { UsersPanel } from './UsersPanel';
import { RolesPanel } from './RolesPanel';
import { CalendarPanel } from './CalendarPanel';
import { EscaladoPanel } from './EscaladoPanel';
import { CrossProject } from './CrossProject';
import { ConsultantTimeline } from './ConsultantTimeline';
import { ProjectsPanel } from './ProjectsPanel';
import { Icon } from '@components/common/Icon';
import { Loading } from '@components/common/Feedback';
import { ProfileEditor } from '@components/common/ProfileEditor';
import { NotificationBell } from '@components/common/NotificationBell';

interface RoomPickerProps {
  user: AppUser;
  onGoToRoom: (slug: string, tipo: string) => void;
  onLogout: () => void;
  onBackToHome: () => void;
}

// ─── Navigation structure ───
interface NavItem {
  id: string;
  icon: string;
  label: string;
  children?: { id: string; icon: string; label: string }[];
}

const NAV: NavItem[] = [
  { id: 'dashboard', icon: 'BarChart3', label: 'Dashboard' },
  { id: 'proyectos', icon: 'FolderOpen', label: 'Proyectos' },
  {
    id: 'rrhh', icon: 'Users', label: 'RRHH',
    children: [
      { id: 'usuarios',    icon: 'UserCheck',  label: 'Usuarios' },
      { id: 'roles',       icon: 'Shield',     label: 'Roles y Habilidades' },
      { id: 'calendarios', icon: 'Calendar',   label: 'Calendario / Convenio' },
      { id: 'organigrama', icon: 'GitBranch',  label: 'Organigrama' },
      { id: 'timeline',    icon: 'Clock',      label: 'Consultant Timeline' },
    ],
  },
  { id: 'riesgos', icon: 'AlertTriangle', label: 'Riesgos y Escalado' },
];

export function RoomPicker({ user, onGoToRoom, onLogout, onBackToHome }: RoomPickerProps) {
  const [tab, setTab] = useState('dashboard');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['rrhh']));
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<Member | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);

  useEffect(() => {
    loadRooms().then(result => {
      if (result.ok) setRooms(result.data);
      setLoading(false);
    });
    loadTeamMembers().then(r => {
      if (r.ok) {
        const me = r.data.find(m => m.id === user.id || m.name === user.name);
        if (me) setUserProfile(me);
      }
    });
  }, []);

  // Close avatar menu on outside click
  useEffect(() => {
    if (!showAvatarMenu) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('[data-avatar-menu]')) setShowAvatarMenu(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showAvatarMenu]);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isActive = (id: string) => tab === id;
  const navBtnStyle = (active: boolean) => ({
    display: 'flex' as const, alignItems: 'center' as const, gap: 8,
    padding: '8px 10px', borderRadius: 8, border: 'none',
    background: active ? '#F2F2F7' : 'transparent',
    color: active ? '#007AFF' : '#6E6E73',
    fontSize: 12, fontWeight: (active ? 700 : 500) as number,
    cursor: 'pointer' as const, marginBottom: 1, width: '100%', textAlign: 'left' as const,
    transition: 'all .12s',
  });

  if (loading) return <Loading />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F5F5F7' }}>

      {/* ═══ HEADER ═══ */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px',
        background: '#FFF', borderBottom: '1px solid #E8E8ED', flexShrink: 0, zIndex: 20,
      }}>
        {/* Left: logo + title */}
        <h1 style={{
          fontFamily: "'Comfortaa',sans-serif", fontSize: 18, fontWeight: 400,
          background: 'linear-gradient(90deg,#007AFF,#5856D6)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0,
        }}>revelio</h1>
        <div style={{ width: 1, height: 20, background: '#E5E5EA', margin: '0 4px' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F' }}>Centro de control</span>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Right: Home + Notifications + Avatar */}
        <button onClick={onBackToHome}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid #E8E8ED', background: '#FFF', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#007AFF' }}>
          <Icon name="Home" size={13} color="#007AFF" /> Home
        </button>

        <NotificationBell user={user} global />

        <div style={{ position: 'relative' }} data-avatar-menu>
          <button onClick={(e) => { e.stopPropagation(); setShowAvatarMenu(!showAvatarMenu); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 4px', borderRadius: 10, border: '1px solid #E8E8ED', background: '#FFF', cursor: 'pointer' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: user.color || '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
              {user.avatar || '👤'}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F' }}>{user.name}</span>
            <Icon name="ChevronDown" size={12} color="#86868B" />
          </button>
          {showAvatarMenu && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#FFF', borderRadius: 12, border: '1px solid #E8E8ED', boxShadow: '0 8px 24px #0002', minWidth: 180, zIndex: 100, overflow: 'hidden' }}>
              <button onClick={() => { setShowProfile(true); setShowAvatarMenu(false); }}
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
        <aside style={{
          width: 210, background: '#FFF', borderRight: '1px solid #E8E8ED',
          padding: '16px 10px', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto',
        }}>
          {NAV.map(item => {
            if (!item.children) {
              // Simple nav item
              return (
                <button key={item.id} onClick={() => setTab(item.id)} style={navBtnStyle(isActive(item.id))}>
                  <Icon name={item.icon} size={14} color={isActive(item.id) ? '#007AFF' : '#86868B'} />
                  {item.label}
                </button>
              );
            }
            // Section with children
            const expanded = expandedSections.has(item.id);
            const childActive = item.children.some(c => isActive(c.id));
            return (
              <div key={item.id} style={{ marginBottom: 2 }}>
                <button onClick={() => toggleSection(item.id)}
                  style={{
                    ...navBtnStyle(childActive),
                    justifyContent: 'space-between',
                    color: childActive ? '#007AFF' : '#6E6E73',
                    fontWeight: childActive || expanded ? 700 : 500,
                  }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name={item.icon} size={14} color={childActive ? '#007AFF' : '#86868B'} />
                    {item.label}
                  </span>
                  <Icon name={expanded ? 'ChevronDown' : 'ChevronRight'} size={11} color="#C7C7CC" />
                </button>
                {expanded && (
                  <div style={{ paddingLeft: 14, marginTop: 2 }}>
                    {item.children.map(child => (
                      <button key={child.id} onClick={() => setTab(child.id)}
                        style={{
                          ...navBtnStyle(isActive(child.id)),
                          fontSize: 11, padding: '6px 10px',
                        }}>
                        <Icon name={child.icon} size={12} color={isActive(child.id) ? '#007AFF' : '#AEAEB2'} />
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Bottom: avatar */}
          <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid #F2F2F7' }}>
            <div onClick={() => setShowProfile(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 6px', cursor: 'pointer', borderRadius: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: user.color || '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                {user.avatar || '👤'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                <div style={{ fontSize: 9, color: '#86868B' }}>{user.role || 'Admin'}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ═══ CONTENT ═══ */}
        <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>

          {/* Dashboard */}
          {tab === 'dashboard' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: '#86868B', fontWeight: 600 }}>Filtrar:</span>
                <button onClick={() => setFilterProject([])}
                  style={{ padding: '5px 12px', borderRadius: 8, border: filterProject.length === 0 ? 'none' : '1.5px solid #E5E5EA', background: filterProject.length === 0 ? '#1D1D1F' : '#FFF', color: filterProject.length === 0 ? '#FFF' : '#6E6E73', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  Todos
                </button>
                {rooms.map(r => {
                  const active = filterProject.includes(r.slug);
                  return (
                    <button key={r.slug} onClick={() => setFilterProject(prev => active ? prev.filter(s => s !== r.slug) : [...prev, r.slug])}
                      style={{ padding: '5px 12px', borderRadius: 8, border: active ? 'none' : '1.5px solid #E5E5EA', background: active ? '#007AFF' : '#FFF', color: active ? '#FFF' : '#6E6E73', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      {r.name}
                    </button>
                  );
                })}
              </div>
              <AdminDashboard rooms={rooms} filterProject={filterProject} onGoToRoom={onGoToRoom} />
            </>
          )}

          {/* Proyectos */}
          {tab === 'proyectos' && <ProjectsPanel onGoToRoom={onGoToRoom} />}

          {/* RRHH tabs */}
          {tab === 'usuarios' && <UsersPanel />}
          {tab === 'roles' && <RolesPanel />}
          {tab === 'calendarios' && <CalendarPanel />}
          {tab === 'organigrama' && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="GitBranch" size={18} color="#5856D6" /> Organigrama
              </h2>
              <p style={{ fontSize: 13, color: '#86868B', marginBottom: 16 }}>Estructura jerárquica del equipo (por proyecto, seleccionable desde cada proyecto).</p>
              {/* Placeholder — will be populated in Iter 6 */}
              <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 40, textAlign: 'center', color: '#C7C7CC' }}>
                <Icon name="GitBranch" size={40} color="#E5E5EA" />
                <p style={{ fontSize: 13, marginTop: 8 }}>Organigrama global — disponible próximamente</p>
              </div>
            </div>
          )}
          {tab === 'timeline' && <ConsultantTimeline />}

          {/* Maestros — legacy, will merge into RRHH later */}
          {tab === 'maestros' && <MaestrosPanel />}

          {/* Riesgos y Escalado */}
          {tab === 'riesgos' && <EscaladoPanel />}
        </div>
      </div>

      {/* Profile editor modal */}
      {showProfile && userProfile && (
        <ProfileEditor user={user} profile={userProfile}
          onClose={() => setShowProfile(false)}
          onSave={updated => setUserProfile(updated)} />
      )}
    </div>
  );
}
