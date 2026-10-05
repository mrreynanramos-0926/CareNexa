# Software Requirements Specification

| Field | Value |
| --- | --- |
| Product | CareNexa |
| Document | SRS |
| Version | 0.1 Draft |
| Status | Pending approval — implementation must not start until this set is approved |
| Date | 2026-10-03 |
| Audience | Executive Facial Care stakeholders, product, engineering, QA |

Related documents:

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DATABASE.md](DATABASE.md)
- [API.md](API.md)
- [UI-UX.md](UI-UX.md)
- [TESTING.md](TESTING.md)
- [ROADMAP.md](ROADMAP.md)

---

## 1. Executive Summary

CareNexa is an AI-powered customer relationship management and business intelligence platform for facial care and beauty clinics. The first release is a locally runnable web application for Executive Facial Care (EFC). It centralizes customers, orders, inventory, marketing, and operational alerts so clinic managers can act on customer and sales data.

The MVP uses React, Node.js, Express, Prisma, SQLite, and JWT. External systems are behind interfaces: a mock POS provider stands in for Loyverse, and SMS and email are logged rather than delivered. Recommendations and anomaly checks in the MVP are deterministic rules and statistics. The product must label them as rule-based and must not describe them as a machine-learning model.

This document is the requirements baseline. Items marked **Pending confirmation** are not approved business rules.

## 2. Product Overview

**Name:** CareNexa

**Description:** CareNexa is an AI-powered Customer Relationship Management and Business Intelligence platform designed for facial care and beauty businesses.

**Tagline:** Connect. Understand. Engage. Grow.

**Users:** clinic administrators, managers, and front-desk or floor staff.

**Primary outcome:** turn customer and transaction data into actions — who to contact, what to restock, which campaigns to run, and which transactions need review.

The original clinic operation uses Loyverse as the POS. CareNexa must be able to receive POS data later without rewriting CRM logic. The MVP may run entirely on sample data and orders entered in CareNexa.

## 3. Business Problem

Clinic customer, visit, and product data is split between the POS and informal follow-up. That makes it difficult to:

- see a single customer history
- identify VIP, frequent, new, and inactive customers with consistent rules
- run SMS or email campaigns against a segment
- notice low stock and slow-moving items before they affect service
- review unusual transactions such as large discounts, voids, or sales spikes
- explain why a recommendation was produced

CareNexa addresses that gap for one clinic in the MVP. It is a management and intelligence layer. It is not a replacement POS.

## 4. Objectives

1. Give staff a searchable customer record with purchase, service, and activity history.
2. Classify customers with configurable segment rules, including VIP, Loyal, Frequent, Regular, New, and Inactive.
3. Show historical customer value: total spending, visits, average transaction value, and last visit.
4. Let managers create, schedule, and track SMS and email campaigns against segments.
5. Evaluate configurable promotion triggers, including birthday, inactivity win-back, new-customer, VIP, and loyalty-count rules.
6. Track products and services, stock, reorder points, and stock alerts.
7. Show sales and inventory analytics with date filters.
8. Surface rule-based insights that cite the data, the reason, and a recommended action.
9. Raise anomaly alerts without changing the underlying transaction.
10. Restrict every function by role on the server, and record security-relevant and data-changing actions in an audit log.
11. Export the defined reports as CSV.
12. Keep POS, messaging, database, and future model-based insight behind replaceable providers.

## 5. Scope

### 5.1 In scope for the MVP

- Local web application for a single clinic
- JWT login, logout, password change, and three roles
- Customer CRM, activities, segmentation, and historical value metrics
- Product and service catalog, inventory, restock, adjustment, and alerts
- Orders with line items, including manual entry and mock POS import
- Marketing campaigns and a promotion rule engine with mocked delivery
- Executive dashboard, sales analytics, CSV reports
- Rule-based insights and rule-based anomaly detection
- Audit log for the actions listed in this SRS
- Seed data with Philippine-oriented fictional records and PHP amounts
- Markdown requirements and an OpenAPI description of the API (OpenAPI file is produced during implementation)

### 5.2 MVP operating mode

Two data-entry paths are in scope:

1. Staff create and complete orders in CareNexa.
2. A mock POS provider supplies customers, transactions, and inventory for sync.

Both paths must call the same order, customer, and inventory services. Loyverse-specific API calls are out of scope.

## 6. Out of Scope

- Live Loyverse API connection
- Live SMS (Semaphore, Twilio) or live email (SendGrid)
- A trained machine-learning model, LLM-generated business advice, or any insight that is not computed from stored data
- Online booking, payments, invoicing, BIR official receipts, and tax filing
- Multi-branch, multi-clinic, or multi-tenant isolation
- Native mobile apps
- PDF and Excel export (the report service must allow them later)
- Customer self-service portal
- Automated deletion or silent correction of anomalous transactions
- Real personal data

## 7. Stakeholders

| Stakeholder | Interest |
| --- | --- |
| Clinic owner / executive | Sales, customer value, campaign results, anomalies |
| Clinic manager | Daily operations, segments, inventory, promotions |
| Front-desk / floor staff | Customer lookup, activities, order entry |
| System administrator | Users, roles, configuration, audit |
| CareNexa delivery team | A local MVP that can later accept PostgreSQL, Loyverse, messaging providers, and an external model service |

No named individual stakeholders were provided.

## 8. User Roles

Authorization is enforced on every protected API. Hiding a navigation item is additional, not sufficient.

| Role | Purpose |
| --- | --- |
| ADMIN | Full access, including users, roles, configuration, and audit logs |
| MANAGER | Commercial and operational modules, without user administration |
| STAFF | Customer care and order handling, plus a basic dashboard |

### 8.1 Permission matrix

`Y` = allowed. `N` = denied. `R` = read only.

