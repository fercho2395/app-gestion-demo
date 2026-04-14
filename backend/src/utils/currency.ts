/**
 * Utilidad de conversión de monedas.
 * Usa los FxConfig almacenados en BD para convertir entre pares de monedas.
 * Las tasas se almacenan como: 1 baseCode = rate quoteCode (ej: 1 USD = 4000 COP).
 */

export type FxRateRecord = {
  baseCode: string;
  quoteCode: string;
  rate: { toString(): string } | number;
};

/**
 * Construye un mapa de conversión bidireccional a partir de los registros FxConfig.
 * Clave: "FROM->TO", Valor: multiplicador para convertir.
 */
export function buildRateMap(configs: FxRateRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const config of configs) {
    const rate = Number(config.rate);
    if (!Number.isFinite(rate) || rate <= 0) continue;

    // Directo: 1 baseCode = rate quoteCode
    map.set(`${config.baseCode}->${config.quoteCode}`, rate);
    // Inverso: 1 quoteCode = 1/rate baseCode
    map.set(`${config.quoteCode}->${config.baseCode}`, 1 / rate);
  }
  return map;
}

/**
 * Convierte un monto de una moneda a otra.
 * Primero intenta conversión directa; si no existe, busca conversión via pivote (ej. USD).
 * Retorna null si no hay tasa disponible para el par solicitado.
 */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rateMap: Map<string, number>,
): number | null {
  if (from === to) return amount;

  // Conversión directa
  const directRate = rateMap.get(`${from}->${to}`);
  if (directRate !== undefined) {
    return amount * directRate;
  }

  // Conversión con pivote (ej: COP -> EUR via USD)
  for (const [key, rate] of rateMap.entries()) {
    const parts = key.split("->");
    if (parts[0] !== from) continue;
    const pivot = parts[1];
    const pivotToTarget = rateMap.get(`${pivot}->${to}`);
    if (pivotToTarget !== undefined) {
      return amount * rate * pivotToTarget;
    }
  }

  return null;
}

/**
 * Convierte con fallback al monto original si no hay tasa disponible.
 * Útil para cálculos de totales donde preferimos un número a null.
 */
export function convertAmountFallback(
  amount: number,
  from: string,
  to: string,
  rateMap: Map<string, number>,
): number {
  return convertAmount(amount, from, to, rateMap) ?? amount;
}
