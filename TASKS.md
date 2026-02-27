# TASKS.md — Fortress Engineering Task List

> Execute tasks sequentially within each section. Tasks across sections may be
> parallelized if dependencies are met. Mark completed tasks with [x].
> Reference CLAUDE.md for project rules, structure, and domain logic.

---

## Phase 0: Foundation

### 0.1 Project Scaffolding

- [x] **0.1.1 Initialize monorepo**
  - Create workspace structure per CLAUDE.md repo layout.
  - `client/`: React + TypeScript + Vite + Tailwind + Zustand.
  - `server/`: Node.js + Fastify + TypeScript.
  - `packages/types/`: shared TypeScript interfaces.
  - `.env.example` for client and server (never create `.env` directly).
  - `config.ts` in both client and server reading from env vars with dev/test/prod defaults.
  - ESLint + Prettier configured.
  - **Test:** `npm run dev` starts both. TypeScript compiles clean. Browser shows placeholder page.

- [x] **0.1.2 CI pipeline**
  - GitHub Actions: lint -> type-check -> test -> build.
  - Separate jobs for client and server.
  - Runs on push to main and on PRs.
  - **Test:** Pipeline passes on scaffolded project.
  - **Depends on:** 0.1.1

- [x] **0.1.3 Database schema — identity tier**
  - PostgreSQL `identity` schema: `users` table (id UUID, email, email_verified bool, mil_email text nullable, mil_verified bool, pay_grade text nullable, mfa_secret_encrypted bytea nullable, created_at, updated_at).
  - Migration system (Drizzle or Knex).
  - This schema holds ONLY Tier 4 (identity) data. No financial columns.
  - **Test:** Migrations run in dev and test. Insert/read user works.
  - **Depends on:** 0.1.1

- [x] **0.1.4 Database schema — encrypted financial tier**
  - Separate `financial` schema: `encrypted_snapshots` table (id UUID, user_id FK to identity.users, ciphertext bytea, iv bytea, auth_tag bytea, salt bytea, iterations int, schema_version int, created_at, updated_at).
  - Server code for this table is pure pass-through — no decryption, no plaintext columns.
  - **Test:** CRUD on encrypted_snapshots works. Verify no plaintext financial columns exist anywhere in DB schema.
  - **Depends on:** 0.1.3

---

### 0.2 Authentication

- [x] **0.2.1 Email + password auth**
  - Routes: `POST /auth/register`, `POST /auth/login`, `POST /auth/session` (refresh).
  - Password: Argon2 hashing.
  - JWT: short-lived access token (15 min) + httpOnly refresh cookie (7 days).
  - Rate limit: configurable per env (default 5 attempts/min/IP on auth routes).
  - **Files:** `server/src/routes/auth.ts`, `server/src/middleware/rate-limit.ts`, `server/src/middleware/auth.ts`
  - **Test:** Register -> login -> receive tokens. Bad credentials -> 401. Rate limit triggers. Refresh token works.
  - **Depends on:** 0.1.3

- [x] **0.2.2 .mil email verification**
  - Routes: `POST /auth/verify-email`, `POST /auth/verify-code`.
  - 6-digit code, 10-minute expiry, max 3 attempts.
  - Email transport: configurable. `console` provider for dev (logs code to stdout). Real provider for prod.
  - Sets `mil_verified = true` on user.
  - **Files:** `server/src/services/email.ts`, extend `server/src/routes/auth.ts`
  - **Test:** Full flow. Expired code rejected. Wrong code rejected. Max attempts enforced. Dev mode logs to console.
  - **Depends on:** 0.2.1

- [x] **0.2.3 TOTP MFA**
  - Routes: `POST /auth/mfa/setup` (returns secret + QR URI), `POST /auth/mfa/verify`.
  - Library: `otpauth` (RFC 6238 TOTP).
  - MFA secret encrypted at rest in users table.
  - MFA required for all data-write operations when enabled.
  - **Files:** `server/src/services/mfa.ts`, extend `server/src/routes/auth.ts`
  - **Test:** Setup -> verify with valid token. Invalid token rejected. MFA enforcement on protected routes.
  - **Depends on:** 0.2.1

