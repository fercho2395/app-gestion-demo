import type { FastifyInstance } from "fastify";
import { healthRoutes } from "./health.routes.js";
import { projectsRoutes } from "../modules/projects/projects.routes.js";
import { consultantsRoutes } from "../modules/consultants/consultants.routes.js";
import { timeEntriesRoutes } from "../modules/time-entries/time-entries.routes.js";
import { expensesRoutes } from "../modules/expenses/expenses.routes.js";
import { forecastsRoutes } from "../modules/forecasts/forecasts.routes.js";
import { statsRoutes } from "../modules/stats/stats.routes.js";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { adminUsersRoutes } from "../modules/admin/users.routes.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(projectsRoutes, { prefix: "/api/projects" });
  await app.register(consultantsRoutes, { prefix: "/api/consultants" });
  await app.register(timeEntriesRoutes, { prefix: "/api/time-entries" });
  await app.register(expensesRoutes, { prefix: "/api/expenses" });
  await app.register(forecastsRoutes, { prefix: "/api/forecasts" });
  await app.register(statsRoutes, { prefix: "/api/stats" });
  await app.register(adminUsersRoutes, { prefix: "/api/admin/users" });
}
