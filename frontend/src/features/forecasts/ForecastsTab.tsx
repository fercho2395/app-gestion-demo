import { useState } from "react";
import type { FormEvent } from "react";
import {
  createForecast,
  deleteForecast,
  updateForecast,
  type Consultant,
  type Forecast,
  type Project,
} from "../../services/api";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { SectionLayout } from "../../components/SectionLayout";
import { downloadCsv } from "../../utils/csv";
import {
  describeDuration,
  todayISO,
  presetThisMonthDates,
  presetCurrentQuarterDates,
  presetNextQuarterDates,
  presetNext6MonthsDates,
  presetRestOfYearDates,
} from "../../utils/periodUtils";
import { formatDate, formatDateRange, calcDias } from "../../utils/formatDate";

const currencyOptions = ["COP", "USD", "EUR", "MXN", "PEN", "CLP"];

const MAX_HORAS_PERIODO = 2000;
const MIN_HORAS = 0.5;

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function numberish(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// ── Preset buttons ─────────────────────────────────────────────────────────

const PRESETS = [
  { label: "Este mes",          fn: presetThisMonthDates },
  { label: "Trimestre actual",  fn: presetCurrentQuarterDates },
  { label: "Próximo trimestre", fn: presetNextQuarterDates },
  { label: "Próximos 6 meses",  fn: presetNext6MonthsDates },
  { label: "Resto del año",     fn: presetRestOfYearDates },
] as const;

// ── Progress bar ────────────────────────────────────────────────────────────

function ForecastProgress({
  approvedHours,
  hoursProjected,
}: {
  approvedHours: number;
  hoursProjected: number;
}) {
  if (hoursProjected <= 0) return null;
  const pct = Math.min((approvedHours / hoursProjected) * 100, 100);
  const isOver = approvedHours > hoursProjected;
  const barColor = isOver ? "#dc2626" : pct >= 80 ? "#f59e0b" : "#2563eb";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: "8rem" }}>
      <div style={{ flex: 1, height: "6px", background: "#e5e7eb", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: "3px", transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: "0.7rem", color: isOver ? "#dc2626" : "#6b7280", whiteSpace: "nowrap" }}>
        {approvedHours.toFixed(0)}/{hoursProjected.toFixed(0)}h
      </span>
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

type EditForm = {
  id: string;
  projectId: string;
  consultantId: string;
  startDate: string;
  endDate: string;
  hoursProjected: string;
  hourlyRate: string;
  sellRate: string;
  currency: string;
  note: string;
};