- [x] **0.2.4 Auth UI**
  - Pages: Register, Login, .mil Verification, MFA Setup.
  - Zustand auth store: user state, tokens (in memory, not localStorage), auth status.
  - `ProtectedRoute` wrapper component.
  - JWT refresh via httpOnly cookie on page load.
  - **Files:** `client/src/stores/auth.ts`, `client/src/components/auth/`, `client/src/pages/`
  - **Test:** Full flow in browser. Unauthenticated -> redirect to login. Session survives page refresh.
  - **Depends on:** 0.2.1, 0.2.2, 0.2.3

---

### 0.3 Financial State Model & Data Entry

- [x] **0.3.1 FSM types and Zustand store**
  - All interfaces from spec in `packages/types/src/financial-state.ts`: `FinancialState`, `Debt`, `Allotment`, `PayGrade`.
  - Zustand store in `client/src/stores/financial-state.ts` with full FSM shape.
  - Computed fields as derived selectors:
    - `totalGross = basePay + bah + bas + cola + specialPay + otherIncome`
    - `totalTaxable = basePay + specialPay + otherIncome`
    - `totalNonTaxable = bah + bas + cola`
    - `totalEssential = housing + utilities + transportation + food + childcare + insurance`
    - `totalMonthly = totalEssential + subscriptions + discretionary`
    - `totalLiquid = checkingBalance + savingsBalance`
    - `emergencyFundMonths = totalLiquid / totalEssential`
    - `debtToIncomeRatio = sum(debt.monthlyPayment) / totalGross`
    - `tspContributionPct = (tspTraditional + tspRoth) / basePay`
    - `sgliAdequate = dependents === 0 || sgliCoverage >= 500000`
    - `tspMatchCaptured = retirementSystem !== 'brs' || tspContributionPct >= 0.05`
    - `highInterestDebtTotal = sum(debts.filter(d => d.apr > 15).map(d => d.balance))`
    - `scaEligible = debts.some(d => d.preService && d.apr > 6)`
    - `completeness = populatedFieldCount / totalFieldCount`
  - **Files:** `packages/types/src/financial-state.ts`, `client/src/stores/financial-state.ts`
  - **Test:** 100% unit test coverage on computed fields. Setting basePay recalculates totalGross. Setting debts recalculates DTI. Completeness reflects actual populated fields.
  - **Depends on:** 0.1.1

- [x] **0.3.2 Military pay data tables**
  - JSON files in `data/pay-tables/`:
    - `base-pay-2025.json`: PayGrade -> YearsOfService -> monthly amount.
    - `bas-2025.json`: { enlisted: number, officer: number }.
    - `bah-2025-stub.json`: 20-30 representative ZIP codes for Phase 0.
  - Utility functions in `client/src/utils/pay-tables.ts`:
    - `lookupBasePay(grade: PayGrade, yos: number): number`
    - `lookupBAH(zip: string, withDependents: boolean): number | null`
    - `lookupBAS(grade: PayGrade): number`
  - **Test:** Spot-check values against published DFAS tables. E3/2 YOS, E5/8 YOS, O3/6 YOS. BAH returns null for unstubbed ZIPs.
  - **Depends on:** 0.1.1

- [x] **0.3.3 Guided manual entry (7-step intake wizard)**
  - Multi-step wizard component in `client/src/components/intake/`.
  - 7 steps: Military Info, Income (auto-fill from pay tables), Deductions, Expenses, Debts (dynamic list), Assets, Review & Save.
  - Each answer writes to FSM store immediately.
  - Running completeness indicator.
  - Input validation: no negatives, APR 0-100, pay grade from valid enum, YOS 0-40.
  - **Files:** `client/src/components/intake/`, `client/src/components/shared/`, `client/src/hooks/useIntakeWizard.ts`
  - **Test:** Full completion yields completeness >= 0.8. Auto-filled base pay matches pay table. Validation rejects invalid inputs.
  - **Depends on:** 0.3.1, 0.3.2