| Capability | ADMIN | MANAGER | STAFF |
| --- | --- | --- | --- |
| Login, logout, change own password | Y | Y | Y |
| View basic dashboard (counts, recent transactions, own relevant alerts summary) | Y | Y | Y |
| View full executive dashboard, analytics, AI insights | Y | Y | N |
| Customer list, search, profile, create, update | Y | Y | Y |
| Delete or deactivate customer | Y | Y | N |
| Record customer activities | Y | Y | Y |
| View and manage segments and run segmentation | Y | Y | R |
| View CLV on profiles and lists | Y | Y | Y |
| Campaigns and promotion rules | Y | Y | N |
| Products, services, inventory, restock, adjustment | Y | Y | R |
| Create and complete orders | Y | Y | Y |
| Void or cancel orders | Y | Y | N |
| Review anomaly alerts | Y | Y | N |
| Reports and CSV export | Y | Y | N |
| User and role management | Y | N | N |
| System configuration (thresholds stored as settings) | Y | N | N |
| Audit logs | Y | N | N |

**Pending confirmation:** whether MANAGER may view audit logs in read-only form. This SRS keeps audit logs to ADMIN, matching the role statement in the source brief.

**Pending confirmation:** whether STAFF may create customers and orders for any customer, or only customers they are assigned. No assignment model was specified. Assumption A-08 applies until changed.

## 9. Functional Requirements

Identifiers are stable for tests and later stories. Priority: Must (MVP), Should (MVP if inexpensive), Could (later).

### 9.1 Authentication and access

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-AUTH-01 | The system shall authenticate users with email and password and return a signed JWT. | Must |
| FR-AUTH-02 | The system shall store passwords only as a slow hash (bcrypt or equivalent). | Must |
| FR-AUTH-03 | The system shall reject login when the account status is not active. | Must |
| FR-AUTH-04 | The system shall expose the current user and role to an authenticated caller. | Must |
| FR-AUTH-05 | Logout shall record an audit event. Token handling follows Assumption A-03. | Must |
| FR-AUTH-06 | An authenticated user shall change their own password by submitting the current password and a new password. | Must |
| FR-AUTH-07 | Every protected endpoint shall check the caller’s role on the server. | Must |
| FR-AUTH-08 | ADMIN shall create users, set role and status, and reset a user password to a temporary value that must be changed at next login. | Must |

### 9.2 Dashboard

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-DSH-01 | The executive dashboard shall show total, new, active, inactive, and VIP customer counts for the selected period where the metric is period-based, and current totals where it is a stock metric. | Must |
| FR-DSH-02 | The dashboard shall show total sales, average transaction value, and a customer-value summary. | Must |
| FR-DSH-03 | The dashboard shall show top-selling products and services, low-stock items, and slow-moving items. | Must |
| FR-DSH-04 | The dashboard shall show recent transactions, campaign performance, open anomaly alerts, and current rule-based recommendations. | Must |
| FR-DSH-05 | The dashboard shall chart sales trend, customer growth, segmentation, top products and services, inventory status, and campaign performance. | Must |
| FR-DSH-06 | Dashboard data shall respect the caller’s role. STAFF receives the basic set only. | Must |
| FR-DSH-07 | The user shall filter the dashboard by a date range. Default range is Assumption A-06. | Must |

### 9.3 Customer CRM

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-CRM-01 | The system shall list customers with search, filter, sort, and pagination. | Must |
| FR-CRM-02 | The system shall create and update a customer profile: name, email, phone, birthday, address, customer type, and status. | Must |
| FR-CRM-03 | The profile shall show contact details, segment memberships, value metrics, last visit, purchase history, service history, and activity history. | Must |
| FR-CRM-04 | Users with permission shall record an activity with type, notes, and activity date. | Must |
| FR-CRM-05 | Customer email shall be unique when provided. Phone shall be unique when provided. | Must |
| FR-CRM-06 | Deactivation shall retain history. Physical deletion is limited to ADMIN and shall be refused when orders exist. | Must |

`customer_type` and segment membership are different fields. The source brief includes both and does not define `customer_type`. See clarification C-02.

### 9.4 Segmentation

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-SEG-01 | The system shall store named segments with a description and structured criteria. | Must |
| FR-SEG-02 | The MVP shall seed VIP, Loyal, Frequent, Regular, New, and Inactive. Criteria are data, not hard-coded branches scattered through the UI. | Must |
| FR-SEG-03 | A segmentation run shall assign or remove memberships by evaluating criteria against customer metrics. | Must |
| FR-SEG-04 | A customer may belong to more than one segment (BR-001). | Must |
| FR-SEG-05 | MANAGER and ADMIN shall edit segment criteria. STAFF may view the resulting membership on a profile. | Must |
| FR-SEG-06 | Membership changes shall record `assigned_at` when a customer enters a segment. | Must |

### 9.5 Customer value

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-CLV-01 | For each customer the system shall calculate total spending, visit count, average transaction value, and last visit date from completed orders. | Must |
| FR-CLV-02 | The system shall display those figures on the profile, customer list, dashboard, and CLV report. | Must |
| FR-CLV-03 | Recalculation shall run when a completed order is created, voided, or cancelled, and when a user requests a recalculation for one customer or all customers. | Must |
| FR-CLV-04 | The UI shall describe the figure as historical value computed from completed orders. It shall not label it as a predictive lifetime-value model. | Must |

The source brief lists “customer lifetime value” separately from total spending. No predictive formula was given. See clarification C-01 and Assumption A-04.

### 9.6 Marketing campaigns

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-MKT-01 | MANAGER and ADMIN shall create, edit, schedule, activate, deactivate, and review campaigns. | Must |
| FR-MKT-02 | A campaign has name, type, channel (SMS or Email), target segment, message, start date, end date, status, and creator. | Must |
| FR-MKT-03 | Activating a campaign shall resolve current segment members and write one marketing-message row per recipient. | Must |
| FR-MKT-04 | Delivery shall go through a messaging port. The MVP adapter marks messages as sent and stores the body. It does not call an external provider. | Must |
| FR-MKT-05 | The campaign view shall show recipient counts by message status. | Must |
| FR-MKT-06 | The same customer shall not receive the same campaign twice during one activation. | Must |

