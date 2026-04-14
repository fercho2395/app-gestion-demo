import { useState, useEffect, useRef } from "react";

export type DateRange = { from: string; to: string };

type Preset = "today" | "week" | "month" | "lastMonth" | "qtd" | "ytd" | "custom";

const STORAGE_KEY = "dashboardDateRange";

function pad(n: number) { return String(n).padStart(2, "0"); }
function fmt(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function getPresetRange(preset: Preset): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (preset) {
    case "today": {
      const t = fmt(now);
      return { from: t, to: t };
    }
    case "week": {
      const dow = now.getDay(); // 0=Sun
      const monday = new Date(now); monday.setDate(d - ((dow + 6) % 7));
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      return { from: fmt(monday), to: fmt(sunday) };
    }
    case "month":
      return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case "lastMonth":
      return { from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)) };
    case "qtd": {
      const q = Math.floor(m / 3);
      return { from: fmt(new Date(y, q * 3, 1)), to: fmt(new Date(y, m + 1, 0)) };
    }
    case "ytd":
      return { from: fmt(new Date(y, 0, 1)), to: fmt(now) };
    default:
      return { from: "", to: "" };
  }
}

function presetLabel(p: Preset | null): string {
  const map: Record<string, string> = {
    today: "Hoy", week: "Esta semana", month: "Este mes",
    lastMonth: "Mes anterior", qtd: "Trimestre a la fecha",
    ytd: "Año a la fecha", custom: "Personalizado",
  };
  return p ? (map[p] ?? p) : "Rango de fechas";
}

function rangeToPreset(range: DateRange): Preset | null {
  if (!range.from && !range.to) return null;
  for (const p of ["today", "week", "month", "lastMonth", "qtd", "ytd"] as Preset[]) {
    const r = getPresetRange(p);
    if (r.from === range.from && r.to === range.to) return p;
  }
  return "custom";
}

// ── Persist to/from URL + localStorage ──────────────────────────────────────

function readPersistedRange(): DateRange {
  try {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";
    if (from || to) return { from, to };
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as DateRange;
  } catch { /* ignore */ }
  return { from: "", to: "" };
}

function persistRange(range: DateRange) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(range));
    const url = new URL(window.location.href);
    if (range.from) url.searchParams.set("from", range.from);
    else url.searchParams.delete("from");
    if (range.to) url.searchParams.set("to", range.to);
    else url.searchParams.delete("to");
    window.history.replaceState({}, "", url.toString());
  } catch { /* ignore */ }
}

// ── Component ────────────────────────────────────────────────────────────────

const PRESETS: Preset[] = ["today", "week", "month", "lastMonth", "qtd", "ytd"];

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activePreset = rangeToPreset(value);

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function applyPreset(p: Preset) {
    const r = getPresetRange(p);
    onChange(r);
    persistRange(r);
    if (p !== "custom") setOpen(false);
  }

  function applyCustom(field: "from" | "to", val: string) {
    const next = { ...value, [field]: val };
    onChange(next);
    persistRange(next);
  }

  function clear() {
    const empty = { from: "", to: "" };
    onChange(empty);
    persistRange(empty);
    setOpen(false);
  }

  const displayLabel = (() => {
    if (!value.from && !value.to) return "Rango de fechas";
    if (activePreset && activePreset !== "custom") return presetLabel(activePreset);
    if (value.from && value.to) return `${value.from} → ${value.to}`;
    return value.from || value.to;
  })();

  return (
    <div ref={ref} style={{ position: "relative", minWidth: "12rem" }}>
      <button
        type="button"
        className="ghost"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between",
          alignItems: "center", gap: "0.4rem", fontSize: "0.875rem",
          borderColor: activePreset ? "#f97316" : undefined,
          color: activePreset ? "#ea580c" : undefined,
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>📅 {displayLabel}</span>
        <span style={{ fontSize: "0.65rem" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200,
            background: "#fff", border: "1px solid #f1c79d", borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(15,23,42,0.12)", minWidth: "16rem",
            padding: "0.5rem",
          }}
        >
          {/* Presets */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem", marginBottom: "0.5rem" }}>
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                role="option"
                aria-selected={activePreset === p}
                onClick={() => applyPreset(p)}
                style={{
                  background: activePreset === p ? "linear-gradient(135deg,#ff8b3d,#ea580c)" : "#fff6ef",
                  color: activePreset === p ? "#fff" : "#9a3412",
                  border: "1px solid #f8c39b",
                  borderRadius: "8px",
                  padding: "0.35rem 0.5rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                {presetLabel(p)}
              </button>
            ))}
          </div>

          {/* Custom */}
          <div style={{ borderTop: "1px solid #f4d4b6", paddingTop: "0.5rem" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#9a4f0f", marginBottom: "0.35rem" }}>
              Personalizado
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
              <div>
                <label style={{ fontSize: "0.65rem", color: "#6b7280", display: "block", marginBottom: "0.15rem" }}>Desde</label>
                <input
                  type="date"
                  value={value.from}
                  onChange={(e) => applyCustom("from", e.target.value)}
                  style={{ fontSize: "0.8rem", padding: "0.35rem 0.5rem" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.65rem", color: "#6b7280", display: "block", marginBottom: "0.15rem" }}>Hasta</label>
                <input
                  type="date"
                  value={value.to}
                  onChange={(e) => applyCustom("to", e.target.value)}
                  style={{ fontSize: "0.8rem", padding: "0.35rem 0.5rem" }}
                />
              </div>
            </div>
          </div>

          {/* Clear */}
          {(value.from || value.to) && (
            <button
              type="button"
              onClick={clear}
              style={{
                marginTop: "0.4rem", width: "100%", background: "none",
                border: "1px solid #f1c79d", color: "#9a3412",
                fontSize: "0.75rem", padding: "0.3rem",
              }}
            >
              Limpiar fechas
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export { readPersistedRange };
