-- ===========================================================================
-- SAIPEI POS - seed data (PostgreSQL)
-- Mirrors prisma/seed.ts: permissions, roles, test users, branch/warehouses,
-- reference data, opening stock and settings. Idempotent - safe to re-run.
-- Passwords are bcrypt-hashed with pgcrypto (compatible with bcryptjs).
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- Permissions ---------------------------------------------------------------
INSERT INTO "Permission" ("id","code","module","label") VALUES
  (gen_random_uuid(),'dashboard.view','Dashboard','View dashboard'),
  (gen_random_uuid(),'dashboard.financials','Dashboard','View profit and margin figures'),
  (gen_random_uuid(),'pos.sell','Sales & POS','Operate the POS till'),
  (gen_random_uuid(),'pos.discount','Sales & POS','Apply discounts'),
  (gen_random_uuid(),'sales.view','Sales & POS','View sales'),
  (gen_random_uuid(),'sales.credit','Sales & POS','Sell on credit'),
  (gen_random_uuid(),'sales.void','Sales & POS','Void a sale'),
  (gen_random_uuid(),'sales.return','Sales & POS','Process sales returns'),
  (gen_random_uuid(),'customers.manage','Sales & POS','Manage customers'),
  (gen_random_uuid(),'inventory.view','Warehousing & Inventory','View stock'),
  (gen_random_uuid(),'inventory.receive','Warehousing & Inventory','Receive goods'),
  (gen_random_uuid(),'inventory.transfer','Warehousing & Inventory','Transfer stock'),
  (gen_random_uuid(),'inventory.adjust','Warehousing & Inventory','Adjust stock'),
  (gen_random_uuid(),'inventory.stocktake','Warehousing & Inventory','Run stock takes'),
  (gen_random_uuid(),'products.manage','Warehousing & Inventory','Manage products'),
  (gen_random_uuid(),'purchasing.view','Purchasing','View purchasing'),
  (gen_random_uuid(),'purchasing.manage','Purchasing','Create purchase orders and invoices'),
  (gen_random_uuid(),'purchasing.approve','Purchasing','Approve purchase orders'),
  (gen_random_uuid(),'suppliers.manage','Purchasing','Manage suppliers'),
  (gen_random_uuid(),'imports.view','Import & Clearing','View imports'),
  (gen_random_uuid(),'imports.manage','Import & Clearing','Manage imports, shipments and documents'),
  (gen_random_uuid(),'imports.costs','Import & Clearing','Capture landed costs and customs'),
  (gen_random_uuid(),'finance.view','Finance & Expenses','View finance'),
  (gen_random_uuid(),'finance.payments','Finance & Expenses','Record payments and receipts'),
  (gen_random_uuid(),'finance.expenses','Finance & Expenses','Record expenses'),
  (gen_random_uuid(),'finance.cash','Finance & Expenses','Open and close cash sessions'),
  (gen_random_uuid(),'finance.reconcile','Finance & Expenses','Reconcile accounts'),
  (gen_random_uuid(),'reports.view','Reports & Analytics','View reports'),
  (gen_random_uuid(),'reports.profit','Reports & Analytics','View profit reports'),
  (gen_random_uuid(),'admin.users','Administration','Manage users'),
  (gen_random_uuid(),'admin.roles','Administration','Manage roles and permissions'),
  (gen_random_uuid(),'admin.settings','Administration','Change system settings'),
  (gen_random_uuid(),'admin.audit','Administration','View the audit trail'),
  (gen_random_uuid(),'admin.approvals','Administration','Action approvals')
ON CONFLICT ("code") DO UPDATE SET "module"=EXCLUDED."module","label"=EXCLUDED."label";

-- Roles -----------------------------------------------------------------------
INSERT INTO "Role" ("id","name","description","isSystem","updatedAt") VALUES
  (gen_random_uuid(),'Administrator','Full access to every module and setting',true,now()),
  (gen_random_uuid(),'Director','Management oversight, approvals and full financial visibility',true,now()),
  (gen_random_uuid(),'Accountant','Finance, purchasing, imports and reporting',true,now()),
  (gen_random_uuid(),'Store Keeper','Goods receiving, stock movements and stock takes',true,now()),
  (gen_random_uuid(),'Cashier','POS till operation and customer receipts',true,now())
ON CONFLICT ("name") DO UPDATE SET "description"=EXCLUDED."description","updatedAt"=now();

