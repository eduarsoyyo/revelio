// ═══ TAB PERSONAS — Team cards + skill evaluation with radar + history ═══
import { useState, useEffect, useMemo } from 'preact/hooks';
import type { Member, SkillProfile, ProfileSkill, MemberSkill, Skill } from '@app-types/index';
import { memberFit, fitColor, LEVEL_COLORS, LEVEL_ICONS, LEVEL_LABELS } from '@domain/skills';
import { assignProfileToMember, evaluateSkill } from '@services/skills';
import { Icon } from '@components/common/Icon';

interface TabPersonasProps {
  team: Member[];
  profiles: SkillProfile[];
  profSkills: ProfileSkill[];
  memSkills: MemberSkill[];
  memProfiles: Array<{ id: string; member_id: string; profile_id: string; sala: string }>;
  skills: Skill[];
  categories: string[];
  sala: string;
  onRefresh: () => void;
}

// Eval history loader
async function loadEvalHistory(sala: string): Promise<Array<{ member_id: string; evaluated_at: string; fit: number }>> {
  try {
    const { supabase } = await import('../../data/supabase');
    const { data } = await supabase.from('skill_evaluations').select('member_id,evaluated_at,fit').eq('sala', sala).order('evaluated_at');
    return data ?? [];
  } catch { return []; }
}
async function saveEvalSnapshot(sala: string, memberId: string, fit: number) {
  try {
    const { supabase } = await import('../../data/supabase');
    await supabase.from('skill_evaluations').insert({ sala, member_id: memberId, fit, evaluated_at: new Date().toISOString() });
  } catch {}
}

