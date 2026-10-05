CREATE TABLE "business_profile" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
  "legal_name" TEXT NOT NULL,
  "trade_name" TEXT NOT NULL,
  "business_type" TEXT NOT NULL DEFAULT 'Sole proprietorship',
  "tin" TEXT NOT NULL DEFAULT '',
  "address_line1" TEXT NOT NULL DEFAULT '',
  "barangay" TEXT NOT NULL DEFAULT '',
  "city" TEXT NOT NULL DEFAULT '',
  "province" TEXT NOT NULL DEFAULT '',
  "postal_code" TEXT NOT NULL DEFAULT '',
  "country" TEXT NOT NULL DEFAULT 'Philippines',
  "phone" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "website" TEXT NOT NULL DEFAULT '',
  "hours" TEXT NOT NULL DEFAULT '',
  "receipt_footer" TEXT NOT NULL DEFAULT '',
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "business_profile" (
  "id", "legal_name", "trade_name", "business_type", "tin",
  "address_line1", "barangay", "city", "province", "postal_code", "country",
  "phone", "email", "website", "hours", "receipt_footer", "updated_at"
) VALUES (
  'default',
  'Executive Facial Care',
  'Executive Facial Care',
  'Sole proprietorship',
  '',
  '',
  '',
  'Metro Manila',
  'Metro Manila',
  '',
  'Philippines',
  '',
  '',
  '',
  'Daily, 10:00 AM – 8:00 PM',
  'Thank you for visiting Executive Facial Care.',
  CURRENT_TIMESTAMP
);
