import type { ReactNode } from "react";

export function EmptyState({
  icon = "📋",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 1rem",
        gap: "0.75rem",
        textAlign: "center",
        color: "#6b7280",
      }}
    >
      <span style={{ fontSize: "2.5rem", lineHeight: 1 }}>{icon}</span>
      <p style={{ fontWeight: 600, color: "#374151", margin: 0, fontSize: "1rem" }}>{title}</p>
      {description && <p style={{ margin: 0, fontSize: "0.875rem", maxWidth: "24rem" }}>{description}</p>}
      {action && <div style={{ marginTop: "0.5rem" }}>{action}</div>}
    </div>
  );
}
