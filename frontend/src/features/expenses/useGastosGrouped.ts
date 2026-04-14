import { useMemo } from "react";
import type { Expense, FxConfig, Project } from "../../services/api";
import {
  convertToBase,
  getBudgetStatus,
  numberish,
  toMonthKey,
  formatMonthKey,
  fmtMoney,
} from "./gastosUtils";

export type GroupBy = "project" | "category" | "month";

export type GroupedGasto = {
  key: string;
  label: string;
  count: number;
  totalBase: number;
  lastDate: string;
  status: "ok" | "warning" | "exceeded";
  items: Expense[];
  tooltipBreakdown: string;
};

export type GastoTotals = {
  count: number;
  totalBase: number;
};

function buildTooltipBreakdown(
  items: Expense[],
  baseCurrency: string,
  fxConfigs: FxConfig[],
): string {
  const byCurrency = new Map<string, { original: number; converted: number }>();
  for (const e of items) {
    const amt = numberish(e.amount);
    const { value } = convertToBase(amt, e.currency, baseCurrency, fxConfigs);
    const entry = byCurrency.get(e.currency) ?? { original: 0, converted: 0 };
    entry.original += amt;
    entry.converted += value;
    byCurrency.set(e.currency, entry);
  }
  return Array.from(byCurrency.entries())
    .map(([cur, v]) => `${fmtMoney(v.original, cur)} = ${fmtMoney(v.converted, baseCurrency)}`)
    .join(" | ");
}

export function useGastosGrouped(
  expenses: Expense[],
  groupBy: GroupBy,
  baseCurrency: string,
  fxConfigs: FxConfig[],
  projects: Project[],
): { groups: GroupedGasto[]; totals: GastoTotals } {
  return useMemo(() => {
    const budgetMap = new Map(projects.map((p) => [p.id, numberish(p.budget)]));

    const buckets = new Map<string, Expense[]>();
    for (const exp of expenses) {
      const key =
        groupBy === "project"  ? exp.projectId :
        groupBy === "category" ? exp.category :
        toMonthKey(exp.expenseDate);

      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(exp);
    }

    const groups: GroupedGasto[] = [];

    for (const [key, items] of buckets.entries()) {
      const totalBase = items.reduce(
        (sum, e) =>
          sum + convertToBase(numberish(e.amount), e.currency, baseCurrency, fxConfigs).value,
        0,
      );
      const lastDate = items.reduce(
        (max, e) => (e.expenseDate > max ? e.expenseDate : max),
        items[0].expenseDate,
      );
      const tooltipBreakdown = buildTooltipBreakdown(items, baseCurrency, fxConfigs);

      let label: string;
      let status: GroupedGasto["status"] = "ok";

      if (groupBy === "project") {
        label = items[0].project?.name ?? key;
        const budget = budgetMap.get(key) ?? 0;
        status = getBudgetStatus(totalBase, budget);
      } else if (groupBy === "category") {
        label = key;
      } else {
        label = formatMonthKey(key);
      }

      groups.push({ key, label, count: items.length, totalBase, lastDate, status, items, tooltipBreakdown });
    }

    groups.sort((a, b) => b.totalBase - a.totalBase);

    const totals: GastoTotals = {
      count: expenses.length,
      totalBase: groups.reduce((s, g) => s + g.totalBase, 0),
    };

    return { groups, totals };
  }, [expenses, groupBy, baseCurrency, fxConfigs, projects]);
}
