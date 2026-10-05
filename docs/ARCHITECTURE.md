# CareNexa Architecture

| Field | Value |
| --- | --- |
| Version | 0.1 Draft |
| Status | Pending approval |
| Date | 2026-10-03 |
| Baseline | [SRS.md](SRS.md) |

No application code is authorized by this document until the SRS is approved.

## 1. System architecture

CareNexa is a single-clinic web system with a browser client and one API process. The API owns business rules. The browser renders them.

```
                        CARENEXA
                           │
            ┌──────────────┴──────────────┐
            │                             │
      React frontend                Node / Express API
      (Vite, Recharts)                    │
            │                    ┌────────┴─────────┐
            │                    │                  │
            │              Application         Provider ports
            │              services                 │
            │         ┌────────┴────────┐     ┌─────┴──────┐
            │         │                 │     │            │
            │        CRM           Inventory  Insights   Anomaly
            │      Segments         Catalog   (rules)    (rules)
            │      Campaigns        Orders
            │         │                 │
            └─────────┴────────┬────────┘
                               │
                         Prisma ORM
                               │
                            SQLite
```

Provider ports sit beside the services, not inside React:

| Port | MVP | Future |
| --- | --- | --- |
| POS | Mock POS provider | Loyverse |
| Messaging | Mock SMS and mock email | Semaphore, Twilio, SendGrid |
| Insights | Rule-based provider | External model service |

The browser never opens SQLite and never holds the JWT signing secret.

## 2. Component architecture

### 2.1 Frontend

The frontend is a Vite + React single-page application.

| Area | Responsibility |
| --- | --- |
| Routes and pages | One page per primary navigation item in UI-UX.md |
| Feature components | Tables, filters, forms, charts, badges |
| API client | Attaches the bearer token, handles the error envelope, does not encode business rules |
| Session store | Holds the JWT in memory and in `sessionStorage` for refresh of the tab. See security note below. |
| Role gate | Hides navigation the role cannot use. The API remains the authority. |

Business calculations (segmentation, CLV, stock projection, anomaly rules) do not run in the browser except for display formatting.

### 2.2 Backend

Request path:

1. Router matches `/api/...`
2. Auth middleware verifies JWT and loads user status
3. Permission policy checks the role
4. Validator checks params, query, and body
5. Controller maps HTTP to a service call
6. Service applies business rules
7. Prisma implements persistence
8. Error middleware maps failures to the standard envelope

Modules (each with routes, controller, service, and validator as needed):

- auth
- users
- customers
- segments
- activities
- customer-value
- catalog
- inventory
- orders
- campaigns
- promotions
- analytics
- insights
- anomalies
- reports
- audit
- settings
- jobs (segmentation, promotion evaluation, inventory evaluation, anomaly evaluation)
- integrations/pos
- integrations/messaging

Controllers stay thin. Services do not import Express request objects. Prisma calls stay in module repositories or in the service only when the query is used in one place. Cross-module changes go through services. Example: completing an order calls the customer-value service and the inventory service. It does not update those tables with ad-hoc queries from the order controller.

### 2.3 Jobs

MVP jobs are synchronous HTTP actions protected for MANAGER and ADMIN, plus the same functions callable from a script. There is no message queue. Each job is idempotent for unchanged inputs:

- segmentation rewrites memberships to match current criteria
- promotion evaluation uses message history to avoid duplicates
- inventory evaluation refreshes open alerts
- anomaly evaluation does not insert a duplicate open alert for the same order, rule, and type

## 3. Data flow

### 3.1 Completed order

1. Staff submits customer, lines, and amounts.
2. Order service validates items, prices, and permission.
3. In one database transaction the service writes the order and lines, decrements stock for items that track inventory, writes inventory movements, and writes the audit row.
4. After commit, customer-value recalculation updates that customer’s snapshot.
5. Inventory evaluation creates or resolves stock alerts.
6. Anomaly evaluation may insert an alert. It does not change the order.

Void and cancel use the same services in reverse for stock and value (proposed BR-012).

### 3.2 Campaign activation

1. Manager activates a campaign whose dates include today.
2. Campaign service loads current members of the target segment.
3. It creates message rows for members who do not already have a row for that campaign.
4. The messaging port “sends” each row and stores status `sent` or `failed`.
5. The campaign and message inserts are audited without storing secrets.

### 3.3 Mock POS sync

1. Manager starts sync.
2. `MockPosProvider` returns customers, transactions, and inventory snapshots.
3. Sync services upsert through customer, order, and inventory services.
4. Idempotency depends on external ids (SRS clarification C-05). Until those columns are approved, the sync endpoint may be specified but not treated as accepted.

### 3.4 Insights

1. Manager requests insights for a date range.
2. `RuleBasedInsightProvider` reads aggregates through analytics and inventory services.
3. It returns findings with source, reason, and basis, or an insufficient-data finding.
4. The browser renders the contract. It does not rewrite the statement.

## 4. API architecture

- REST JSON under `/api`
- Resource nouns in the plural
- JWT bearer authentication
- Consistent list and error shapes defined in [API.md](API.md)
- OpenAPI document generated or maintained at `backend/openapi.yaml` during implementation
- CORS restricted to the Vite origin
- Central error handler; controllers do not send ad-hoc error JSON

