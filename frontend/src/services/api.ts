import { env } from "../config/env";

type ApiEnvelope<T> = { data: T };

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

let accessToken: string | null = null;

export type AppRole = "ADMIN" | "PM" | "CONSULTANT" | "FINANCE" | "VIEWER";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  roles: AppRole[];
  permissions: string[];
};

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  microsoftOid: string | null;
  active: boolean;
  roles: AppRole[];
  createdAt: string;
  updatedAt: string;
};

export type HealthResponse = {
  ok: boolean;
  service: string;
  timestamp: string;
};

export type Project = {
  id: string;
  name: string;
  company: string;
  country: string;
  currency: string;
  budget: string;
  startDate: string;
  endDate: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Consultant = {
  id: string;
  fullName: string;
  email: string | null;
  role: string;
  hourlyRate: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TimeEntryStatus = "PENDING" | "APPROVED" | "REJECTED";

export type TimeEntry = {
  id: string;
  projectId: string;
  consultantId: string;
  workDate: string;
  hours: string;
  note: string | null;
  status: TimeEntryStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionNote: string | null;
  createdAt: string;
  updatedAt: string;
  project: Project;
  consultant: Consultant;
};

export type Expense = {
  id: string;
  projectId: string;
  expenseDate: string;
  category: string;
  amount: string;
  currency: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  project: Project;
};

export type Forecast = {
  id: string;
  projectId: string;
  consultantId: string;
  period: string;
  hoursProjected: string;
  hourlyRate: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  project: Project;
  consultant: Consultant;
  projectedCost?: number;
};

export type StatsOverview = {
  projects: Array<{
    projectId: string;
    projectName: string;
    company: string;
    currency: string;
    budget: number;
    spent: number;
    remainingBudget: number;
    usedBudgetPercent: number;
    totalHours: number;
    approvedHours: number;
  }>;
  totals: {
    budget: number;
    spent: number;
    totalHours: number;
    approvedHours: number;
  };
};

function ensureApiUrl() {
  if (!env.apiUrl) {
    throw new Error("Missing VITE_API_URL in frontend build configuration");
  }

  return env.apiUrl;
}

export function setApiAccessToken(token: string | null) {
  accessToken = token;
}

async function request<T>(path: string, method: HttpMethod = "GET", body?: unknown): Promise<T> {
  const baseUrl = ensureApiUrl();

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const fallbackMessage = `Request failed with status ${response.status}`;
    let errorMessage = fallbackMessage;

    try {
      const errorBody = (await response.json()) as { message?: string };
      errorMessage = errorBody.message || fallbackMessage;
    } catch {
      errorMessage = fallbackMessage;
    }

    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export async function getMe(): Promise<AuthUser> {
  const response = await request<ApiEnvelope<AuthUser>>("/api/auth/me");
  return response.data;
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const response = await request<ApiEnvelope<AdminUser[]>>("/api/admin/users");
  return response.data;
}

export async function createAdminUser(payload: {
  email: string;
  displayName: string;
  microsoftOid?: string;
  active: boolean;
  roles: AppRole[];
}): Promise<AdminUser> {
  const response = await request<ApiEnvelope<AdminUser>>("/api/admin/users", "POST", payload);
  return response.data;
}

export async function updateAdminUser(
  id: string,
  payload: {
    displayName?: string;
    microsoftOid?: string;
    active?: boolean;
    roles?: AppRole[];
  },
): Promise<AdminUser> {
  const response = await request<ApiEnvelope<AdminUser>>(`/api/admin/users/${id}`, "PATCH", payload);
  return response.data;
}

export async function listProjects(params?: { search?: string }): Promise<Project[]> {
  const query = new URLSearchParams();
  if (params?.search) {
    query.set("search", params.search);
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await request<ApiEnvelope<Project[]>>(`/api/projects${suffix}`);
  return response.data;
}

export async function createProject(payload: {
  name: string;
  company: string;
  country: string;
  currency: string;
  budget: number;
  startDate: string;
  endDate: string;
  description?: string;
}): Promise<Project> {
  const response = await request<ApiEnvelope<Project>>("/api/projects", "POST", payload);
  return response.data;
}

export async function updateProject(
  id: string,
  payload: {
    name: string;
    company: string;
    country: string;
    currency: string;
    budget: number;
    startDate: string;
    endDate: string;
    description?: string;
  },
): Promise<Project> {
  const response = await request<ApiEnvelope<Project>>(`/api/projects/${id}`, "PUT", payload);
  return response.data;
}

export async function deleteProject(id: string): Promise<void> {
  await request<void>(`/api/projects/${id}`, "DELETE");
}

export async function listConsultants(): Promise<Consultant[]> {
  const response = await request<ApiEnvelope<Consultant[]>>("/api/consultants");
  return response.data;
}

export async function createConsultant(payload: {
  fullName: string;
  email?: string;
  role: string;
  hourlyRate?: number;
  active: boolean;
}): Promise<Consultant> {
  const response = await request<ApiEnvelope<Consultant>>("/api/consultants", "POST", payload);
  return response.data;
}

export async function updateConsultant(
  id: string,
  payload: {
    fullName: string;
    email?: string;
    role: string;
    hourlyRate?: number;
    active: boolean;
  },
): Promise<Consultant> {
  const response = await request<ApiEnvelope<Consultant>>(`/api/consultants/${id}`, "PUT", payload);
  return response.data;
}

export async function deleteConsultant(id: string): Promise<void> {
  await request<void>(`/api/consultants/${id}`, "DELETE");
}

export async function listTimeEntries(): Promise<TimeEntry[]> {
  const response = await request<ApiEnvelope<TimeEntry[]>>("/api/time-entries");
  return response.data;
}

export async function createTimeEntry(payload: {
  projectId: string;
  consultantId: string;
  workDate: string;
  hours: number;
  note?: string;
}): Promise<TimeEntry> {
  const response = await request<ApiEnvelope<TimeEntry>>("/api/time-entries", "POST", payload);
  return response.data;
}

export async function approveTimeEntry(id: string, approvedBy: string): Promise<TimeEntry> {
  const response = await request<ApiEnvelope<TimeEntry>>(`/api/time-entries/${id}/approve`, "PATCH", {
    approvedBy,
  });
  return response.data;
}

export async function rejectTimeEntry(id: string, approvedBy: string, rejectionNote: string): Promise<TimeEntry> {
  const response = await request<ApiEnvelope<TimeEntry>>(`/api/time-entries/${id}/reject`, "PATCH", {
    approvedBy,
    rejectionNote,
  });
  return response.data;
}

export async function listExpenses(): Promise<Expense[]> {
  const response = await request<ApiEnvelope<Expense[]>>("/api/expenses");
  return response.data;
}

export async function createExpense(payload: {
  projectId: string;
  expenseDate: string;
  category: string;
  amount: number;
  currency: string;
  description?: string;
}): Promise<Expense> {
  const response = await request<ApiEnvelope<Expense>>("/api/expenses", "POST", payload);
  return response.data;
}

export async function updateExpense(
  id: string,
  payload: {
    projectId: string;
    expenseDate: string;
    category: string;
    amount: number;
    currency: string;
    description?: string;
  },
): Promise<Expense> {
  const response = await request<ApiEnvelope<Expense>>(`/api/expenses/${id}`, "PUT", payload);
  return response.data;
}

export async function deleteExpense(id: string): Promise<void> {
  await request<void>(`/api/expenses/${id}`, "DELETE");
}

export async function listForecasts(): Promise<Forecast[]> {
  const response = await request<ApiEnvelope<Forecast[]>>("/api/forecasts");
  return response.data;
}

export async function createForecast(payload: {
  projectId: string;
  consultantId: string;
  period: string;
  hoursProjected: number;
  hourlyRate?: number;
  note?: string;
}): Promise<Forecast> {
  const response = await request<ApiEnvelope<Forecast>>("/api/forecasts", "POST", payload);
  return response.data;
}

export async function updateForecast(
  id: string,
  payload: {
    projectId: string;
    consultantId: string;
    period: string;
    hoursProjected: number;
    hourlyRate?: number;
    note?: string;
  },
): Promise<Forecast> {
  const response = await request<ApiEnvelope<Forecast>>(`/api/forecasts/${id}`, "PUT", payload);
  return response.data;
}

export async function deleteForecast(id: string): Promise<void> {
  await request<void>(`/api/forecasts/${id}`, "DELETE");
}

export async function getStatsOverview(): Promise<StatsOverview> {
  const response = await request<ApiEnvelope<StatsOverview>>("/api/stats/overview");
  return response.data;
}