- [x] **0.3.4 Client-side encryption module**
  - Web Crypto API: AES-256-GCM.
  - Key derivation: PBKDF2-SHA256 from passphrase, 600,000 iterations, random 32-byte salt.
  - `encrypt(plaintext, passphrase): Promise<EncryptedPayload>`
  - `decrypt(payload, passphrase): Promise<string>`
  - `encryptState(state, passphrase)`, `decryptAndHydrate(payload, passphrase)`, `encryptCurrentState(passphrase)`
  - `EncryptedPayload` type in `packages/types/src/api.ts`: { ciphertext, iv, authTag, salt, iterations, schemaVersion }.
  - **Files:** `client/src/crypto/crypto.ts`, `client/src/crypto/state-crypto.ts`, `client/src/crypto/api.ts`, `client/src/crypto/index.ts`
  - **Test:** Round-trip: encrypt -> decrypt === original. Different passphrases -> different ciphertext. Tampered ciphertext -> decryption throws. Performance: < 50ms for typical state.
  - **Depends on:** 0.3.1

- [x] **0.3.5 Encrypted snapshot sync**
  - Client: after FSM changes, debounce 5 seconds -> encrypt -> `PUT /store/snapshot`.
  - Server routes: `PUT /store/snapshot`, `GET /store/snapshot`, `DELETE /store/snapshot`.
  - Server stores encrypted blob — no decryption, no inspection.
  - On app load: `GET /store/snapshot` -> decrypt -> hydrate FSM store.
  - **Files:** extend `client/src/stores/financial-state.ts` (sync logic), `server/src/routes/store.ts`
  - **Test:** Modify FSM -> wait 5s -> snapshot appears in DB. Reload app -> state restored. Delete -> state gone. Verify network payloads contain only encrypted data (no plaintext).
  - **Depends on:** 0.1.4, 0.3.4, 0.2.1

- [x] **0.3.6 Full BAH table (lazy-loaded)**
  - Server route: `GET /tables/bah/:year` returns full BAH JSON (~400KB gzipped).
  - `GET /tables/version` returns hash/version for cache invalidation.
  - Client: lazy-load after app shell interactive. Store in IndexedDB. Version-check on app start.
  - Update `lookupBAH` to use full table when available, stub when not.
  - **Files:** `server/src/routes/tables.ts`, extend `client/src/engine/pay-tables.ts`
  - **Test:** BAH lookup works for any valid ZIP. Table loads without blocking UI. IndexedDB cache works. Offline lookup succeeds after first load.
  - **Depends on:** 0.3.2

---

### 0.4 Risk Engine (MVP)

- [x] **0.4.1 Risk engine — 3 rules**
  - Pure function in `client/src/engine/risk-engine.ts`:
    `calculateRiskScore(state: FinancialState): RiskAssessment`
  - Types in `packages/types/src/risk.ts`: `RiskAssessment`, `RiskFinding`, `RiskCategory`.
  - Phase 0 rules:
    1. **Emergency fund** (25% weight): `emergencyFundMonths`. <1 = critical (up to 25 pts deducted), 1-3 = warning (proportional).
    2. **High-interest debt** (20% weight): debts > 15% APR. Points scaled by total balance relative to 2x monthly income.
    3. **SGLI gap** (15% weight): dependents > 0 AND sgliCoverage < 500,000 -> 15 pts deducted (binary).
  - Remaining 40% weight: not scored yet. Scale score: `max(0, 100 - totalDeducted)` where `totalDeducted` can be up to 60 in Phase 0.
  - Each finding includes: id, category, severity, title, description (with specific numbers from FSM), impact (with dollar amounts), actionId, pointsDeducted, weight.
  - Findings sorted by pointsDeducted descending.
  - Tier: >=80 green, 50-79 yellow, <50 red.
  - `dataQuality` = FSM `completeness`.
  - Partial data: if completeness < 0.2, return score with findings but flag `dataQuality`. Engine evaluates whatever categories have data, skips those without.
  - **Files:** `client/src/engine/risk-engine.ts`, `packages/types/src/risk.ts`
  - **Test:**
    - E3, $200 savings, 2 dependents, $100K SGLI, $5K CC at 22% -> red, findings for all 3 categories.
    - O4, $30K savings, 3 dependents, $500K SGLI, no debt -> green.
    - Partial data (only savings + income) -> score generated for emergency fund only, other categories skipped.
    - Zero income -> handles gracefully (no division by zero).
    - No debts at all -> high-interest debt rule scores 0 deducted.
  - **Depends on:** 0.3.1

