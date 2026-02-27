# Fortress — Master Specification

**Project Codename:** Fortress
**Version:** 3.0 — Unified PRD + Technical Architecture
**Classification:** Internal — Distribution Limited
**Last Updated:** February 2026

---

## Part I: Product Requirements

### 1. Mission

Deliver a secure, capital-efficient, behaviorally intelligent financial planning web platform that enables U.S. service members and their families to reach an actionable "80% financial readiness solution" in under 30 minutes — and materially reduce financial stress that degrades mission readiness.

We are not building a budgeting app.
**We are building a financial stability moat for the American warfighter.**

---

### 2. Strategic Thesis

*"Risk comes from not knowing what you're doing." — Buffett*

The military ecosystem already provides educational tools (FINRED, Sen$e), counselors (PFC, Military OneSource), relief societies, and compensation structures. But it does **not** provide integrated decision sequencing, risk detection, personalized action prioritization, secure data continuity across life events, or a fast path to "good enough" financial clarity.

This gap creates stress, which leads to distraction and degraded readiness. **Fortress will convert knowledge into execution.**

#### 2.1 The Moat — Why This Endures

**Structural Moat (Hard to Replicate):**
- **Military-native data model.** LES parsing, BAH/BAS/COLA logic, SCRA/MLA rule engines, TSP match calculations, and PCS financial modeling are domain-specific IP.
- **OPSEC-grade security posture.** Zero-trust architecture and deployment anonymization are preconditions for operating in this ecosystem.
- **Counselor network integration.** Once Fortress becomes the referral pathway for PFCs and relief societies, it creates a two-sided network effect.

**Behavioral Moat (Hard to Displace):**
- **Habit formation through the 1st/15th cycle.** Micro check-ins anchored to military paydays.
- **Life event lock-in.** Every PCS, deployment, or new child that runs through a Fortress playbook creates switching costs.
- **Spousal continuity.** The Homefront Link and Black Box mean Fortress is the *household's* operating system.

#### 2.2 Margin of Safety

| Assumption | Optimistic | Pessimistic | Margin of Safety |
|---|---|---|---|
| LES OCR accuracy | 95%+ | 70%, manual correction needed | Guided manual entry always available as parallel path |
| User completes full intake | 70% completion | 40% completion | Risk engine produces useful score from 5 core inputs |
| Users execute actions | 60% execute 2+ in 30 days | 25% execute 1 | Single action (SCRA, SGLI) delivers hundreds in annual value |
| .mil email verification | Frictionless for active duty | Some users lack .mil access | Standard email + MFA as fallback |
| Counselor adoption | PFCs actively use Fortress | Counselors ignore it | Product must be fully valuable standalone |

---

### 3. Design Principles

1. **Security Is Safety (OPSEC First).** Financial data is treated as classified intelligence. Data minimization, adversary assumption, client-side preference.
2. **Simplicity Compounds.** Every feature must pass the "Would this still matter in 10 years?" test.
3. **Military-Specific Optimization.** Native understanding of DoD pay cycles (1st/15th), SCRA/MLA, BAH/BAS/COLA, TSP/BRS.
4. **Graceful Degradation.** Every feature defines behavior under partial data, poor connectivity, and user abandonment.

---

### 4. Target Users

**Primary:**
- Active duty E1-E5 (junior warfighter): first real paycheck, limited financial literacy. *Must be usable with zero financial vocabulary.*
- Active duty E6-E9 / O1-O5 (mid-career): complex finances, needs mathematical rigor.
- Guard/Reserve: irregular military income layered on civilian employment.
- Dual-military households: two LES inputs, combined TSP optimization.

**Secondary:**
- Spouses (via Homefront Link)
- Transitioning service members (6-12 months from ETS/retirement)
- Financial counselors (PFC, MFLC, relief society staff) — integration partners, not intake users.

**Anti-Personas (who we do NOT build for):**
- High-net-worth officers managing investment portfolios
- Retirees with no active duty connection
- Financial advisors seeking client acquisition
- Users seeking investment advice or stock picks

---

### 5. Problem Definition

#### 5.1 Quantified Cost

- ~1/3 of enlisted report difficulty covering monthly expenses; higher among E1-E4
- Payday lenders cluster near installations; SCRA/MLA protections dramatically underutilized
- Average PCS out-of-pocket cost runs thousands above reimbursement
- Meaningful percentage of SM with dependents carry below-max SGLI
- Junior enlisted TSP contribution rates frequently sit at BRS default minimum