### 9.7 Promotion engine

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-PRM-01 | Promotion behavior shall be driven by stored trigger rules: name, event type, condition, action, message template, and active flag. | Must |
| FR-PRM-02 | The MVP shall support these event types: birthday, account anniversary, inactivity, purchase count, new customer, and VIP membership. | Must |
| FR-PRM-03 | A daily evaluation job, also runnable on demand by MANAGER or ADMIN, shall create marketing messages for matching customers. | Must |
| FR-PRM-04 | Birthday promotions shall be created at most once per customer per birthday period (BR-007). | Must |
| FR-PRM-05 | “Buy 3 Get 1” shall be represented as eligibility from a purchase-count rule. The MVP records eligibility and a message. It does not apply a discount inside an external POS. | Must |
| FR-PRM-06 | Generated messages shall be logged (BR-008). | Must |

Anniversary meaning is unresolved. See clarification C-03.

### 9.8 Inventory

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-INV-01 | The catalog shall store products and services with name, type, description, price, and status. | Must |
| FR-INV-02 | Stocked items shall have current stock, reorder level, reorder quantity, unit cost, last restock date, and stock status. | Must |
| FR-INV-03 | Users with permission shall restock and adjust quantity. Each change shall store a history row. | Must |
| FR-INV-04 | A completed order shall decrement stock for items that track inventory (BR-006). | Must |
| FR-INV-05 | Evaluation shall create a low-stock alert when current stock is below the reorder level, and an out-of-stock alert when stock is zero (BR-004). | Must |
| FR-INV-06 | The system shall list slow-moving and dead-stock items using configurable day and quantity thresholds. | Must |
| FR-INV-07 | Services that are not stocked shall not require an inventory row and shall not be decremented. | Must |

Inventory history is required by the brief and is not satisfied by the current-stock row alone. DATABASE.md proposes an `inventory_movements` entity for approval.

### 9.9 Sales analytics

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-ANL-01 | The system shall report daily, weekly, and monthly sales for a date range. | Must |
| FR-ANL-02 | The system shall report sales by product, by service, and by customer segment. | Must |
| FR-ANL-03 | The system shall report average transaction value, top-selling items, and a sales trend. | Must |
| FR-ANL-04 | All analytics queries shall accept an explicit date range. | Must |

Segment sales can double-count a customer who is in several segments. The UI must state that. See Assumption A-05.

### 9.10 Anomaly detection

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-ANM-01 | The system shall create anomaly alerts for transactions that match active anomaly rules. | Must |
| FR-ANM-02 | MVP rule types shall include excessive discount, repeated voids by the same user in a time window, unusually large transaction amount, and sudden sales spike versus the recent baseline. | Must |
| FR-ANM-03 | Each alert shall store type, description, severity, linked transaction, timestamp, and status. | Must |
| FR-ANM-04 | Status values shall be New, Reviewing, Resolved, and False Positive. | Must |
| FR-ANM-05 | Detection shall not modify the transaction (BR-010). | Must |
| FR-ANM-06 | MANAGER and ADMIN shall update alert status and optional review notes. | Must |

Discount and void facts are not in the minimum order table. See clarification C-04. Until those fields are approved, the discount and void rules cannot be implemented honestly.

### 9.11 Reporting

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-RPT-01 | The system shall provide customer, sales, inventory, campaign, segmentation, customer-value, and anomaly reports. | Must |
| FR-RPT-02 | Each report shall accept the filters defined in API.md and shall paginate on screen. | Must |
| FR-RPT-03 | CSV export shall contain the same filtered dataset as the on-screen report, up to the export cap in Assumption A-07. | Must |
| FR-RPT-04 | The report service shall return tabular data from a single internal shape so a later PDF or Excel renderer can consume it. | Must |

### 9.12 Audit

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-AUD-01 | The system shall append an audit record for login, logout, customer create and update, order create, inventory adjustment and restock, campaign create and update, user create and update, trigger-rule changes, segment-criteria changes, and configuration changes. | Must |
| FR-AUD-02 | Each record shall include user, action, entity, entity id, timestamp, and before and after values when a value change exists. | Must |
| FR-AUD-03 | Audit rows shall be immutable from the API. There is no update or delete endpoint. | Must |
| FR-AUD-04 | Password hashes, JWTs, and message secrets shall never be written to the audit payload. | Must |

### 9.13 POS abstraction

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-POS-01 | CRM services shall depend on a POS port with: get customers, get transactions, get inventory, sync customers, sync transactions, and sync inventory. | Must |
| FR-POS-02 | The MVP provider shall be an in-process mock that returns fictional data and records the last sync time. | Must |
| FR-POS-03 | Sync shall be idempotent using an external id once that field is approved (clarification C-05). | Must |

### 9.14 Insights

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-AI-01 | The insights page shall group rule-based findings into inventory, sales, customers, marketing, and anomalies. | Must |
| FR-AI-02 | Each finding shall show the statement, data source, reason, calculation basis, and recommended action. | Must |
| FR-AI-03 | When the underlying dataset is empty or below the minimum stated in section 20, the system shall return “Insufficient data to generate this recommendation.” | Must |
| FR-AI-04 | Findings shall be computed from database records at request time or from the latest stored evaluation. They shall not be hard-coded sample sentences. | Must |
| FR-AI-05 | The API shall identify the producer as `rule-based` for MVP results. A future `model-based` producer must be a separate provider. | Must |

## 10. Non-Functional Requirements

