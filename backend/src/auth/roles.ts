import { AppRole } from "@prisma/client";

export type Permission =
  | "projects:read"
  | "projects:write"
  | "consultants:read"
  | "consultants:write"
  | "time:read"
  | "time:write"
  | "time:review"
  | "expenses:read"
  | "expenses:write"
  | "forecasts:read"
  | "forecasts:write"
  | "revenue:read"
  | "revenue:write"
  | "fx:read"
  | "fx:write"
  | "stats:read"
  | "assignments:read"
  | "assignments:write"
  | "capacity:read"
  | "snapshots:close"
  | "alerts:read"
  | "alerts:resolve"
  | "audit:read"
  | "users:manage";

const allPermissions: Permission[] = [
  "projects:read",
  "projects:write",
  "consultants:read",
  "consultants:write",
  "time:read",
  "time:write",
  "time:review",
  "expenses:read",
  "expenses:write",
  "forecasts:read",
  "forecasts:write",
  "revenue:read",
  "revenue:write",
  "fx:read",
  "fx:write",
  "stats:read",
  "assignments:read",
  "assignments:write",
  "capacity:read",
  "snapshots:close",
  "alerts:read",
  "alerts:resolve",
  "audit:read",
  "users:manage",
];

export const rolePermissions: Record<AppRole, Permission[]> = {
  ADMIN: allPermissions,
  PM: [
    "projects:read",
    "projects:write",
    "consultants:read",
    "consultants:write",
    "time:read",
    "time:write",
    "time:review",
    "expenses:read",
    "expenses:write",
    "forecasts:read",
    "forecasts:write",
    "revenue:read",
    "revenue:write",
    "fx:read",
    "stats:read",
    "assignments:read",
    "assignments:write",
    "capacity:read",
    "alerts:read",
    "alerts:resolve",
  ],
  CONSULTANT: [
    "projects:read",
    "consultants:read",
    "time:read",
    "time:write",
    "fx:read",
    "stats:read",
    "assignments:read",
    "capacity:read",
    "alerts:read",
  ],
  FINANCE: [
    "projects:read",
    "expenses:read",
    "expenses:write",
    "forecasts:read",
    "revenue:read",
    "revenue:write",
    "fx:read",
    "fx:write",
    "stats:read",
    "assignments:read",
    "capacity:read",
    "snapshots:close",
    "alerts:read",
    "alerts:resolve",
    "audit:read",
  ],
  VIEWER: [
    "projects:read",
    "consultants:read",
    "time:read",
    "expenses:read",
    "forecasts:read",
    "revenue:read",
    "fx:read",
    "stats:read",
    "assignments:read",
    "capacity:read",
    "alerts:read",
  ],
};

export function resolvePermissions(roles: AppRole[]): Permission[] {
  const permissions = new Set<Permission>();
  for (const role of roles) {
    for (const permission of rolePermissions[role]) {
      permissions.add(permission);
    }
  }
  return Array.from(permissions);
}
