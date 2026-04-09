# Backend (Node.js + TypeScript)

## Stack
- Fastify
- Prisma
- PostgreSQL

## Quick start
1. Start PostgreSQL:
   - `docker compose up -d`
2. Install dependencies:
   - `npm install`
3. Generate Prisma client:
   - `npm run prisma:generate`
4. Run first migration:
   - `npm run prisma:migrate -- --name init`
5. Start API:
   - `npm run dev`

## Railway deploy (API)
1. Root directory:
   - `backend`
2. Build command:
   - `npm run build`
3. Start command:
   - `npm run railway:start`
4. Variables:
   - `NODE_ENV=production`
   - `CORS_ORIGIN=https://<frontend-domain>`
   - `DATABASE_URL=<railway-postgres-url>`

`railway:start` generates Prisma client and applies schema with `prisma db push` before starting the API.

## Railway deploy (Frontend)
1. Root directory:
   - `frontend`
2. Build command:
   - `npm run build`
3. Variable:
   - `VITE_API_URL=https://<backend-domain>`

After updating `VITE_API_URL`, redeploy frontend so Vite rebuilds with the new API URL.

## Available scripts
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:push`
- `npm run prisma:deploy`
- `npm run prisma:studio`
- `npm run railway:start`