| ID | Category | Requirement |
| --- | --- | --- |
| NFR-01 | Performance | Customer, order, audit, and report lists shall be paginated. Default page size is 25. Maximum page size is 100. |
| NFR-02 | Performance | Dashboard and analytics endpoints shall aggregate in the database. The API shall not ship full order history to the browser for charting. |
| NFR-03 | Performance | List filters used by the UI shall be supported by indexes documented in DATABASE.md. |
| NFR-04 | Security | Passwords shall be hashed with bcrypt (cost factor 12 unless operations tuning requires a documented change). |
| NFR-05 | Security | Authentication shall use JWT signed with a secret from the environment. |
| NFR-06 | Security | All write inputs shall be validated on the server. Client validation is only a usability aid. |
| NFR-07 | Security | Data access shall go through Prisma parameterized queries. |
| NFR-08 | Security | Secrets, connection strings, and provider credentials shall live in environment variables and shall not be committed. |
| NFR-09 | Security | Authorization failures shall return 403 without revealing whether a hidden record exists beyond the standard error shape. |
| NFR-10 | Privacy | Marketing sends require a recorded channel consent flag once clarification C-06 is decided. Until then, mock sends still persist the message log. |
| NFR-11 | Maintainability | HTTP handlers shall call application services. Services shall not import UI code. Persistence shall sit behind Prisma, not inside route handlers. |
| NFR-12 | Maintainability | Business thresholds shall be read from a configuration store or segment and trigger records, not duplicated as magic numbers in controllers. |
| NFR-13 | Portability | Prisma schema and migrations shall avoid SQLite-only SQL in application code so PostgreSQL can become the datasource later. |
| NFR-14 | Portability | Money shall not be stored as binary floating point. See Assumption A-01. |
| NFR-15 | Usability | The web UI shall be usable on desktop and tablet widths specified in UI-UX.md. |
| NFR-16 | Operability | A new developer shall run the API, web app, migrations, and seed from documented commands on Windows with Node.js LTS. |
| NFR-17 | Reliability | A failed mock message delivery shall mark that message failed and shall not roll back the campaign definition. |
| NFR-18 | Auditability | Clocks stored in the database shall be UTC. The UI shall present them in Asia/Manila. |
| NFR-19 | Testability | Business rules in section 11 shall have automated tests listed in TESTING.md. |
| NFR-20 | Honesty | The UI copy shall call MVP insights “rule-based insights.” |

## 11. Business Rules

### 11.1 Specified rules

| ID | Rule |
| --- | --- |
| BR-001 | A customer may belong to one or more segments. |
| BR-002 | A customer becomes inactive after a configurable number of days without a purchase. |
| BR-003 | A customer may qualify as VIP based on configurable spending or visit criteria. |
| BR-004 | Inventory must generate a low-stock alert when current stock is below the reorder level. |
| BR-005 | Completed orders must update customer spending metrics. |
| BR-006 | Completed orders must update inventory where applicable. |
| BR-007 | Birthday promotions may be triggered only once per customer per birthday period. |
| BR-008 | Marketing messages must be logged. |
| BR-009 | Users may access only functions permitted by their role. |
| BR-010 | Anomaly detection must create an alert record and must not silently modify the transaction. |

### 11.2 Proposed rules pending approval

These rules are required to implement the stated features consistently. They are not approved until the stakeholder accepts them.

| ID | Proposed rule | Why it is proposed |
| --- | --- | --- |
| BR-011 | Only orders in status `completed` count toward spending, visits, stock decrement, and segment metrics. `voided` and `cancelled` orders do not. | “Completed orders” is the phrase used in BR-005 and BR-006. Other statuses were not defined. |
| BR-012 | Voiding or cancelling a completed order reverses its stock and value effects and writes an audit record. | Otherwise metrics drift after a correction. |
| BR-013 | A service with `tracks_inventory = false` is sellable and does not change stock. | Facial services are not physical stock. |
| BR-014 | A low-stock or out-of-stock alert is not duplicated while an open alert of the same type exists for that product. Restock above the reorder level resolves the open alert. | Prevents alert floods. |
| BR-015 | Slow-moving means units sold over the configured window are at or below the configured quantity, and on-hand stock is greater than zero. Dead stock means units sold over a longer configured window are zero and stock remains. | The brief names both outcomes and does not define them. |
| BR-016 | Birthday period is the customer’s birthday month in Asia/Manila, evaluated once per calendar year. | “Once per birthday period” needs a period definition. |
| BR-017 | Purchase-count promotions (including Buy 3 Get 1 eligibility) fire once when the count first reaches the threshold, not on every later purchase. | Otherwise the customer is messaged on every visit after the third. |
| BR-018 | Segment sales reports count an order once per matching segment of the customer. | Follows BR-001 and avoids hiding overlap. |
| BR-019 | Inactive segment membership is removed when the customer completes a new purchase, on the next segmentation run. | Win-back audiences must shrink after a return visit. |
| BR-020 | Anomaly severity is `high` for excessive discount and unusually large amount, `medium` for repeated voids and sudden spikes, unless configuration overrides it. | The brief requires severity and does not define the scale. |

Seed defaults for the configurable numbers are in Assumption A-02. They are demo values, not clinic policy.

## 12. Use Cases

| ID | Name | Actor | Summary |
| --- | --- | --- | --- |
| UC-01 | Log in | Any role | Active user submits email and password and receives a session token. |
| UC-02 | Change password | Any role | User replaces their password after the current password is verified. |
| UC-03 | Administer users | ADMIN | Admin creates a user or changes role and status. |
| UC-04 | Find a customer | STAFF, MANAGER, ADMIN | User searches and opens the 360-degree profile. |
| UC-05 | Maintain a customer | STAFF, MANAGER, ADMIN | User creates or updates contact details and records an activity. |
| UC-06 | Run segmentation | MANAGER, ADMIN | User updates criteria and runs assignment. |
| UC-07 | Record an order | STAFF, MANAGER, ADMIN | User creates an order with line items. Completion updates metrics and stock. |
| UC-08 | Correct an order | MANAGER, ADMIN | User voids or cancels an order. Effects reverse. Anomaly rules may raise an alert. |
| UC-09 | Replenish stock | MANAGER, ADMIN | User restocks or adjusts inventory and reviews alerts. |
| UC-10 | Run a campaign | MANAGER, ADMIN | User targets a segment and activates a mocked SMS or email campaign. |
| UC-11 | Evaluate promotions | MANAGER, ADMIN, scheduler | Active trigger rules create logged messages for matching customers. |
| UC-12 | Review the business | MANAGER, ADMIN | User reads the dashboard, analytics, and rule-based insights for a date range. |
| UC-13 | Review an anomaly | MANAGER, ADMIN | User moves an alert through New, Reviewing, Resolved, or False Positive. |
| UC-14 | Export a report | MANAGER, ADMIN | User downloads the filtered report as CSV. |
| UC-15 | Inspect audit history | ADMIN | User filters audit records. |
| UC-16 | Sync mock POS | MANAGER, ADMIN | User runs sync. The mock provider upserts customers, orders, and stock through the same services as UC-07. |
| UC-17 | View basic dashboard | STAFF | User sees counts and recent transactions without executive analytics or insights. |

