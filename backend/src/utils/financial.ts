/**
 * Lógica financiera centralizada.
 * Todos los cálculos de margen, rentabilidad y forecast viven aquí —
 * fuera del frontend y fuera de las rutas, para que sean testeables.
 */

import { convertAmountFallback, type FxRateRecord, buildRateMap } from "./currency.js";

export type { FxRateRecord };

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

export type ForecastInput = {
  hoursProjected: number;
  hourlyRate: number | null;   // costo consultor
  sellRate: number | null;     // tarifa de venta al cliente
  currency: string;
};

export type ConsultantInput = {
  hourlyRate: number | null;
  rateCurrency: string;
};

export type TimeEntryInput = {
  hours: number;
  workDate: Date;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

export type ExpenseInput = {
  amount: number;
  currency: string;
};

export type RevenueEntryInput = {
  amount: number;
  currency: string;
};

// ─── Utilidad de período ──────────────────────────────────────────────────────

/**
 * Convierte un período YYYY-Qn al rango de fechas [start, end].
 * Ej: "2026-Q2" → { start: 2026-04-01, end: 2026-06-30 }
 */
export function periodToDateRange(period: string): { start: Date; end: Date } | null {
  const match = period.match(/^(\d{4})-Q([1-4])$/);
  if (!match) return null;

  const year = Number(match[1]);
  const quarter = Number(match[2]);
  const startMonth = (quarter - 1) * 3;

  return {
    start: new Date(Date.UTC(year, startMonth, 1)),
    end: new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59, 999)),
  };
}

/**
 * Verifica si una fecha cae dentro del rango de un período.
 */
export function isInPeriod(date: Date, period: string): boolean {
  const range = periodToDateRange(period);
  if (!range) return false;
  return date >= range.start && date <= range.end;
}

// ─── Cálculo de forecast ajustado ────────────────────────────────────────────

/**
 * Calcula el costo proyectado de un forecast descontando las horas ya aprobadas.
 *
 * ANTES (bug): projectedCost = hoursProjected * hourlyRate  (ignora lo ya ejecutado)
 * AHORA:       projectedCost = (hoursProjected - approvedHours) * hourlyRate
 *
 * Si ya se ejecutaron más horas de las proyectadas, el costo adicional es 0.
 */
export function getAdjustedForecastCost(
  forecast: ForecastInput,
  consultant: ConsultantInput,
  approvedHoursInPeriod: number,
  rateMap: Map<string, number>,
  baseCurrency: string,
): number {
  const effectiveCostRate = forecast.hourlyRate ?? consultant.hourlyRate ?? 0;
  const remainingHours = Math.max(forecast.hoursProjected - approvedHoursInPeriod, 0);
  const costInForecastCurrency = remainingHours * effectiveCostRate;
  return convertAmountFallback(costInForecastCurrency, forecast.currency, baseCurrency, rateMap);
}

/**
 * Calcula el ingreso proyectado de un forecast (usando sellRate).
 * Solo aplica para TIME_AND_MATERIAL y STAFFING.
 */
export function getAdjustedForecastRevenue(
  forecast: ForecastInput,
  approvedHoursInPeriod: number,
  rateMap: Map<string, number>,
  baseCurrency: string,
): number {
  if (!forecast.sellRate) return 0;
  const remainingHours = Math.max(forecast.hoursProjected - approvedHoursInPeriod, 0);
  const revenueInForecastCurrency = remainingHours * forecast.sellRate;
  return convertAmountFallback(revenueInForecastCurrency, forecast.currency, baseCurrency, rateMap);
}

// ─── Cálculo de rentabilidad por proyecto ────────────────────────────────────

export type ProfitabilityResult = {
  // Ingresos
  contractValue: number;      // sellPrice del proyecto (en baseCurrency)
  revenueRecognized: number;  // sum(RevenueEntry) en baseCurrency
  revenuePending: number;     // contractValue - revenueRecognized
  revenueProjected: number;   // ingresos proyectados de forecasts no ejecutados

  // Costos
  laborCostActual: number;    // horas aprobadas * hourlyRate en baseCurrency
  laborCostForecast: number;  // forecast pendiente (ajustado) en baseCurrency
  expensesActual: number;     // gastos reales en baseCurrency
  totalCostActual: number;    // laborCostActual + expensesActual
  totalCostProjected: number; // totalCostActual + laborCostForecast

  // Presupuesto
  budget: number;
  budgetConsumed: number;
  budgetConsumedPct: number;
  estimateAtCompletion: number; // EAC
  budgetVariance: number;       // budget - EAC (positivo = bien, negativo = sobrecosto)

  // Márgenes
  grossMarginActual: number;
  grossMarginActualPct: number;
  grossMarginProjected: number;
  grossMarginProjectedPct: number;
};

