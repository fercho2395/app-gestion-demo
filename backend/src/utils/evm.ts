/**
 * Earned Value Management (EVM) — métricas de rendimiento de proyectos.
 *
 * CPI = EV / AC  (> 1 bajo presupuesto, < 1 sobrecosto)
 * SPI = EV / PV  (> 1 adelantado, < 1 retrasado)
 * EV  = (completionPct / 100) × BAC  (presupuesto × avance)
 * PV  = (elapsedDays / totalDays) × BAC  (presupuesto planificado a la fecha)
 * EAC = AC + (BAC - EV) / CPI  (estimación a la terminación)
 * VAC = BAC - EAC  (variación en la terminación)
 */

export type EVMResult = {
  ev: number | null;    // Earned Value
  pv: number | null;    // Planned Value
  ac: number;           // Actual Cost
  cpi: number | null;   // Cost Performance Index
  spi: number | null;   // Schedule Performance Index
  eac: number | null;   // Estimate at Completion
  vac: number | null;   // Variance at Completion
  tcpi: number | null;  // To-Complete Performance Index
};

export function computeEVM(project: {
  budget: number;
  completionPct: number | null;
  startDate: Date;
  endDate: Date;
  totalCostActual: number;
}): EVMResult {
  const ac = project.totalCostActual;
  const bac = project.budget;

  if (!project.completionPct || bac === 0) {
    return { ev: null, pv: null, ac, cpi: null, spi: null, eac: null, vac: null, tcpi: null };
  }

  const ev = (project.completionPct / 100) * bac;

  const today = new Date();
  const start = project.startDate.getTime();
  const end = project.endDate.getTime();
  const totalMs = end - start;
  const elapsedMs = Math.min(today.getTime() - start, totalMs);
  const pv = totalMs > 0 ? (Math.max(elapsedMs, 0) / totalMs) * bac : null;

  const cpi = ac > 0 ? ev / ac : null;
  const spi = pv !== null && pv > 0 ? ev / pv : null;

  // EAC = AC + (BAC - EV) / CPI  — si CPI = 0, usar BAC como fallback
  const eac = cpi && cpi > 0 ? ac + (bac - ev) / cpi : bac;
  const vac = bac - eac;

  // TCPI = (BAC - EV) / (BAC - AC)
  const tcpi = bac - ac > 0 ? (bac - ev) / (bac - ac) : null;

  const round2 = (v: number | null) => v !== null ? Math.round(v * 100) / 100 : null;

  return {
    ev: round2(ev),
    pv: round2(pv),
    ac,
    cpi: round2(cpi),
    spi: round2(spi),
    eac: round2(eac),
    vac: round2(vac),
    tcpi: round2(tcpi),
  };
}
