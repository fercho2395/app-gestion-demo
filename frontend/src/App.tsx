import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { env } from "./config/env";
import { apiTokenRequest, loginRequest } from "./auth/msal";
import {
  approveTimeEntry,
  createAdminUser,
  createConsultant,
  createExpense,
  createForecast,
  createProject,
  createTimeEntry,
  deleteConsultant,
  deleteExpense,
  deleteForecast,
  deleteProject,
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
  updateConsultant,
  updateExpense,
  updateForecast,
  updateProject,
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
const currencyOptions = ["COP", "USD", "EUR", "MXN", "PEN", "CLP"];
const consultantRoleOptions = ["Analista", "Desarrollador", "QA", "Arquitecto", "PM", "Data Engineer"];
const expenseCategoryOptions = ["Viajes", "Alojamiento", "Alimentacion", "Transporte", "Software", "Servicios", "Otros"];
const quarterOptions = ["Q1", "Q2", "Q3", "Q4"];

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

function toDateInput(value: string) {
  return value.slice(0, 10);
}

function quarterToIndex(quarter: string) {
  return quarterOptions.indexOf(quarter);
}

function buildForecastPeriods(yearText: string, startQuarter: string, endQuarter: string) {
  const year = Number(yearText);
  const startIdx = quarterToIndex(startQuarter);
  const endIdx = quarterToIndex(endQuarter);

  if (!Number.isInteger(year) || startIdx < 0 || endIdx < 0 || endIdx < startIdx) {
    throw new Error("Selecciona un rango de periodo valido");
  }

  return quarterOptions.slice(startIdx, endIdx + 1).map((quarter) => `${year}-${quarter}`);
}

function isWithinDateRange(dateText: string, from?: string, to?: string) {
  if (!dateText) return false;
  if (from && dateText < from) return false;
  if (to && dateText > to) return false;
  return true;
}

function periodToDateRange(period: string) {
  const match = period.match(/^(\d{4})-Q([1-4])$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const quarter = Number(match[2]);
  const startMonth = (quarter - 1) * 3;

  const startDate = new Date(Date.UTC(year, startMonth, 1));
  const endDate = new Date(Date.UTC(year, startMonth + 3, 0));

  const start = startDate.toISOString().slice(0, 10);
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

function overlapsRange(start: string, end: string, from?: string, to?: string) {
  const min = from || "0000-01-01";
  const max = to || "9999-12-31";
  return !(end < min || start > max);
}

async function getAccessToken(
  instance: ReturnType<typeof useMsal>["instance"],
  account: ReturnType<typeof useMsal>["accounts"][number],
): Promise<string | null> {
  const preferAccessToken = Boolean(env.azureApiScope);

  try {
    const result = await instance.acquireTokenSilent({
      ...apiTokenRequest,
      account,
    });
    return preferAccessToken ? result.accessToken || result.idToken : result.idToken || result.accessToken;
  } catch {
    await instance.acquireTokenRedirect({
      ...apiTokenRequest,
      account,
      redirectStartPage: `${window.location.origin}/home`,
    });
    return null;
  }
}

function App() {
  const microsoftConfigured = Boolean(env.azureClientId && env.azureTenantId);
  const authWithMicrosoftEnabled = microsoftConfigured && !env.forceLocalAuth;
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [currentPath, setCurrentPath] = useState(() => (window.location.pathname || "/").toLowerCase());

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
  const [projectSearch, setProjectSearch] = useState("");
  const [statsFilters, setStatsFilters] = useState({
    company: "",
    projectId: "",
    from: "",
    to: "",
  });

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
    role: consultantRoleOptions[0],
    hourlyRate: "",
    active: true,
    rateCurrency: "COP",
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
    category: expenseCategoryOptions[0],
    amount: "",
    currency: "COP",
    description: "",
  });

  const [forecastForm, setForecastForm] = useState({
    projectId: "",
    consultantId: "",
    periodYear: String(new Date().getFullYear()),
    periodQuarterStart: "Q1",
    periodQuarterEnd: "Q1",
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

  function goTo(path: "/login" | "/home", replace = false) {
    if (replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }
    setCurrentPath(path);
  }

  useEffect(() => {
    const onPopState = () => setCurrentPath((window.location.pathname || "/").toLowerCase());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (currentPath !== "/login" && currentPath !== "/home") {
      goTo(authUser ? "/home" : "/login", true);
    }
  }, [currentPath, authUser]);

  const tabs = useMemo(
    () => allTabs.filter((tab) => !tab.permission || permissions.includes(tab.permission)),
    [permissions],
  );

  const filteredProjects = useMemo(() => {
    const term = projectSearch.trim().toLowerCase();
    if (!term) {
      return projects;
    }

    return projects.filter((project) => {
      return project.name.toLowerCase().includes(term) || project.company.toLowerCase().includes(term);
    });
  }, [projects, projectSearch]);

  const companies = useMemo(() => {
    const unique = new Set(projects.map((project) => project.company).filter(Boolean));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const dashboardProjects = useMemo(() => {
    return projects.filter((project) => {
      if (statsFilters.company && project.company !== statsFilters.company) return false;
      if (statsFilters.projectId && project.id !== statsFilters.projectId) return false;
      return true;
    });
  }, [projects, statsFilters.company, statsFilters.projectId]);

  const dashboardProjectIds = useMemo(() => {
    return new Set(dashboardProjects.map((project) => project.id));
  }, [dashboardProjects]);

  const dashboardTimeEntries = useMemo(() => {
    return timeEntries.filter((entry) => {
      if (!dashboardProjectIds.has(entry.projectId)) return false;
      return isWithinDateRange(entry.workDate.slice(0, 10), statsFilters.from, statsFilters.to);
    });
  }, [timeEntries, dashboardProjectIds, statsFilters.from, statsFilters.to]);

  const dashboardApprovedTimeEntries = useMemo(() => {
    return dashboardTimeEntries.filter((entry) => entry.status === "APPROVED");
  }, [dashboardTimeEntries]);

  const dashboardExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      if (!dashboardProjectIds.has(expense.projectId)) return false;
      return isWithinDateRange(expense.expenseDate.slice(0, 10), statsFilters.from, statsFilters.to);
    });
  }, [expenses, dashboardProjectIds, statsFilters.from, statsFilters.to]);

  const dashboardForecasts = useMemo(() => {
    return forecasts.filter((forecast) => {
      if (!dashboardProjectIds.has(forecast.projectId)) return false;
      const range = periodToDateRange(forecast.period);
      if (!range) return true;
      return overlapsRange(range.start, range.end, statsFilters.from, statsFilters.to);
    });
  }, [forecasts, dashboardProjectIds, statsFilters.from, statsFilters.to]);

  const dashboardTotals = useMemo(() => {
    const budget = dashboardProjects.reduce((acc, project) => acc + numberish(project.budget), 0);
    const spent = dashboardExpenses.reduce((acc, expense) => acc + numberish(expense.amount), 0);
    const totalHours = dashboardTimeEntries.reduce((acc, entry) => acc + numberish(entry.hours), 0);
    const approvedHours = dashboardApprovedTimeEntries.reduce((acc, entry) => acc + numberish(entry.hours), 0);
    const projectedCost = dashboardForecasts.reduce((acc, forecast) => acc + numberish(String(forecast.projectedCost || 0)), 0);
    return { budget, spent, totalHours, approvedHours, projectedCost };
  }, [dashboardProjects, dashboardExpenses, dashboardTimeEntries, dashboardApprovedTimeEntries, dashboardForecasts]);

  const dashboardProjectSummary = useMemo(() => {
    return dashboardProjects
      .map((project) => {
        const projectSpent = dashboardExpenses
          .filter((expense) => expense.projectId === project.id)
          .reduce((acc, expense) => acc + numberish(expense.amount), 0);

        const projectApprovedHours = dashboardApprovedTimeEntries
          .filter((entry) => entry.projectId === project.id)
          .reduce((acc, entry) => acc + numberish(entry.hours), 0);

        const projectProjectedCost = dashboardForecasts
          .filter((forecast) => forecast.projectId === project.id)
          .reduce((acc, forecast) => acc + numberish(String(forecast.projectedCost || 0)), 0);

        const budget = numberish(project.budget);
        const remaining = budget - projectSpent;
        const projectedTotal = projectSpent + projectProjectedCost;
        const projectedPct = budget > 0 ? (projectedTotal / budget) * 100 : 0;

        return {
          project,
          spent: projectSpent,
          approvedHours: projectApprovedHours,
          remaining,
          projectedCost: projectProjectedCost,
          projectedTotal,
          projectedPct,
        };
      })
      .sort((a, b) => b.projectedPct - a.projectedPct);
  }, [dashboardProjects, dashboardExpenses, dashboardApprovedTimeEntries, dashboardForecasts]);

  const dashboardHoursByConsultant = useMemo(() => {
    const grouped = new Map<string, { total: number; byProject: Map<string, number> }>();

    for (const entry of dashboardApprovedTimeEntries) {
      const key = entry.consultant.fullName || "Sin nombre";
      if (!grouped.has(key)) {
        grouped.set(key, { total: 0, byProject: new Map() });
      }

      const node = grouped.get(key)!;
      const hours = numberish(entry.hours);
      node.total += hours;
      node.byProject.set(entry.projectId, (node.byProject.get(entry.projectId) || 0) + hours);
    }

    return Array.from(grouped.entries())
      .map(([consultant, value]) => ({ consultant, total: value.total, byProject: value.byProject }))
      .sort((a, b) => b.total - a.total);
  }, [dashboardApprovedTimeEntries]);

  const dashboardForecastByConsultant = useMemo(() => {
    const grouped = new Map<string, { totalHours: number; items: Forecast[] }>();

    for (const forecast of dashboardForecasts) {
      const key = forecast.consultant.fullName || "Sin nombre";
      if (!grouped.has(key)) {
        grouped.set(key, { totalHours: 0, items: [] });
      }

      const node = grouped.get(key)!;
      node.totalHours += numberish(forecast.hoursProjected);
      node.items.push(forecast);
    }

    return Array.from(grouped.entries())
      .map(([consultant, value]) => ({
        consultant,
        totalHours: value.totalHours,
        items: value.items.sort((a, b) => a.period.localeCompare(b.period)),
      }))
      .sort((a, b) => b.totalHours - a.totalHours);
  }, [dashboardForecasts]);

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

      if (authWithMicrosoftEnabled) {
        if (!isAuthenticated || !accounts[0]) {
          setAuthUser(null);
          if (currentPath !== "/login") {
            goTo("/login", true);
          }
          setLoading(false);
          return;
        }

        const token = await getAccessToken(instance, accounts[0]);
        if (!token) {
          return;
        }
        setApiAccessToken(token);
      } else {
        setApiAccessToken(null);
      }

      const me = await getMe();
      setAuthUser(me);
      if (currentPath !== "/home") {
        goTo("/home", true);
      }
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
  }, [microsoftConfigured, isAuthenticated, accounts.length, currentPath]);

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

  async function editProject(project: Project) {
    try {
      const name = window.prompt("Nombre del proyecto", project.name);
      if (!name) return;
      const company = window.prompt("Empresa", project.company);
      if (!company) return;
      const country = window.prompt("Pais", project.country);
      if (!country) return;
      const budgetText = window.prompt("Presupuesto", String(numberish(project.budget)));
      if (!budgetText) return;

      await updateProject(project.id, {
        name,
        company,
        country,
        currency: project.currency,
        budget: Number(budgetText),
        startDate: toDateInput(project.startDate),
        endDate: toDateInput(project.endDate),
        description: project.description || "",
      });
      await bootstrap();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo editar proyecto");
    }
  }

  async function removeProject(project: Project) {
    try {
      if (!window.confirm(`Eliminar proyecto ${project.name}?`)) return;
      await deleteProject(project.id);
      await bootstrap();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo eliminar proyecto");
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
      setConsultantForm({ fullName: "", email: "", role: consultantRoleOptions[0], hourlyRate: "", active: true, rateCurrency: "COP" });
      await bootstrap();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear consultor");
    }
  }

  async function editConsultant(consultant: Consultant) {
    try {
      const fullName = window.prompt("Nombre del consultor", consultant.fullName);
      if (!fullName) return;
      const role = window.prompt("Rol", consultant.role);
      if (!role) return;

      await updateConsultant(consultant.id, {
        fullName,
        email: consultant.email || "",
        role,
        hourlyRate: numberish(consultant.hourlyRate),
        active: consultant.active,
      });
      await bootstrap();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo editar consultor");
    }
  }

  async function toggleConsultantActive(consultant: Consultant) {
    try {
      await updateConsultant(consultant.id, {
        fullName: consultant.fullName,
        email: consultant.email || "",
        role: consultant.role,
        hourlyRate: numberish(consultant.hourlyRate),
        active: !consultant.active,
      });
      await bootstrap();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo actualizar estado del consultor");
    }
  }

  async function removeConsultant(consultant: Consultant) {
    try {
      if (!window.confirm(`Eliminar consultor ${consultant.fullName}?`)) return;
      await deleteConsultant(consultant.id);
      await bootstrap();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo eliminar consultor");
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
      setExpenseForm({ projectId: "", expenseDate: "", category: expenseCategoryOptions[0], amount: "", currency: "COP", description: "" });
      await bootstrap();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo registrar gasto");
    }
  }

  async function editExpense(expense: Expense) {
    try {
      const amountText = window.prompt("Monto", String(numberish(expense.amount)));
      if (!amountText) return;

      await updateExpense(expense.id, {
        projectId: expense.projectId,
        expenseDate: toDateInput(expense.expenseDate),
        category: expense.category,
        amount: Number(amountText),
        currency: expense.currency,
        description: expense.description || "",
      });
      await bootstrap();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo editar gasto");
    }
  }

  async function removeExpense(expense: Expense) {
    try {
      if (!window.confirm(`Eliminar gasto de ${expense.category}?`)) return;
      await deleteExpense(expense.id);
      await bootstrap();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo eliminar gasto");
    }
  }

  async function submitForecast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const periods = buildForecastPeriods(
        forecastForm.periodYear,
        forecastForm.periodQuarterStart,
        forecastForm.periodQuarterEnd,
      );

      await Promise.all(
        periods.map((period) =>
          createForecast({
            projectId: forecastForm.projectId,
            consultantId: forecastForm.consultantId,
            period,
            hoursProjected: Number(forecastForm.hoursProjected),
            hourlyRate: forecastForm.hourlyRate ? Number(forecastForm.hourlyRate) : undefined,
            note: forecastForm.note,
          }),
        ),
      );
      setForecastForm({
        projectId: "",
        consultantId: "",
        periodYear: String(new Date().getFullYear()),
        periodQuarterStart: "Q1",
        periodQuarterEnd: "Q1",
        hoursProjected: "",
        hourlyRate: "",
        note: "",
      });
      await bootstrap();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear proyección");
    }
  }

  async function editForecast(forecast: Forecast) {
    try {
      const hoursText = window.prompt("Horas proyectadas", String(numberish(forecast.hoursProjected)));
      if (!hoursText) return;

      await updateForecast(forecast.id, {
        projectId: forecast.projectId,
        consultantId: forecast.consultantId,
        period: forecast.period,
        hoursProjected: Number(hoursText),
        hourlyRate: forecast.hourlyRate ? Number(forecast.hourlyRate) : undefined,
        note: forecast.note || "",
      });
      await bootstrap();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo editar proyección");
    }
  }

  async function removeForecast(forecast: Forecast) {
    try {
      if (!window.confirm(`Eliminar proyección ${forecast.period}?`)) return;
      await deleteForecast(forecast.id);
      await bootstrap();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo eliminar proyección");
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
    if (currentPath !== "/login") {
      goTo("/login", true);
    }
    await instance.loginRedirect({
      ...loginRequest,
      redirectStartPage: `${window.location.origin}/home`,
    });
  }

  async function logout() {
    setApiAccessToken(null);
    setAuthUser(null);
    goTo("/login", true);
    if (authWithMicrosoftEnabled) {
      await instance.logoutRedirect({
        postLogoutRedirectUri: `${window.location.origin}/login`,
      });
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
          {error && <p className="error-banner">{error}</p>}
          {authWithMicrosoftEnabled ? (
            <>
              {isAuthenticated ? (
                <>
                  <p>
                    Tu sesión Microsoft está activa, pero no fue posible validar permisos en la app.
                  </p>
                  <div className="inline-actions">
                    <button type="button" onClick={() => void bootstrap()}>
                      Reintentar
                    </button>
                    <button type="button" className="ghost" onClick={() => void logout()}>
                      Cerrar sesión Microsoft
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>Ingresa con Microsoft para continuar.</p>
                  <button type="button" onClick={() => void loginWithMicrosoft()}>
                    Iniciar sesión con Microsoft
                  </button>
                </>
              )}
            </>
          ) : (
            <p>Modo demo activo sin login Microsoft.</p>
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
        <section className="grid">
          <article className="card">
            <h3>Filtros del tablero</h3>
            <div className="form-grid filters-grid">
              <select
                value={statsFilters.company}
                onChange={(event) => setStatsFilters((prev) => ({ ...prev, company: event.target.value, projectId: "" }))}
              >
                <option value="">Todas las empresas</option>
                {companies.map((company) => (
                  <option key={company} value={company}>{company}</option>
                ))}
              </select>
              <select
                value={statsFilters.projectId}
                onChange={(event) => setStatsFilters((prev) => ({ ...prev, projectId: event.target.value }))}
              >
                <option value="">Todos los proyectos</option>
                {dashboardProjects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={statsFilters.from}
                onChange={(event) => setStatsFilters((prev) => ({ ...prev, from: event.target.value }))}
              />
              <input
                type="date"
                value={statsFilters.to}
                onChange={(event) => setStatsFilters((prev) => ({ ...prev, to: event.target.value }))}
              />
              <button
                type="button"
                className="ghost"
                onClick={() => setStatsFilters({ company: "", projectId: "", from: "", to: "" })}
              >
                Limpiar filtros
              </button>
            </div>
          </article>

          <section className="grid dashboard-grid">
            <article className="card kpi"><h3>Presupuesto total</h3><p>{money(dashboardTotals.budget || stats?.totals.budget || 0)}</p></article>
            <article className="card kpi"><h3>Gasto total</h3><p>{money(dashboardTotals.spent || stats?.totals.spent || 0)}</p></article>
            <article className="card kpi"><h3>Horas totales</h3><p>{(dashboardTotals.totalHours || stats?.totals.totalHours || 0).toFixed(2)}</p></article>
            <article className="card kpi"><h3>Horas aprobadas</h3><p>{(dashboardTotals.approvedHours || stats?.totals.approvedHours || 0).toFixed(2)}</p></article>
          </section>

          <article className="card">
            <h3>Resumen por proyecto</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Proyecto</th>
                    <th>Presupuesto</th>
                    <th>Gasto real</th>
                    <th>Disponible</th>
                    <th>Proyección costo</th>
                    <th>Total proyectado</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardProjectSummary.map((row) => {
                    const tone = row.projectedPct > 100 ? "error" : row.projectedPct > 90 ? "warn" : "ok";
                    const statusLabel = row.projectedPct > 100 ? "Se pasa" : row.projectedPct > 90 ? "Riesgo" : "OK";

                    return (
                      <tr key={row.project.id}>
                        <td>{row.project.company}</td>
                        <td>{row.project.name}</td>
                        <td>{money(numberish(row.project.budget), row.project.currency)}</td>
                        <td>{money(row.spent, row.project.currency)}</td>
                        <td>{money(row.remaining, row.project.currency)}</td>
                        <td>{money(row.projectedCost, row.project.currency)}</td>
                        <td>{`${money(row.projectedTotal, row.project.currency)} (${row.projectedPct.toFixed(1)}%)`}</td>
                        <td><span className={`pill ${tone}`}>{statusLabel}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>

          <section className="grid two-col">
            <article className="card">
              <h3>Horas aprobadas por consultor</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Consultor</th>
                      <th>Total horas</th>
                      <th>Detalle por proyecto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardHoursByConsultant.map((row) => (
                      <tr key={row.consultant}>
                        <td>{row.consultant}</td>
                        <td>{row.total.toFixed(2)}</td>
                        <td>
                          <div className="tag-list">
                            {Array.from(row.byProject.entries()).map(([projectId, hours]) => {
                              const projectName = projects.find((project) => project.id === projectId)?.name || "Proyecto";
                              return <span key={projectId} className="pill neutral">{`${projectName}: ${hours.toFixed(2)}h`}</span>;
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="card">
              <h3>Proyección por consultor</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Consultor</th>
                      <th>Horas proyectadas</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardForecastByConsultant.map((row) => (
                      <tr key={row.consultant}>
                        <td>{row.consultant}</td>
                        <td>{row.totalHours.toFixed(2)}</td>
                        <td>
                          <div className="tag-list">
                            {row.items.map((item) => (
                              <span key={item.id} className="pill neutral">{`${item.period}: ${numberish(item.hoursProjected).toFixed(2)}h`}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
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
                <select value={projectForm.currency} onChange={(event) => setProjectForm((prev) => ({ ...prev, currency: event.target.value }))} required>
                  {currencyOptions.map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
                <input type="number" placeholder="Presupuesto" value={projectForm.budget} onChange={(event) => setProjectForm((prev) => ({ ...prev, budget: event.target.value }))} required />
                <input type="date" value={projectForm.startDate} onChange={(event) => setProjectForm((prev) => ({ ...prev, startDate: event.target.value }))} required />
                <input type="date" value={projectForm.endDate} onChange={(event) => setProjectForm((prev) => ({ ...prev, endDate: event.target.value }))} required />
                <textarea placeholder="Descripción" value={projectForm.description} onChange={(event) => setProjectForm((prev) => ({ ...prev, description: event.target.value }))} />
                <button type="submit">Crear proyecto</button>
              </form>
            )}
          </article>
          <article className="card"><h3>Listado de proyectos</h3><input placeholder="Filtrar por proyecto o empresa" value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} /><div className="table-wrap"><table><thead><tr><th>Nombre</th><th>Empresa</th><th>Moneda</th><th>Presupuesto</th><th>Acciones</th></tr></thead><tbody>{filteredProjects.map((project) => (<tr key={project.id}><td>{project.name}</td><td>{project.company}</td><td>{project.currency}</td><td>{money(numberish(project.budget), project.currency)}</td><td>{can("projects:write") && (<div className="inline-actions"><button type="button" onClick={() => void editProject(project)}>Editar</button><button type="button" className="ghost" onClick={() => void removeProject(project)}>Eliminar</button></div>)}</td></tr>))}</tbody></table></div></article>
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
                <select value={consultantForm.role} onChange={(event) => setConsultantForm((prev) => ({ ...prev, role: event.target.value }))} required>
                  {consultantRoleOptions.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                <select value={consultantForm.rateCurrency} onChange={(event) => setConsultantForm((prev) => ({ ...prev, rateCurrency: event.target.value }))}>
                  {currencyOptions.map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
                <input type="number" placeholder={`Tarifa por hora (${consultantForm.rateCurrency})`} value={consultantForm.hourlyRate} onChange={(event) => setConsultantForm((prev) => ({ ...prev, hourlyRate: event.target.value }))} />
                <label className="check"><input type="checkbox" checked={consultantForm.active} onChange={(event) => setConsultantForm((prev) => ({ ...prev, active: event.target.checked }))} />Activo</label>
                <button type="submit">Crear consultor</button>
              </form>
            )}
          </article>
          <article className="card"><h3>Listado de consultores</h3><div className="table-wrap"><table><thead><tr><th>Nombre</th><th>Rol</th><th>Tarifa</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{consultants.map((consultant) => (<tr key={consultant.id}><td>{consultant.fullName}</td><td>{consultant.role}</td><td>{money(numberish(consultant.hourlyRate || "0"), "COP")}</td><td>{consultant.active ? "Activo" : "Inactivo"}</td><td>{can("consultants:write") && (<div className="inline-actions"><button type="button" onClick={() => void editConsultant(consultant)}>Editar</button><button type="button" onClick={() => void toggleConsultantActive(consultant)}>{consultant.active ? "Desactivar" : "Activar"}</button><button type="button" className="ghost" onClick={() => void removeConsultant(consultant)}>Eliminar</button></div>)}</td></tr>))}</tbody></table></div></article>
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
                <select value={expenseForm.category} onChange={(event) => setExpenseForm((prev) => ({ ...prev, category: event.target.value }))} required>
                  {expenseCategoryOptions.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <input type="number" step="0.01" placeholder="Valor" value={expenseForm.amount} onChange={(event) => setExpenseForm((prev) => ({ ...prev, amount: event.target.value }))} required />
                <select value={expenseForm.currency} onChange={(event) => setExpenseForm((prev) => ({ ...prev, currency: event.target.value }))} required>
                  {currencyOptions.map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
                <textarea placeholder="Descripción" value={expenseForm.description} onChange={(event) => setExpenseForm((prev) => ({ ...prev, description: event.target.value }))} />
                <button type="submit">Registrar gasto</button>
              </form>
            )}
          </article>
          <article className="card"><h3>Listado de gastos</h3><div className="table-wrap"><table><thead><tr><th>Proyecto</th><th>Categoría</th><th>Monto</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>{expenses.map((expense) => (<tr key={expense.id}><td>{expense.project.name}</td><td>{expense.category}</td><td>{money(numberish(expense.amount), expense.currency)}</td><td>{new Date(expense.expenseDate).toLocaleDateString()}</td><td>{can("expenses:write") && (<div className="inline-actions"><button type="button" onClick={() => void editExpense(expense)}>Editar</button><button type="button" className="ghost" onClick={() => void removeExpense(expense)}>Eliminar</button></div>)}</td></tr>))}</tbody></table></div></article>
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
                <input type="number" min="2020" max="2100" placeholder="Año" value={forecastForm.periodYear} onChange={(event) => setForecastForm((prev) => ({ ...prev, periodYear: event.target.value }))} required />
                <select value={forecastForm.periodQuarterStart} onChange={(event) => setForecastForm((prev) => ({ ...prev, periodQuarterStart: event.target.value }))} required>
                  {quarterOptions.map((quarter) => (
                    <option key={`start-${quarter}`} value={quarter}>{`Desde ${quarter}`}</option>
                  ))}
                </select>
                <select value={forecastForm.periodQuarterEnd} onChange={(event) => setForecastForm((prev) => ({ ...prev, periodQuarterEnd: event.target.value }))} required>
                  {quarterOptions.map((quarter) => (
                    <option key={`end-${quarter}`} value={quarter}>{`Hasta ${quarter}`}</option>
                  ))}
                </select>
                <input type="number" step="0.5" placeholder="Horas proyectadas" value={forecastForm.hoursProjected} onChange={(event) => setForecastForm((prev) => ({ ...prev, hoursProjected: event.target.value }))} required />
                <input type="number" step="0.01" placeholder="Tarifa/hora" value={forecastForm.hourlyRate} onChange={(event) => setForecastForm((prev) => ({ ...prev, hourlyRate: event.target.value }))} />
                <textarea placeholder="Nota" value={forecastForm.note} onChange={(event) => setForecastForm((prev) => ({ ...prev, note: event.target.value }))} />
                <button type="submit">Guardar proyección</button>
              </form>
            )}
          </article>
          <article className="card"><h3>Listado de proyecciones</h3><div className="table-wrap"><table><thead><tr><th>Proyecto</th><th>Consultor</th><th>Periodo</th><th>Horas</th><th>Costo</th><th>Acciones</th></tr></thead><tbody>{forecasts.map((forecast) => (<tr key={forecast.id}><td>{forecast.project.name}</td><td>{forecast.consultant.fullName}</td><td>{forecast.period}</td><td>{numberish(forecast.hoursProjected).toFixed(2)}</td><td>{money(forecast.projectedCost || 0, forecast.project.currency)}</td><td>{can("forecasts:write") && (<div className="inline-actions"><button type="button" onClick={() => void editForecast(forecast)}>Editar</button><button type="button" className="ghost" onClick={() => void removeForecast(forecast)}>Eliminar</button></div>)}</td></tr>))}</tbody></table></div></article>
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