## 13. User Stories

### Authentication and administration

| ID | Story | Priority | Module | Acceptance criteria |
| --- | --- | --- | --- | --- |
| US-01 | As a user, I want to log in with my email and password, so that I can reach only the tools of my role. | Must | Authentication | AC-01, AC-02 |
| US-02 | As a user, I want to change my password, so that a temporary or old password does not remain in use. | Must | Authentication | AC-03 |
| US-03 | As an admin, I want to create staff and manager accounts, so that each person has the right access. | Must | Authentication | AC-04 |
| US-04 | As an admin, I want to deactivate a user, so that a departed employee cannot log in. | Must | Authentication | AC-02 |

### Customers and value

| ID | Story | Priority | Module | Acceptance criteria |
| --- | --- | --- | --- | --- |
| US-05 | As a staff member, I want to search customers by name or phone, so that I can open the right profile at the desk. | Must | CRM | AC-05 |
| US-06 | As a staff member, I want a profile that shows visits, services, spending, and notes, so that I can continue care without asking the customer to repeat history. | Must | CRM | AC-06 |
| US-07 | As a staff member, I want to record a call or visit note, so that the next person sees the follow-up. | Must | CRM | AC-07 |
| US-08 | As a manager, I want customers placed into configurable segments, so that campaigns use the same definitions every time. | Must | Segmentation | AC-08, AC-09 |
| US-09 | As a manager, I want to see who has not visited for the configured number of days, so that I can launch a win-back campaign. | Must | Segmentation | AC-08 |
| US-10 | As a manager, I want each customer’s spending, visits, average transaction, and last visit, so that I can judge historical value. | Must | CLV | AC-10 |

### Orders, inventory, marketing

| ID | Story | Priority | Module | Acceptance criteria |
| --- | --- | --- | --- | --- |
| US-11 | As a staff member, I want to record a completed visit with services and products, so that sales and stock stay current. | Must | Orders | AC-11, AC-12 |
| US-12 | As a manager, I want stock to fall when a product is sold, so that counts match the floor. | Must | Inventory | AC-12 |
| US-13 | As a manager, I want an alert when stock is below the reorder level, so that I can restock before a service is interrupted. | Must | Inventory | AC-13 |
| US-14 | As a manager, I want to see items that barely sell, so that I can stop reordering them. | Must | Inventory | AC-14 |
| US-15 | As a manager, I want to send a message to one segment by SMS or email, so that the offer reaches the intended customers. | Must | Campaigns | AC-15 |
| US-16 | As a manager, I want a birthday message prepared once each birthday period, so that the greeting is not repeated. | Must | Promotions | AC-16 |
| US-17 | As a manager, I want inactive customers to qualify for a win-back message, so that lapsed clients receive a timely offer. | Must | Promotions | AC-17 |

### Insight, control, and reporting

| ID | Story | Priority | Module | Acceptance criteria |
| --- | --- | --- | --- | --- |
| US-18 | As a manager, I want sales by day, week, month, item, and segment, so that I can compare periods. | Must | Analytics | AC-18 |
| US-19 | As a manager, I want a dashboard of customers, sales, stock, campaigns, and alerts, so that I can start the day from one screen. | Must | Dashboard | AC-19 |
| US-20 | As a manager, I want each insight to explain its data and calculation, so that I can trust or discard it. | Must | Insights | AC-20, AC-21 |
| US-21 | As a manager, I want unusual discounts, voids, large tickets, and sales spikes flagged, so that I can review them without the system rewriting the sale. | Must | Anomalies | AC-22 |
| US-22 | As a manager, I want CSV copies of the standard reports, so that I can share them outside the app. | Must | Reporting | AC-23 |
| US-23 | As an admin, I want an audit trail of logins and data changes, so that I can see who changed a record. | Must | Audit | AC-24 |
| US-24 | As a manager, I want a mock POS sync, so that we can prove the integration boundary before Loyverse is connected. | Must | POS | AC-25 |
| US-25 | As a staff member, I want a simpler dashboard, so that I am not shown executive tools I cannot use. | Must | Dashboard | AC-26 |

## 14. Acceptance Criteria

