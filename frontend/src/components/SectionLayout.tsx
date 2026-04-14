import { useState } from "react";
import type { ReactNode } from "react";

interface SectionLayoutProps {
  title: string;
  newLabel?: string;
  canWrite?: boolean;
  form?: ReactNode;
  table: ReactNode;
  onExport?: () => void;
  exportDisabled?: boolean;
  extraActions?: ReactNode;
  defaultOpen?: boolean;
}

export function SectionLayout({
  title,
  newLabel = "+ Nuevo",
  canWrite = false,
  form,
  table,
  onExport,
  exportDisabled,
  extraActions,
  defaultOpen = false,
}: SectionLayoutProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <article className="card section-layout">
      <div className="section-header">
        <h3 className="section-header-title">{title}</h3>
        <div className="section-header-actions">
          {extraActions}
          {canWrite && form && (
            <button
              type="button"
              className={open ? "ghost" : ""}
              style={{ fontSize: "0.82rem", padding: "0.35rem 0.8rem" }}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "✕ Cerrar" : newLabel}
            </button>
          )}
          {onExport && (
            <button
              type="button"
              className="ghost"
              style={{ fontSize: "0.75rem", padding: "0.35rem 0.7rem" }}
              onClick={onExport}
              disabled={exportDisabled}
            >
              Exportar CSV
            </button>
          )}
        </div>
      </div>

      {canWrite && form && (
        <div className={`section-form-wrap${open ? " open" : ""}`}>
          <div className="section-form-inner">
            <div className="section-form-panel">
              {form}
            </div>
          </div>
        </div>
      )}

      {table}
    </article>
  );
}
