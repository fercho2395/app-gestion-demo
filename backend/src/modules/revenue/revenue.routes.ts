import { AppRole } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, authorize } from "../../auth/guard.js";
import { prisma } from "../../infra/prisma.js";

const revenuePayloadSchema = z.object({
  projectId: z.string().min(1),
  entryDate: z.coerce.date(),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().toUpperCase().length(3),
  description: z.string().trim().optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });
const projectIdParamsSchema = z.object({ projectId: z.string().min(1) });

export async function revenueRoutes(app: FastifyInstance) {
  // GET /api/revenue?projectId=... — listado por proyecto
  app.get(
    "/",
    {
      preHandler: [
        authenticate,
        authorize([AppRole.ADMIN, AppRole.PM, AppRole.FINANCE, AppRole.VIEWER]),
      ],
    },
    async (request) => {
      const { projectId } = projectIdParamsSchema.partial().parse(request.query);

      const entries = await prisma.revenueEntry.findMany({
        where: projectId ? { projectId } : undefined,
        include: { project: { select: { id: true, name: true, currency: true } } },
        orderBy: { entryDate: "desc" },
      });

      return { data: entries };
    },
  );

  // POST /api/revenue — registrar ingreso
  app.post(
    "/",
    {
      preHandler: [authenticate, authorize([AppRole.ADMIN, AppRole.PM, AppRole.FINANCE])],
    },
    async (request, reply) => {
      const payload = revenuePayloadSchema.parse(request.body);

      const project = await prisma.project.findUnique({ where: { id: payload.projectId } });
      if (!project) {
        return reply.status(400).send({ message: "Proyecto no encontrado" });
      }

      const entry = await prisma.revenueEntry.create({ data: payload });
      return reply.status(201).send({ data: entry });
    },
  );

  // PUT /api/revenue/:id — editar ingreso
  app.put(
    "/:id",
    {
      preHandler: [authenticate, authorize([AppRole.ADMIN, AppRole.PM, AppRole.FINANCE])],
    },
    async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params);
      const payload = revenuePayloadSchema.parse(request.body);

      const existing = await prisma.revenueEntry.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ message: "Ingreso no encontrado" });
      }

      const entry = await prisma.revenueEntry.update({ where: { id }, data: payload });
      return { data: entry };
    },
  );

  // DELETE /api/revenue/:id — eliminar ingreso
  app.delete(
    "/:id",
    {
      preHandler: [authenticate, authorize([AppRole.ADMIN, AppRole.PM, AppRole.FINANCE])],
    },
    async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params);

      const existing = await prisma.revenueEntry.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ message: "Ingreso no encontrado" });
      }

      await prisma.revenueEntry.delete({ where: { id } });
      return reply.status(204).send();
    },
  );
}
