// ═══ ABSENCE TYPES — Shared constant for vacation/absence management ═══

export const ABSENCE_TYPES = [
  { id: 'vacaciones',         label: '🏖️ Vacaciones',                  initial: 'V',  color: '#FF9500' },
  { id: 'baja_medica',        label: '🏥 Baja médica (IT)',             initial: 'B',  color: '#FF3B30' },
  { id: 'asuntos_propios',    label: '📅 Asuntos propios',              initial: 'A',  color: '#5856D6' },
  { id: 'matrimonio',         label: '💍 Permiso por matrimonio',       initial: 'M',  color: '#AF52DE' },
  { id: 'nacimiento',         label: '👶 Nacimiento/adopción',          initial: 'N',  color: '#FF2D55' },
  { id: 'fallecimiento_1g',   label: '⚫ Fallecimiento fam. 1er grado', initial: 'F',  color: '#1D1D1F' },
  { id: 'fallecimiento_2g',   label: '⚫ Fallecimiento fam. 2do grado', initial: 'F',  color: '#3A3A3C' },
  { id: 'mudanza',            label: '🏠 Traslado de domicilio',        initial: 'T',  color: '#00C7BE' },
  { id: 'formacion',          label: '📚 Formación/examen',             initial: 'E',  color: '#007AFF' },
  { id: 'lactancia',          label: '👩‍🍼 Lactancia',                   initial: 'L',  color: '#FF6482' },
  { id: 'reduccion_jornada',  label: '⏱️ Reducción de jornada',         initial: 'R',  color: '#FF9F0A' },
  { id: 'permiso_retribuido', label: '✅ Permiso retribuido',           initial: 'P',  color: '#34C759' },
  { id: 'otro',               label: '📝 Otro',                         initial: 'O',  color: '#86868B' },
] as const;

export type AbsenceTypeId = typeof ABSENCE_TYPES[number]['id'];

export const ANNUAL_VAC_DAYS = 22;

/** Get absence type by id */
export const getAbsenceType = (id: string) =>
  ABSENCE_TYPES.find(t => t.id === id) || ABSENCE_TYPES[ABSENCE_TYPES.length - 1];
