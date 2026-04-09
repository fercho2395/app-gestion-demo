import { AppRole } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { env } from "../config/env.js";
import { prisma } from "../infra/prisma.js";

type MicrosoftClaims = JWTPayload & {
  oid?: string;
  preferred_username?: string;
  email?: string;
  upn?: string;
  name?: string;
};

const issuer = `https://login.microsoftonline.com/${env.AZURE_AD_TENANT_ID}/v2.0`;
const jwks = createRemoteJWKSet(
  new URL(`https://login.microsoftonline.com/${env.AZURE_AD_TENANT_ID}/discovery/v2.0/keys`),
);

function getBearerToken(request: FastifyRequest) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim();
}

async function verifyMicrosoftToken(token: string) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience: env.AZURE_AD_AUDIENCE,
  });

  return payload as MicrosoftClaims;
}

function resolveEmail(payload: MicrosoftClaims) {
  return payload.preferred_username || payload.email || payload.upn || null;
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  if (!env.AUTH_ENABLED) {
    request.authUser = {
      id: "local-admin",
      email: env.ADMIN_EMAIL.toLowerCase(),
      displayName: "Local Admin",
      roles: [AppRole.ADMIN],
    };
    return;
  }

  const token = getBearerToken(request);
  if (!token) {
    return reply.status(401).send({ message: "Missing bearer token" });
  }

  let claims: MicrosoftClaims;
  try {
    claims = await verifyMicrosoftToken(token);
  } catch {
    return reply.status(401).send({ message: "Invalid Microsoft token" });
  }

  const email = resolveEmail(claims)?.toLowerCase();
  if (!email) {
    return reply.status(401).send({ message: "Token does not include a valid email" });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    return reply.status(403).send({
      message: "Tu usuario no existe en la aplicacion. Solicita acceso a un administrador.",
    });
  }

  if (!user.active) {
    return reply.status(403).send({
      message: "Tu usuario esta inactivo. Contacta a un administrador.",
    });
  }

  const roles = user.roles.map((item) => item.role.name);
  if (roles.length === 0) {
    return reply.status(403).send({
      message: "Tu usuario no tiene roles asignados. Contacta a un administrador.",
    });
  }

  request.authUser = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles,
  };
}

export function authorize(allowedRoles: AppRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.authUser;
    if (!user) {
      return reply.status(401).send({ message: "Not authenticated" });
    }

    const hasRole = user.roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      return reply.status(403).send({ message: "Insufficient permissions" });
    }
  };
}
