import { describe, it, expect } from "vitest";
import { computeHealthStatus, type HealthInput } from "../health.js";

const baseInput: HealthInput = {
  alertLevel: "ok",
  grossMarginActualPct: 25,
  marginThreshold: 15,
  openHighRisks: 0,
  delayedMilestones: 0,
  spi: 1.0,
  cpi: 1.0,
  utilizationPct: 75,
};

describe("computeHealthStatus", () => {
  it("retorna GREEN para un proyecto saludable", () => {
    expect(computeHealthStatus(baseInput)).toBe("GREEN");
  });

  // ── RED triggers ──────────────────────────────────────────────────────────

  it("retorna RED si alertLevel es exceeded (presupuesto superado)", () => {
    expect(computeHealthStatus({ ...baseInput, alertLevel: "exceeded" })).toBe("RED");
  });

  it("retorna RED si hay riesgos de alto impacto abiertos", () => {
    expect(computeHealthStatus({ ...baseInput, openHighRisks: 1 })).toBe("RED");
    expect(computeHealthStatus({ ...baseInput, openHighRisks: 3 })).toBe("RED");
  });

  it("retorna RED si CPI < 0.75", () => {
    expect(computeHealthStatus({ ...baseInput, cpi: 0.74 })).toBe("RED");
    expect(computeHealthStatus({ ...baseInput, cpi: 0.5 })).toBe("RED");
  });

  it("retorna RED si SPI < 0.75", () => {
    expect(computeHealthStatus({ ...baseInput, spi: 0.74 })).toBe("RED");
  });

  it("retorna RED si margen es menor al 50% del umbral", () => {
    // threshold = 15 → 50% = 7.5 → margin < 7.5 → RED
    expect(computeHealthStatus({ ...baseInput, grossMarginActualPct: 7, marginThreshold: 15 })).toBe("RED");
    expect(computeHealthStatus({ ...baseInput, grossMarginActualPct: -5, marginThreshold: 15 })).toBe("RED");
  });

  // ── YELLOW triggers ───────────────────────────────────────────────────────

  it("retorna YELLOW si alertLevel es warning", () => {
    expect(computeHealthStatus({ ...baseInput, alertLevel: "warning" })).toBe("YELLOW");
  });

  it("retorna YELLOW si hay hitos retrasados", () => {
    expect(computeHealthStatus({ ...baseInput, delayedMilestones: 1 })).toBe("YELLOW");
  });

  it("retorna YELLOW si CPI está entre 0.75 y 0.90", () => {
    expect(computeHealthStatus({ ...baseInput, cpi: 0.76 })).toBe("YELLOW");
    expect(computeHealthStatus({ ...baseInput, cpi: 0.89 })).toBe("YELLOW");
  });

  it("retorna YELLOW si SPI está entre 0.75 y 0.90", () => {
    expect(computeHealthStatus({ ...baseInput, spi: 0.85 })).toBe("YELLOW");
  });

  it("retorna YELLOW si margen está entre el 50% y el 100% del umbral", () => {
    // threshold = 15 → 50% = 7.5, entre 7.5 y 15 → YELLOW
    expect(computeHealthStatus({ ...baseInput, grossMarginActualPct: 10, marginThreshold: 15 })).toBe("YELLOW");
    expect(computeHealthStatus({ ...baseInput, grossMarginActualPct: 8, marginThreshold: 15 })).toBe("YELLOW");
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it("CPI exactamente en 0.75 no es RED", () => {
    expect(computeHealthStatus({ ...baseInput, cpi: 0.75 })).not.toBe("RED");
  });

  it("CPI exactamente en 0.90 no es YELLOW", () => {
    expect(computeHealthStatus({ ...baseInput, cpi: 0.90 })).not.toBe("YELLOW");
  });

  it("ignorar margen si marginThreshold es null", () => {
    const lowMargin = { ...baseInput, grossMarginActualPct: 2, marginThreshold: null };
    expect(computeHealthStatus(lowMargin)).toBe("GREEN");
  });

  it("ignorar margen si grossMarginActualPct es null", () => {
    const noMargin = { ...baseInput, grossMarginActualPct: null, marginThreshold: 15 };
    expect(computeHealthStatus(noMargin)).toBe("GREEN");
  });

  it("RED tiene prioridad sobre YELLOW (múltiples condiciones simultáneas)", () => {
    // alertLevel warning (→ YELLOW) AND openHighRisks > 0 (→ RED) → debe ser RED
    expect(computeHealthStatus({ ...baseInput, alertLevel: "warning", openHighRisks: 1 })).toBe("RED");
  });
});