const cardS = { background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA' } as const;

export function TabPersonas({ team, profiles, profSkills, memSkills, memProfiles, skills, categories, sala, onRefresh }: TabPersonasProps) {
  const [evalMember, setEvalMember] = useState<Member | null>(null);
  const [history, setHistory] = useState<Array<{ member_id: string; evaluated_at: string; fit: number }>>([]);

  useEffect(() => { loadEvalHistory(sala).then(setHistory); }, [sala]);

  const getMemberProfile = (mid: string) => {
    const mp = memProfiles.find(x => x.member_id === mid);
    return mp ? profiles.find(p => p.id === mp.profile_id) : null;
  };

  const getMemberFit = (mid: string): number | null => {
    const mp = memProfiles.find(x => x.member_id === mid);
    if (!mp) return null;
    const reqs = profSkills.filter(ps => ps.profile_id === mp.profile_id);
    return memberFit(mid, reqs, memSkills);
  };

  const handleAssign = async (memberId: string, profileId: string) => {
    await assignProfileToMember(memberId, profileId || null, sala);
    onRefresh();
  };

  const handleEval = async (memberId: string, skillId: string, level: number) => {
    await evaluateSkill(memberId, skillId, level);
    onRefresh();
    // Save snapshot
    setTimeout(() => {
      const fit = getMemberFit(memberId);
      if (fit !== null) saveEvalSnapshot(sala, memberId, fit);
    }, 300);
  };

  // Radar SVG
  const renderRadar = (member: Member) => {
    const profile = getMemberProfile(member.id);
    if (!profile) return null;
    const reqs = profSkills.filter(ps => ps.profile_id === profile.id);
    if (reqs.length < 3) return <p style={{ fontSize: 10, color: '#C7C7CC', textAlign: 'center' }}>Mínimo 3 habilidades para radar</p>;

    const n = reqs.length;
    const cx = 110, cy = 110, r = 80;
    const reqPts: string[] = [];
    const actPts: string[] = [];

    reqs.forEach((req, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      reqPts.push(`${cx + Math.cos(a) * (req.required_level / 4) * r},${cy + Math.sin(a) * (req.required_level / 4) * r}`);
      const ms = memSkills.find(x => x.member_id === member.id && x.skill_id === req.skill_id);
      actPts.push(`${cx + Math.cos(a) * ((ms?.current_level || 0) / 4) * r},${cy + Math.sin(a) * ((ms?.current_level || 0) / 4) * r}`);
    });

    return (
      <svg viewBox="0 0 220 220" style={{ width: 200, height: 200 }}>
        {[1, 2, 3, 4].map(l => (
          <polygon key={l} points={reqs.map((_, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; const lr = (l / 4) * r; return `${cx + Math.cos(a) * lr},${cy + Math.sin(a) * lr}`; }).join(' ')}
            fill="none" stroke="#E5E5EA" strokeWidth={0.5} />
        ))}
        {reqs.map((_, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} stroke="#F2F2F7" strokeWidth={0.5} />; })}
        <polygon points={reqPts.join(' ')} fill="rgba(0,122,255,.06)" stroke="#007AFF" strokeWidth={1.5} strokeDasharray="4 3" />
        <polygon points={actPts.join(' ')} fill="rgba(88,86,214,.1)" stroke="#5856D6" strokeWidth={2} />
        {reqs.map((req, i) => {
          const sk = skills.find(s => s.id === req.skill_id);
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const lx = cx + Math.cos(a) * (r + 20);
          const ly = cy + Math.sin(a) * (r + 20);
          const name = sk?.name || '?';
          return <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={6.5} fill="#6E6E73" fontWeight={600}>{name.length > 14 ? name.slice(0, 12) + '…' : name}</text>;
        })}
        <text x={20} y={215} fontSize={6} fill="#007AFF">— Requerido</text>
        <text x={120} y={215} fontSize={6} fill="#5856D6">— Actual</text>
      </svg>
    );
  };

  // Mini evolution sparkline
  const renderSparkline = (memberId: string) => {
    const pts = history.filter(h => h.member_id === memberId).slice(-8);
    if (pts.length < 2) return null;
    const w = 80, h = 24;
    const maxFit = 100;
    const points = pts.map((p, i) => `${(i / (pts.length - 1)) * w},${h - (p.fit / maxFit) * h}`).join(' ');
    return (
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, height: h }}>
        <polyline points={points} fill="none" stroke="#34C759" strokeWidth={1.5} />
      </svg>
    );
  };

  // Suggest action for gap
  const suggestAction = (gap: number) => {
    if (gap >= 3) return 'Formación intensiva';
    if (gap >= 2) return 'Curso + práctica';
    if (gap >= 1) return 'Práctica/mentoring';
    return '';
  };

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Personas del equipo</h3>
      <p style={{ fontSize: 12, color: '#86868B', marginBottom: 14 }}>{team.length} personas · Click en tarjeta para asignar perfil · "Evaluar" para valorar habilidades</p>

      {/* Team cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
        {team.map(m => {
          const profile = getMemberProfile(m.id);
          const fit = getMemberFit(m.id);
          const reqs = profile ? profSkills.filter(ps => ps.profile_id === profile.id) : [];
          const evaluated = reqs.length > 0 && reqs.some(r => memSkills.some(ms => ms.member_id === m.id && ms.skill_id === r.skill_id));
          return (
            <div key={m.id} style={{ ...cardS, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: m.color || '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  {m.avatar || '👤'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: '#86868B' }}>{m.role_label || '—'} · {m.company || 'ALT'}</div>
                </div>
                {fit !== null && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: fitColor(fit) }}>{fit}%</div>
                    <div style={{ fontSize: 8, color: '#86868B' }}>encaje</div>
                  </div>
                )}
              </div>

              {/* Profile selector + fit bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <select value={profile?.id || ''} onChange={e => handleAssign(m.id, (e.target as HTMLSelectElement).value)}
                  style={{ flex: 1, border: '1.5px solid #E5E5EA', borderRadius: 8, padding: '5px 8px', fontSize: 11, fontFamily: 'inherit', outline: 'none', background: '#FFF' }}>
                  <option value="">— Sin perfil —</option>
                  {profiles.filter(p => p.sala === sala).map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
                </select>
                <button onClick={() => setEvalMember(m)}
                  style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: '#FF9500', color: '#FFF', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  Evaluar
                </button>
              </div>

              {/* Fit progress bar */}
              {fit !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#F2F2F7' }}>
                    <div style={{ width: `${fit}%`, height: 4, borderRadius: 2, background: fitColor(fit), transition: 'width .3s' }} />
                  </div>
                  {renderSparkline(m.id)}
                </div>
              )}

              {/* Quick skill summary */}
              {reqs.length > 0 && evaluated && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  {reqs.map(r => {
                    const sk = skills.find(s => s.id === r.skill_id);
                    const ms = memSkills.find(x => x.member_id === m.id && x.skill_id === r.skill_id);
                    const cur = ms?.current_level || 0;
                    const gap = r.required_level - cur;
                    return (
                      <span key={r.id} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 600, background: gap > 0 ? '#FF3B3010' : '#34C75910', color: gap > 0 ? '#FF3B30' : '#34C759' }}>
                        {sk?.name?.slice(0, 10) || '?'} {cur}/{r.required_level} {gap > 0 ? '▼' : '✓'}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Evaluation Modal ── */}
      {evalMember && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 15000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={() => setEvalMember(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(4px)' }} />
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', background: '#FFF', borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)', padding: 24 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: evalMember.color || '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                {evalMember.avatar || '👤'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Evaluar: {evalMember.name}</div>
                <div style={{ fontSize: 12, color: '#86868B' }}>{getMemberProfile(evalMember.id)?.name || 'Sin perfil'}</div>
              </div>
              {(() => { const f = getMemberFit(evalMember.id); return f !== null ? <div style={{ fontSize: 28, fontWeight: 800, color: fitColor(f) }}>{f}%</div> : null; })()}
              <button onClick={() => setEvalMember(null)} style={{ border: 'none', background: '#F2F2F7', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="X" size={16} color="#86868B" />
              </button>
            </div>

            {/* Two-column: radar + skills */}
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>
              {/* Radar */}
              <div>{renderRadar(evalMember)}</div>

              {/* Skills evaluation */}
              <div>
                {(() => {
                  const profile = getMemberProfile(evalMember.id);
                  if (!profile) return <p style={{ fontSize: 12, color: '#C7C7CC', textAlign: 'center', padding: 20 }}>Asigna un perfil primero</p>;
                  const reqs = profSkills.filter(ps => ps.profile_id === profile.id);
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {reqs.map(req => {
                        const sk = skills.find(s => s.id === req.skill_id);
                        const ms = memSkills.find(x => x.member_id === evalMember.id && x.skill_id === req.skill_id);
                        const cur = ms?.current_level || 0;
                        const gap = req.required_level - cur;
                        return (
                          <div key={req.id} style={{ ...cardS, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 700 }}>{sk?.name || '?'}</span>
                              <span style={{ fontSize: 10, color: '#86868B' }}>Req: {LEVEL_LABELS[req.required_level]} <strong>{req.required_level}</strong></span>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {([1, 2, 3, 4] as const).map(l => (
                                <button key={l} onClick={() => handleEval(evalMember.id, req.skill_id, l)}
                                  style={{
                                    flex: 1, padding: '6px 4px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                                    border: cur === l ? `2px solid ${LEVEL_COLORS[l]}` : '1.5px solid #E5E5EA',
                                    background: cur === l ? LEVEL_COLORS[l] + '15' : '#FFF',
                                    color: cur === l ? LEVEL_COLORS[l] : '#C7C7CC',
                                  }}>
                                  <div style={{ fontSize: 14 }}>{LEVEL_ICONS[l]}</div>
                                  <div style={{ fontSize: 8, fontWeight: 600, marginTop: 2 }}>{LEVEL_LABELS[l]}</div>
                                </button>
                              ))}
                            </div>
                            {gap > 0 && (
                              <div style={{ marginTop: 5, fontSize: 10, color: '#FF3B30', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontWeight: 700, background: '#FF3B3012', padding: '1px 6px', borderRadius: 4 }}>Gap: {gap}</span>
                                <span style={{ color: '#86868B' }}>— {suggestAction(gap)}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Evolution history */}
            {(() => {
              const pts = history.filter(h => h.member_id === evalMember.id);
              if (pts.length < 2) return null;
              const w = 400, h = 60;
              const points = pts.map((p, i) => `${(i / (pts.length - 1)) * w},${h - (p.fit / 100) * h}`).join(' ');
              return (
                <div style={{ marginTop: 16, padding: 12, background: '#F9F9FB', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', marginBottom: 6 }}>EVOLUCIÓN DEL ENCAJE</div>
                  <svg viewBox={`0 0 ${w} ${h + 10}`} style={{ width: '100%', height: 70 }}>
                    <polyline points={points} fill="none" stroke="#34C759" strokeWidth={2} />
                    {pts.map((p, i) => (
                      <g key={i}>
                        <circle cx={(i / (pts.length - 1)) * w} cy={h - (p.fit / 100) * h} r={3} fill="#34C759" />
                        <text x={(i / (pts.length - 1)) * w} y={h + 10} textAnchor="middle" fontSize={6} fill="#86868B">{new Date(p.evaluated_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</text>
                      </g>
                    ))}
                  </svg>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
