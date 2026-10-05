ALTER TABLE "orders" ADD COLUMN "payment_status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "orders" ADD COLUMN "created_by" TEXT;

CREATE TABLE "payment_methods" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "allows_change" BOOLEAN NOT NULL DEFAULT false,
  "requires_reference" BOOLEAN NOT NULL DEFAULT false,
  "qr_config" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "payment_methods_code_key" ON "payment_methods"("code");
CREATE INDEX "payment_methods_category_display_order_idx" ON "payment_methods"("category", "display_order");

CREATE TABLE "order_payments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "order_id" TEXT NOT NULL,
  "payment_method_id" TEXT NOT NULL,
  "amount_centavos" INTEGER NOT NULL,
  "reference_number" TEXT NOT NULL DEFAULT '',
  "authorization_code" TEXT NOT NULL DEFAULT '',
  "card_last_four" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "payment_status" TEXT NOT NULL DEFAULT 'PAID',
  "paid_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "order_payments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "order_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "order_payments_order_id_idx" ON "order_payments"("order_id");
CREATE INDEX "order_payments_payment_method_id_idx" ON "order_payments"("payment_method_id");

INSERT INTO "payment_methods" ("id", "name", "category", "provider", "code", "description", "is_active", "display_order", "allows_change", "requires_reference", "created_at", "updated_at") VALUES
('pm_cash', 'Cash', 'CASH', 'Cash', 'CASH', '', 1, 1, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pm_gcash', 'GCash', 'EWALLET', 'GCash', 'GCASH', '', 1, 2, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pm_maya', 'Maya', 'EWALLET', 'Maya', 'MAYA', '', 1, 3, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pm_gcash_qr', 'GCash QR', 'QR', 'GCash', 'GCASH_QR', '', 1, 4, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pm_maya_qr', 'Maya QR', 'QR', 'Maya', 'MAYA_QR', '', 1, 5, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pm_other_qr', 'Other QR', 'QR', 'Other', 'OTHER_QR', '', 1, 6, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pm_visa', 'Visa', 'CARD', 'Visa', 'VISA', '', 1, 7, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pm_mastercard', 'Mastercard', 'CARD', 'Mastercard', 'MASTERCARD', '', 1, 8, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pm_amex', 'American Express', 'CARD', 'American Express', 'AMEX', '', 1, 9, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pm_jcb', 'JCB', 'CARD', 'JCB', 'JCB', '', 1, 10, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pm_other_card', 'Other Card', 'CARD', 'Other', 'OTHER_CARD', '', 1, 11, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
