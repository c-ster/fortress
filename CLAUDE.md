# CLAUDE.md — Fortress Project Instructions

## Project Overview

Fortress is a secure financial planning platform for U.S. military service members. It ingests financial data (LES parsing or manual entry), calculates a risk score, generates prioritized action plans, and projects financial trajectories over 40 years via Monte Carlo simulation.

**Architecture:** Client-heavy, server-light. Financial computations happen client-side. The server stores only encrypted blobs it cannot decrypt. This is the core security invariant — never violate it.

**Stack:** React + TypeScript + Vite (client), Node.js + Fastify + TypeScript (server), PostgreSQL, Zustand (state), Tailwind CSS, D3.js (simulator charts), Recharts (dashboard charts), Web Workers (simulation), Web Crypto API (encryption), PDF.js + Tesseract.js (LES OCR), Workbox (PWA/offline).

## Repository Structure

```
fortress/
├── CLAUDE.md                    # This file
├── TASKS.md                     # Task list with status tracking
├── package.json                 # Workspace root
├── packages/
│   └── types/                   # Shared TypeScript interfaces (FSM, API contracts)
│       └── src/
│           ├── financial-state.ts
│           ├── risk.ts
│           ├── actions.ts
│           ├── simulation.ts
│           └── api.ts
├── client/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── public/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── config.ts            # Environment-aware config (dev/test/prod)
│   │   ├── stores/              # Zustand stores
│   │   │   ├── financial-state.ts
│   │   │   ├── auth.ts
│   │   │   └── ui.ts
│   │   ├── engine/              # Pure computation modules
│   │   │   ├── risk-engine.ts
│   │   │   ├── action-generator.ts
│   │   │   ├── les-parser.ts
│   │   │   └── pay-tables.ts
│   │   ├── simulation/          # Simulator (runs in Web Worker)
│   │   │   ├── simulator.ts
│   │   │   ├── worker.ts
│   │   │   ├── aggregation.ts
│   │   │   ├── debt-strategies.ts
│   │   │   └── brs-match.ts
│   │   ├── crypto/              # Client-side encryption
│   │   │   └── encryption.ts
│   │   ├── components/          # React components
│   │   │   ├── auth/
│   │   │   ├── intake/
│   │   │   ├── dashboard/
│   │   │   ├── simulator/
│   │   │   ├── playbooks/
│   │   │   ├── homefront/
│   │   │   └── shared/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── utils/
│   └── tests/
│       ├── engine/
│       ├── simulation/
│       ├── crypto/
│       └── components/
├── server/
│   ├── package.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── config.ts            # Environment-aware config (dev/test/prod)
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── store.ts
│   │   │   ├── homefront.ts
│   │   │   ├── referral.ts
│   │   │   ├── blackbox.ts
│   │   │   └── tables.ts
│   │   ├── db/
│   │   │   ├── schema.ts
│   │   │   ├── migrations/
│   │   │   └── connection.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── rate-limit.ts
│   │   │   └── audit-log.ts
│   │   └── services/
│   │       ├── email.ts
│   │       ├── mfa.ts
│   │       └── pdf-generator.ts
│   └── tests/
├── data/
│   ├── pay-tables/              # Static military pay data (JSON)
│   │   ├── base-pay-2025.json
│   │   ├── bah-2025.json
│   │   ├── bas-2025.json
│   │   └── cola-2025.json
│   └── les-samples/             # Anonymized LES samples for testing
└── .github/
    └── workflows/
        └── ci.yml
```

## Critical Rules

1. **NEVER store plaintext financial data on the server.** The server receives and returns encrypted blobs only. All financial computation is client-side. This is the foundational security invariant.
2. **NEVER overwrite .env files.** Create `.env.example` with documented variables. Ask before modifying any existing `.env`.
3. **Environment awareness.** All config must support dev/test/prod via `config.ts` reading from env vars. Dev mode: console email logging, relaxed rate limits, verbose errors. Prod mode: real email, strict limits, generic errors.
4. **No mocked data outside tests.** Test files can use fixtures. Dev and prod environments use real logic with real (or user-provided) data. Never add stub/fake data patterns that could reach dev or prod.
5. **Pure functions for computation.** Risk engine, action generator, and simulator must be pure functions with zero side effects. This makes them trivially testable and guarantees they work offline.
6. **Tests ship with implementation.** Every task includes acceptance criteria with specific test cases. Write tests alongside the code, not as a separate step.
7. **Files under 300 lines.** Refactor when approaching this limit. The simulator and risk engine are already structured into multiple files for this reason.
8. **Iterate on existing patterns.** When extending the risk engine or action plan, add to the existing functions. Do not rewrite or introduce new patterns unless the existing approach is fundamentally broken.
9. **Minimize dependencies.** Before adding a new library, check if the functionality exists in the current stack or can be implemented in < 50 lines.

## Key Domain Logic

### Military Pay
- Pay cycles: 1st and 15th of month (not bi-weekly).
- Income = Base Pay (taxable) + BAH + BAS + COLA (tax-free) + Special Pay.
- BAH varies by pay grade, ZIP code, and dependency status. ~2MB lookup table.
- BRS (Blended Retirement System) match: 1% automatic + dollar-for-dollar on first 3% + $0.50/$1 on next 2% of base pay.
- SGLI max coverage: $500,000.
- SCRA: caps pre-service debt interest at 6% for active duty.

### Risk Score (0-100)
- Emergency fund (25%): liquid savings / essential monthly expenses.
- High-interest debt (20%): debts > 15% APR, scaled by balance vs. income.
- SGLI gap (15%): binary — dependents > 0 AND coverage < $500K.
- TSP match (15%): contribution % vs. 5% BRS threshold.
- DTI ratio (10%): > 40% critical (clearance risk), > 30% warning.
- SCRA opportunity (10%): pre-service debt > 6% unclaimed.
- Payday spike (5%): spending concentration days 12-14.

### Simulator
- 40-year horizon (480 monthly timesteps), 500 Monte Carlo iterations.
- Stochastic TSP returns: 7% annual mean, 15% stddev (log-normal monthly).
- Output: percentile bands (p10/p25/p50/p75/p90) at each timestep.
- Preview mode during slider drag: 50 iterations for responsiveness.

## Commands

```bash
# Development
npm run dev              # Start client + server concurrently
npm run dev:client       # Client only (Vite)
npm run dev:server       # Server only (Fastify)

# Testing
npm run test             # All tests
npm run test:client      # Client tests only
npm run test:server      # Server tests only
npm run test:types       # Type checking only

# Building
npm run build            # Production build (both)
npm run build:client     # Client production build
npm run build:server     # Server production build

# Database
npm run db:migrate       # Run pending migrations
npm run db:migrate:test  # Run migrations against test DB
npm run db:reset         # Reset dev database (drops + recreates)

# Linting
npm run lint             # ESLint + Prettier check
npm run lint:fix         # Auto-fix
```

## Environment Variables

```bash
# Server (.env)
NODE_ENV=development|test|production
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/fortress_dev
DATABASE_URL_TEST=postgresql://user:pass@localhost:5432/fortress_test
JWT_SECRET=<random-string>
JWT_REFRESH_SECRET=<random-string>
EMAIL_PROVIDER=console|sendgrid|ses
EMAIL_API_KEY=<key>           # Not needed when EMAIL_PROVIDER=console
RATE_LIMIT_AUTH=5              # Attempts per minute per IP

# Client (.env)
VITE_API_URL=http://localhost:3001
VITE_ENV=development|test|production
```
