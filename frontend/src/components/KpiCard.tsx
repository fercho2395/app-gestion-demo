import type { CSSProperties, ReactNode } from "react";

export function KpiCard({
  title,
  value,
  period,
  trend,
  color,
  subtitle,
}: {
  title: string;
  value: ReactNode;
  period?: string;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  color?: string;
  subtitle?: string;
}) {
  const trendColors = { up: "#16a34a", down: "#dc2626", flat: "#6b7280" };
  const trendIcons = { up: "↑", down: "↓", flat: "→" };

  return (
    <article className="card kpi">
      <h3>{title}</h3>
      <p style={{ color } as CSSProperties}>{value}</p>
      {subtitle && (
        <p style={{ fontSize: "0.75rem", color: "#6b7280", margin: "0.25rem 0 0" }}>
          {subtitle}
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
        {period && (
          <span
            style={{
              fontSize: "0.7rem",
              background: "#f3f4f6",
              color: "#6b7280",
              borderRadius: "4px",
              padding: "0.1rem 0.4rem",
            }}
          >
            {period}
          </span>
        )}
        {trend && (
          <span
            style={{
              fontSize: "0.7rem",
              color: trendColors[trend.direction],
              fontWeight: 600,
            }}
          >
            {trendIcons[trend.direction]} {trend.label}
          </span>
        )}
      </div>
    </article>
  );
}
