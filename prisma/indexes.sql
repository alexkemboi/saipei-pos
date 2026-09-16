-- Filtered unique indexes.
--
-- SQL Server treats NULL as a value in a plain UNIQUE index, so only one row
-- may be NULL. These columns are optional but must be unique *when present*,
-- which SQL Server expresses as a filtered index. Prisma cannot describe them
-- in schema.prisma, so they are applied here after `prisma db push`.

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Product_barcode')
  CREATE UNIQUE INDEX UX_Product_barcode
    ON [Product] ([barcode])
    WHERE [barcode] IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_MpesaTransaction_checkoutRequestId')
  CREATE UNIQUE INDEX UX_MpesaTransaction_checkoutRequestId
    ON [MpesaTransaction] ([checkoutRequestId])
    WHERE [checkoutRequestId] IS NOT NULL;

-- One import order per purchase order, while still allowing many import
-- orders that were raised without one.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_ImportOrder_purchaseOrderId')
  CREATE UNIQUE INDEX UX_ImportOrder_purchaseOrderId
    ON [ImportOrder] ([purchaseOrderId])
    WHERE [purchaseOrderId] IS NOT NULL;
