import type { FastifyInstance } from "fastify";
import { healthRoutes } from "./health.routes.js";
import { projectsRoutes } from "../modules/projects/projects.routes.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes);
  await app.register(projectsRoutes, { prefix: "/api/projects" });
}