| ID | Criteria |
| --- | --- |
| AC-01 | Given an active user with a correct password, when they log in, then the API returns a JWT and the user’s role, and writes a login audit record. |
| AC-02 | Given a user whose status is inactive, when they log in, then the API rejects the attempt and does not return a token. |
| AC-03 | Given a logged-in user, when they submit the correct current password and a valid new password, then the old password no longer logs in and the new password does. |
| AC-04 | Given an admin, when they create a user with role STAFF, then that user can call staff endpoints and receives 403 on user-administration endpoints. |
| AC-05 | Given customers exist, when a staff user searches by partial name or phone, then only matching customers appear, paginated. |
| AC-06 | Given a customer with completed orders and activities, when a user opens the profile, then contact details, segments, value metrics, order lines, and activities are visible. |
| AC-07 | Given a staff user on a profile, when they save an activity with type, notes, and date, then the activity appears in history and an audit record is stored. |
| AC-08 | Given inactivity days are configured to 30, and a customer’s last completed purchase was 30 or more days ago, when segmentation runs, then that customer is a member of Inactive. |
| AC-09 | Given a customer meets both VIP and Frequent criteria, when segmentation runs, then the customer has both memberships. |
| AC-10 | Given completed orders totaling 10,000 PHP across 4 visits, when value is calculated, then total spending is 10000.00, visit count is 4, average transaction value is 2500.00, and last visit is the latest completed order date. |
| AC-11 | Given a staff user, when they complete an order for a customer, then the order and lines are stored, customer metrics refresh, and an audit record is stored. |
| AC-12 | Given a product tracks inventory and has stock 10, when an order containing quantity 2 is completed, then current stock is 8 and a movement row records the sale. |
| AC-13 | Given current stock is below the reorder level, when inventory is evaluated, then one open low-stock alert exists for that product. |
| AC-14 | Given a stocked product sold at or below the slow-moving threshold in the configured window, when inventory intelligence runs, then the product is listed as slow-moving with the quantities used. |
| AC-15 | Given a segment with three members and a draft SMS campaign, when a manager activates it, then three message rows exist, each is logged as mock-sent, and a second activation does not duplicate them. |
| AC-16 | Given a customer whose birthday is today in Asia/Manila and who has not received this year’s birthday promotion, when promotion evaluation runs, then one birthday message is logged. When evaluation runs again in the same birthday period, then no second message is logged. |
| AC-17 | Given a customer with no completed purchase for the configured inactivity days, when the inactivity promotion runs, then a win-back message is logged once for that inactive episode. |
| AC-18 | Given completed orders across two months, when a manager requests monthly sales for that range, then totals match the sum of those completed orders and exclude voided orders. |
| AC-19 | Given seed data is loaded, when a manager opens the dashboard for a range that contains sales, then the required cards and charts render from API data. |
| AC-20 | Given enough sales history for a stocked product to project a stock-out inside 7 days at the recent daily rate, when insights are requested, then the finding names the product, the source tables, the rate used, and a restock action. |
| AC-21 | Given no orders exist, when insights are requested, then the response states “Insufficient data to generate this recommendation.” for the sales findings. |
| AC-22 | Given a completed order whose discount exceeds the configured threshold, when anomaly evaluation runs, then an alert is stored with type, severity, description, and transaction id, and the order amounts are unchanged. |
| AC-23 | Given a manager filters the sales report, when they export CSV, then the file contains the filtered rows and a header row. |
| AC-24 | Given an admin updates a customer phone, when they open audit logs, then the record shows the user, entity, entity id, old phone, and new phone. |
| AC-25 | Given the mock POS returns a known external transaction twice, when sync runs twice, then the order exists once. |
| AC-26 | Given a staff token, when the user calls the executive analytics or insights endpoint, then the API returns 403. The staff dashboard endpoint still succeeds. |

AC-22 and AC-25 depend on clarifications C-04 and C-05. They remain the target criteria once the missing fields are approved.

## 15. Data Requirements

The minimum entity list in the source brief is the baseline. DATABASE.md is the physical specification.

Summary:

- Identity and access: users, roles
- CRM: customers, segments, memberships, activities, customer value snapshots
- Commerce: products and services, inventory, orders, order items
- Marketing: campaigns, trigger rules, marketing messages
- Operations: inventory alerts, anomaly alerts, audit logs
- Proposed additions, not yet approved: inventory movements, system settings, external POS ids, discount and void fields, channel consent, review notes on anomalies

Currency is Philippine peso (PHP). Timezone for business-day rules is Asia/Manila. Persisted timestamps are UTC.

Seed data, all fictional:

- 3 users, one per role
- at least 30 customers
- at least 10 products and services
- at least 50 orders
- the six named segments with memberships
- campaigns, inventory rows, alerts, and anomaly examples
- names of the form Maria Santos, Juan Dela Cruz, Ana Reyes
- no real personal information

## 16. Database ERD

The logical model and physical rules are in [DATABASE.md](DATABASE.md). Application code must use Prisma migrations. Business logic must not execute SQLite-specific SQL.

## 17. API Requirements

The endpoint catalog, status codes, and payload conventions are in [API.md](API.md).

Global rules:

- Base path `/api`
- JSON request and response bodies
- Authenticated routes require `Authorization: Bearer <token>`
- One error envelope for validation, auth, and unexpected failures
- List endpoints accept `page` and `pageSize`
- Dates in query strings are ISO-8601 calendar dates interpreted in Asia/Manila when they define a business range

## 18. Security Requirements

| ID | Requirement |
| --- | --- |
| SEC-01 | Passwords are hashed with bcrypt. Plaintext passwords are not stored, logged, or returned. |
| SEC-02 | JWT payload contains user id and role. Authorization still loads the current account status on each request so a deactivated user cannot keep calling APIs until expiry. |
| SEC-03 | Access token lifetime follows Assumption A-03. |
| SEC-04 | Login is rate-limited per IP and per email. |
| SEC-05 | CORS allows only the configured web origin. |
| SEC-06 | Security headers are enabled on the API. |
| SEC-07 | Role checks run in middleware or equivalent server policy for every protected route. |
| SEC-08 | Customer, order, and inventory identifiers are not a substitute for authorization. STAFF restrictions are role-wide in the MVP (Assumption A-08). |
| SEC-09 | Audit and log output redacts password, token, and provider-secret fields. |
| SEC-10 | Demo user passwords are supplied through environment variables or a local untracked seed secret, not hard-coded in source. |
| SEC-11 | The MVP does not claim compliance with the Philippine Data Privacy Act. C-06 must be resolved before any live message provider is connected. |

## 19. Reporting Requirements

| Report | Primary questions | Minimum columns |
| --- | --- | --- |
| Customers | Who are the customers and what is their status? | Name, phone, email, status, type, segments, last visit |
| Sales | How much was sold, and on which items? | Order date, order id, customer, status, total, item summary |
| Inventory | What is on hand and what is at risk? | Item, type, stock, reorder level, status, last restock |
| Campaigns | What was sent and to whom? | Campaign, channel, segment, message status counts, period |
| Segmentation | Who is in each segment? | Segment, customer, assigned at, current metrics used |
| Customer value | What has each customer spent? | Customer, total spent, visits, average, last visit, calculated at |
| Anomalies | What needs review? | Created at, type, severity, status, transaction id, description |

Each report supports CSV. The UI shows the same filters. Export is an API response of `text/csv`.

## 20. AI Requirements

### 20.1 What the MVP is

