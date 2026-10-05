# CareNexa

CareNexa is a local CRM and business-intelligence app for a facial care clinic. The web client is React. The API is Node.js and Express. Data is stored in SQLite through Prisma.

Insights in this version are rule-based calculations. They are not a machine-learning model. SMS, email, and POS calls are simulated.

## Requirements

- Windows
- Node.js 20 LTS or newer

## Setup

From `backend`:

```powershell
copy .env.example .env
```

Edit `.env` and set `JWT_SECRET` plus the three seed passwords. Each password needs at least 10 characters, one letter, and one number.

```powershell
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run dev
```

From `frontend`, in a second terminal:

```powershell
npm install
npm run dev
```

Open http://localhost:5173. The API listens on http://localhost:4000. API docs are at http://localhost:4000/api/docs.

Seeded sign-in addresses:

- admin@carenexa.local
- manager@carenexa.local
- staff@carenexa.local

Use the passwords you placed in `.env`. Seeding replaces the local demo database.

## Tests

```powershell
cd backend
npm test
```

## Documents

The product scope is in `docs/SRS.md`, with architecture, database, API, UI, testing, and roadmap beside it.