- [x] **0.4.2 Risk score UI**
  - Dashboard page: `client/src/pages/Dashboard.tsx`.
  - Large risk score number + tier color ring/badge.
  - Findings list: cards with title, description, impact, severity badge.
  - Data quality banner: if < 0.5, show "Preliminary — add more data for accuracy" with link to guided entry.
  - **Files:** `client/src/pages/Dashboard.tsx`, `client/src/components/dashboard/RiskScore.tsx`, `client/src/components/dashboard/FindingCard.tsx`
  - **Test:** Renders correctly for red/yellow/green states. Data quality banner appears/hides correctly. Mobile responsive (375px).
  - **Depends on:** 0.4.1, 0.3.3

---

### 0.5 Action Plan (MVP)

- [x] **0.5.1 Action generator — immediate tier**
  - Pure function in `client/src/engine/action-generator.ts`:
    `generateActionPlan(state: FinancialState, risk: RiskAssessment): ActionPlan`
  - Types in `packages/types/src/actions.ts`: `ActionPlan`, `Action`.
  - Phase 0: `immediate` tier only (7-day, easy). Max 3 actions.
  - Each action maps to a risk finding. Includes:
    - `title`: verb + object ("Set up savings allotment on myPay")
    - `description`: full instruction
    - `mechanism`: specific path ("myPay > Allotments > Add New > Savings")
    - `amount`: calculated from FSM (e.g., min($gap/6 rounded to $50, 10% gross))
    - `deadline`: "Before [next 1st or 15th]"
    - `estimatedImpact`: "Builds $X in emergency savings by [month]"
    - `difficulty`: 'easy'
    - `estimatedMinutes`: number
    - `status`: 'pending'
  - Action generators per risk category:
    - `emergency_fund` -> savings allotment action
    - `high_interest_debt` -> SCRA invocation (if eligible) or debt payoff priority action
    - `sgli_coverage` -> SGLI increase action
  - Disclaimer string constant: "Fortress provides financial planning tools, not financial advice. Consult your installation PFC or a licensed financial advisor for personalized guidance."
  - **Files:** `client/src/engine/action-generator.ts`, `packages/types/src/actions.ts`
  - **Test:**
    - Red risk with all 3 findings -> 3 actions, one per finding.
    - Green risk with no findings -> empty action plan.
    - Allotment amount respects 10% gross cap.
    - Deadline references next actual payday (1st or 15th).
    - All actions have non-empty mechanism field with specific steps.
  - **Depends on:** 0.4.1

- [x] **0.5.2 Action plan UI with status tracking**
  - Section on dashboard below risk score.
  - Action cards: title, description, mechanism, amount, deadline, impact, difficulty badge, time estimate.
  - Status buttons per action: "Done" / "Skip" / "Later".
  - Completed actions: visual distinction (muted, moved to bottom or collapsed section).
  - Status persists to FSM -> encrypted sync.
  - Disclaimer footer always visible.
  - **Files:** `client/src/components/dashboard/ActionPlan.tsx`, `client/src/components/dashboard/ActionCard.tsx`
  - **Test:** Actions render with all fields. Status changes persist across page reload. Disclaimer visible.
  - **Depends on:** 0.5.1, 0.3.5

---

## Phase 1: Core Product

### 1.1 LES OCR Parsing

- [x] **1.1.1 PDF.js + Tesseract.js in Web Worker**
  - Web Worker: loads PDF.js, renders page to canvas at 300 DPI, runs Tesseract.js WASM OCR.
  - Main thread API: `parseLES(file: File): Promise<LESParseResult>`.
  - PDF binary stays in Worker memory — never posted back to main thread, never persisted.
  - Progress callback for UI (PDF loading -> rendering -> OCR -> extraction).
  - **Files:** `client/src/engine/les-parser.ts` (main thread API), `client/src/engine/les-worker.ts` (Web Worker)
  - **Test:** Given sample LES PDF -> returns raw OCR text. Worker doesn't block UI. PDF data absent from main thread memory after parse. < 15s on sample PDF.
  - **Depends on:** 0.1.1

