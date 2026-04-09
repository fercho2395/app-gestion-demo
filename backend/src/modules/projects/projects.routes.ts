import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../infra/prisma.js";

const createProjectSchema = z.object({
  name: z.string().min(1),
  company: z.string().min(1),
  country: z.string().min(1),
  currency: z.string().min(1),
  budget: z.coerce.number().nonnegative(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export async function projectsRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
    });

    return { data: projects };
  });

  app.post("/", async (request, reply) => {
    const body = createProjectSchema.parse(request.body);

    if (body.endDate < body.startDate) {
      return reply.status(400).send({ message: "endDate cannot be before startDate" });
    }

    const project = await prisma.project.create({
      data: {
        name: body.name,
        company: body.company,
        country: body.country,
        currency: body.currency,
        budget: body.budget,
        startDate: body.startDate,
        endDate: body.endDate,
      },
    });

    return reply.status(201).send({ data: project });
  });
}
