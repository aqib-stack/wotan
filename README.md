# WOTAN Insights Phase 1

Functional MVP with:
- Next.js frontend
- NestJS backend
- PostgreSQL schema via Prisma
- Dynamic Insights calculations from bet records

## Run

### 1. Start database
```bash
docker compose up -d
```

### 2. Install dependencies
```bash
npm run install:all
```

### 3. Backend setup
```bash
cd apps/backend
cp .env.example .env
npx prisma migrate dev --name init
npm run seed
npm run start:dev
```
Backend runs on `http://localhost:4000`.

### 4. Frontend setup
Open new terminal:
```bash
cd apps/frontend
cp .env.local.example .env.local
npm run dev
```
Frontend runs on `http://localhost:3000/insights`.
