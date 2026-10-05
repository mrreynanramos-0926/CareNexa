# CareNexa API Specification

| Field | Value |
| --- | --- |
| Version | 0.1 Draft |
| Status | Pending approval |
| Date | 2026-10-03 |
| Base URL | `/api` |
| Format | JSON, UTF-8 |

OpenAPI file `backend/openapi.yaml` is an implementation deliverable and must match this document.

## 1. Conventions

### 1.1 Authentication

Protected routes require:

```
Authorization: Bearer <jwt>
```

Public route: `POST /api/auth/login` only.

### 1.2 Success envelope

Single resource:

```json
{ "data": {} }
```

List:

```json
{
  "data": [],
  "page": 1,
  "pageSize": 25,
  "total": 0
}
```

Job result:

```json
{
  "data": {
    "processed": 0,
    "created": 0,
    "updated": 0,
    "skipped": 0
  }
}
```

### 1.3 Error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Phone is already in use.",
    "details": [{ "field": "phone", "message": "Phone is already in use." }]
  }
}
```

| HTTP | code | When |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | Body or query failed validation |
| 401 | UNAUTHORIZED | Missing, expired, or invalid token, or bad login |
| 403 | FORBIDDEN | Authenticated role may not perform the action |
| 404 | NOT_FOUND | Id does not exist |
| 409 | CONFLICT | Unique constraint or illegal state change |
| 422 | BUSINESS_RULE | A business rule rejected the action |
| 500 | INTERNAL | Unexpected failure; no stack trace in the body |

Login failure uses 401 and a generic message: “Email or password is incorrect.” Inactive accounts use the same message so the API does not reveal account state more than necessary. The audit log may store the reason for admins.

### 1.4 Pagination, sort, and dates

Query parameters for lists:

| Param | Default | Notes |
| --- | --- | --- |
| page | 1 | minimum 1 |
| pageSize | 25 | maximum 100 |
| sort | resource default | field name |
| direction | desc or asc | |

Date filters `from` and `to` are `YYYY-MM-DD` in Asia/Manila, inclusive.

Money in JSON is a string with two decimals (`"1500.00"`) plus the centavo integer only inside the database. Clients never send floating binary money. The API accepts a decimal string.

### 1.5 Roles

`ADMIN`, `MANAGER`, and `STAFF` match the SRS matrix. Where this document says “Manager,” ADMIN is included. “Staff” means STAFF only.

## 2. Auth

### POST /api/auth/login

Public.

Body: `{ "email": "manager@carenexa.local", "password": "..." }`

Response 200: `{ "data": { "token": "...", "user": { "id", "name", "email", "role", "mustChangePassword" } } }`

Errors: 401, 400.

Audit: login success and failure (failure stores email and result, not password).

### POST /api/auth/logout

Authenticated.

Response 204 empty. Audit: logout. Client deletes the token.

### GET /api/auth/me

Authenticated.

Response: current user without `password_hash`.

### POST /api/auth/change-password

Authenticated.

Body: `{ "currentPassword": "...", "newPassword": "..." }`

Response 204. Errors: 400 when the new password fails policy, 401 when the current password is wrong.

## 3. Users

ADMIN only.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/users | List users |
| POST | /api/users | Create user |
| PUT | /api/users/:id | Update name, role, or status |
| POST | /api/users/:id/reset-password | Set a temporary password and `mustChangePassword` |

Create body: `{ "name", "email", "password", "role" }` where role is `ADMIN`, `MANAGER`, or `STAFF`.

The API does not return password hashes.

## 4. Customers

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| GET | /api/customers | All | Search and list |
| GET | /api/customers/:id | All | 360-degree profile |
| POST | /api/customers | All | Create |
| PUT | /api/customers/:id | All | Update |
| POST | /api/customers/:id/deactivate | Manager | Set status inactive |

Query: `search`, `status`, `segmentId`, `customerType`, `sort` (`name`, `lastVisit`, `totalSpent`, `createdAt`).

List item includes name, contact, status, type, segment names, total spent, visit count, last visit.

Profile `data` includes customer, segments, value snapshot, orders with lines, and activities.

Create and update body:

```json
{
  "firstName": "Maria",
  "lastName": "Santos",
  "email": "maria.santos@example.com",
  "phone": "09000000001",
  "birthday": "1992-04-03",
  "address": "Makati",
  "customerType": "individual",
  "status": "active"
}
```

There is no general `DELETE`. Deactivation preserves history (FR-CRM-06). ADMIN may call `DELETE /api/customers/:id` only when the customer has no orders; otherwise 409.

## 5. Activities

| Method | Path | Roles |
| --- | --- | --- |
| GET | /api/customers/:id/activities | All |
| POST | /api/customers/:id/activities | All |

Body: `{ "type": "note", "notes": "...", "activityDate": "2026-10-03T02:00:00.000Z" }`

## 6. Segments

| Method | Path | Roles |
| --- | --- | --- |
| GET | /api/segments | All |
| GET | /api/segments/:id | All |
| POST | /api/segments | Manager |
| PUT | /api/segments/:id | Manager |
| POST | /api/segments/rebuild | Manager |

PUT replaces `name`, `description`, and `criteria`.

`POST /api/segments/rebuild` runs segmentation for every active customer and returns the job envelope.

GET `/:id` includes member count and criteria. Members are listed with `GET /api/segments/:id/members` using pagination.

## 7. Customer value

| Method | Path | Roles |
| --- | --- | --- |
| GET | /api/customers/:id/value | All |
| POST | /api/customers/:id/value/recalculate | Manager |
| POST | /api/customer-value/recalculate | Manager |

Response fields: `totalSpent`, `visitCount`, `averageTransactionValue`, `lastVisitDate`, `calculatedAt`, `method: "historical_completed_orders"`.

## 8. Catalog and inventory

| Method | Path | Roles |
| --- | --- | --- |
| GET | /api/products | All |
| POST | /api/products | Manager |
| PUT | /api/products/:id | Manager |
| GET | /api/inventory | All |
| GET | /api/inventory/:id | All |
| PUT | /api/inventory/:id | Manager |
| POST | /api/inventory/restock | Manager |
| POST | /api/inventory/adjustments | Manager |
| GET | /api/inventory/:id/movements | All |
| GET | /api/inventory/alerts | All |
| POST | /api/inventory/evaluate | Manager |

Restock body: `{ "productId", "quantity", "unitCost" }`

Adjustment body: `{ "productId", "quantityDelta", "note" }`

PUT inventory updates reorder level, reorder quantity, and unit cost. It does not set stock directly; stock changes go through restock, adjustment, or orders.

Product body includes `tracksInventory`. When true, creating the product also creates an inventory row with zero stock.

## 9. Orders

| Method | Path | Roles |
| --- | --- | --- |
| GET | /api/orders | All |
| GET | /api/orders/:id | All |
| POST | /api/orders | All |
| POST | /api/orders/:id/void | Manager |
| POST | /api/orders/:id/cancel | Manager |

List filters: `from`, `to`, `status`, `customerId`, `source`.

Create body:

```json
{
  "customerId": "...",
  "orderDate": "2026-10-03T04:00:00.000Z",
  "source": "manual",
  "lines": [
    { "productId": "...", "quantity": 1, "unitPrice": "1800.00" }
  ]
}
```

The server computes subtotals and total. If `unitPrice` is omitted, the current catalog price is used. Status of a created order is `completed`.

Void body: `{ "reason": "..." }`. Blocked for a full implementation of repeated-void anomalies until C-04. The endpoint is still specified so order correction exists for BR-012.

Insufficient stock returns 422 `BUSINESS_RULE`.

## 10. Campaigns and promotions

| Method | Path | Roles |
| --- | --- | --- |
| GET | /api/campaigns | Manager |
| GET | /api/campaigns/:id | Manager |
| POST | /api/campaigns | Manager |
| PUT | /api/campaigns/:id | Manager |
| POST | /api/campaigns/:id/activate | Manager |
| POST | /api/campaigns/:id/deactivate | Manager |
| GET | /api/trigger-rules | Manager |
| POST | /api/trigger-rules | Manager |
| PUT | /api/trigger-rules/:id | Manager |
| POST | /api/promotions/evaluate | Manager |
| GET | /api/messages | Manager |

Campaign body:

```json
{
  "name": "October facial offer",
  "type": "promotional",
  "channel": "sms",
  "targetSegmentId": "...",
  "message": "Hi {{first_name}}, ...",
  "startDate": "2026-10-01",
  "endDate": "2026-10-31"
}
```

Activate returns counts of messages created and skipped. Delivery is mock-sent.

Message list filters: `campaignId`, `customerId`, `status`, `channel`.

## 11. Analytics

Manager only, except the staff dashboard.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/analytics/dashboard | Executive payload for the date range |
| GET | /api/analytics/dashboard/basic | Staff payload |
| GET | /api/analytics/sales | Daily, weekly, or monthly buckets |
| GET | /api/analytics/customers | Growth and status counts |
| GET | /api/analytics/inventory | Stock status and movers |

Query: `from`, `to`. Sales also accepts `bucket=day|week|month` and `groupBy=product|service|segment`.

Dashboard `data` contains:

- customerCounts: total, new, active, inactive, vip
- sales: total, averageTransactionValue
- customerValue: sum of historical totals, average of historical totals
- topItems: up to 5
- lowStock: open alerts
- slowMoving: current window
- recentOrders: latest 10 in range
- campaigns: sent and failed counts in range
- anomalies: open count
- insights: up to 5 findings, same contract as the insights endpoint

Charts receive series arrays `{ "label", "value" }`, not raw orders.

## 12. Insights and anomalies

### GET /api/ai/recommendations

Manager. Query: `from`, `to`.

Returns customer, sales, and marketing findings. `producer` is `rule-based`.

### GET /api/ai/inventory

Manager. Inventory findings for the same contract.

### GET /api/ai/anomalies

Manager.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/ai/anomalies | List alerts. Filters: `status`, `severity`, `type`, `from`, `to` |
| POST | /api/ai/anomalies/evaluate | Run detectors |
| PUT | /api/ai/anomalies/:id | Update status and review notes |

The path prefix `/api/ai` is kept because the brief requested it. Responses include `producer: "rule-based"` so the path is not mistaken for a model.

Evaluate response lists alerts created. Existing open duplicates are skipped.

## 13. Reports

Manager. Each route accepts the relevant filters and `format=json|csv`.

| Method | Path |
| --- | --- |
| GET | /api/reports/customers |
| GET | /api/reports/sales |
| GET | /api/reports/inventory |
| GET | /api/reports/campaigns |
| GET | /api/reports/segments |
| GET | /api/reports/customer-value |
| GET | /api/reports/anomalies |

`format=json` uses the list envelope (pagination applies).

`format=csv` returns `text/csv` and `Content-Disposition: attachment`. Pagination is ignored up to the 10,000-row cap. The JSON error envelope is used if the cap is exceeded (422) so the client can narrow filters.

## 14. Audit and settings

| Method | Path | Roles |
| --- | --- | --- |
| GET | /api/audit-logs | ADMIN |
| GET | /api/settings | ADMIN |
| PUT | /api/settings/:key | ADMIN |

Audit filters: `from`, `to`, `userId`, `entity`, `action`.

Settings keys are the threshold names from SRS A-02. Unknown keys return 404. Values are JSON numbers or strings as documented in DATABASE.md.

## 15. POS

| Method | Path | Roles |
| --- | --- | --- |
| POST | /api/pos/sync | Manager |
| GET | /api/pos/sync/status | Manager |

Body: `{ "resources": ["customers", "transactions", "inventory"] }`

Response uses the job envelope plus `provider: "mock"`.

Sync of transactions is not acceptance-complete until external ids exist (SRS C-05).

## 16. Health

### GET /api/health

Public. `{ "data": { "status": "ok" } }`

Does not report database file paths or versions in detail beyond `{ "database": "up" | "down" }`.

## 17. Standard headers

Responses set `Content-Type: application/json; charset=utf-8` except CSV.

Clients send `Content-Type: application/json` on bodies.

## 18. Idempotency and concurrency

- Campaign activation is safe to retry because of `dedupe_key`.
- Segmentation rebuild is safe to retry.
- Order create is not idempotent in the MVP. A double submit can create two orders. The UI disables the submit button while the request is in flight. POS sync idempotency is separately required by C-05.
- Stock updates use a transaction. SQLite serializes writes. The service re-reads stock inside the transaction before decrementing.