-- Role permissions (re-granted from the templates in src/lib/permissions.ts)
DELETE FROM "RolePermission" WHERE "roleId" IN (SELECT "id" FROM "Role" WHERE "isSystem");
INSERT INTO "RolePermission" ("roleId","permissionId")
  SELECT r."id", p."id" FROM "Role" r, "Permission" p
  WHERE r."name"='Administrator' AND p."code" IN ('dashboard.view','dashboard.financials','pos.sell','pos.discount','sales.view','sales.credit','sales.void','sales.return','customers.manage','inventory.view','inventory.receive','inventory.transfer','inventory.adjust','inventory.stocktake','products.manage','purchasing.view','purchasing.manage','purchasing.approve','suppliers.manage','imports.view','imports.manage','imports.costs','finance.view','finance.payments','finance.expenses','finance.cash','finance.reconcile','reports.view','reports.profit','admin.users','admin.roles','admin.settings','admin.audit','admin.approvals');
INSERT INTO "RolePermission" ("roleId","permissionId")
  SELECT r."id", p."id" FROM "Role" r, "Permission" p
  WHERE r."name"='Director' AND p."code" IN ('dashboard.view','dashboard.financials','pos.sell','pos.discount','sales.view','sales.credit','sales.void','sales.return','customers.manage','inventory.view','inventory.receive','inventory.transfer','inventory.adjust','inventory.stocktake','products.manage','purchasing.view','purchasing.manage','purchasing.approve','suppliers.manage','imports.view','imports.manage','imports.costs','finance.view','finance.payments','finance.expenses','finance.cash','finance.reconcile','reports.view','reports.profit','admin.audit','admin.approvals');
INSERT INTO "RolePermission" ("roleId","permissionId")
  SELECT r."id", p."id" FROM "Role" r, "Permission" p
  WHERE r."name"='Accountant' AND p."code" IN ('dashboard.view','dashboard.financials','sales.view','sales.credit','inventory.view','purchasing.view','purchasing.manage','suppliers.manage','imports.view','imports.manage','imports.costs','finance.view','finance.payments','finance.expenses','finance.cash','finance.reconcile','reports.view','reports.profit','customers.manage');
INSERT INTO "RolePermission" ("roleId","permissionId")
  SELECT r."id", p."id" FROM "Role" r, "Permission" p
  WHERE r."name"='Store Keeper' AND p."code" IN ('dashboard.view','inventory.view','inventory.receive','inventory.transfer','inventory.adjust','inventory.stocktake','products.manage','purchasing.view','imports.view','reports.view');
INSERT INTO "RolePermission" ("roleId","permissionId")
  SELECT r."id", p."id" FROM "Role" r, "Permission" p
  WHERE r."name"='Cashier' AND p."code" IN ('pos.sell','sales.view','sales.return','customers.manage','inventory.view','finance.cash');

-- Branch & warehouses ---------------------------------------------------------
INSERT INTO "Branch" ("id","code","name","location") VALUES
  (gen_random_uuid(),'HQ','Head Office','Nairobi, Kenya')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Warehouse" ("id","code","name","location","branchId","isDefault") VALUES
  (gen_random_uuid(),'MAIN','Main Warehouse','Nairobi',(SELECT "id" FROM "Branch" WHERE "code"='HQ'),true),
  (gen_random_uuid(),'SHOP','Retail Shop','Nairobi CBD',(SELECT "id" FROM "Branch" WHERE "code"='HQ'),false)
ON CONFLICT ("code") DO NOTHING;

-- Test user accounts (DEVELOPMENT ONLY - change these passwords before go-live)
INSERT INTO "User" ("id","username","email","fullName","passwordHash","roleId","branchId","updatedAt")
SELECT gen_random_uuid(), u.username, u.email, u.full_name,
       crypt(u.pw, gen_salt('bf', 10)),
       (SELECT "id" FROM "Role" WHERE "name"=u.role),
       (SELECT "id" FROM "Branch" WHERE "code"='HQ'), now()
FROM (VALUES
  ('admin','admin@saipeifoods.co.ke','System Administrator','Administrator','Admin@2026'),
  ('wmusili','director@saipeifoods.co.ke','Wycliffe Musili','Director','Director@2026'),
  ('accounts','accounts@saipeifoods.co.ke','Grace Wanjiru','Accountant','Accounts@2026'),
  ('store','store@saipeifoods.co.ke','Peter Otieno','Store Keeper','Store@2026'),
  ('cashier','cashier@saipeifoods.co.ke','Mary Achieng','Cashier','Cashier@2026')
) AS u(username,email,full_name,role,pw)
ON CONFLICT ("username") DO UPDATE SET "fullName"=EXCLUDED."fullName","roleId"=EXCLUDED."roleId","isActive"=true,"updatedAt"=now();

