// ═══ useRealtime — Supabase Broadcast for collaborative retros ═══
// Handles: presence (online users), state sync, cursor tracking, timer sync, phase sync.
// No window globals — all via callbacks.

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { supabase } from '../data/supabase';
import { saveRetroSnapshot } from '../data/retros';
import type { AppUser, BroadcastPayload } from '../types/index';
import { createLogger } from '../lib/logger';

const log = createLogger('hook:realtime');

export interface OnlineUser {
  name: string;
  avatar: string;
  color: string;
}

export interface CursorInfo {
  x: number;
  y: number;
  name: string;
  avatar: string;
  color: string;
  ts: number;
}

export interface RealtimeState {
  notes: unknown[];
  tasks: unknown[];
  actions: unknown[];
  obj: { text: string; met: boolean | null };
  risks: unknown[];
  [key: string]: unknown;
}

interface UseRealtimeOptions {
  user: AppUser;
  sala: string;
  tipo: string;
  onPhaseReceived?: (phase: number) => void;
  onTimerReceived?: (secs: number, isRunning: boolean, startedAt: number | null) => void;
  onCelebrationReceived?: () => void;
}

const DEFAULT_STATE: RealtimeState = {
  notes: [],
  tasks: [],
  actions: [],
  obj: { text: '', met: null },
  risks: [],
};