**Unit economics of intervention:** One SCRA invocation on an 18% auto loan saves thousands over the loan term. One TSP match capture compounded over 20 years reaches six figures.

#### 5.2 Why Previous Attempts Failed

- Education-only tools assume the bottleneck is knowledge. It's *execution friction*.
- Civilian fintech doesn't understand military pay; Plaid often fails with DFAS.
- Command financial readiness programs generate awareness, not behavior change.
- One-on-one counseling is effective but doesn't scale.

Fortress is the *connective tissue* — converts awareness into action and routes complex cases to human expertise.

---

### 6. Core Product Modules

#### 6.1 Secure Identity & Access Control
- Tiered auth: biometric/FaceID for view-only, mandatory MFA for data entry.
- .mil email verification as primary trust signal (Phase 0/1). CAC/DoD SSO deferred to Phase 3 conditional on adoption.
- Zero-trust: device fingerprinting, session timeouts, encrypted local cache.
- Degraded mode: read-only cached plan from encrypted local storage if MFA unavailable.

#### 6.2 Financial Data Ingestion (LES First)
- **Primary:** Drag-and-drop LES PDF upload -> client-side OCR -> parsed fields (PDF never leaves device).
- **Secondary:** Guided manual entry via conversational Q&A (equally polished, not a fallback).
- **Data controls:** Compartmentalized storage, user-controlled deletion.
- **Minimum viable intake:** 5 questions (pay grade, dependents, savings, high-interest debt, TSP%) -> preliminary risk score.

**LES parsing accuracy targets:**

| Field | Required Accuracy | Fallback |
|---|---|---|
| Base Pay | 99%+ | Manual confirmation |
| BAH/BAS/COLA | 95%+ | Manual entry with rank/location lookup |
| Allotments | 90%+ | List for user verification |
| TSP Contribution % | 95%+ | Manual entry |
| SGLI Deduction | 95%+ | Binary yes/no with amount confirmation |
| Leave Balance | 85%+ | Informational only |

**Intentionally NOT ingested:** SSNs, unit designations, security clearance info, deployment orders.

#### 6.3 Risk & Opportunity Intelligence Engine

Rules-based system with transparent scoring. Every point deducted maps to a specific, actionable finding.

| Risk Category | Weight | Detection Logic |
|---|---|---|
| Emergency savings < 1 month | 25% | Liquid savings / essential monthly expenses |
| High-interest debt (>15% APR) | 20% | Count and total above threshold |
| SGLI under-coverage with dependents | 15% | Binary: dependents > 0 AND SGLI < max |
| TSP below match threshold | 15% | Contribution rate vs. 5% BRS match |
| DTI ratio > 40% | 10% | Monthly debt payments / gross income |
| SCRA opportunity unclaimed | 10% | Pre-service debt > 6% AND active duty |
| Payday spending spike | 5% | Outflow concentration days 12-14 |

**Score tiers:** >=80 Green (mission-ready), 50-79 Yellow (stable but exposed), <50 Red (risk).

#### 6.4 80% Action Plan Generator

Every action includes: specific action (verb + object), specific amount, specific mechanism (e.g., "myPay > Allotments"), specific deadline, estimated impact, difficulty rating (easy/medium/hard).

- **Immediate (7 days):** e.g., "Set up $150 allotment on myPay effective 1 June."
- **Stabilization (30 days):** e.g., "Refinance 18% card via NMCRS."
- **Compounding (90 days):** e.g., "Increase TSP Roth by 2% to capture full match."

**Standing disclaimer on all plans:** *"Fortress provides financial planning tools, not financial advice. Consult your installation PFC or a licensed financial advisor for personalized guidance."*

#### 6.5 Financial Path Simulator (What-If Engine)

40-year projection with Monte Carlo range bands (~500 iterations). Client-side only.

**Controllable variables:** TSP contribution rate, monthly savings allotment, debt payoff strategy (min/avalanche/snowball), extra debt payment, housing choice, lifestyle adjustment.

**NOT modeled:** Market predictions, promotion timelines, inflation, tax implications beyond standard deductions.