function makeEmptyForm() {
  const today = todayISO();
  return {
    projectId: "",
    consultantId: "",
    dateFrom: today,
    dateTo: today,
    hoursProjected: "",
    hourlyRate: "",
    sellRate: "",
    currency: "USD",
    note: "",
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export function ForecastsTab({
  forecasts,
  projects,
  consultants,
  loading,
  canWrite,
  onReload,
  onError,
}: {
  forecasts: Forecast[];
  projects: Project[];
  consultants: Consultant[];
  loading: boolean;
  canWrite: boolean;
  onReload: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState(makeEmptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Forecast | null>(null);
  const [filterProject, setFilterProject] = useState("");
  const [filterConsultant, setFilterConsultant] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("");

  // ── Validations ─────────────────────────────────────────────────────────

  const rangeError =
    form.dateTo < form.dateFrom
      ? "La fecha fin debe ser igual o posterior a la fecha inicio."
      : "";

  const rangeWarning = (() => {
    if (rangeError) return "";
    const today = todayISO();
    const from = form.dateFrom;
    const to = form.dateTo;
    const [fy, fm] = from.split("-").map(Number);
    const [ty, tm] = to.split("-").map(Number);
    const spanMonths = (ty - fy) * 12 + (tm - fm) + 1;
    if (spanMonths > 24) return `Rango de ${spanMonths} meses (> 24). Considera dividir en proyecciones más cortas.`;
    if (from < today) return "La fecha inicio está en el pasado.";
    return "";
  })();

  const hoursNum = Number(form.hoursProjected);
  const hoursError = form.hoursProjected
    ? hoursNum < MIN_HORAS
      ? `Mínimo ${MIN_HORAS}h por período.`
      : hoursNum > MAX_HORAS_PERIODO
      ? `Las horas no pueden superar ${MAX_HORAS_PERIODO}h por período.`
      : ""
    : "";

  const budgetWarning = (() => {
    if (!form.projectId || !form.hoursProjected || !form.hourlyRate) return "";
    const project = projects.find((p) => p.id === form.projectId);
    if (!project) return "";
    const budget = Number(project.budget);
    if (!budget) return "";
    const estimatedCost = hoursNum * Number(form.hourlyRate);
    const pct = (estimatedCost / budget) * 100;
    if (pct > 100) return `⚠ Costo estimado (${money(estimatedCost, form.currency)}) supera el presupuesto del proyecto (${money(budget, project.currency)}).`;
    if (pct > 80) return `ℹ Costo estimado (${money(estimatedCost, form.currency)}) representa el ${pct.toFixed(0)}% del presupuesto.`;
    return "";
  })();

  const durationLabel = !rangeError && form.dateFrom && form.dateTo
    ? describeDuration(form.dateFrom, form.dateTo)
    : "";

  // ── Form handlers ────────────────────────────────────────────────────────

  function applyPreset(fn: () => { from: string; to: string }) {
    const { from, to } = fn();
    setForm((p) => ({ ...p, dateFrom: from, dateTo: to }));
  }

  function setDateFrom(iso: string) {
    setForm((p) => ({
      ...p,
      dateFrom: iso,
      dateTo: iso > p.dateTo ? iso : p.dateTo,
    }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (rangeError || hoursError) return;
    setSubmitting(true);
    try {
      await createForecast({
        projectId: form.projectId,
        consultantId: form.consultantId,
        startDate: form.dateFrom,
        endDate: form.dateTo,
        hoursProjected: Number(form.hoursProjected),
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
        sellRate: form.sellRate ? Number(form.sellRate) : undefined,
        currency: form.currency,
        note: form.note || undefined,
      });
      setForm(makeEmptyForm());
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo crear proyección");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (!editForm) return;
    setEditSubmitting(true);
    try {
      await updateForecast(editForm.id, {
        projectId: editForm.projectId,
        consultantId: editForm.consultantId,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        hoursProjected: Number(editForm.hoursProjected),
        hourlyRate: editForm.hourlyRate ? Number(editForm.hourlyRate) : undefined,
        sellRate: editForm.sellRate ? Number(editForm.sellRate) : undefined,
        currency: editForm.currency,
        note: editForm.note || undefined,
      });
      setEditForm(null);
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo actualizar proyección");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteForecast(deleteTarget.id);
      setDeleteTarget(null);
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo eliminar proyección");
    }
  }

  // ── Filtered list ────────────────────────────────────────────────────────

  const filtered = forecasts.filter((f) => {
    if (filterProject && f.projectId !== filterProject) return false;
    if (filterConsultant && f.consultantId !== filterConsultant) return false;
    if (filterPeriod) {
      const q = filterPeriod.trim().toLowerCase();
      const range = `${f.startDate} ${f.endDate} ${formatDate(f.startDate)} ${formatDate(f.endDate)}`.toLowerCase();
      if (!range.includes(q)) return false;
    }
    return true;
  });

  function handleExport() {
    downloadCsv(
      filtered.map((f) => ({
        proyecto:        f.project.name,
        consultor:       f.consultant.fullName,
        fechaInicio:     formatDate(f.startDate),
        fechaFin:        formatDate(f.endDate),
        dias:            String(calcDias(f.startDate, f.endDate)),
        horasProyectadas: numberish(f.hoursProjected).toFixed(2),
        costoProyectado: (f.projectedCost ?? 0).toFixed(2),
        moneda:          f.currency,
        nota:            f.note ?? "",
      })),
      [
        { key: "proyecto",         label: "Proyecto" },
        { key: "consultor",        label: "Consultor" },
        { key: "fechaInicio",      label: "Fecha Inicio" },
        { key: "fechaFin",         label: "Fecha Fin" },
        { key: "dias",             label: "Días" },
        { key: "horasProyectadas", label: "Horas Proyectadas" },
        { key: "costoProyectado",  label: "Costo Proyectado" },
        { key: "moneda",           label: "Moneda" },
        { key: "nota",             label: "Nota" },
      ],
      "proyecciones",
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <SectionLayout
        title="Proyecciones"
        newLabel="+ Nueva proyección"
        canWrite={canWrite}
        onExport={handleExport}
        exportDisabled={filtered.length === 0}
        form={
          <>
            {/* Preset chips */}
            <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
              {PRESETS.map(({ label, fn }) => (
                <button
                  key={label}
                  type="button"
                  className="ghost"
                  style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
                  onClick={() => applyPreset(fn)}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={(e) => void handleCreate(e)} className="form-inline">
              <select
                value={form.projectId}
                onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value }))}
                required
              >
                <option value="">Proyecto</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              <select
                value={form.consultantId}
                onChange={(e) => {
                  const id = e.target.value;
                  const consultant = consultants.find((c) => c.id === id);
                  setForm((p) => ({
                    ...p,
                    consultantId: id,
                    hourlyRate: consultant?.hourlyRate ? String(Number(consultant.hourlyRate)) : p.hourlyRate,
                    currency: consultant?.rateCurrency || p.currency,
                  }));
                }}
                required
              >
                <option value="">Consultor</option>
                {consultants.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
              </select>

              <div>
                <label htmlFor="form-date-from" style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.2rem" }}>
                  Fecha inicio
                </label>
                <input
                  id="form-date-from"
                  type="date"
                  value={form.dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  required
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label htmlFor="form-date-to" style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.2rem" }}>
                  Fecha fin
                </label>
                <input
                  id="form-date-to"
                  type="date"
                  value={form.dateTo}
                  min={form.dateFrom}
                  onChange={(e) => setForm((p) => ({ ...p, dateTo: e.target.value }))}
                  required
                  style={{ width: "100%" }}
                />
                {durationLabel && !rangeError && (
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.72rem", color: "#6b7280" }}>
                    📅 Duración: {durationLabel}
                  </p>
                )}
              </div>

              {rangeError && (
                <p className="span-all" style={{ margin: "0.1rem 0", color: "#dc2626", fontSize: "0.75rem", fontWeight: 600 }}>
                  ⚠ {rangeError}
                </p>
              )}
              {!rangeError && rangeWarning && (
                <p className="span-all" style={{ margin: "0.1rem 0", color: "#d97706", fontSize: "0.75rem" }}>
                  ℹ {rangeWarning}
                </p>
              )}

              <div>
                <input
                  type="number"
                  step="0.5"
                  min={MIN_HORAS}
                  max={MAX_HORAS_PERIODO}
                  placeholder={`Horas proyectadas (${MIN_HORAS}–${MAX_HORAS_PERIODO})`}
                  value={form.hoursProjected}
                  onChange={(e) => setForm((p) => ({ ...p, hoursProjected: e.target.value }))}
                  required
                  style={{ width: "100%" }}
                />
                {hoursError && (
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.72rem", color: "#dc2626", fontWeight: 600 }}>
                    ⚠ {hoursError}
                  </p>
                )}
              </div>

              <select
                value={form.currency}
                onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
              >
                {currencyOptions.map((c) => <option key={`fc-${c}`} value={c}>{`Moneda tarifa: ${c}`}</option>)}
              </select>

              <div>
                <input
                  type="number"
                  step="0.01"
                  placeholder={`Tarifa costo/hora (${form.currency})`}
                  value={form.hourlyRate}
                  onChange={(e) => setForm((p) => ({ ...p, hourlyRate: e.target.value }))}
                  style={{ width: "100%" }}
                />
                {budgetWarning && (
                  <p style={{
                    margin: "0.2rem 0 0",
                    fontSize: "0.72rem",
                    color: budgetWarning.startsWith("⚠") ? "#dc2626" : "#d97706",
                    fontWeight: budgetWarning.startsWith("⚠") ? 600 : 400,
                  }}>
                    {budgetWarning}
                  </p>
                )}
              </div>

              <input
                type="number"
                step="0.01"
                placeholder={`Tarifa venta/hora (${form.currency})`}
                value={form.sellRate}
                onChange={(e) => setForm((p) => ({ ...p, sellRate: e.target.value }))}
              />

              <textarea
                placeholder="Nota"
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              />

              <button type="submit" disabled={submitting || !!rangeError || !!hoursError}>
                {submitting ? "Guardando…" : "Guardar proyección"}
              </button>
            </form>
          </>
        }
        table={
          <>
            {/* Filters */}
            <div className="form-grid filters-grid" style={{ marginBottom: "0.75rem" }}>
              <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
                <option value="">Todos los proyectos</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={filterConsultant} onChange={(e) => setFilterConsultant(e.target.value)}>
                <option value="">Todos los consultores</option>
                {consultants.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
              </select>
              <input
                placeholder="Buscar por fecha (ej: 2026-04)"
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
              />
              {(filterProject || filterConsultant || filterPeriod) && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => { setFilterProject(""); setFilterConsultant(""); setFilterPeriod(""); }}
                >
                  Limpiar
                </button>
              )}
            </div>

            {loading ? (
              <p className="loading">Cargando...</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Proyecto</th>
                      <th>Consultor</th>
                      <th>Fecha Inicio</th>
                      <th>Fecha Fin</th>
                      <th>Días</th>
                      <th>Horas / Ejecución</th>
                      <th>Costo</th>
                      {canWrite && <th>Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((f) => {
                      const approved = (f as unknown as { approvedHours?: number }).approvedHours ?? 0;
                      return (
                        <tr key={f.id}>
                          <td>{f.project.name}</td>
                          <td>{f.consultant.fullName}</td>
                          <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>{formatDate(f.startDate)}</td>
                          <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>{formatDate(f.endDate)}</td>
                          <td style={{ fontSize: "0.8rem", textAlign: "right" }}>{calcDias(f.startDate, f.endDate)}</td>
                          <td>
                            <ForecastProgress
                              approvedHours={approved}
                              hoursProjected={numberish(f.hoursProjected)}
                            />
                          </td>
                          <td>{money(f.projectedCost || 0, f.project.currency)}</td>
                          {canWrite && (
                            <td>
                              <div className="inline-actions">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditForm({
                                      id: f.id,
                                      projectId: f.projectId,
                                      consultantId: f.consultantId,
                                      startDate: f.startDate,
                                      endDate: f.endDate,
                                      hoursProjected: String(numberish(f.hoursProjected)),
                                      hourlyRate: String(numberish(f.hourlyRate)),
                                      sellRate: f.sellRate ? String(numberish(f.sellRate)) : "",
                                      currency: f.currency || "USD",
                                      note: f.note || "",
                                    });
                                  }}
                                >
                                  Editar
                                </button>
                                <button type="button" className="ghost" onClick={() => setDeleteTarget(f)}>
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filtered.length === 0 && !loading && (
                  <p style={{ textAlign: "center", color: "#6b7280", padding: "1.5rem", fontSize: "0.875rem" }}>
                    Sin proyecciones para los filtros seleccionados.
                  </p>
                )}
              </div>
            )}
          </>
        }
      />

      {/* Edit modal */}
      {editForm && (
        <div className="modal-overlay" onClick={() => setEditForm(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editar proyección</h3>
              <button type="button" className="ghost" onClick={() => setEditForm(null)}>Cerrar</button>
            </div>
            <form className="form-grid" onSubmit={(e) => void handleUpdate(e)}>
              <select
                value={editForm.projectId}
                onChange={(e) => setEditForm((p) => p && { ...p, projectId: e.target.value })}
                required
              >
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select
                value={editForm.consultantId}
                onChange={(e) => setEditForm((p) => p && { ...p, consultantId: e.target.value })}
                required
              >
                {consultants.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
              </select>
              <div>
                <label htmlFor="edit-start-date" style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.2rem" }}>
                  Fecha inicio <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  id="edit-start-date"
                  type="date"
                  value={editForm.startDate}
                  max={editForm.endDate || undefined}
                  onChange={(e) => setEditForm((p) => p && { ...p, startDate: e.target.value })}
                  required
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label htmlFor="edit-end-date" style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.2rem" }}>
                  Fecha fin <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  id="edit-end-date"
                  type="date"
                  value={editForm.endDate}
                  min={editForm.startDate || undefined}
                  onChange={(e) => setEditForm((p) => p && { ...p, endDate: e.target.value })}
                  required
                  style={{ width: "100%" }}
                />
                {editForm.startDate && editForm.endDate && editForm.startDate <= editForm.endDate && (
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.72rem", color: "#6b7280" }}>
                    {formatDateRange(editForm.startDate, editForm.endDate)} · {calcDias(editForm.startDate, editForm.endDate)} días
                  </p>
                )}
              </div>
              <div>
                <input
                  type="number"
                  step="0.5"
                  min={MIN_HORAS}
                  max={MAX_HORAS_PERIODO}
                  value={editForm.hoursProjected}
                  onChange={(e) => setEditForm((p) => p && { ...p, hoursProjected: e.target.value })}
                  placeholder={`Horas (${MIN_HORAS}–${MAX_HORAS_PERIODO})`}
                  required
                  style={{ width: "100%" }}
                />
                {(() => {
                  const h = Number(editForm.hoursProjected);
                  if (h < MIN_HORAS) return <p style={{ margin: "0.2rem 0 0", fontSize: "0.72rem", color: "#dc2626" }}>⚠ Mínimo {MIN_HORAS}h</p>;
                  if (h > MAX_HORAS_PERIODO) return <p style={{ margin: "0.2rem 0 0", fontSize: "0.72rem", color: "#dc2626" }}>⚠ Máximo {MAX_HORAS_PERIODO}h</p>;
                  return null;
                })()}
              </div>
              <select
                value={editForm.currency}
                onChange={(e) => setEditForm((p) => p && { ...p, currency: e.target.value })}
              >
                {currencyOptions.map((c) => <option key={`edit-fc-${c}`} value={c}>{`Moneda tarifa: ${c}`}</option>)}
              </select>
              <input
                type="number"
                step="0.01"
                value={editForm.hourlyRate}
                onChange={(e) => setEditForm((p) => p && { ...p, hourlyRate: e.target.value })}
                placeholder={`Tarifa costo/hora (${editForm.currency})`}
              />
              <input
                type="number"
                step="0.01"
                value={editForm.sellRate}
                onChange={(e) => setEditForm((p) => p && { ...p, sellRate: e.target.value })}
                placeholder={`Tarifa venta/hora (${editForm.currency})`}
              />
              <textarea
                value={editForm.note}
                onChange={(e) => setEditForm((p) => p && { ...p, note: e.target.value })}
                placeholder="Nota"
              />
              <div className="modal-actions">
                <button type="submit" disabled={editSubmitting}>
                  {editSubmitting ? "Guardando…" : "Guardar cambios"}
                </button>
                <button type="button" className="ghost" onClick={() => setEditForm(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar proyección"
        message={`¿Eliminar proyección "${deleteTarget ? `${formatDate(deleteTarget.startDate)} – ${formatDate(deleteTarget.endDate)}` : ""}"?`}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
