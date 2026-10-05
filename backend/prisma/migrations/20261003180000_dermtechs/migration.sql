ALTER TABLE "products_services" ADD COLUMN "commission_flat_centavos" INTEGER;
ALTER TABLE "order_items" ADD COLUMN "dermtech_id" TEXT;

CREATE TABLE "dermtechs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "is_walk_in" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'active',
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "dermtechs_name_key" ON "dermtechs"("name");
CREATE INDEX "dermtechs_status_display_order_idx" ON "dermtechs"("status", "display_order");
CREATE INDEX "order_items_dermtech_id_idx" ON "order_items"("dermtech_id");

INSERT INTO "dermtechs" ("id", "name", "phone", "notes", "is_walk_in", "status", "display_order", "created_at", "updated_at") VALUES
('dt_antonet', 'Antonet', '', '', 0, 'active', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('dt_icel', 'Icel', '', '', 0, 'active', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('dt_jeniviv', 'Jeniviv', '', '', 0, 'active', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('dt_mary', 'Mary', '', '', 0, 'active', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('dt_khel', 'Khel', '', '', 0, 'active', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('dt_lei', 'Lei', '', '', 0, 'active', 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('dt_mitzie', 'Mitzie', '', '', 0, 'active', 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('dt_criza', 'Criza', '', '', 0, 'active', 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('dt_emmy', 'Emmy', '', '', 0, 'active', 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('dt_trixie', 'Trixie', '', '', 0, 'active', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('dt_dreana', 'Dreana', '', '', 0, 'active', 11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('dt_rose', 'Rose', '', '', 0, 'active', 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('dt_walkin', 'Walk-in', '', 'Sales that are not assigned to a named dermtech.', 1, 'active', 13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE "products_services" SET "commission_percent" = 0, "commission_flat_centavos" = 10000 WHERE "name" = 'FOOTSPA' AND "type" = 'service';
UPDATE "products_services" SET "commission_percent" = 0, "commission_flat_centavos" = 12000 WHERE "name" = 'FOOTSPA WITH PARAFFIN' AND "type" = 'service';
UPDATE "products_services" SET "commission_percent" = 0, "commission_flat_centavos" = 1000 WHERE "name" = 'Sunblock' AND "type" = 'service';
UPDATE "products_services" SET "commission_percent" = 0, "commission_flat_centavos" = 1000 WHERE "name" = 'Lifting Mask' AND "type" = 'service';
UPDATE "products_services" SET "commission_percent" = 0, "commission_flat_centavos" = 1000 WHERE "name" = 'Whitening Mask' AND "type" = 'service';