- [x] **1.1.2 Field extraction templates**
  - Template registry: `LESFieldTemplate[]` with regex patterns per field.
  - Fields: basePay, bah, bas, cola, allotments, tspContribution, sgli, federalTax, stateTax, fica.
  - Multiple regex variants per field for format differences.
  - Confidence scoring: pattern match quality x validation range check.
  - Validation ranges: basePay $1K-$25K, BAH $0-$5K, etc.
  - **Files:** extend `client/src/engine/les-parser.ts`
  - **Test:** Correct extraction from at least 2 different LES text formats. Confidence scores reflect quality. Out-of-range values get low confidence.
  - **Depends on:** 1.1.1

- [x] **1.1.3 LES upload UI with confirmation**
  - Drag-and-drop upload zone (click-to-select fallback).
  - Progress indicator during OCR.
  - Confirmation screen: form with extracted values. Per-field confidence badge (green >=90%, yellow 70-89%, red <70%). User can edit any field.
  - "Confirm" writes to FSM.
  - Error handling: corrupted PDF -> message + redirect to manual entry. Password-protected -> message.
  - **Files:** `client/src/components/intake/LESUpload.tsx`, `client/src/components/intake/LESConfirmation.tsx`
  - **Test:** Full upload -> confirm flow. Low-confidence fields highlighted. Edits persist. Error states handled gracefully.
  - **Depends on:** 1.1.2, 0.3.1

- [x] **1.1.4 Hybrid data source tracking**
  - FSM `meta.dataSource` updates to `'hybrid'` when both OCR and manual data present.
  - Per-field confidence tracks source (ocr vs manual).
  - Conflict resolution: if OCR value differs from existing manual value, prompt user to choose.
  - **Files:** extend `client/src/stores/financial-state.ts`
  - **Test:** Upload LES after manual entry -> hybrid mode. Conflicting values prompt resolution.
  - **Depends on:** 1.1.3, 0.3.3

---

### 1.2 Full Risk Engine

- [ ] **1.2.1 Extend risk engine to 7 rules**
  - ADD to existing `calculateRiskScore` in `client/src/engine/risk-engine.ts`. Do NOT rewrite.
  - New rules:
    4. **TSP match** (15%): `tspContributionPct` vs 0.05. Points = `15 * (0.05 - pct) / 0.05`. Calculate annual match dollars lost. Include 20-year compounded estimate in impact string.
    5. **DTI** (10%): >0.40 critical (10 pts), 0.30-0.40 warning (proportional). Mention security clearance relevance in description.
    6. **SCRA opportunity** (10%): for each pre-service debt >6%: calculate `balance * (apr - 0.06) / 12` monthly savings. Points scaled by total savings (cap at $200/month = full points).
    7. **Payday spike** (5%): if `paydaySpikeSeverity > 0.5`, deduct proportionally. (Note: Phase 1 may not have expense timing data yet — score 0 if data unavailable.)
  - Update scoring: remove Phase 0 scaling. Score is now `max(0, 100 - totalDeducted)` across all 100 points.
  - **Files:** extend `client/src/engine/risk-engine.ts`
  - **Test:** All existing tests still pass (no regressions). New tests:
    - BRS user at 2% TSP -> TSP finding with dollar amount lost.
    - DTI at 45% -> critical finding mentioning clearance.
    - Pre-service auto loan at 18% -> SCRA finding with monthly/annual savings.
    - Missing expense timing -> payday spike scores 0 (not error).
  - **Depends on:** 0.4.1

---

### 1.3 Full Action Plan

- [ ] **1.3.1 Extend action plan to 30/90-day tiers**
  - ADD stabilization (30-day, medium) and compounding (90-day, hard) tiers to existing generator.
  - New generators:
    - `tsp_match` -> "Increase TSP contribution to 5% via myPay" (easy/immediate if small gap, medium if large gap)
    - `scra_opportunity` -> "Request SCRA rate reduction from [lender]" (medium — requires letter/phone call)
    - `debt_to_income` -> "Prioritize debt payoff using [strategy]" (medium/hard depending on complexity)
    - `high_interest_debt` (extended) -> "Contact NMCRS/AFAS for debt consolidation" (medium)
  - Sort by risk finding pointsDeducted descending. Max 3 per tier.
  - **Files:** extend `client/src/engine/action-generator.ts`
  - **Test:** Full risk assessment -> actions in all 3 tiers. Priority order correct. Existing tests pass.
  - **Depends on:** 0.5.1, 1.2.1

