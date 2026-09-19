# Backend (NestJS)

Requirements: Node 18+, npm, Docker (optional)

Local development:

```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

API will run on `http://localhost:4000/api` by default.
