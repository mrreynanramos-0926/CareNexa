# CareNexa Payment Module

Status: implemented for payment recording. This is not a payment gateway.

The order screen records how a customer paid. It does not charge GCash, Maya, a QR network, or a card processor. Those names are payment methods stored in the database. A later provider class can perform a real charge without changing the balance math.

## Requirements

- An order can be paid with one or more methods.
- Methods come from `payment_methods`. The checkout does not hard-code Cash, GCash, Maya, or card brands.
- Categories are `CASH`, `EWALLET`, `QR`, and `CARD`. A category has many providers (Cash, GCash, Maya, Visa, and later GrabPay or UnionPay).
- Seeded methods start active: Cash; GCash; Maya; GCash QR; Maya QR; Other QR; Visa; Mastercard; American Express; JCB; Other Card.
- Administrators can add, edit, enable, disable, and reorder methods. Disabling sets `is_active` to false. Methods that already have payments are not deleted, so old receipts still show the original name.
- Only an active method can be used on a new payment. An inactive method still appears on historical payments.
- Checkout can be completed only when the balance due is zero. A short payment shows `Payment is incomplete. Remaining balance: ₱…` and does not save the order.
- The API can store a partial payment when `allowPartial` is true. The order stays `PARTIALLY_PAID` until the balance is zero.
- Cash may be more than the remaining balance. The extra is change. Other methods are rejected with `Payment amount exceeds the remaining balance.` unless that method has `allows_change` turned on.
- Card records store the brand (the payment method) and, optionally, the last 4 digits, a reference, and an authorization code. Full card numbers, CVV, PIN, and expiration data are rejected and are not stored.
- Each recorded payment writes an audit row, action `PAYMENT_RECORDED`.
- The dashboard can total completed-order sales and recorded payments by method for today, yesterday, this week, this month, or a custom Manila date range.

## Money formula

These stay separate:

- Subtotal = service lines + medicine lines + PPE + gift certificate
- Discount
- Tip
- Net total = subtotal − discount + tip
- Total paid = sum of payments that are still `PAID`
- Balance due = net total − total paid, and never below zero
- Change = cash (or a method explicitly allowed to give change) received above the balance that was still due when that payment was applied

`orders.total_centavos` stores the net total when the checkout sends a `payments` array. Older callers that omit `payments` (the current tests and mock POS sync) keep the previous total, which does not add tip. Tip on that older path is still stored and is still subtracted from the tender only when there are no `order_payments` rows.

Amounts are integer centavos in SQLite. The API returns peso strings with two decimals, the same as the rest of CareNexa (`"1500.00"`), not bare numbers.

## Data model

`PaymentMethod` (`payment_methods`)

- `id`, `name`, `category`, `provider`, `code` (unique)
- `description`, `is_active`, `display_order`
- `allows_change` (default false; cash still allows change because its category is `CASH`)
- `requires_reference` (default false)
- `qr_config` (optional text for a future QR image or payload; nothing is generated now)
- `created_at`, `updated_at`

`OrderPayment` (`order_payments`)

- `id`, `order_id`, `payment_method_id`, `amount_centavos`
- `reference_number`, `authorization_code`, `card_last_four`, `notes`
- `payment_status`: `PENDING`, `PAID`, `PARTIALLY_PAID`, `FAILED`, `VOIDED`, `REFUNDED`
- Recorded checkout lines use `PAID`
- `paid_at`, `created_by`, `created_at`, `updated_at`

`Order` gains `payment_status` and `created_by`. Existing sale status (`completed`, `voided`, `cancelled`) is unchanged. One order has many payments. Each payment has one method.

Voiding or cancelling an order marks its payments `VOIDED`. It does not delete them.

## Payment flow

1. The checkout loads `GET /api/payment-methods/active`.
2. The user picks a category, then a method, then enters an amount and the fields that method needs.
3. Add Payment keeps the line on the screen. Remove drops an unsaved line. Totals recalculate immediately.
4. Complete Order sends the lines with the order. The server prices the order, checks stock, validates every method and amount, then saves the order and the payments together.
5. If the balance is not zero, nothing is saved.
6. A later payment on an existing order uses `POST /api/orders/:orderId/payments`. `POST /api/orders/:orderId/complete` sets the order to `PAID` only when the balance is zero.
7. `DELETE /api/orders/:orderId/payments/:paymentId` physically removes a line only while the order is not fully paid. A paid order returns an error. Use void on the order after that.

