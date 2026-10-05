ALTER TABLE "products_services" ADD COLUMN "cash_price_centavos" INTEGER;
ALTER TABLE "products_services" ADD COLUMN "commission_percent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "ppe_centavos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "gc_centavos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "tip_centavos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "payments_json" TEXT;
ALTER TABLE "order_items" ADD COLUMN "price_rate" TEXT NOT NULL DEFAULT 'regular';