-- Reference data --------------------------------------------------------------
INSERT INTO "Category" ("id","name") VALUES
  (gen_random_uuid(),'Shoes - Men'),
  (gen_random_uuid(),'Shoes - Ladies'),
  (gen_random_uuid(),'Shoes - Children'),
  (gen_random_uuid(),'Sandals'),
  (gen_random_uuid(),'Sports Shoes')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "ExpenseCategory" ("id","name") VALUES
  (gen_random_uuid(),'Transport'),
  (gen_random_uuid(),'Warehouse Rent'),
  (gen_random_uuid(),'Salaries'),
  (gen_random_uuid(),'Utilities'),
  (gen_random_uuid(),'Clearing Charges'),
  (gen_random_uuid(),'Office Supplies'),
  (gen_random_uuid(),'Licences & Permits')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "Supplier" ("id","code","name","type","country","contactName","email","currency","updatedAt") VALUES
  (gen_random_uuid(),'SUP-001','Guangzhou Footwear Trading Co. Ltd','FOREIGN','China','Li Wei','sales@gzfootwear.cn','USD',now())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "ClearingAgent" ("id","code","name","contactName","phone","taxPin") VALUES
  (gen_random_uuid(),'CA-001','Mombasa Freight & Clearing Ltd','Hassan Ali','+254 722 000 111','P051234567X')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Customer" ("id","code","name","creditLimit","updatedAt") VALUES
  (gen_random_uuid(),'CUS-000','Walk-in Customer',0,now())
ON CONFLICT ("code") DO NOTHING;

-- Products with opening stock in the Main Warehouse ---------------------------
CREATE TEMP TABLE _seed_products (sku text, name text, category text, cost numeric, price numeric, qty numeric) ON COMMIT DROP;
INSERT INTO _seed_products VALUES
  ('SH-M-001','Men''s Leather Shoes - Black','Shoes - Men',850,1800,120),
  ('SH-M-002','Men''s Official Shoes - Brown','Shoes - Men',900,1950,84),
  ('SH-L-001','Ladies'' Flat Shoes - Assorted','Shoes - Ladies',620,1400,160),
  ('SH-L-002','Ladies'' Heels - Assorted','Shoes - Ladies',780,1750,45),
  ('SH-C-001','Children''s School Shoes','Shoes - Children',450,1100,210),
  ('SD-001','Rubber Sandals - Assorted','Sandals',180,450,340),
  ('SP-001','Sports Shoes - Running','Sports Shoes',1100,2400,18),
  ('SP-002','Canvas Shoes - Assorted','Sports Shoes',520,1250,6);

INSERT INTO "Product" ("id","sku","name","categoryId","unit","costPrice","sellingPrice","reorderLevel","taxRate","updatedAt")
SELECT gen_random_uuid(), s.sku, s.name, c."id", 'PAIR', s.cost, s.price, 20, 16, now()
FROM _seed_products s LEFT JOIN "Category" c ON c."name" = s.category
ON CONFLICT ("sku") DO UPDATE SET "costPrice"=EXCLUDED."costPrice","sellingPrice"=EXCLUDED."sellingPrice","updatedAt"=now();

INSERT INTO "StockLevel" ("id","productId","warehouseId","quantity","updatedAt")
SELECT gen_random_uuid(), p."id", w."id", s.qty, now()
FROM _seed_products s
JOIN "Product" p ON p."sku" = s.sku
JOIN "Warehouse" w ON w."code" = 'MAIN'
ON CONFLICT ("productId","warehouseId") DO UPDATE SET "quantity"=EXCLUDED."quantity","updatedAt"=now();

-- Settings --------------------------------------------------------------------
INSERT INTO "Setting" ("key","value","group","updatedAt") VALUES
  ('company.name','SAIPEI FOODS LIMITED','company',now()),
  ('company.tagline','From Kenya with Love','company',now()),
  ('company.phone','+254 787 088567','company',now()),
  ('company.address','Nairobi, Kenya','company',now()),
  ('tax.vatRate','16','tax',now()),
  ('mpesa.shortcode','5606927','mpesa',now()),
  ('mpesa.type','BUY_GOODS','mpesa',now()),
  ('pos.receiptFooter','Thank you for shopping with SAIPEI FOODS LIMITED','pos',now())
ON CONFLICT ("key") DO UPDATE SET "value"=EXCLUDED."value","group"=EXCLUDED."group","updatedAt"=now();

COMMIT;