**Visualization:** Ranges not point estimates, side-by-side current vs. adjusted path, zoom controls (1/5/10/40-year), milestone markers, plain-language summary. Intentional 2-3 second pacing UX. No gamification.

**"Make this my plan" button** converts selected scenario into updated action items.

#### 6.6 Military Life Event Playbooks

- **PCS Module:** 3-phase (pre-move 90-60 days, execution 60-0, settlement 0-60 after). BAH delta, OOP costs, DITY vs TMO.
- **Deployment Module:** Spousal income buffer, auto-bill audit.
- **Transition Module:** 12-month runway, GI Bill optimization, health insurance bridge.
- **New Child Module:** Cost forecast, childcare modeling, tax implications.

Playbooks are *overlays* on the base plan — modify action plan and risk score for a defined window, then retire.

#### 6.7 Spouse/Partner Bridge (Homefront Link)

Service member generates link -> spouse gets view/edit access without DoD credentials.

| Permission Level | View Plan | Edit Data | Execute Actions | Share Access |
|---|---|---|---|---|
| Owner (SM) | Y | Y | Y | Y |
| Spouse (Homefront) | Y | Y | Y (configurable) | N |
| Counselor (Referral) | Summary only | N | N | N |
| Emergency Contact (Black Box) | Emergency sheet only | N | N | N |

#### 6.8 Black Box (Digital Will & Continuity)

Encrypted emergency financial sheet (account locations, SGLI policy numbers, bill due dates). Accessible only by designated next-of-kin via separate secure key. Contains financial logistics only — no balances, no credentials. Cannot be updated remotely during deployment. Auto-expires after deployment window.

#### 6.9 Behavioral Reinforcement System

- Check-ins arrive on 2nd and 16th (day after payday). Two-question maximum.
- Progress visualization shows trajectory: "Your emergency fund is at $900. At current rate, you hit $2,000 by August."
- No badges, no points, no leaderboards.

#### 6.10 Secure Counselor Integration

Summary PDF generation + one-click email compose. No API integration.

| Risk Score | Behavior |
|---|---|
| >= 50 (Yellow) | "Consider speaking with a counselor" banner. Dismissible. |
| < 50 (Red) | "We recommend connecting" modal. Persistent, not blocking. |
| < 30 (Critical) | "Connect Now" button with pre-filled referral. |
| User-initiated | One-click referral from dashboard at any time. |

Counselor sees (with consent): risk score, top 3 risks, action plan status. Never raw data or LES contents.

---

### 7. Security Architecture

**Fortress is a commercial application serving military users, not a DoD system.** No FedRAMP certification required. Security benchmarked to FedRAMP Moderate standards.

#### 7.1 Infrastructure
- Cloud provider with strong security posture (GovCloud-capable preferred, not required). Isolated VPC, strict IAM.
- Immutable logging, SIEM monitoring, continuous red teaming.

#### 7.2 OPSEC Controls
- **Deployment anonymization:** Relative timeframes only ("<30 days"). System stores volatility status, deletes specific window after plan generation.

#### 7.3 Threat Model

| Threat Actor | Motivation | Mitigation |
|---|---|---|
| Nation-state | Profile military personnel | No aggregated PII at rest, compartmentalized storage |
| Organized crime | Steal PII/credentials | MFA, no credential storage, rate limiting |
| Predatory lenders | Target stressed SMs | No data sales, no third-party analytics |
| Insider threat | Exfiltrate data | Least privilege, immutable audit logs, split-key |

#### 7.4 Data Classification

| Tier | Type | Storage | Retention |
|---|---|---|---|
| 1 (Ephemeral) | Raw LES PDF, OCR intermediate | Client-side only | Deleted after parsing |
| 2 (Derived Financial) | Parsed income, expenses, debts | Server (encrypted, compartmentalized) | User-controlled; 24-month inactivity purge |
| 3 (Plan & Actions) | Risk score, action items, progress | Server (encrypted) | Linked to Tier 2 |
| 4 (Identity) | Name, rank, duty station, email | Server (separate datastore) | Never joined with Tier 2/3 except in-memory |
| 5 (Emergency) | Black Box contents | Encrypted blob (Fortress cannot decrypt) | Auto-expires per deployment window |

---

### 8. Performance Requirements

