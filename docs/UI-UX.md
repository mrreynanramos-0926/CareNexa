# CareNexa UI / UX Specification

| Field | Value |
| --- | --- |
| Version | 0.1 Draft |
| Status | Pending approval |
| Date | 2026-10-03 |

## 1. Product feel

CareNexa should look like an enterprise clinic operations tool: calm, sparse, and readable. The visual direction is professional healthcare and beauty combined with software clarity. Decoration, illustration-heavy empty states, and marketing-site layouts are out of place.

Primary jobs of the interface:

- scan clinic health in one dashboard
- find a customer and read their history
- record an order or a note with few fields
- act on stock, campaigns, and alerts

## 2. Layout

Desktop (1280 px and wider) and tablet (768 px to 1279 px) are the design targets. Below 768 px, navigation collapses into a menu and tables become stacked rows. Phone use is supported, not optimized.

Structure:

- Left navigation on desktop, top bar with the current user and logout
- Content column with a page title, short description, and primary action
- Filters directly above tables
- Detail pages use a header summary and stacked sections

No nested application inside the page. Modals are for short create and edit forms. Full profiles and reports are pages.

## 3. Navigation

Visible items depend on role. Hidden items are also blocked by the API.

| Item | Route | ADMIN | MANAGER | STAFF |
| --- | --- | --- | --- | --- |
| Dashboard | / | Yes | Yes | Yes, basic |
| Customers | /customers | Yes | Yes | Yes |
| Segments | /segments | Yes | Yes | Read only |
| Orders | /orders | Yes | Yes | Yes |
| Products & Services | /catalog | Yes | Yes | Read only |
| Inventory | /inventory | Yes | Yes | Read only |
| Marketing | /marketing | Yes | Yes | No |
| Promotions | /promotions | Yes | Yes | No |
| Analytics | /analytics | Yes | Yes | No |
| AI Insights | /insights | Yes | Yes | No |
| Reports | /reports | Yes | Yes | No |
| Users | /users | Yes | No | No |
| Audit Logs | /audit | Yes | No | No |
| Settings | /settings | Yes | No | No |

The insights navigation label is **AI Insights**. The page heading is **Rule-based insights**, with one line of helper text: “These findings are calculated from CareNexa records. They are not a machine-learning model.”

## 4. Visual system

Assumption A-11. Tokens, not one-off colors.

| Token | Use | Value |
| --- | --- | --- |
| Ink | Primary text | `#1C2430` |
| Muted | Secondary text | `#5C6B7A` |
| Surface | Page background | `#F4F6F8` |
| Card | Panels | `#FFFFFF` |
| Line | Borders | `#E2E8EE` |
| Brand | Navigation and primary buttons | `#0F6E6B` |
| Brand strong | Header bar | `#0C3B4A` |
| Danger | Errors, out of stock, high severity | `#9B2C2C` |
| Warning | Low stock, medium severity | `#8A5A00` |
| Success | Sent, resolved, in stock | `#1F7A4D` |
| Info | New, reviewing | `#1D4E89` |

Typography: a single sans-serif stack (`Segoe UI`, system-ui). Titles 24 px, section titles 18 px, body 14 px, table text 14 px. Currency is right-aligned in tables and formatted `₱1,500.00`.

Status uses a text badge plus color, never color alone.

## 5. Shared components

| Component | Behavior |
| --- | --- |
| Metric card | Label, value, optional comparison caption |
| Filter bar | Date range, search, status; Apply and Reset |
| Data table | Header sort, pagination, empty row message |
| Modal form | Label above each field, inline error, primary and cancel actions |
| Status badge | Maps status enums to label and color |
| Chart card | Title, one chart, source caption |
| Insight card | Statement, source, reason, basis, action |
| Empty state | What is missing and the one action that fixes it |
| Insufficient data | Exact sentence from FR-AI-03 |

Buttons: one primary action per view. Destructive actions use a confirm step that names the record.

## 6. Key screens

### 6.1 Login

Email, password, submit. Error text uses the API message. No self-registration.

### 6.2 Dashboard

Manager and admin see the cards and charts required by FR-DSH-01 through FR-DSH-05. Staff see customer totals, recent orders, and low-stock counts without campaign, anomaly management, or insight charts.

Each chart has a date range shared with the page filter. Segment charts include the caption “Customers may belong to more than one segment.”

### 6.3 Customers

List: search, status, segment, sort. Columns: name, phone, segments, total spent, visits, last visit, status.

Profile sections, in order: contact and status, value metrics, segments, orders, activities. Actions: edit, add activity, new order.

Value metrics are labeled “Historical value from completed orders.”

### 6.4 Segments

List of segments with member counts. Editor for name, description, and criteria rules (field, operator, value, optional window). A “Rebuild memberships” action shows the job result.

### 6.5 Orders

List plus a create form: customer, date, lines (item, quantity, price), computed total. Void and cancel are manager actions with a reason field.

### 6.6 Catalog and inventory

Catalog table distinguishes product and service. Inventory table shows stock, reorder level, status, and last restock. Restock and adjustment open modals. A history drawer lists movements. Alerts appear as a list on the same page.

### 6.7 Marketing and promotions

Campaign list and a form for the fields in API.md. Detail page shows message status counts and a recipient table. Activation states that messages are simulated and not delivered to phones or inboxes.

Promotion page lists trigger rules and a “Run evaluation” action with the job summary.

### 6.8 Analytics

Tabs or stacked sections for sales trend, group-by product, service, and segment, and customer growth. Date filter is required and visible.

### 6.9 Insights

Five groups: inventory, sales, customers, marketing, anomalies. Each card is one finding. The insufficient-data state replaces the group when the API says so. Recommended actions link to the relevant screen (inventory, segment, campaign, anomaly queue) and do not auto-run the action.

### 6.10 Reports

One page with a report picker, filters, a preview table, and Export CSV.

### 6.11 Users, audit, settings

Users: table and create modal. Audit: filterable read-only table, before and after values in a row expansion. Settings: form of the approved threshold keys with their units written beside the fields (days, PHP, percent, count).

## 7. Interaction rules

- Save buttons stay disabled until required fields are valid on the client, and the server result is still shown if it disagrees.
- Lists remember filter state in the query string so refresh keeps the view.
- Dates display in Asia/Manila.
- Failed requests show the API `error.message` and field details next to inputs.
- Loading uses a quiet inline state. The layout does not jump when numbers arrive.
- Notes and campaign messages render as text, not HTML.

## 8. Copy rules

- Call the insights producer rule-based wherever a result is shown.
- Call Buy 3 Get 1 style outcomes “eligible,” not “redeemed at the POS.”
- Call mock SMS and email “simulated send.”
- Empty data uses “Insufficient data to generate this recommendation.” when the API returns that finding.
- Do not use the words “predicted by AI” or “model confidence.”

## 9. Accessibility baseline

- Form fields have visible labels.
- Focus states are visible on the brand and neutral surfaces.
- Dialogs trap focus and close on Escape.
- Tables have header cells.
- Status is text plus color.
- Contrast for body text on white and on the header bar meets WCAG AA for normal text as a design target. A formal audit is out of scope (SRS section 26.2).
