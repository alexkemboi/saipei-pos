-- Partial unique indexes and data-integrity checks that Prisma cannot express
-- in schema.prisma. Applied after `prisma db push` by apply-indexes.mjs.
-- Every statement is idempotent, so the script can be re-run safely.

-- Optional columns that must be unique *when present*. (PostgreSQL already
-- allows many NULLs in a unique index; the WHERE clause keeps the index small
-- and documents the intent.)
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Product_barcode"
  ON "Product" ("barcode")
  WHERE "barcode" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "UX_MpesaTransaction_checkoutRequestId"
  ON "MpesaTransaction" ("checkoutRequestId")
  WHERE "checkoutRequestId" IS NOT NULL;

-- One import order per purchase order, while still allowing many import
-- orders that were raised without one.
CREATE UNIQUE INDEX IF NOT EXISTS "UX_ImportOrder_purchaseOrderId"
  ON "ImportOrder" ("purchaseOrderId")
  WHERE "purchaseOrderId" IS NOT NULL;

-- Case-insensitive sign-in: 'Admin' and 'admin' must not be two accounts.
CREATE UNIQUE INDEX IF NOT EXISTS "UX_User_username_lower" ON "User" (lower("username"));
CREATE UNIQUE INDEX IF NOT EXISTS "UX_User_email_lower" ON "User" (lower("email"));