| Metric | Target | Degraded Acceptable |
|---|---|---|
| Page load (cached) | < 1.5s | < 3s |
| Page load (cold) | < 2.5s | < 5s |
| LES OCR | < 8s | < 15s |
| Plan generation | < 5s | < 10s |
| Risk score | < 2s | < 5s |
| API response | < 200ms | < 500ms |
| Simulator (40yr/500 iter) | < 5s | < 10s |
| Accessibility | WCAG 2.1 AA | -- |
| Concurrent users (launch) | 1,000 | -- |
| Uptime | 99.9% | 99.5% |

---

### 9. Success Metrics

**Primary (outcomes, not usage):**

| Metric | Target | Timeframe |
|---|---|---|
| Action execution rate | >=60% execute 2+ actions | 30 days |
| Emergency savings improvement | >=25% increase in liquid savings | 90 days |
| High-interest debt reduction | >=15% balance reduction | 6 months |
| Financial stress reduction | Significant reduction on validated scale | 6 months |

**Diagnostic:**

| Metric | Target |
|---|---|
| Intake completion | >=70% |
| Time to first plan | < 30 min (p75) |
| LES upload success | >=85% |
| 30-day retention | >=50% return |
| Counselor referral acceptance | >=30% |
| Homefront Link activation | >=25% (users with dependents) |

**NOT optimized for:** DAU, session duration, feature adoption breadth.

---

### 10. Capital Allocation Priority

1. Security & OPSEC infrastructure
2. Risk detection accuracy
3. Action plan specificity
4. Data ingestion reliability
5. Financial Path Simulator
6. Life event playbooks
7. Behavioral reinforcement
8. Counselor integration
9. Spousal bridge / Black Box

**Kill criteria:** <5% usage after 90 days, >20% engineer time maintenance without impact, unresolvable security findings, >30% usability test failure.

---

## Part II: Technical Architecture

### 11. Architecture Philosophy

**Client-heavy, server-light.** Financial data is computed on the device and stored on the server only as encrypted, derived artifacts. The server never sees raw financial inputs in plaintext.

```
+------------------------------------------------------+
|                 CLIENT (Browser/PWA)                  |
|                                                      |
|  +----------+  +--------+  +--------+  +----------+ |
|  |  Data    |  |  Risk  |  | Action |  | Financial| |
|  | Ingestion|->| Engine |->|  Plan  |->|   Path   | |
|  |  Layer   |  |        |  |  Gen   |  |Simulator | |
|  +----------+  +--------+  +--------+  +----------+ |
|       |                                      |       |
|       v                                      v       |
|  +----------------------------------------------+    |
|  |       Unified Financial State Model          |    |
|  |      (In-memory, never persisted raw)        |    |
|  +----------------------------------------------+    |
|       |                                              |
|       v (encrypted derived snapshot)                 |
+------------------------------------------------------+
        |
        v
+------------------------------------------------------+
|                  SERVER (API Layer)                   |
|  Auth | Encrypted Store | Referral | Black Box | Sync|
+------------------------------------------------------+
```

---

### 12. Unified Financial State Model (FSM)

Single canonical data structure. Every module reads from and writes to this model. See `packages/types/src/financial-state.ts` for full TypeScript interfaces.

---

### 13. Data Ingestion Layer

#### 13.1 LES OCR Pipeline (Client-Side)

```
PDF File -> PDF.js (render to canvas @ 300 DPI) -> Tesseract.js (WASM OCR)
  -> Field Extractor (regex template matching) -> Validation & User Confirm -> FSM
```

Template-matching approach with multiple regex patterns per field for format variants. Each extracted field gets a confidence score. Fields below 90% confidence flagged for user review.

#### 13.2 Guided Manual Entry

Conversational Q&A populating the same FSM fields. First 5 questions yield a preliminary risk score (pay grade, dependents, savings, high-interest debt, TSP%).

#### 13.3 Military Pay Data Tables (Static, Client-Side)

- Pay table: ~15KB (all grades x 40 YOS)
- BAH table: ~2MB (all ZIP codes x dependency status) — lazy-load after app shell
- BAS: <1KB
- COLA: ~50KB

Updated annually. Version-checked on launch. Cached in IndexedDB for offline.

---

### 14-16. Risk Engine, Simulator, Action Plan

Pure functions operating on the FSM. See TASKS.md for implementation details and `packages/types/src/` for TypeScript interfaces.

---

