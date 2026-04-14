const PRESET: Record<string, { cls: string; label?: string }> = {
  ACTIVE:      { cls: "ok", label: "Activo" },
  PAUSED:      { cls: "warn", label: "Pausado" },
  CLOSED:      { cls: "neutral", label: "Cerrado" },
  PLANNED:     { cls: "neutral", label: "Planificado" },
  COMPLETED:   { cls: "ok", label: "Completado" },
  CANCELLED:   { cls: "error", label: "Cancelado" },
  PARTIAL:     { cls: "warn", label: "Parcial" },
  FREE:        { cls: "ok", label: "Libre" },
  FULL:        { cls: "neutral", label: "Completo" },
  OVERLOADED:  { cls: "error", label: "Sobrecargado" },
  PENDING:     { cls: "warn", label: "Pendiente" },
  APPROVED:    { cls: "ok", label: "Aprobado" },
  REJECTED:    { cls: "error", label: "Rechazado" },
  FIXED_PRICE:        { cls: "neutral", label: "Precio Fijo" },
  TIME_AND_MATERIAL:  { cls: "neutral", label: "T&M" },
  STAFFING:           { cls: "neutral", label: "Staffing" },
  exceeded:    { cls: "error", label: "Superado" },
  warning:     { cls: "warn", label: "Riesgo" },
  ok:          { cls: "ok", label: "OK" },
};

export function StatusBadge({
  status,
  label,
  size = "normal",
}: {
  status: string;
  label?: string;
  size?: "small" | "normal";
}) {
  const preset = PRESET[status];
  const cls = preset?.cls ?? "neutral";
  const text = label ?? preset?.label ?? status;

  return (
    <span
      className={`pill ${cls}`}
      style={size === "small" ? { fontSize: "0.7rem", padding: "0.1rem 0.45rem" } : undefined}
    >
      {text}
    </span>
  );
}
