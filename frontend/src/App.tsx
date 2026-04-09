import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { env } from "./config/env";
import { loginRequest } from "./auth/msal";
import {
  approveTimeEntry,
  createAdminUser,
  createConsultant,
  createExpense,
  createForecast,
  createProject,
  createTimeEntry,
  getHealth,
  getMe,
  getStatsOverview,
  listAdminUsers,
  listConsultants,
  listExpenses,
  listForecasts,
  listProjects,
  listTimeEntries,
  rejectTimeEntry,
  setApiAccessToken,
  type AdminUser,
  type AppRole,
  type AuthUser,
  type Consultant,
  type Expense,
  type Forecast,
  type HealthResponse,
  type Project,
  type StatsOverview,
  type TimeEntry,
} from "./services/api";
import "./App.css";

type TabId = "dashboard" | "projects" | "consultants" | "timeEntries" | "expenses" | "forecasts" | "admin";

const allTabs: Array<{ id: TabId; label: string; permission?: string }> = [
  { id: "dashboard", label: "Dashboard", permission: "stats:read" },
  { id: "projects", label: "Proyectos", permission: "projects:read" },
  { id: "consultants", label: "Consultores", permission: "consultants:read" },
  { id: "timeEntries", label: "Horas", permission: "time:read" },
  { id: "expenses", label: "Gastos", permission: "expenses:read" },
  { id: "forecasts", label: "Proyecciones", permission: "forecasts:read" },
  { id: "admin", label: "Usuarios", permission: "users:manage" },
];