The insights module is a **rule-based recommendation service**. It uses counts, sums, ratios, and thresholds from CareNexa tables. It is allowed to live behind an `InsightProvider` interface so a later model-based provider can be added without replacing CRM code.

The UI label is **Rule-based insights**. The API field `producer` is `rule-based`.

### 20.2 Finding contract

Every finding includes:

| Field | Meaning |
| --- | --- |
| id | Stable id for the finding type plus subject |
| category | `inventory`, `sales`, `customer`, `marketing`, or `anomaly` |
| statement | One sentence a manager can read |
| dataSource | Tables or report used |
| reason | Rule that fired, in plain language |
| basis | Inputs: counts, dates, thresholds, rates |
| recommendedAction | A next step a user can take in CareNexa |
| producer | `rule-based` |
| confidence | For rules, this is `deterministic`. A numeric confidence is reserved for a future model provider. |

If the minimum data is missing, the category returns a single insufficient-data finding and no fabricated statement.

### 20.3 MVP finding types

| Finding | Minimum data | Rule sketch |
| --- | --- | --- |
| Restock soon | At least 7 days of completed sales for the item, stock greater than zero | Projected days of cover = stock / average daily units. Fire when days of cover is 7 or less, or when stock is below reorder level. |
| Slow-moving | Item has stock and the slow-moving window has elapsed since the item existed in seed or catalog | Units sold in the window are at or below the configured threshold. |
| Declining sales | At least 4 full weeks of sales for the item | Units in the latest 2 weeks are at least the configured percent below the prior 2 weeks. |
| May run out | Same as restock soon | Same projection, stated as a stock-out risk. |
| Inactive share | At least 1 customer | Inactive members / all customers. |
| VIP sales share | At least 1 completed order in the selected period | Sum of completed orders whose customer is in VIP / period sales. |
| Campaign suggestion | A segment exists with members and no active campaign covering it | Suggest a campaign for the largest uncontacted priority segment in the period. Priority order is pending C-07. |
| Open anomalies | Zero or more alerts | Count of alerts in New or Reviewing. If zero, say there are no open alerts. That statement is allowed because it is computed, not a substitute for missing data. |

Example shape, illustrative only (the implementation must calculate the numbers):

- Statement: “Facial Kit is projected to reach the reorder threshold within 7 days.”
- Data source: `inventory`, `order_items`, `orders`
- Reason: “Average daily sales over the last 14 days imply days of cover at or below 7.”
- Basis: stock, average daily units, reorder level, window dates
- Recommended action: “Create a restock for the reorder quantity.”

### 20.4 Prohibited behavior

- Do not ship static insight sentences that ignore the database.
- Do not invent a confidence percentage for a rule.
- Do not call the module a machine-learning model in the UI, API, or docs.
- Do not send customer data to an external model in the MVP.

## 21. Integration Requirements

| Port | MVP adapter | Later adapter | Contract |
| --- | --- | --- | --- |
| POS | `MockPosProvider` | Loyverse provider | get and sync customers, transactions, and inventory |
| SMS | `MockSmsProvider` | Semaphore or Twilio | send(to, body) returns provider message id and status |
| Email | `MockEmailProvider` | SendGrid | send(to, subject, body) returns provider message id and status |
| Insights | `RuleBasedInsightProvider` | External model service | returns the finding contract in section 20 |
| Database | SQLite file | PostgreSQL | Prisma datasource only |

CRM, inventory, and campaign services depend on these ports. They do not import vendor SDKs.

Mock POS data is deterministic for tests and is also loadable as demo sync data. It is fictional.

## 22. Assumptions

| ID | Assumption | Consequence if rejected |
| --- | --- | --- |
| A-01 | Money is stored as integer centavos (PHP × 100) in the database and shown with two decimals. | A different decimal strategy must be chosen before migration 001. |
| A-02 | Demo thresholds, editable in settings: inactive after 30 days; VIP at 50,000 PHP lifetime spend or 12 visits in 365 days; frequent at 3 visits in 30 days; loyal at 6 visits in 180 days and a visit within 60 days; regular at 2 visits in 90 days; new if the first completed order is within 30 days; slow-moving at 2 units or fewer in 30 days; dead stock at 0 units in 60 days; large transaction at 15,000 PHP; excessive discount at 20% of gross; spike when a day is at least 2× the prior 28-day daily average; declining sales at 25% down. | Replace the seed settings. Rules stay configurable. |
| A-03 | Access tokens expire after 8 hours. Logout discards the token in the client and writes an audit event. A server-side denylist is not in the MVP. Deactivation is enforced by reloading user status. | If true server revocation is required, add a denylist in Phase 1. |
| A-04 | “Customer lifetime value” in the MVP is the historical total of completed orders. Average transaction value is that total divided by visit count. Visit count is the number of completed orders. | A predictive formula needs a new approved definition. |
| A-05 | Customers may appear in multiple segment charts. Charts show membership counts and label the overlap. | Exclusive priority would be a new rule. |
| A-06 | Default dashboard range is the last 30 days through today in Asia/Manila. | Change the default in UI settings. |
| A-07 | CSV export is capped at 10,000 rows and states when the cap is hit. | A larger cap needs a background export. |
| A-08 | STAFF may access all customers and orders. There is no per-staff assignment. | An ownership model needs new fields and AC changes. |
| A-09 | One clinic, one database, no `branch_id`. | Multi-branch needs a tenancy design before production. |
| A-10 | UI copy is English. Seed names and addresses are Philippine-oriented fiction. | Localization is a later project. |
| A-11 | Charts use Recharts. Layout uses a small internal design system on top of accessible HTML, with Bootstrap 5 only if a component would otherwise be custom-built without benefit. | Either named option in the brief remains acceptable. |
| A-12 | Customer status values are `active` and `inactive`. User status values are `active`, `inactive`, and `invited`. Order status values are `completed`, `voided`, and `cancelled`. | Enum changes must happen before implementation. |
| A-13 | `customer_type` is a free descriptive label for the MVP (`individual` only in seed) and is not used for segmentation. | C-02 may replace this. |
| A-14 | Account anniversary is the date the customer record was created, until C-03 is answered. | The trigger may be removed or redefined. |
| A-15 | The on-demand jobs for segmentation, promotions, inventory evaluation, and anomalies are HTTP endpoints. A Windows Task Scheduler or a later worker can call them. No always-on queue is required for the MVP. | A hosted scheduler is a deployment concern. |
| A-16 | Password policy: 10 characters minimum, at least one letter and one number. No expiry in the MVP. | A stricter policy can be added in validation. |
| A-17 | Prisma is the ORM. Sequelize will not be used. | None, unless the team rejects Prisma. |

