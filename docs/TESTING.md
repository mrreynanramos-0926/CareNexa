# CareNexa Testing Strategy

| Field | Value |
| --- | --- |
| Version | 0.1 Draft |
| Status | Pending approval |
| Date | 2026-10-03 |

Tests are written with the feature that introduces the behavior. A phase is not done while its acceptance criteria in the SRS lack coverage.

## 1. Layers

| Layer | What it proves | Where |
| --- | --- | --- |
| Unit | Pure rules: criteria evaluation, money math, dedupe keys, stock status, insight wording inputs | `backend/tests/unit` |
| Service | Business rules with a test database | `backend/tests/services` |
| API | HTTP status, envelope, auth, and validation | `backend/tests/api` |
| Database | Migrations apply, unique keys, required relations | `backend/tests/db` |
| UI | Critical flows in the browser or component tests | `frontend` tests |

The MVP test runner for the API is Node’s built-in test runner or Jest. Pick one in Phase 1 and keep it. UI tests cover login, customer search, and dashboard load. A full visual regression suite is out of scope.

Use a separate SQLite file for tests. Do not point tests at `dev.db`.

## 2. Required scenarios

Each scenario maps to an SRS acceptance criterion. Scenarios marked blocked wait on the named clarification.

| Area | Scenario | Expected result | AC |
| --- | --- | --- | --- |
| Auth | Unknown email or wrong password | 401, generic message, no token | AC-01 negative |
| Auth | Inactive user | 401, no token | AC-02 |
| Auth | Valid login | 200, token, login audit | AC-01 |
| Auth | Change password | Old password fails, new password works | AC-03 |
| Authz | Staff token on `POST /api/users` | 403 | AC-04 |
| Authz | Staff token on insights and executive dashboard | 403 | AC-26 |
| Authz | Missing token on `/api/customers` | 401 | SEC-02 |
| CRM | Create customer | 201 and audit row | US-05 setup |
| CRM | Duplicate phone | 409 | FR-CRM-05 |
| CRM | Search by partial name and phone | Paginated matches | AC-05 |
| CRM | Profile includes orders, activities, segments, value | 200 with sections | AC-06 |
| CRM | Add activity | Visible on profile, audit written | AC-07 |
| CRM | Deactivate | Status inactive, orders remain | FR-CRM-06 |
| Segment | 30 days without purchase | Inactive membership | AC-08 |
| Segment | VIP and Frequent both match | Two memberships | AC-09 |
| Segment | Rebuild removes stale Inactive after a new completed order | Membership gone | BR-019 |
| CLV | Four completed orders totaling 10,000 PHP | Totals, average, last visit | AC-10 |
| CLV | Voided order | Excluded after reversal | BR-011, BR-012 |
| Order | Complete order | Lines, total, audit | AC-11 |
| Inventory | Sell quantity 2 from stock 10 | Stock 8 and a sale movement | AC-12 |
| Inventory | Stock below reorder level | One open low-stock alert | AC-13 |
| Inventory | Second evaluation | Does not duplicate the open alert | BR-014 |
| Inventory | Restock above reorder level | Alert resolved | BR-014 |
| Inventory | Service line | Stock unchanged | BR-013 |
| Inventory | Slow-moving threshold | Item listed with the quantities used | AC-14 |
| Campaign | Activate SMS to three members | Three mock-sent messages | AC-15 |
| Campaign | Activate again | No duplicate messages | AC-15 |
| Promotion | Birthday today, first run | One message | AC-16 |
| Promotion | Birthday second run same year | No extra message | AC-16 |
| Promotion | Inactivity rule | One win-back message for that episode | AC-17 |
| Promotion | Purchase count reaches 3 | One eligibility message, order unchanged | FR-PRM-05 |
| Analytics | Monthly sales | Matches completed orders only | AC-18 |
| Insights | Enough history to project 7 days of cover | Finding contains source, reason, basis, action | AC-20 |
| Insights | No orders | Insufficient-data statement | AC-21 |
| Insights | Producer field | `rule-based` | FR-AI-05 |
| Anomaly | Discount above threshold | Alert stored, order unchanged | AC-22, blocked on C-04 |
| Anomaly | Large transaction | Alert stored, order unchanged | FR-ANM-02 |
| Anomaly | Mark false positive | Status updated, order unchanged | BR-010 |
| Report | CSV export | Header plus filtered rows | AC-23 |
| Audit | Phone change | Old and new values, no password fields | AC-24 |
| POS | Same external transaction synced twice | One order | AC-25, blocked on C-05 |
| Security | Audit payload of password change | Hash and password absent | FR-AUD-04 |

## 3. API tests

Every protected route group needs at least:

- 401 without a token
- 403 for a role the matrix denies
- 400 for an invalid body
- the success path for an allowed role

List endpoints need a test that `pageSize` above 100 is rejected and that page 2 does not repeat page 1.

## 4. Database tests

- Migrate a temporary database from empty
- Seed roles and settings
- Reject an order item without an order (foreign key)
- Reject a second membership for the same customer and segment
- Reject a second message with the same `dedupe_key`

## 5. UI tests

| Flow | Check |
| --- | --- |
| Login | Error on bad password, redirect on success |
| Staff shell | Marketing, insights, users, and audit are absent |
| Customer search | Seeded name returns the profile metrics |
| Dashboard | Manager sees chart containers populated from the API, not hard-coded series |
| Insight card | Shows source and reason; page heading says rule-based |

Browser verification during implementation follows the project’s UI rule: exercise the changed flow, not only a screenshot.

## 6. Business-rule tests

BR-001 through BR-010 each have a named test. Proposed BR-011 through BR-020 are tested if those rules are approved with the SRS.

## 7. Non-goals for MVP testing

- Load tests beyond a sanity check that the dashboard query returns on the seed dataset in under two seconds on a developer machine
- Penetration test by a third party
- Live provider contract tests against Twilio, SendGrid, or Loyverse
- WCAG certification

## 8. Exit criteria for UAT

UAT uses the seed clinic and the three demo users.

- A staff user can find Maria Santos (or the seeded equivalent), read her history, add a note, and complete an order.
- Stock for a sold product changes by the sold quantity.
- A manager can see that customer in a segment, activate a simulated campaign, and export the sales CSV.
- A manager can open a large-transaction anomaly and set it to Reviewing without the total changing.
- An admin can see the audit rows for those actions.
- Insight cards either cite their basis or show the insufficient-data sentence.
- No screen calls the findings a machine-learning model.

## 9. Defect severity

| Severity | Meaning |
| --- | --- |
| Blocker | Wrong money, broken login, authorization bypass, stock not updated, data loss |
| Major | A Must story acceptance criterion fails |
| Minor | Layout or copy issue that does not change a business result |
