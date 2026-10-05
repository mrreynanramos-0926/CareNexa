UPDATE "business_profile"
SET
  "trade_name" = 'The Executive Facial Care',
  "address_line1" = 'Jaka Plaza',
  "barangay" = 'Sucat',
  "city" = 'Parañaque',
  "province" = 'Metro Manila',
  "phone" = '0942-052-7720',
  "receipt_footer" = ''
WHERE "id" = 'default'
  AND "address_line1" = ''
  AND "phone" = '';
