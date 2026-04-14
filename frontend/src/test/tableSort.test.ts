import { describe, it, expect } from 'vitest';

// Mirrors the sort logic from DashboardTab displayProjects table
type AlertLevel = "ok" | "warning" | "exceeded";
type MockRow = {
  projectName: string;
  budget: number;
  alertLevel: AlertLevel;
};

const alertOrder: Record<AlertLevel, number> = { exceeded: 0, warning: 1, ok: 2 };

function sortRows(
  rows: MockRow[],
  sortField: "budget" | "alertLevel",
  sortDir: "asc" | "desc",
): MockRow[] {
  return [...rows].sort((a, b) => {
    let av: number, bv: number;
    if (sortField === "alertLevel") {
      av = alertOrder[a.alertLevel];
      bv = alertOrder[b.alertLevel];
    } else {
      av = a[sortField] ?? 0;
      bv = b[sortField] ?? 0;
    }
    return sortDir === "asc" ? av - bv : bv - av;
  });
}

describe('table sort logic', () => {
  const rows: MockRow[] = [
    { projectName: "Alpha",   budget: 50000, alertLevel: "ok" },
    { projectName: "Beta",    budget: 80000, alertLevel: "exceeded" },
    { projectName: "Gamma",   budget: 30000, alertLevel: "warning" },
    { projectName: "Delta",   budget: 95000, alertLevel: "ok" },
  ];

  it('sorts by budget descending', () => {
    const sorted = sortRows(rows, "budget", "desc");
    expect(sorted.map((r) => r.projectName)).toEqual(["Delta", "Beta", "Alpha", "Gamma"]);
  });

  it('sorts by budget ascending', () => {
    const sorted = sortRows(rows, "budget", "asc");
    expect(sorted.map((r) => r.projectName)).toEqual(["Gamma", "Alpha", "Beta", "Delta"]);
  });

  it('sorts by alertLevel: exceeded first (desc = most critical first)', () => {
    const sorted = sortRows(rows, "alertLevel", "asc"); // asc = 0 (exceeded) first
    expect(sorted[0].alertLevel).toBe("exceeded");
    expect(sorted[1].alertLevel).toBe("warning");
    expect(sorted[2].alertLevel).toBe("ok");
    expect(sorted[3].alertLevel).toBe("ok");
  });

  it('sorts by alertLevel: ok first (desc = least critical first)', () => {
    const sorted = sortRows(rows, "alertLevel", "desc"); // desc = 2 (ok) first
    expect(sorted[0].alertLevel).toBe("ok");
    expect(sorted[3].alertLevel).toBe("exceeded");
  });

  it('does not mutate original array', () => {
    const original = [...rows];
    sortRows(rows, "budget", "asc");
    expect(rows).toEqual(original);
  });
});
