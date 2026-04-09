import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  const payload = () => ({
    ok: true,
    service: "app-gestion-backend",
    timestamp: new Date().toISOString(),
  });

  app.get("/", async () => {
    return payload();
  });

  app.get("/health", async () => {
    return payload();
  });
}
