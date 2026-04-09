# Backend (Node.js + TypeScript)

## Stack
- Fastify
- Prisma
- PostgreSQL (Railway)

## Local quick start
1. Install dependencies:
   - `npm install`
2. Set `DATABASE_URL` in `.env` with a reachable Postgres URL
3. Generate Prisma client:
   - `npm run prisma:generate`
4. Sync schema to database:
   - `npm run prisma:push`
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

`railway:start` starts only the API process for a fast and reliable healthcheck.

If you need to apply migrations in Railway, run:
- `npm run railway:migrate`

## Notes
- The repository deploys backend from root using `railway.toml` + `Dockerfile`.
- Frontend deploy is a separate Railway service using root directory `frontend`.

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
