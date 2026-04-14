import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./infra/prisma.js";
import { runAssignmentMaintenance } from "./modules/assignments/assignments.job.js";
import { runAlertEngine } from "./modules/alerts/alerts.service.js";

async function main() {
  const app = await buildApp();

  try {
    await app.listen({
      host: "0.0.0.0",
      port: env.PORT,
    });
    app.log.info(`Backend listening on http://localhost:${env.PORT}`);

    // Ejecutar jobs de mantenimiento al iniciar
    void runAssignmentMaintenance(prisma).catch((e) => app.log.error(e, "[AssignmentJob]"));
    void runAlertEngine(prisma).catch((e) => app.log.error(e, "[AlertEngine]"));
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
