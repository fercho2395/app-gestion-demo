import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T, index: number) => ReactNode;
  sortable?: boolean;
  width?: string;
};

export function Table<T extends object>({
  data,
  columns,
  keyExtractor,
  pageSize = 25,
  searchFields,
  searchPlaceholder = "Buscar...",
  emptyIcon,
  emptyTitle = "Sin datos",
  emptyDescription,
  emptyAction,
  loading,
  footer,
}: {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T, index: number) => string;
  pageSize?: number;
  searchFields?: (keyof T)[];
  searchPlaceholder?: string;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  loading?: boolean;
  footer?: ReactNode;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    if (!search.trim() || !searchFields) return data;
    const term = search.toLowerCase();
    return data.filter((row) =>
      searchFields.some((field) => {
        const val = row[field];
        return typeof val === "string" && val.toLowerCase().includes(term);
      }),
    );
  }, [data, search, searchFields]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey] ?? "";
      const bv = (b as Record<string, unknown>)[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  return (
    <div>
      {searchFields && searchFields.length > 0 && (
        <input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ marginBottom: "0.75rem", width: "100%", maxWidth: "22rem" }}
        />
      )}
      {loading ? (
        <p className="loading">Cargando...</p>
      ) : paged.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={search ? `Sin resultados para "${search}"` : emptyTitle}
          description={search ? "Intenta con otro término." : emptyDescription}
          action={!search ? emptyAction : undefined}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={{ width: col.width, cursor: col.sortable ? "pointer" : undefined, userSelect: "none" }}
                    onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                  >
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      <span style={{ marginLeft: "0.3rem", opacity: 0.6 }}>
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((row, i) => (
                <tr key={keyExtractor(row, i)}>
                  {columns.map((col) => (
                    <td key={col.key}>{col.render(row, i)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {footer}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "0.75rem",
            fontSize: "0.8rem",
            color: "#6b7280",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <span>
            {sorted.length} registros · página {safePage} de {totalPages}
          </span>
          <div style={{ display: "flex", gap: "0.25rem" }}>
            <button
              type="button"
              className="ghost"
              disabled={safePage === 1}
              onClick={() => setPage(1)}
              style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
            >
              «
            </button>
            <button
              type="button"
              className="ghost"
              disabled={safePage === 1}
              onClick={() => setPage((p) => p - 1)}
              style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
            >
              ‹
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(safePage - 2, totalPages - 4));
              const p = start + i;
              return (
                <button
                  key={p}
                  type="button"
                  className={p === safePage ? "tab active" : "ghost"}
                  onClick={() => setPage(p)}
                  style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", minWidth: "2rem" }}
                >
                  {p}
                </button>
              );
            })}
            <button
              type="button"
              className="ghost"
              disabled={safePage === totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
            >
              ›
            </button>
            <button
              type="button"
              className="ghost"
              disabled={safePage === totalPages}
              onClick={() => setPage(totalPages)}
              style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