## 23. Constraints

- MVP database is SQLite.
- The application must run locally on Windows with Node.js LTS.
- Implementation starts only after this documentation set is approved.
- External credentials are unavailable, so POS and messaging stay mocked.
- Do not hard-code secrets.
- Do not add features that are not in this SRS.
- Do not over-build a distributed system for a single-clinic local MVP.

## 24. Risks

| ID | Risk | Impact | Mitigation |
| --- | --- | --- | --- |
| R-01 | Discount and void behavior is unspecified, but anomaly stories depend on it. | Those detectors would be fake or incomplete. | Block FR-ANM discount and void rules on C-04. Implement large-amount and spike rules first. |
| R-02 | Orders entered in CareNexa and orders synced from POS can double-count. | Sales, CLV, and stock become wrong. | Require external ids and idempotent sync (C-05) before POS sync is considered done. |
| R-03 | Live marketing without consent conflicts with the Data Privacy Act. | Legal exposure for EFC. | Keep providers mocked. Do not connect Twilio, Semaphore, or SendGrid until C-06 is decided. |
| R-04 | SQLite write locking under a single local user is acceptable, and is a poor production fit. | Clinic concurrency issues if SQLite is left in production. | Keep SQL portable. Plan PostgreSQL before multi-user production. |
| R-05 | Overlapping segments confuse “percent of customers” claims. | Managers misread the dashboard. | Label overlap. Avoid exclusive percentages unless a priority rule is approved. |
| R-06 | Calling rules “AI” erodes trust. | Users act on unexplained numbers. | Mandatory finding contract and `rule-based` label. |
| R-07 | JWT logout does not revoke a stolen token before expiry. | Stolen token remains usable for up to 8 hours. | Short lifetime, status check, HTTPS in any deployed environment. Add a denylist if the clinic requires immediate revocation. |
| R-08 | Buy 3 Get 1 cannot be redeemed in Loyverse from CareNexa in the MVP. | Staff may think the free item is applied at the till. | UI copy must say “eligible,” not “discount applied at POS.” |

## 25. Future Enhancements

- Loyverse provider on the POS port
- Semaphore or Twilio, and SendGrid, after consent rules exist
- PostgreSQL and hosted deployment
- PDF and Excel renderers on the report table model
- Model-based insight provider
- Multi-branch
- Booking and a real promotion redemption flow inside the POS
- Refresh tokens and a revocation list
- Filipino and English UI

## 26. Gaps, ambiguities, and dependencies

### 26.1 Ambiguous requirements

| ID | Topic | What is unclear |
| --- | --- | --- |
| C-01 | Customer lifetime value | The brief lists CLV separately from total spending, visit count, and average transaction value, and also asks for a predictive-sounding “lifetime value,” without a formula. |
| C-02 | `customer_type` versus segment | Both exist. Allowed values and business meaning of `customer_type` are not defined. |
| C-03 | Anniversary promotion | It is unclear whether anniversary means first visit, account creation, or a treatment date. |
| C-04 | Discounts and voids | Anomaly examples require discounts and repeated voids. The order entity has neither discount, void actor, nor void reason. |
| C-05 | Identity across POS and CareNexa | Sync cannot be idempotent without an external id on customers, products, and orders. |
| C-06 | Marketing consent | Philippine privacy obligations for SMS and email are not specified. There is no consent field. |
| C-07 | Campaign suggestion priority | The insight “who should we contact” needs an approved segment priority. |
| C-08 | Buy 3 Get 1 reward | The free item, whether it must be the same SKU, and whether eligibility expires are not defined. |
| C-09 | Primary segment | BR-001 allows many segments. The customer list still needs a display choice when space allows one badge. |
| C-10 | Tax and discounts in totals | It is unclear whether `total_amount` is gross, net of discount, or VAT-inclusive. |

### 26.2 Missing requirements

The source brief does not specify:

- Multi-branch or device/register identity
- Retention period for audit logs and message logs
- Password reset by email
- Backup and restore procedure for the SQLite file
- Who may mark an anomaly as false positive (this SRS proposes MANAGER and ADMIN)
- Business hours or quiet hours for automated messages
- Refunds as a flow distinct from voids
- Per-item discount versus order discount
- Whether staff may see other staff members’ activity notes (this SRS allows it inside the clinic)
- Accessibility standard (this SRS targets practical keyboard access and contrast, not a formal WCAG audit)
- Production hosting, domain, and TLS ownership

### 26.3 Dependencies

| Dependency | Needed for |
| --- | --- |
| Approved SRS and architecture set | Any application code |
| Node.js LTS and npm on Windows | Local run |
| Decision on C-04 | Discount and void anomaly tests |
| Decision on C-05 | Mock POS sync acceptance |
| Decision on C-01 and C-02 | Wording on the customer profile |
| Decision on C-06 | Any non-mock messaging |
| Fictional seed content only | Demo and tests |

### 26.4 Recommended decision for approval

Approve the specified rules BR-001 through BR-010, the functional requirements, and assumptions A-01 through A-17 as the MVP baseline.

Treat BR-011 through BR-020 as accepted unless a stakeholder edits them in review.

Defer live providers. Implement anomaly rules that need discount or void data only after C-04 adds the fields. Implement sync idempotency only after C-05 adds external ids.

## 27. Approval

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Product owner | | Pending | |
| Engineering | | Pending | |

Implementation is blocked until this table records approval or a revised version replaces 0.1.
