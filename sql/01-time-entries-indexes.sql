-- ═══════════════════════════════════════════════════════════════════════════
-- Sesión 8 — Índices y RLS para time_entries (revisar antes de aplicar)
-- ═══════════════════════════════════════════════════════════════════════════
-- Estos índices aceleran las queries que va a hacer services/finance.ts:
--   - fetchTimeEntries({ sala, year })       → idx_time_entries_sala_date
--   - fetchTimeEntries({ memberId, year })   → idx_time_entries_member_date
--
-- Ejecutar UNA SOLA VEZ en el SQL Editor de Supabase (rjuszxhiqqkkizhqtwep).
-- Si ya existen, IF NOT EXISTS evita el error.
-- ═══════════════════════════════════════════════════════════════════════════

-- Índices compuestos
CREATE INDEX IF NOT EXISTS idx_time_entries_sala_date
  ON time_entries (sala, date);

CREATE INDEX IF NOT EXISTS idx_time_entries_member_date
  ON time_entries (member_id, date);

CREATE INDEX IF NOT EXISTS idx_time_entries_status
  ON time_entries (status)
  WHERE status IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verificación post-aplicación
-- ═══════════════════════════════════════════════════════════════════════════
-- Pega esto después para confirmar que los índices están creados:
--
-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'time_entries' ORDER BY indexname;
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- (OPCIONAL) RLS — descomentar si time_entries todavía tiene USING(true)
-- ═══════════════════════════════════════════════════════════════════════════
-- ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "time_entries_select_authenticated" ON time_entries;
-- CREATE POLICY "time_entries_select_authenticated"
--   ON time_entries FOR SELECT
--   TO authenticated
--   USING (true);
--
-- DROP POLICY IF EXISTS "time_entries_insert_own" ON time_entries;
-- CREATE POLICY "time_entries_insert_own"
--   ON time_entries FOR INSERT
--   TO authenticated
--   WITH CHECK (member_id = auth.uid());
-- ═══════════════════════════════════════════════════════════════════════════
