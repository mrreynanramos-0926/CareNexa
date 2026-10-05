# CareNexa Development Roadmap

| Field | Value |
| --- | --- |
| Version | 0.1 Draft |
| Status | Pending approval — do not start Phase 1 until the SRS is approved |
| Date | 2026-10-03 |

Phases are sequential. Each phase ends with its exit checks passing locally on Windows. Dates are intentionally absent; the clinic has not set a schedule.

## Phase 0 — Requirements (this phase)

Deliverables:

- `docs/SRS.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/API.md`
- `docs/UI-UX.md`
- `docs/TESTING.md`
- `docs/ROADMAP.md`

Exit: stakeholder approval of version 0.1 or a revised document. Open items C-01 through C-10 are either decided or explicitly deferred.

Deferred does not mean silently implemented. In particular, discount and void anomaly rules and POS idempotency stay out of the “done” column until C-04 and C-05 are approved.

## Phase 1 — Foundation

Scope:

- Backend and frontend packages, Vite, Express, Prisma, SQLite
- `.env.example`, gitignore for `.env` and `*.db`
- Migrations for the approved schema
- Seed for roles, settings, and three users
- Login, logout, current user, change password
- Role middleware and the user-admin endpoints
- Health endpoint
- Shared error envelope
- First API tests for auth and authorization

Exit:

- AC-01, AC-02, AC-03, AC-04
- A staff token receives 403 on user administration
- README setup commands: install, migrate, seed, run API, run web
- Demo passwords come from the environment

## Phase 2 — Customers

Scope:

- Customer CRUD and deactivate
- Search, filter, sort, pagination
- Activities
- Profile API assembling history placeholders for orders
- Customer UI list and profile
- Audit writes for customer changes

Exit:

- AC-05, AC-06 (activities and identity; orders appear when Phase 3 exists), AC-07
- Duplicate phone and email tests

## Phase 3 — Catalog, orders, inventory

Scope:

- Products and services
- Inventory, restock, adjustment, movements, alerts
- Orders, lines, completion, void, cancel
- Customer-value snapshot
- Stock decrement and reversal
- Order and inventory screens

Exit:

- AC-10, AC-11, AC-12, AC-13
- BR-005, BR-006, BR-011, BR-012, BR-013, BR-014
- Service lines do not change stock

## Phase 4 — Segments, campaigns, promotions

Scope:

- Segment criteria editor and rebuild
- Seed the six segments by running the engine
- Campaigns and mock messaging port
- Trigger rules and evaluation
- Marketing and promotion screens

Exit:

- AC-08, AC-09, AC-15, AC-16, AC-17
- BR-001, BR-002, BR-003, BR-007, BR-008, BR-019
- UI states that sends are simulated

## Phase 5 — Dashboard, analytics, reports

Scope:

- Executive and basic dashboard endpoints
- Sales and customer analytics
- Charts on the dashboard and analytics pages
- Seven reports and CSV export

Exit:

- AC-18, AC-19, AC-23, AC-26
- Segment charts state that memberships can overlap
- Staff dashboard does not call executive endpoints

## Phase 6 — Insights and anomalies

Scope:

- Rule-based insight provider and insight page
- Large-transaction and sales-spike detectors
- Anomaly queue and status changes
- Slow-moving and declining-sales findings

Exit:

- AC-14, AC-20, AC-21
- AC-22 only if C-04 is approved; otherwise the excessive-discount and repeated-void detectors are not shipped
- `producer` is `rule-based` on every finding
- BR-010 test: status changes do not edit the order

## Phase 7 — POS port

Scope:

- `PosIntegrationService` and `MockPosProvider`
- Sync endpoint and status
- Idempotent upsert if external ids are approved

Exit:

- AC-25 if C-05 is approved
- If C-05 is still open, the phase delivers the port and a dry-run that does not write, and AC-25 remains open

## Phase 8 — Hardening and UAT

Scope:

- Remaining authorization tests across route groups
- Audit coverage for the FR-AUD-01 action list
- Settings UI for approved thresholds
- Seed completed to the sample-data minimum (30 customers, 10 catalog items, 50 orders)
- UAT script from TESTING.md section 8
- Setup documentation reviewed on a clean machine

Exit:

- TESTING.md UAT checklist passes
- No secret in source
- Open clarifications are listed in the README as known limits

## Cross-phase rules

- Do not start a later phase by stubbing fake successful business results.
- Do not add a feature that is absent from the SRS.
- Do not connect a live SMS, email, or Loyverse credential in these phases.
- PostgreSQL, PDF export, and a model-based insight provider are future enhancements, not MVP phases.

## Suggested build order inside a phase

1. Prisma model and migration
2. Service and unit or service tests
3. Route and API tests
4. Screen wired to the real API

## Approval gate

| Gate | Condition |
| --- | --- |
| Start Phase 1 | SRS 0.1 approved, including which of BR-011–BR-020 and which pending columns are in migration 001 |
| Ship discount or void anomalies | C-04 decided and migrated |
| Ship sync that writes POS orders | C-05 decided and migrated |
| Connect a real message provider | C-06 decided; not part of the MVP roadmap |