Versioning: no `/v1` prefix in the MVP. A prefix can be added when an external partner needs stability.

## 5. Database architecture

- Prisma schema is the source of truth
- Migrations in `backend/prisma/migrations`
- SQLite file path comes from `DATABASE_URL`
- Application code uses Prisma Client only
- No SQLite-only functions in services (`strftime` and similar stay out of the service layer; date bucketing that must differ by engine is isolated in one query module)
- Money is integer centavos (Assumption A-01)
- Timestamps are UTC
- PostgreSQL later means changing the datasource and rechecking migrations, not rewriting CRM services

Details, keys, and indexes are in [DATABASE.md](DATABASE.md).

## 6. Security architecture

| Concern | Approach |
| --- | --- |
| Identity | Email plus bcrypt password |
| Session | Signed JWT, 8-hour lifetime (A-03) |
| Revocation | Account status checked on every request. Logout is client discard plus audit. |
| Authorization | Role policy table shared by routes. UI hiding is not a control. |
| Transport | HTTPS wherever the API is not on localhost |
| Browser token | `sessionStorage` so the token is not shared across browser profiles and is cleared when the tab session ends. XSS still matters; the app must not render unsanitized HTML from messages or notes. |
| Secrets | `.env` locally, never committed. `.env.example` lists keys without values. |
| Audit | Append-only API. Sensitive fields redacted. |
| Validation | Server-side schema validation on every write |

Production deployment is out of scope. The local design still refuses to embed secrets in the repository.

## 7. Integration architecture

```
Order / Customer / Inventory services
        │
        ▼
PosIntegrationService  ──►  MockPosProvider
                         └► LoyversePosProvider (not in MVP)

Campaign / Promotion services
        │
        ▼
MessageGateway  ──►  MockSmsProvider
                 └► MockEmailProvider

Analytics services
        │
        ▼
InsightProvider  ──►  RuleBasedInsightProvider
                  └► ModelInsightProvider (not in MVP)
```

Adding Loyverse means a new class that implements the POS port and maps Loyverse payloads into CareNexa commands. CRM modules stay unchanged.

## 8. Configuration

Environment variables:

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Prisma SQLite URL |
| `JWT_SECRET` | Signing secret |
| `JWT_EXPIRES_IN` | Token lifetime |
| `API_PORT` | API listen port |
| `CORS_ORIGIN` | Frontend origin |
| `SEED_ADMIN_PASSWORD` | Initial admin password for seed only |
| `SEED_MANAGER_PASSWORD` | Initial manager password for seed only |
| `SEED_STAFF_PASSWORD` | Initial staff password for seed only |
| `BCRYPT_COST` | Optional override, default 12 |

Business thresholds live in the settings table, not in environment variables, so an admin can change them without a redeploy.

## 9. Recommended folder structure

```
CareNexa/
  docs/
    SRS.md
    ARCHITECTURE.md
    DATABASE.md
    API.md
    UI-UX.md
    TESTING.md
    ROADMAP.md
  backend/
    package.json
    .env.example
    openapi.yaml
    prisma/
      schema.prisma
      migrations/
      seed.js
    src/
      server.js
      app.js
      config/
      middleware/
        authenticate.js
        authorize.js
        errorHandler.js
        validate.js
      modules/
        auth/
        users/
        customers/
        segments/
        activities/
        customerValue/
        catalog/
        inventory/
        orders/
        campaigns/
        promotions/
        analytics/
        insights/
        anomalies/
        reports/
        audit/
        settings/
        jobs/
      integrations/
        pos/
          PosIntegrationService.js
          MockPosProvider.js
        messaging/
          MessageGateway.js
          MockSmsProvider.js
          MockEmailProvider.js
      lib/
        money.js
        errors.js
    tests/
  frontend/
    package.json
    index.html
    vite.config.js
    src/
      main.jsx
      app/
        router.jsx
        session.jsx
      api/
        client.js
      components/
      pages/
      styles/
```

JavaScript is the MVP language (Assumption from the brief: JavaScript or TypeScript). TypeScript is acceptable if the implementer prefers it before Phase 1 starts; mixing both languages in one package is not.

Shared UI components: page header, data table, filter bar, status badge, modal form, metric card, chart card, empty state, and insufficient-data state.

## 10. Deployment view (local MVP)

- Process 1: `backend` on port 4000
- Process 2: Vite dev server on port 5173, proxying `/api` or calling `CORS_ORIGIN`
- Database file: `backend/prisma/dev.db` (gitignored)

Production topology, process manager, and backups are future work (SRS section 25).

## 11. Architecture decisions

| ID | Decision | Reason |
| --- | --- | --- |
| AD-01 | Modular monolith | One clinic, one team, local MVP. Separate deployable services would add cost without a stated need. |
| AD-02 | Prisma | Specified as the preferred ORM, with migrations. |
| AD-03 | Integer centavos | SQLite has no exact decimal type. Integers migrate cleanly to PostgreSQL. |
| AD-04 | Rule provider isolated from CRM | Satisfies the requirement to add a model later without pretending the MVP is a model. |
| AD-05 | Jobs as services invoked by HTTP | Avoids a queue dependency on a developer laptop. |
| AD-06 | React + Vite + Recharts | Matches the approved stack options and keeps charts in React components. |