const roleOptions: AppRole[] = ["ADMIN", "PM", "CONSULTANT", "FINANCE", "VIEWER"];

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function numberish(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getAccessToken(instance: ReturnType<typeof useMsal>["instance"], account: ReturnType<typeof useMsal>["accounts"][number]) {
  try {
    const result = await instance.acquireTokenSilent({
      ...loginRequest,
      account,
    });
    return result.accessToken;
  } catch {
    const result = await instance.acquireTokenPopup(loginRequest);
    return result.accessToken;
  }
}

function App() {
  const microsoftConfigured = Boolean(env.azureClientId && env.azureTenantId);
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);

  const [projectForm, setProjectForm] = useState({
    name: "",
    company: "",
    country: "",
    currency: "USD",
    budget: "",
    startDate: "",
    endDate: "",
    description: "",
  });

  const [consultantForm, setConsultantForm] = useState({
    fullName: "",
    email: "",
    role: "",
    hourlyRate: "",
    active: true,
  });

  const [timeForm, setTimeForm] = useState({
    projectId: "",
    consultantId: "",
    workDate: "",
    hours: "",
    note: "",
  });

  const [expenseForm, setExpenseForm] = useState({
    projectId: "",
    expenseDate: "",
    category: "",
    amount: "",
    currency: "USD",
    description: "",
  });

  const [forecastForm, setForecastForm] = useState({
    projectId: "",
    consultantId: "",
    period: "",
    hoursProjected: "",
    hourlyRate: "",
    note: "",
  });

  const [adminUserForm, setAdminUserForm] = useState({
    email: "",
    displayName: "",
    microsoftOid: "",
    active: true,
    role: "VIEWER" as AppRole,
  });

  const permissions = authUser?.permissions ?? [];

  const tabs = useMemo(
    () => allTabs.filter((tab) => !tab.permission || permissions.includes(tab.permission)),
    [permissions],
  );

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id ?? "dashboard");
    }
  }, [tabs, activeTab]);

  function can(permission: string) {
    return permissions.includes(permission);
  }

  async function loadDomainData(user: AuthUser | null) {
    const userPermissions = user?.permissions ?? [];

    const [projectsResult, consultantsResult, timeEntriesResult, expensesResult, forecastsResult, statsResult, adminUsersResult] =
      await Promise.all([
        userPermissions.includes("projects:read") ? listProjects() : Promise.resolve([]),
        userPermissions.includes("consultants:read") ? listConsultants() : Promise.resolve([]),
        userPermissions.includes("time:read") ? listTimeEntries() : Promise.resolve([]),
        userPermissions.includes("expenses:read") ? listExpenses() : Promise.resolve([]),
        userPermissions.includes("forecasts:read") ? listForecasts() : Promise.resolve([]),
        userPermissions.includes("stats:read") ? getStatsOverview() : Promise.resolve(null),
        userPermissions.includes("users:manage") ? listAdminUsers() : Promise.resolve([]),
      ]);

    setProjects(projectsResult);
    setConsultants(consultantsResult);
    setTimeEntries(timeEntriesResult);
    setExpenses(expensesResult);
    setForecasts(forecastsResult);
    setStats(statsResult);
    setAdminUsers(adminUsersResult);
  }

  async function bootstrap() {
    try {
      setLoading(true);
      setError(null);

      const healthResult = await getHealth();
      setHealth(healthResult);

      if (microsoftConfigured) {
        if (!isAuthenticated || !accounts[0]) {
          setAuthUser(null);
          setLoading(false);
          return;
        }

        const token = await getAccessToken(instance, accounts[0]);
        setApiAccessToken(token);
      } else {
        setApiAccessToken(null);
      }

      const me = await getMe();
      setAuthUser(me);
      await loadDomainData(me);
    } catch (bootstrapError) {
      setAuthUser(null);
      setError(bootstrapError instanceof Error ? bootstrapError.message : "Error inicializando la aplicación");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [microsoftConfigured, isAuthenticated, accounts.length]);

  async function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createProject({ ...projectForm, budget: Number(projectForm.budget) });
      setProjectForm({ name: "", company: "", country: "", currency: "USD", budget: "", startDate: "", endDate: "", description: "" });
      await bootstrap();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear proyecto");
    }
  }

  async function submitConsultant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createConsultant({
        fullName: consultantForm.fullName,
        email: consultantForm.email,
        role: consultantForm.role,
        hourlyRate: consultantForm.hourlyRate ? Number(consultantForm.hourlyRate) : undefined,
        active: consultantForm.active,
      });
      setConsultantForm({ fullName: "", email: "", role: "", hourlyRate: "", active: true });
      await bootstrap();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear consultor");
    }
  }

  async function submitTimeEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createTimeEntry({
        projectId: timeForm.projectId,
        consultantId: timeForm.consultantId,
        workDate: timeForm.workDate,
        hours: Number(timeForm.hours),
        note: timeForm.note,
      });
      setTimeForm({ projectId: "", consultantId: "", workDate: "", hours: "", note: "" });
      await bootstrap();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo registrar hora");
    }
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createExpense({
        projectId: expenseForm.projectId,
        expenseDate: expenseForm.expenseDate,
        category: expenseForm.category,
        amount: Number(expenseForm.amount),
        currency: expenseForm.currency,
        description: expenseForm.description,
      });
      setExpenseForm({ projectId: "", expenseDate: "", category: "", amount: "", currency: "USD", description: "" });
      await bootstrap();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo registrar gasto");
    }
  }

  async function submitForecast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createForecast({
        projectId: forecastForm.projectId,
        consultantId: forecastForm.consultantId,
        period: forecastForm.period,
        hoursProjected: Number(forecastForm.hoursProjected),
        hourlyRate: forecastForm.hourlyRate ? Number(forecastForm.hourlyRate) : undefined,
        note: forecastForm.note,
      });
      setForecastForm({ projectId: "", consultantId: "", period: "", hoursProjected: "", hourlyRate: "", note: "" });
      await bootstrap();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear proyección");
    }
  }

  async function submitAdminUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await createAdminUser({
        email: adminUserForm.email,
        displayName: adminUserForm.displayName,
        microsoftOid: adminUserForm.microsoftOid || undefined,
        active: adminUserForm.active,
        roles: [adminUserForm.role],
      });
      setAdminUserForm({
        email: "",
        displayName: "",
        microsoftOid: "",
        active: true,
        role: "VIEWER",
      });
      await bootstrap();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear usuario");
    }
  }

  async function reviewTimeEntry(id: string, action: "approve" | "reject") {
    try {
      if (action === "approve") {
        await approveTimeEntry(id, authUser?.displayName || "admin");
      } else {
        await rejectTimeEntry(id, authUser?.displayName || "admin", "No cumple criterio");
      }
      await bootstrap();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo actualizar estado");
    }
  }

  async function loginWithMicrosoft() {
    await instance.loginPopup(loginRequest);
  }

  async function logout() {
    setApiAccessToken(null);
    setAuthUser(null);
    if (microsoftConfigured) {
      await instance.logoutPopup();
    }
  }

  if (!authUser) {
    if (loading) {
      return (
        <main className="shell auth-shell">
          <section className="auth-card">
            <div className="logo-slot">Logo Empresa</div>
            <h1>App Gestion Demo</h1>
            <p>Inicializando sesión...</p>
          </section>
        </main>
      );
    }

    return (
      <main className="shell auth-shell">
        <section className="auth-card">
          <div className="logo-slot">Logo Empresa</div>
          <h1>App Gestion Demo</h1>
          {microsoftConfigured ? (
            <>
              <p>Ingresa con Microsoft para continuar.</p>
              <button type="button" onClick={() => void loginWithMicrosoft()}>
                Iniciar sesión con Microsoft
              </button>
            </>
          ) : (
            <p>
              Falta configurar autenticación Microsoft en frontend (VITE_AZURE_TENANT_ID y
              VITE_AZURE_CLIENT_ID).
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="hero">
        <div className="hero-left">
          <div className="logo-slot">Logo Empresa</div>
          <div>
            <h1>App Gestion Demo</h1>
            <p>Gestión integral de proyectos, horas, gastos y proyecciones</p>
          </div>
        </div>
        <div className="badges">
          <span className={`pill ${health?.ok ? "ok" : "error"}`}>{health?.ok ? "Backend activo" : "Backend no disponible"}</span>
          <span className="pill neutral">{`${authUser.displayName} (${authUser.roles.join(", ")})`}</span>
          <button type="button" className="ghost" onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <nav className="tabs">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className={activeTab === tab.id ? "tab active" : "tab"} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {error && <p className="error-banner">{error}</p>}
      {loading && <p className="loading">Cargando datos...</p>}

      {!loading && activeTab === "dashboard" && (
        <section className="grid dashboard-grid">
          <article className="card kpi"><h3>Presupuesto total</h3><p>{money(stats?.totals.budget || 0)}</p></article>
          <article className="card kpi"><h3>Gasto total</h3><p>{money(stats?.totals.spent || 0)}</p></article>
          <article className="card kpi"><h3>Horas totales</h3><p>{(stats?.totals.totalHours || 0).toFixed(2)}</p></article>
          <article className="card kpi"><h3>Horas aprobadas</h3><p>{(stats?.totals.approvedHours || 0).toFixed(2)}</p></article>
          <article className="card span-4">
            <h3>Resumen por proyecto</h3>
            <div className="table-wrap">
              <table><thead><tr><th>Proyecto</th><th>Empresa</th><th>Presupuesto</th><th>Gastado</th><th>Disponible</th><th>Uso</th></tr></thead>
                <tbody>{(stats?.projects || []).map((project) => (
                  <tr key={project.projectId}><td>{project.projectName}</td><td>{project.company}</td><td>{money(project.budget, project.currency)}</td><td>{money(project.spent, project.currency)}</td><td>{money(project.remainingBudget, project.currency)}</td><td>{project.usedBudgetPercent}%</td></tr>
                ))}</tbody>
              </table>
            </div>
          </article>
        </section>
      )}

      {!loading && activeTab === "projects" && (
        <section className="grid two-col">
          <article className="card">
            <h3>Nuevo proyecto</h3>
            {can("projects:write") && (
              <form onSubmit={submitProject} className="form-grid">
                <input placeholder="Nombre" value={projectForm.name} onChange={(event) => setProjectForm((prev) => ({ ...prev, name: event.target.value }))} required />
                <input placeholder="Empresa" value={projectForm.company} onChange={(event) => setProjectForm((prev) => ({ ...prev, company: event.target.value }))} required />
                <input placeholder="País" value={projectForm.country} onChange={(event) => setProjectForm((prev) => ({ ...prev, country: event.target.value }))} required />
                <input placeholder="Moneda" value={projectForm.currency} onChange={(event) => setProjectForm((prev) => ({ ...prev, currency: event.target.value }))} required />
                <input type="number" placeholder="Presupuesto" value={projectForm.budget} onChange={(event) => setProjectForm((prev) => ({ ...prev, budget: event.target.value }))} required />
                <input type="date" value={projectForm.startDate} onChange={(event) => setProjectForm((prev) => ({ ...prev, startDate: event.target.value }))} required />
                <input type="date" value={projectForm.endDate} onChange={(event) => setProjectForm((prev) => ({ ...prev, endDate: event.target.value }))} required />
                <textarea placeholder="Descripción" value={projectForm.description} onChange={(event) => setProjectForm((prev) => ({ ...prev, description: event.target.value }))} />
                <button type="submit">Crear proyecto</button>
              </form>
            )}
          </article>
          <article className="card"><h3>Listado de proyectos</h3><div className="table-wrap"><table><thead><tr><th>Nombre</th><th>Empresa</th><th>Moneda</th><th>Presupuesto</th></tr></thead><tbody>{projects.map((project) => (<tr key={project.id}><td>{project.name}</td><td>{project.company}</td><td>{project.currency}</td><td>{money(numberish(project.budget), project.currency)}</td></tr>))}</tbody></table></div></article>
        </section>
      )}

      {!loading && activeTab === "consultants" && (
        <section className="grid two-col">
          <article className="card">
            <h3>Nuevo consultor</h3>
            {can("consultants:write") && (
              <form onSubmit={submitConsultant} className="form-grid">
                <input placeholder="Nombre completo" value={consultantForm.fullName} onChange={(event) => setConsultantForm((prev) => ({ ...prev, fullName: event.target.value }))} required />
                <input placeholder="Correo" value={consultantForm.email} onChange={(event) => setConsultantForm((prev) => ({ ...prev, email: event.target.value }))} />
                <input placeholder="Rol" value={consultantForm.role} onChange={(event) => setConsultantForm((prev) => ({ ...prev, role: event.target.value }))} required />
                <input type="number" placeholder="Tarifa por hora" value={consultantForm.hourlyRate} onChange={(event) => setConsultantForm((prev) => ({ ...prev, hourlyRate: event.target.value }))} />
                <label className="check"><input type="checkbox" checked={consultantForm.active} onChange={(event) => setConsultantForm((prev) => ({ ...prev, active: event.target.checked }))} />Activo</label>
                <button type="submit">Crear consultor</button>
              </form>
            )}
          </article>
          <article className="card"><h3>Listado de consultores</h3><div className="table-wrap"><table><thead><tr><th>Nombre</th><th>Rol</th><th>Tarifa</th><th>Estado</th></tr></thead><tbody>{consultants.map((consultant) => (<tr key={consultant.id}><td>{consultant.fullName}</td><td>{consultant.role}</td><td>{money(numberish(consultant.hourlyRate || "0"))}</td><td>{consultant.active ? "Activo" : "Inactivo"}</td></tr>))}</tbody></table></div></article>
        </section>
      )}

      {!loading && activeTab === "timeEntries" && (
        <section className="grid two-col">
          <article className="card">
            <h3>Registrar horas</h3>
            {can("time:write") && (
              <form onSubmit={submitTimeEntry} className="form-grid">
                <select value={timeForm.projectId} onChange={(event) => setTimeForm((prev) => ({ ...prev, projectId: event.target.value }))} required><option value="">Proyecto</option>{projects.map((project) => (<option key={project.id} value={project.id}>{project.name}</option>))}</select>
                <select value={timeForm.consultantId} onChange={(event) => setTimeForm((prev) => ({ ...prev, consultantId: event.target.value }))} required><option value="">Consultor</option>{consultants.map((consultant) => (<option key={consultant.id} value={consultant.id}>{consultant.fullName}</option>))}</select>
                <input type="date" value={timeForm.workDate} onChange={(event) => setTimeForm((prev) => ({ ...prev, workDate: event.target.value }))} required />
                <input type="number" step="0.25" placeholder="Horas" value={timeForm.hours} onChange={(event) => setTimeForm((prev) => ({ ...prev, hours: event.target.value }))} required />
                <textarea placeholder="Nota" value={timeForm.note} onChange={(event) => setTimeForm((prev) => ({ ...prev, note: event.target.value }))} />
                <button type="submit">Registrar</button>
              </form>
            )}
          </article>
          <article className="card"><h3>Flujo de aprobación</h3><div className="table-wrap"><table><thead><tr><th>Proyecto</th><th>Consultor</th><th>Horas</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{timeEntries.map((entry) => (<tr key={entry.id}><td>{entry.project.name}</td><td>{entry.consultant.fullName}</td><td>{numberish(entry.hours).toFixed(2)}</td><td>{entry.status}</td><td>{entry.status === "PENDING" && can("time:review") && (<div className="inline-actions"><button type="button" onClick={() => void reviewTimeEntry(entry.id, "approve")}>Aprobar</button><button type="button" className="ghost" onClick={() => void reviewTimeEntry(entry.id, "reject")}>Rechazar</button></div>)}</td></tr>))}</tbody></table></div></article>
        </section>
      )}

      {!loading && activeTab === "expenses" && (
        <section className="grid two-col">
          <article className="card">
            <h3>Registrar gasto</h3>
            {can("expenses:write") && (
              <form onSubmit={submitExpense} className="form-grid">
                <select value={expenseForm.projectId} onChange={(event) => setExpenseForm((prev) => ({ ...prev, projectId: event.target.value }))} required><option value="">Proyecto</option>{projects.map((project) => (<option key={project.id} value={project.id}>{project.name}</option>))}</select>
                <input type="date" value={expenseForm.expenseDate} onChange={(event) => setExpenseForm((prev) => ({ ...prev, expenseDate: event.target.value }))} required />
                <input placeholder="Categoría" value={expenseForm.category} onChange={(event) => setExpenseForm((prev) => ({ ...prev, category: event.target.value }))} required />
                <input type="number" step="0.01" placeholder="Valor" value={expenseForm.amount} onChange={(event) => setExpenseForm((prev) => ({ ...prev, amount: event.target.value }))} required />
                <input placeholder="Moneda" value={expenseForm.currency} onChange={(event) => setExpenseForm((prev) => ({ ...prev, currency: event.target.value }))} required />
                <textarea placeholder="Descripción" value={expenseForm.description} onChange={(event) => setExpenseForm((prev) => ({ ...prev, description: event.target.value }))} />
                <button type="submit">Registrar gasto</button>
              </form>
            )}
          </article>
          <article className="card"><h3>Listado de gastos</h3><div className="table-wrap"><table><thead><tr><th>Proyecto</th><th>Categoría</th><th>Monto</th><th>Fecha</th></tr></thead><tbody>{expenses.map((expense) => (<tr key={expense.id}><td>{expense.project.name}</td><td>{expense.category}</td><td>{money(numberish(expense.amount), expense.currency)}</td><td>{new Date(expense.expenseDate).toLocaleDateString()}</td></tr>))}</tbody></table></div></article>
        </section>
      )}

      {!loading && activeTab === "forecasts" && (
        <section className="grid two-col">
          <article className="card">
            <h3>Nueva proyección</h3>
            {can("forecasts:write") && (
              <form onSubmit={submitForecast} className="form-grid">
                <select value={forecastForm.projectId} onChange={(event) => setForecastForm((prev) => ({ ...prev, projectId: event.target.value }))} required><option value="">Proyecto</option>{projects.map((project) => (<option key={project.id} value={project.id}>{project.name}</option>))}</select>
                <select value={forecastForm.consultantId} onChange={(event) => setForecastForm((prev) => ({ ...prev, consultantId: event.target.value }))} required><option value="">Consultor</option>{consultants.map((consultant) => (<option key={consultant.id} value={consultant.id}>{consultant.fullName}</option>))}</select>
                <input placeholder="Periodo (ej: 2026-Q2)" value={forecastForm.period} onChange={(event) => setForecastForm((prev) => ({ ...prev, period: event.target.value }))} required />
                <input type="number" step="0.5" placeholder="Horas proyectadas" value={forecastForm.hoursProjected} onChange={(event) => setForecastForm((prev) => ({ ...prev, hoursProjected: event.target.value }))} required />
                <input type="number" step="0.01" placeholder="Tarifa/hora" value={forecastForm.hourlyRate} onChange={(event) => setForecastForm((prev) => ({ ...prev, hourlyRate: event.target.value }))} />
                <textarea placeholder="Nota" value={forecastForm.note} onChange={(event) => setForecastForm((prev) => ({ ...prev, note: event.target.value }))} />
                <button type="submit">Guardar proyección</button>
              </form>
            )}
          </article>
          <article className="card"><h3>Listado de proyecciones</h3><div className="table-wrap"><table><thead><tr><th>Proyecto</th><th>Consultor</th><th>Periodo</th><th>Horas</th><th>Costo</th></tr></thead><tbody>{forecasts.map((forecast) => (<tr key={forecast.id}><td>{forecast.project.name}</td><td>{forecast.consultant.fullName}</td><td>{forecast.period}</td><td>{numberish(forecast.hoursProjected).toFixed(2)}</td><td>{money(forecast.projectedCost || 0, forecast.project.currency)}</td></tr>))}</tbody></table></div></article>
        </section>
      )}

      {!loading && activeTab === "admin" && (
        <section className="grid two-col">
          <article className="card">
            <h3>Crear usuario</h3>
            <form onSubmit={submitAdminUser} className="form-grid">
              <input placeholder="Correo" value={adminUserForm.email} onChange={(event) => setAdminUserForm((prev) => ({ ...prev, email: event.target.value }))} required />
              <input placeholder="Nombre" value={adminUserForm.displayName} onChange={(event) => setAdminUserForm((prev) => ({ ...prev, displayName: event.target.value }))} required />
              <input placeholder="Microsoft OID (opcional)" value={adminUserForm.microsoftOid} onChange={(event) => setAdminUserForm((prev) => ({ ...prev, microsoftOid: event.target.value }))} />
              <select value={adminUserForm.role} onChange={(event) => setAdminUserForm((prev) => ({ ...prev, role: event.target.value as AppRole }))}>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <label className="check"><input type="checkbox" checked={adminUserForm.active} onChange={(event) => setAdminUserForm((prev) => ({ ...prev, active: event.target.checked }))} />Activo</label>
              <button type="submit">Crear usuario</button>
            </form>
          </article>
          <article className="card"><h3>Usuarios registrados</h3><div className="table-wrap"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Roles</th><th>Estado</th></tr></thead><tbody>{adminUsers.map((user) => (<tr key={user.id}><td>{user.displayName}</td><td>{user.email}</td><td>{user.roles.join(", ")}</td><td>{user.active ? "Activo" : "Inactivo"}</td></tr>))}</tbody></table></div></article>
        </section>
      )}
    </main>
  );
}

export default App;