### 17. Server-Side Architecture

Deliberately thin.

| Service | Responsibility |
|---|---|
| Auth | .mil verification, MFA, sessions, device fingerprint |
| Encrypted Store | Persist encrypted financial snapshots (server cannot decrypt) |
| Homefront Link | Generate/validate spousal tokens, permission model |
| Counselor Referral | Generate summary PDF, compose referral email |
| Black Box | Store encrypted emergency sheets, manage expiration |
| Table Update | Serve current pay/BAH/COLA tables |
| Sync | Receive encrypted snapshots for cross-device continuity |

**Client-side encryption:** AES-256-GCM via Web Crypto API. Key derived from user passphrase via PBKDF2-SHA256 (600K iterations). Server stores ciphertext only.

---

### 18. PWA & Offline

Service Worker: App shell (cache-first, ~2MB), pay/BAH tables (cache-first, ~2.5MB), encrypted state (network-first, ~50KB). Total offline: ~5MB.

| Feature | Offline? |
|---|---|
| View plan / risk score / actions | Y |
| Run simulator | Y |
| LES OCR | Y |
| Manual data entry | Y (queued) |
| Mark actions complete | Y (queued) |
| Counselor referral | N |
| Homefront Link | N |
| Cross-device sync | N |

---

### 19. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript |
| State management | Zustand |
| Styling | Tailwind CSS |
| Charts | D3.js (simulator), Recharts (dashboard) |
| PDF processing | PDF.js |
| OCR | Tesseract.js (WASM) |
| Encryption | Web Crypto API |
| PWA / Offline | Workbox |
| Simulation threading | Web Workers |
| Backend | Node.js + Fastify + TypeScript |
| Database | PostgreSQL |
| Blob storage | S3-compatible |
| Auth | Custom (.mil + TOTP MFA) |
| CI/CD | GitHub Actions |
| Monitoring | OpenTelemetry + Grafana |

---

## Part III: Phased Delivery Roadmap

### Phase 0: Foundation (Weeks 1-6)
- Auth (email + MFA, .mil verification)
- Manual financial data entry (guided interrogation)
- Risk score (3 rules: emergency fund, high-interest debt, SGLI)
- Basic action plan (7-day actions only)
- Security infrastructure (encryption at rest/transit, compartmentalized storage)

**Exit:** 20 users, >=80% rate plan as useful.

### Phase 1: Core Product (Weeks 7-14)
- LES OCR parsing (client-side)
- Full risk engine (all 7 rules)
- Full action plan (7/30/90-day tiers)
- Financial Path Simulator (40-year, Monte Carlo, side-by-side)
- Behavioral check-in system (payday-anchored)
- Progress dashboard

**Exit:** 100 users, >=60% intake completion, >=40% execute 1+ action in 30 days, >=50% use simulator.

### Phase 2: Military Life Events (Weeks 15-22)
- PCS playbook (3-phase, simulator-integrated)
- Deployment playbook
- Homefront Link (spousal access)
- Counselor referral (PDF + email)

**Exit:** PCS used by >=30 users, Homefront activated by >=25% of users with dependents.

### Phase 3: Hardening & Scale (Weeks 23-30)
- Transition playbook
- New child playbook
- Black Box (digital will)
- CAC/DoD SSO (if adoption warrants)
- Independent security audit
- Load testing & optimization

**Exit:** Pass security audit, 1,000 concurrent users, >=99.5% uptime over 30 days.

---

## Appendices

### A. Glossary

| Term | Definition |
|---|---|
| LES | Leave & Earnings Statement — military pay stub |
| BAH | Basic Allowance for Housing — tax-free housing stipend |
| BAS | Basic Allowance for Subsistence — tax-free food stipend |
| COLA | Cost of Living Allowance |
| TSP | Thrift Savings Plan — federal 401(k) |
| BRS | Blended Retirement System — TSP matching |
| SGLI | Servicemembers' Group Life Insurance (up to $500K) |
| SCRA | Servicemembers Civil Relief Act — 6% rate cap on pre-service debt |
| MLA | Military Lending Act — 36% MAPR cap |
| PCS | Permanent Change of Station |
| DFAS | Defense Finance and Accounting Service |
| myPay | DFAS online pay portal |
| PFC | Personal Financial Counselor |
| DTI | Debt-to-Income ratio |
