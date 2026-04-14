/**
 * Mapeos centralizados de status codes → etiquetas en español.
 * Usar en todos los renders de tabla para consistencia visual.
 */

// ── Proyectos ─────────────────────────────────────────────────────────────────

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  ACTIVE:  "Activo",
  PAUSED:  "Pausado",
  CLOSED:  "Cerrado",
};

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  FIXED_PRICE:       "Precio fijo",
  TIME_AND_MATERIAL: "Tiempo y materiales",
  STAFFING:          "Staffing",
};

export const PROJECT_PHASE_LABELS: Record<string, string> = {
  INITIATION:  "Inicio",
  PLANNING:    "Planificación",
  EXECUTION:   "Ejecución",
  MONITORING:  "Seguimiento",
  CLOSING:     "Cierre",
};

// ── Hitos ─────────────────────────────────────────────────────────────────────

export const MILESTONE_STATUS_LABELS: Record<string, string> = {
  PLANNED:     "Planificado",
  IN_PROGRESS: "En progreso",
  COMPLETED:   "Completado",
  DELAYED:     "Atrasado",
  CANCELLED:   "Cancelado",
};

// ── Riesgos ───────────────────────────────────────────────────────────────────

export const RISK_STATUS_LABELS: Record<string, string> = {
  OPEN:      "Abierto",
  MITIGATED: "Mitigado",
  ACCEPTED:  "Aceptado",
  CLOSED:    "Cerrado",
};

// ── Incidentes ────────────────────────────────────────────────────────────────

export const ISSUE_STATUS_LABELS: Record<string, string> = {
  OPEN:        "Abierto",
  IN_PROGRESS: "En progreso",
  RESOLVED:    "Resuelto",
  CLOSED:      "Cerrado",
};

export const ISSUE_SEVERITY_LABELS: Record<string, string> = {
  LOW:      "Baja",
  MEDIUM:   "Media",
  HIGH:     "Alta",
  CRITICAL: "Crítica",
};

// ── Cambios ───────────────────────────────────────────────────────────────────

export const CHANGE_REQUEST_TYPE_LABELS: Record<string, string> = {
  SCOPE:    "Alcance",
  BUDGET:   "Presupuesto",
  SCHEDULE: "Cronograma",
  OTHER:    "Otro",
};

export const CHANGE_REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING:  "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};

// ── Asignaciones ──────────────────────────────────────────────────────────────

export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  PLANNED:   "Planificado",
  ACTIVE:    "Activo",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

// ── Registros de tiempo ───────────────────────────────────────────────────────

export const TIME_ENTRY_STATUS_LABELS: Record<string, string> = {
  PENDING:  "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Devuelve la etiqueta o el code original si no existe mapeo */
export function label(map: Record<string, string>, code: string | null | undefined): string {
  if (!code) return "—";
  return map[code] ?? code;
}
