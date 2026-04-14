import type { HealthStatus } from "@prisma/client";

export type HealthInput = {
  alertLevel: "ok" | "warning" | "exceeded";
  grossMarginActualPct: number | null;
  marginThreshold: number | null;
  openHighRisks: number;
  delayedMilestones: number;
  spi: number | null;
  cpi: number | null;
  utilizationPct: number;
};

/**
 * Calcula el estado de salud RAG del proyecto a partir de sus métricas.
 * Reglas en orden de severidad descendente.
 */
export function computeHealthStatus(input: HealthInput): HealthStatus {
  const { alertLevel, grossMarginActualPct, marginThreshold, openHighRisks, delayedMilestones, spi, cpi } = input;

  // ── RED ────────────────────────────────────────────────────────────────────
  if (alertLevel === "exceeded") return "RED";
  if (openHighRisks > 0) return "RED";
  if (cpi !== null && cpi < 0.75) return "RED";
  if (spi !== null && spi < 0.75) return "RED";
  if (
    grossMarginActualPct !== null &&
    marginThreshold !== null &&
    grossMarginActualPct < marginThreshold * 0.5
  )
    return "RED";

  // ── YELLOW ─────────────────────────────────────────────────────────────────
  if (alertLevel === "warning") return "YELLOW";
  if (delayedMilestones > 0) return "YELLOW";
  if (cpi !== null && cpi < 0.9) return "YELLOW";
  if (spi !== null && spi < 0.9) return "YELLOW";
  if (
    grossMarginActualPct !== null &&
    marginThreshold !== null &&
    grossMarginActualPct < marginThreshold
  )
    return "YELLOW";

  return "GREEN";
}