export type ProfitabilityInput = {
  budget: number;
  budgetCurrency: string;
  sellPrice: number | null;
  sellCurrency: string;
  revenueEntries: RevenueEntryInput[];
  approvedTimeEntries: Array<TimeEntryInput & { consultantId: string; hourlyRate: number | null; rateCurrency: string }>;
  expenses: ExpenseInput[];
  forecasts: Array<ForecastInput & { consultantId: string; consultant: ConsultantInput; startDate: string; endDate: string }>;
  fxConfigs: FxRateRecord[];
  baseCurrency: string;
};

export function calculateProfitability(input: ProfitabilityInput): ProfitabilityResult {
  const {
    budget,
    budgetCurrency,
    sellPrice,
    sellCurrency,
    revenueEntries,
    approvedTimeEntries,
    expenses,
    forecasts,
    fxConfigs,
    baseCurrency,
  } = input;

  const rateMap = buildRateMap(fxConfigs);

  // Presupuesto en moneda base
  const budgetBase = convertAmountFallback(budget, budgetCurrency, baseCurrency, rateMap);

  // Valor contractual en moneda base
  const contractValue = sellPrice
    ? convertAmountFallback(sellPrice, sellCurrency, baseCurrency, rateMap)
    : 0;

  // Ingresos reconocidos
  const revenueRecognized = revenueEntries.reduce((sum, r) => {
    return sum + convertAmountFallback(r.amount, r.currency, baseCurrency, rateMap);
  }, 0);

  const revenuePending = Math.max(contractValue - revenueRecognized, 0);

  // Costo laboral real (horas aprobadas)
  const laborCostActual = approvedTimeEntries.reduce((sum, entry) => {
    const rate = entry.hourlyRate ?? 0;
    const costInLocal = entry.hours * rate;
    return sum + convertAmountFallback(costInLocal, entry.rateCurrency, baseCurrency, rateMap);
  }, 0);

  // Gastos reales
  const expensesActual = expenses.reduce((sum, e) => {
    return sum + convertAmountFallback(e.amount, e.currency, baseCurrency, rateMap);
  }, 0);

  const totalCostActual = laborCostActual + expensesActual;
  const budgetConsumed = totalCostActual;
  const budgetConsumedPct = budgetBase > 0 ? (budgetConsumed / budgetBase) * 100 : 0;

  // Forecast ajustado: descontando horas ya aprobadas por período y consultor
  let laborCostForecast = 0;
  let revenueProjected = revenueRecognized;

  for (const forecast of forecasts) {
    const rangeStart = new Date(forecast.startDate + "T00:00:00Z");
    const rangeEnd   = new Date(forecast.endDate   + "T23:59:59Z");
    const approvedInPeriod = approvedTimeEntries
      .filter(
        (e) =>
          e.consultantId === forecast.consultantId &&
          e.workDate >= rangeStart &&
          e.workDate <= rangeEnd,
      )
      .reduce((sum, e) => sum + e.hours, 0);

    laborCostForecast += getAdjustedForecastCost(
      forecast,
      forecast.consultant,
      approvedInPeriod,
      rateMap,
      baseCurrency,
    );

    revenueProjected += getAdjustedForecastRevenue(
      forecast,
      approvedInPeriod,
      rateMap,
      baseCurrency,
    );
  }

  const totalCostProjected = totalCostActual + laborCostForecast;
  const estimateAtCompletion = totalCostProjected;
  const budgetVariance = budgetBase - estimateAtCompletion;

  // Márgenes
  const grossMarginActual = revenueRecognized - totalCostActual;
  const grossMarginActualPct =
    revenueRecognized > 0 ? (grossMarginActual / revenueRecognized) * 100 : 0;

  const grossMarginProjected = revenueProjected - totalCostProjected;
  const grossMarginProjectedPct =
    revenueProjected > 0 ? (grossMarginProjected / revenueProjected) * 100 : 0;

  return {
    contractValue,
    revenueRecognized,
    revenuePending,
    revenueProjected,
    laborCostActual,
    laborCostForecast,
    expensesActual,
    totalCostActual,
    totalCostProjected,
    budget: budgetBase,
    budgetConsumed,
    budgetConsumedPct: Number(budgetConsumedPct.toFixed(2)),
    estimateAtCompletion,
    budgetVariance,
    grossMarginActual,
    grossMarginActualPct: Number(grossMarginActualPct.toFixed(2)),
    grossMarginProjected,
    grossMarginProjectedPct: Number(grossMarginProjectedPct.toFixed(2)),
  };
}
