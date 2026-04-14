import { describe, it, expect } from "vitest";
import { buildRateMap, convertAmount, convertAmountFallback } from "../currency.js";

const configs = [
  { baseCode: "USD", quoteCode: "COP", rate: 4200 },
  { baseCode: "USD", quoteCode: "EUR", rate: 0.92 },
  { baseCode: "USD", quoteCode: "MXN", rate: 17.5 },
];

describe("buildRateMap", () => {
  it("construye rutas directas e inversas", () => {
    const map = buildRateMap(configs);
    expect(map.get("USD->COP")).toBe(4200);
    expect(map.get("COP->USD")).toBeCloseTo(1 / 4200, 8);
  });

  it("ignora tasas inválidas (cero o negativas)", () => {
    const map = buildRateMap([{ baseCode: "USD", quoteCode: "XYZ", rate: 0 }]);
    expect(map.has("USD->XYZ")).toBe(false);
  });
});

describe("convertAmount — conversión directa", () => {
  const rateMap = buildRateMap(configs);

  it("USD → COP", () => {
    expect(convertAmount(1, "USD", "COP", rateMap)).toBe(4200);
  });

  it("COP → USD", () => {
    expect(convertAmount(4200, "COP", "USD", rateMap)).toBeCloseTo(1, 4);
  });

  it("USD → EUR", () => {
    expect(convertAmount(100, "USD", "EUR", rateMap)).toBeCloseTo(92, 4);
  });

  it("misma moneda devuelve monto original", () => {
    expect(convertAmount(1000, "USD", "USD", rateMap)).toBe(1000);
    expect(convertAmount(5000, "COP", "COP", rateMap)).toBe(5000);
  });
});

describe("convertAmount — conversión con pivote", () => {
  const rateMap = buildRateMap(configs);

  it("COP → EUR via USD", () => {
    // 4200 COP = 1 USD = 0.92 EUR
    const result = convertAmount(4200, "COP", "EUR", rateMap);
    expect(result).toBeCloseTo(0.92, 4);
  });

  it("MXN → COP via USD", () => {
    // 17.5 MXN = 1 USD = 4200 COP
    const result = convertAmount(17.5, "MXN", "COP", rateMap);
    expect(result).toBeCloseTo(4200, 2);
  });

  it("EUR → MXN via USD", () => {
    // 0.92 EUR = 1 USD = 17.5 MXN
    const result = convertAmount(0.92, "EUR", "MXN", rateMap);
    expect(result).toBeCloseTo(17.5, 2);
  });
});

describe("convertAmount — sin tasa disponible", () => {
  const rateMap = buildRateMap(configs);

  it("retorna null si no hay tasa para el par", () => {
    expect(convertAmount(100, "JPY", "BRL", rateMap)).toBeNull();
  });

  it("retorna null para moneda desconocida", () => {
    expect(convertAmount(100, "XYZ", "USD", rateMap)).toBeNull();
  });
});

describe("convertAmountFallback", () => {
  const rateMap = buildRateMap(configs);

  it("convierte cuando hay tasa disponible", () => {
    expect(convertAmountFallback(1, "USD", "COP", rateMap)).toBe(4200);
  });

  it("devuelve el monto original si no hay tasa (no lanza error)", () => {
    expect(convertAmountFallback(500, "JPY", "BRL", rateMap)).toBe(500);
  });
});

// ─── buildRateMap — edge cases ────────────────────────────────────────────────

describe("buildRateMap — edge cases", () => {
  it("mapa vacío con array vacío", () => {
    const map = buildRateMap([]);
    expect(map.size).toBe(0);
  });

  it("tasa negativa es ignorada", () => {
    const map = buildRateMap([{ baseCode: "USD", quoteCode: "COP", rate: -100 }]);
    expect(map.has("USD->COP")).toBe(false);
  });

  it("múltiples pares generan entradas bidireccionales", () => {
    const map = buildRateMap([
      { baseCode: "USD", quoteCode: "COP", rate: 4200 },
      { baseCode: "USD", quoteCode: "EUR", rate: 0.92 },
    ]);
    expect(map.size).toBe(4); // USD->COP, COP->USD, USD->EUR, EUR->USD
  });

  it("tasa de tipo Prisma Decimal (toString) es manejada correctamente", () => {
    // Simula el tipo Decimal de Prisma que implementa toString()
    const decimalLike = { toString: () => "4200" };
    const map = buildRateMap([{ baseCode: "USD", quoteCode: "COP", rate: decimalLike as unknown as number }]);
    expect(map.get("USD->COP")).toBe(4200);
  });
});

// ─── convertAmount — precisión numérica ──────────────────────────────────────

describe("convertAmount — precisión numérica", () => {
  it("conversión de monto cero da cero", () => {
    const map = buildRateMap([{ baseCode: "USD", quoteCode: "COP", rate: 4200 }]);
    expect(convertAmount(0, "USD", "COP", map)).toBe(0);
  });

  it("conversión de montos muy pequeños mantiene precisión", () => {
    const map = buildRateMap([{ baseCode: "USD", quoteCode: "EUR", rate: 0.92 }]);
    // 0.01 USD = 0.0092 EUR
    expect(convertAmount(0.01, "USD", "EUR", map)).toBeCloseTo(0.0092, 6);
  });

  it("conversión de montos grandes no pierde precisión significativa", () => {
    const map = buildRateMap([{ baseCode: "USD", quoteCode: "COP", rate: 4200 }]);
    // 1,000,000 USD → 4,200,000,000 COP
    expect(convertAmount(1_000_000, "USD", "COP", map)).toBeCloseTo(4_200_000_000, -3);
  });

  it("conversión por pivote con 3 monedas", () => {
    // PEN a COP: PEN->USD->COP
    const map = buildRateMap([
      { baseCode: "USD", quoteCode: "PEN", rate: 3.7 },
      { baseCode: "USD", quoteCode: "COP", rate: 4200 },
    ]);
    // 3.7 PEN = 1 USD = 4200 COP → 1 PEN ≈ 4200/3.7 ≈ 1135.13 COP
    const result = convertAmount(3.7, "PEN", "COP", map);
    expect(result).toBeCloseTo(4200, 1);
  });
});