`ManualPaymentProvider` implements `createPayment`, `verifyPayment`, `getPaymentStatus`, and `refundPayment`. Checkout uses `createPayment`, which marks the line `PAID` and does not call a bank or wallet. `verifyPayment` reports that the payment was recorded manually and was not verified with a provider.

## Business rules

- BR-PAY-001: An order may have many payment records.
- BR-PAY-002: A payment cannot exceed the remaining balance, except cash and methods with `allows_change`.
- BR-PAY-003: New payments use active methods only.
- BR-PAY-004: Inactive methods remain on historical payments.
- BR-PAY-005: Payments on a fully paid order are not deleted.
- BR-PAY-006: A full card number is never stored.
- BR-PAY-007: CVV and PIN are never stored.
- BR-PAY-008: Every payment belongs to an order.
- BR-PAY-009: Every payment names a payment method.
- BR-PAY-010: Paid amounts, balance, and change reconcile to the net total.
- BR-PAY-011: Cash may produce change.
- BR-PAY-012: A non-cash method does not produce change unless `allows_change` is enabled.

## API

Authenticated routes:

- `GET /api/payment-methods` lists every method. Administrator only.
- `GET /api/payment-methods/active` lists active methods in display order. Used by checkout.
- `POST /api/payment-methods` adds a method. Administrator only.
- `PUT /api/payment-methods/:id` edits a method, including display order. Administrator only.
- `PATCH /api/payment-methods/:id/status` body `{ "isActive": false }` enables or disables. Administrator only.
- `GET /api/orders/:orderId/payments`
- `POST /api/orders/:orderId/payments`
- `DELETE /api/orders/:orderId/payments/:paymentId`
- `POST /api/orders/:orderId/complete`
- `GET /api/orders/:orderId/payment-summary`
- `GET /api/analytics/payments?preset=today|yesterday|week|month` or `?from=YYYY-MM-DD&to=YYYY-MM-DD`. Manager or administrator.

`GET /api/orders/:orderId/payment-summary` example:

```json
{
  "orderTotal": "2500.00",
  "totalPaid": "1500.00",
  "balanceDue": "1000.00",
  "change": "0.00",
  "paymentStatus": "PARTIALLY_PAID",
  "payments": [
    { "method": "Cash", "category": "CASH", "amount": "500.00" },
    { "method": "GCash", "category": "EWALLET", "amount": "500.00" },
    { "method": "Visa", "category": "CARD", "amount": "500.00" }
  ]
}
```

`POST /api/orders` accepts the existing customer, lines, PPE, gift certificate, discount, and tip fields. `payments` is optional. When it is an array, each item is `{ "paymentMethodId", "amount", "referenceNumber", "authorizationCode", "cardLastFour", "notes" }`. Amounts are decimal strings such as `"500.00"`.

## UI

The order form keeps customer, service, medicine, PPE, gift certificate, discount, and tip. Below that, PAYMENT shows category tabs (Cash, E-Wallet, QR, Card). Each tab lists the active methods for that category by name, with an icon and a text label. Choosing a method shows amount, and then reference, card last 4, or authorization only when they apply. The summary shows bill breakdown, each payment, total paid, balance due, change, and status. A completed order opens a receipt with the same figures.

Settings links to Payment methods. That screen lists method, category, provider, code, status, and display order, and supports add, edit, enable, disable, and reorder.

The manager dashboard chart "Sales by Payment Method" uses the analytics endpoint above.

## Security

- Do not store a full PAN, CVV, PIN, or expiration. Requests that include those fields, or a 13–19 digit number in a reference, authorization code, note, or card field, are rejected.
- The card line may show `**** **** **** 1234`.
- No wallet or card credentials are stored in SQLite.
- Payment method changes and recorded payments are audit logged.
- Role checks stay on the server. Staff can record a payment. Only an administrator can change the method list.

## Tests

`backend/tests/payments.test.js` covers exact cash, cash change, a short GCash payment, a two-way split, a three-way split, and a rejected non-cash overpayment.

`backend/tests/api.test.js` covers a disabled method, no physical delete after the order is paid, card last-4 only, and a method added in admin appearing on the active list the checkout uses.
