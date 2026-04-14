/**
 * Genera y descarga un archivo CSV desde un array de objetos.
 * @param rows    Array of records to serialize
 * @param headers Column definitions: { key: keyof T (or string), label: string }
 * @param filename Suggested filename (without .csv)
 */
export function downloadCsv<T extends Record<string, unknown>>(
  rows: T[],
  headers: { key: string; label: string }[],
  filename: string,
): void {
  const escape = (value: unknown): string => {
    const str = value == null ? "" : String(value);
    // Wrap in quotes if it contains comma, newline or double-quote
    if (str.includes(",") || str.includes("\n") || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.map((h) => escape(h.label)).join(",");
  const dataRows = rows.map((row) => headers.map((h) => escape(row[h.key])).join(","));

  const csv = [headerRow, ...dataRows].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
