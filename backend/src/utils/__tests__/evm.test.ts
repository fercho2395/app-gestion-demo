import { describe, it, expect } from "vitest";
import { computeEVM } from "../evm.js";

const today = new Date();
const pastDate = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000);
const futureDate = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86_400_000);

describe("computeEVM", () => {
  it("retorna nulls si completionPct es null", () => {
    const result = computeEVM({
      budget: 100_000,
      completionPct: null,
      startDate: pastDate(30),
      endDate: futureDate(30),
      totalCostActual: 40_000,
    });
    expect(result.ev).toBeNull();
    expect(result.cpi).toBeNull();
    expect(result.spi).toBeNull();
  });

  it("retorna nulls si budget es 0", () => {
    const result = computeEVM({
      budget: 0,
      completionPct: 50,
      startDate: pastDate(30),
      endDate: futureDate(30),
      totalCostActual: 10_000,
    });
    expect(result.ev).toBeNull();
    expect(result.cpi).toBeNull();
  });

  it("CPI = 1 cuando EV = AC (sin desvío de costo)", () => {
    const result = computeEVM({
      budget: 100_000,
      completionPct: 50,
      startDate: pastDate(60),
      endDate: futureDate(60),
      totalCostActual: 50_000,
    });
    expect(result.cpi).toBeCloseTo(1, 1);
  });

  it("CPI < 1 cuando AC > EV (sobrecosto)", () => {
    const result = computeEVM({
      budget: 100_000,
      completionPct: 40, // EV = 40,000
      startDate: pastDate(60),
      endDate: futureDate(60),
      totalCostActual: 60_000, // AC = 60,000
    });
    expect(result.cpi).toBeLessThan(1);
    expect(result.cpi).toBeCloseTo(40_000 / 60_000, 2);
  });

  it("CPI > 1 cuando AC < EV (bajo presupuesto)", () => {
    const result = computeEVM({
      budget: 100_000,
      completionPct: 60, // EV = 60,000
      startDate: pastDate(60),
      endDate: futureDate(60),
      totalCostActual: 40_000, // AC = 40,000
    });
    expect(result.cpi).toBeGreaterThan(1);
  });

  it("EV = (completionPct/100) × BAC", () => {
    const result = computeEVM({
      budget: 200_000,
      completionPct: 25,
      startDate: pastDate(30),
      endDate: futureDate(90),
      totalCostActual: 50_000,
    });
    expect(result.ev).toBeCloseTo(50_000, 0);
  });

  it("EAC calculado correctamente con CPI", () => {
    // EAC = AC + (BAC - EV) / CPI
    // CPI = EV/AC = 40000/50000 = 0.8
    // EAC = 50000 + (100000 - 40000) / 0.8 = 50000 + 75000 = 125000
    const result = computeEVM({
      budget: 100_000,
      completionPct: 40,
      startDate: pastDate(30),
      endDate: futureDate(90),
      totalCostActual: 50_000,
    });
    expect(result.eac).toBeCloseTo(125_000, 0);
    expect(result.vac).toBeCloseTo(-25_000, 0);
  });

  it("TCPI = (BAC - EV) / (BAC - AC)", () => {
    // TCPI = (100000 - 50000) / (100000 - 40000) = 50000/60000 ≈ 0.833
    const result = computeEVM({
      budget: 100_000,
      completionPct: 50,
      startDate: pastDate(30),
      endDate: futureDate(30),
      totalCostActual: 40_000,
    });
    expect(result.tcpi).toBeCloseTo(50_000 / 60_000, 2);
  });

  it("SPI calculado para proyecto a mitad del camino temporal y a mitad del avance", () => {
    // Proyecto de 60 días, a los 30 días → PV = 50%, avance = 50% → SPI = 1
    const start = pastDate(30);
    const end = futureDate(30);
    const result = computeEVM({
      budget: 100_000,
      completionPct: 50,
      startDate: start,
      endDate: end,
      totalCostActual: 50_000,
    });
    // SPI = EV / PV
    expect(result.spi).toBeCloseTo(1, 1);
  });

  it("SPI < 1 para proyecto retrasado (avance < tiempo transcurrido)", () => {
    // Proyecto de 60 días, a los 30 días → PV ≈ 50%, pero avance = 30% → SPI < 1
    const result = computeEVM({
      budget: 100_000,
      completionPct: 30,
      startDate: pastDate(30),
      endDate: futureDate(30),
      totalCostActual: 30_000,
    });
    expect(result.spi).toBeLessThan(1);
  });

  it("PV se fija en BAC si el proyecto ya venció", () => {
    const result = computeEVM({
      budget: 100_000,
      completionPct: 80,
      startDate: pastDate(120),
      endDate: pastDate(10),  // proyecto vencido
      totalCostActual: 80_000,
    });
    // elapsedMs >= totalMs → PV = BAC
    expect(result.pv).toBeCloseTo(100_000, 0);
  });

  it("retorna null para cpi y spi si totalCostActual = 0", () => {
    const result = computeEVM({
      budget: 100_000,
      completionPct: 30,
      startDate: pastDate(30),
      endDate: futureDate(30),
      totalCostActual: 0,
    });
    expect(result.cpi).toBeNull();
  });
});