---

### 1.4 Financial Path Simulator

- [ ] **1.4.1 Simulation core in Web Worker**
  - Types in `packages/types/src/simulation.ts`: `SimulationScenario`, `MonthlySnapshot`, `SimulationResult`, `PercentileBand`, `MilestoneEstimate`.
  - Core loop in `client/src/simulation/simulator.ts`.
  - Web Worker wrapper in `client/src/simulation/worker.ts`.
  - Main thread API: `runProjection(state, scenario): Promise<SimulationResult>`.
  - **Files:** `client/src/simulation/simulator.ts`, `client/src/simulation/worker.ts`, `client/src/simulation/brs-match.ts`, `client/src/simulation/debt-strategies.ts`, `packages/types/src/simulation.ts`
  - **Test:** 500 iter / 480 months completes < 5s. Higher TSP % -> better median TSP at all horizons.
  - **Depends on:** 0.3.1

- [ ] **1.4.2 Debt payoff strategies**
  - **Depends on:** 1.4.1

- [ ] **1.4.3 Percentile aggregation & milestones**
  - **Depends on:** 1.4.1

- [ ] **1.4.4 Comparison engine**
  - **Depends on:** 1.4.3

- [ ] **1.4.5 Simulator chart (D3.js)**
  - **Depends on:** 1.4.4

- [ ] **1.4.6 Simulator controls & UX**
  - **Depends on:** 1.4.5, 1.3.1

---

### 1.5 Behavioral Check-Ins

- [ ] **1.5.1 Check-in scheduling & data model**
  - **Depends on:** 0.5.2

- [ ] **1.5.2 Check-in UI**
  - **Depends on:** 1.5.1

---

### 1.6 Dashboard

- [ ] **1.6.1 Unified dashboard layout**
  - **Depends on:** 0.4.2, 0.5.2, 1.5.2

---

## Phase 2: Military Life Events

### 2.1 PCS Playbook
- [ ] **2.1.1 PCS calculator** — Depends on: 0.3.6, 0.4.1
- [ ] **2.1.2 PCS UI (3-phase)** — Depends on: 2.1.1, 1.4.6

### 2.2 Deployment Playbook
- [ ] **2.2.1 Deployment preparation module** — Depends on: 0.3.1
- [ ] **2.2.2 Deployment UI** — Depends on: 2.2.1

### 2.3 Homefront Link
- [ ] **2.3.1 Homefront server endpoints** — Depends on: 0.2.1
- [ ] **2.3.2 Spouse access UI** — Depends on: 2.3.1, 1.6.1

### 2.4 Counselor Referral
- [ ] **2.4.1 Summary PDF generator** — Depends on: 0.4.1, 0.5.1
- [ ] **2.4.2 Referral email** — Depends on: 2.4.1

---

## Phase 3: Hardening & Scale

### 3.1 Remaining Playbooks
- [ ] **3.1.1 Transition playbook** — Depends on: 1.4.1, 0.3.1
- [ ] **3.1.2 New child playbook** — Depends on: 0.3.1, 0.3.6

### 3.2 Black Box
- [ ] **3.2.1 Black Box encryption & endpoints** — Depends on: 0.3.4
- [ ] **3.2.2 Black Box UI** — Depends on: 3.2.1

### 3.3 Security Hardening
- [ ] **3.3.1 Device fingerprinting** — Depends on: 0.2.3
- [ ] **3.3.2 Session hardening** — Depends on: 0.2.1
- [ ] **3.3.3 Immutable audit logging** — Depends on: 0.1.3

### 3.4 Performance & Reliability
- [ ] **3.4.1 PWA service worker** — Depends on: 0.3.5, 0.3.6
- [ ] **3.4.2 Load testing** — Depends on: all server tasks
- [ ] **3.4.3 Accessibility audit** — Depends on: all UI tasks