export function useRealtime({ user, sala, tipo, onPhaseReceived, onTimerReceived, onCelebrationReceived }: UseRealtimeOptions) {
  const [state, setState] = useState<RealtimeState>(() => {
    try {
      const saved = localStorage.getItem(`rf-retro-${sala}`);
      return saved ? { ...DEFAULT_STATE, ...JSON.parse(saved) } : { ...DEFAULT_STATE };
    } catch { return { ...DEFAULT_STATE }; }
  });
  const [online, setOnline] = useState<Record<string, OnlineUser>>({});
  const [cursors, setCursors] = useState<Record<string, CursorInfo>>({});

  const chRef = useRef<any>(null);
  const stRef = useRef(state);
  const cursRef = useRef<Record<string, CursorInfo>>({});
  const initialLoaded = useRef(false);
  const lastSavedActions = useRef(0);
  const saveTimerRef = useRef<any>(null);

  stRef.current = state;

  // Persist to localStorage
  const saveLocal = (s: RealtimeState) => {
    try { localStorage.setItem(`rf-retro-${sala}`, JSON.stringify(s)); } catch {}
  };

  // ── Load initial state from Supabase (ALWAYS, prefer DB if richer) ──
  useEffect(() => {
    log.info('Loading initial state from Supabase...', { sala });
    (async () => {
      try {
        let { data } = await supabase.from('retros')
          .select('data').eq('sala', sala).eq('status', 'active')
          .order('updated_at', { ascending: false }).limit(1);

        if (!data?.length) {
          const res = await supabase.from('retros')
            .select('data').eq('sala', sala)
            .order('updated_at', { ascending: false }).limit(1);
          data = res.data;
        }

        if (data?.[0]?.data) {
          const snap = data[0].data as any;
          const dbActions = snap.actions?.length || 0;
          const dbRisks = snap.risks?.length || 0;
          const dbNotes = snap.notes?.length || 0;
          log.info('DB snapshot', { actions: dbActions, risks: dbRisks, notes: dbNotes });

          setState(prev => {
            const localActions = prev.actions?.length || 0;
            const localRisks = prev.risks?.length || 0;
            const localNotes = prev.notes?.length || 0;

            // Prefer whichever has MORE data (DB wins ties)
            const merged = { ...prev };
            if (dbActions >= localActions) merged.actions = snap.actions || [];
            if (dbRisks >= localRisks) merged.risks = snap.risks || [];
            if (dbNotes >= localNotes) merged.notes = snap.notes || [];
            if (snap.tasks?.length > 0) merged.tasks = snap.tasks;
            if (snap.obj) merged.obj = snap.obj;

            lastSavedActions.current = Math.max(lastSavedActions.current, (merged.actions || []).length);
            saveLocal(merged);
            return merged;
          });
        }
      } catch (e) { log.error('Initial load failed', e); }
      initialLoaded.current = true;
    })();
  }, [sala]);

  // ── Auto-save to Supabase (debounced 5s) ──
  useEffect(() => {
    if (!user || !initialLoaded.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      if (!initialLoaded.current) return;
      const s = stRef.current;
      const actLen = (s.actions || []).length;

      // Guard: never overwrite if actions disappeared
      if (actLen === 0 && lastSavedActions.current > 0) {
        log.warn('Auto-save blocked: actions empty but previously had', { prev: lastSavedActions.current });
        return;
      }

      if (actLen > 0 || (s.risks || []).length > 0 || (s.notes || []).length > 0) {
        lastSavedActions.current = Math.max(lastSavedActions.current, actLen);
        saveRetroSnapshot(sala, tipo, s, user.id, 'active').catch(() => {});
      }
    }, 5000);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [state, user, sala, tipo]);

  // ── Supabase Channel: presence + broadcast ──
  useEffect(() => {
    if (!user) return;

    const ch = supabase.channel(`retro-${sala}`, { config: { presence: { key: user.id } } });

    // Presence: online users
    ch.on('presence', { event: 'sync' }, () => {
      const ps = ch.presenceState();
      const u: Record<string, OnlineUser> = {};
      Object.entries(ps).forEach(([k, arr]: [string, any[]]) => {
        if (arr.length > 0) u[k] = { name: arr[0].name, avatar: arr[0].avatar, color: arr[0].color };
      });
      setOnline(u);
    });

    // Broadcast: phase changes
    ch.on('broadcast', { event: 'phase' }, ({ payload }: { payload: BroadcastPayload }) => {
      if (payload.from !== user.id && onPhaseReceived) onPhaseReceived(payload.phase as number);
    });

    // Broadcast: cursor positions
    ch.on('broadcast', { event: 'cursor' }, ({ payload }: { payload: BroadcastPayload }) => {
      if (payload.id === user.id) return;
      const pid = payload.id as string;
      cursRef.current = {
        ...cursRef.current,
        [pid]: { x: payload.x as number, y: payload.y as number, name: payload.name as string, avatar: payload.avatar as string, color: payload.color as string, ts: Date.now() },
      };
      setCursors({ ...cursRef.current });
    });

    // Broadcast: state sync (notes, actions, risks, etc.)
    ch.on('broadcast', { event: 'sync' }, ({ payload }: { payload: BroadcastPayload }) => {
      if (payload.from === user.id) return;
      setState(prev => {
        const next = { ...prev, [payload.key as string]: payload.data };
        saveLocal(next);
        return next;
      });
    });

    // Broadcast: timer sync
    ch.on('broadcast', { event: 'timer' }, ({ payload }: { payload: BroadcastPayload }) => {
      if (payload.from === user.id) return;
      if (onTimerReceived) onTimerReceived(payload.secs as number, payload.isRunning as boolean, payload.startedAt as number | null);
    });

    // Broadcast: request full state (for latecomers)
    ch.on('broadcast', { event: 'req' }, ({ payload }: { payload: BroadcastPayload }) => {
      if (payload.from === user.id) return;
      const s = stRef.current;
      Object.keys(s).forEach(k => {
        (ch as any).httpSend({ type: 'broadcast', event: 'sync', payload: { key: k, data: (s as any)[k], from: user.id } });
      });
    });

    // Broadcast: celebration (triggered when retro is finalized)
    ch.on('broadcast', { event: 'celebration' }, ({ payload }: { payload: BroadcastPayload }) => {
      if (payload.from !== user.id && onCelebrationReceived) onCelebrationReceived();
    });

    ch.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ name: user.name, avatar: user.avatar || '👤', color: user.color || '#007AFF' });
        // Request state from other users after a short delay
        setTimeout(() => (ch as any).httpSend({ type: 'broadcast', event: 'req', payload: { from: user.id } }), 600);
        log.info('Subscribed to channel', { sala });
      }
    });

    // Clean stale cursors every 3s
    const cleanIv = setInterval(() => {
      const now = Date.now();
      let changed = false;
      const c = { ...cursRef.current };
      Object.keys(c).forEach(k => { if (now - c[k].ts > 5000) { delete c[k]; changed = true; } });
      if (changed) { cursRef.current = c; setCursors(c); }
    }, 3000);

    chRef.current = ch;
    return () => { supabase.removeChannel(ch); clearInterval(cleanIv); };
  }, [user, sala]);

  // ── Public API ──

  /** Update a key in retro state and broadcast to others */
  const upd = useCallback((key: string, data: unknown) => {
    setState(prev => {
      const next = { ...prev, [key]: data };
      saveLocal(next);
      return next;
    });
    if (chRef.current && user) {
      chRef.current.httpSend({ type: 'broadcast', event: 'sync', payload: { key, data, from: user.id } });
    }
  }, [user]);

  /** Broadcast cursor position */
  const moveCursor = useCallback((x: number, y: number) => {
    if (chRef.current && user) {
      chRef.current.httpSend({
        type: 'broadcast', event: 'cursor',
        payload: { id: user.id, x, y, name: user.name, avatar: user.avatar || '👤', color: user.color || '#007AFF' },
      });
    }
  }, [user]);

  /** Broadcast timer state */
  const broadcastTimer = useCallback((secs: number, isRunning: boolean, startedAt: number | null) => {
    if (chRef.current && user) {
      chRef.current.httpSend({ type: 'broadcast', event: 'timer', payload: { secs, isRunning, startedAt, from: user.id } });
    }
  }, [user]);

  /** Broadcast phase change */
  const broadcastPhase = useCallback((phaseIdx: number) => {
    if (chRef.current && user) {
      chRef.current.httpSend({ type: 'broadcast', event: 'phase', payload: { phase: phaseIdx, from: user.id, name: user.name } });
    }
  }, [user]);

  /** Broadcast celebration to all connected users */
  const broadcastCelebration = useCallback(() => {
    if (chRef.current && user) {
      chRef.current.httpSend({ type: 'broadcast', event: 'celebration', payload: { from: user.id } });
    }
  }, [user]);

  /** Reset retro to fresh state (preserves open actions + risks) */
  const reset = useCallback(() => {
    const currentRisks = stRef.current.risks || [];
    const openActions = (stRef.current.actions as any[]).filter(a => a.status !== 'done' && a.status !== 'discarded');
    const fresh: RealtimeState = { notes: [], tasks: [], actions: openActions, obj: { text: '', met: null }, risks: currentRisks };
    try { localStorage.removeItem(`rf-retro-${sala}`); } catch {}
    setState(fresh);
    if (chRef.current && user) {
      Object.keys(fresh).forEach(k => {
        chRef.current.httpSend({ type: 'broadcast', event: 'sync', payload: { key: k, data: (fresh as any)[k], from: user.id } });
      });
    }
  }, [user, sala]);

  return { state, upd, online, cursors, moveCursor, reset, broadcastTimer, broadcastPhase, broadcastCelebration };
}
