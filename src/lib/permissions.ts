/**
 * Permission catalogue. Codes are `<module>.<action>` and are seeded into the
 * Permission table; roles are granted subsets of them.
 */
export const PERMISSIONS = [
  // Dashboard
  { code: 'dashboard.view', module: 'Dashboard', label: 'View dashboard' },
  { code: 'dashboard.financials', module: 'Dashboard', label: 'View profit and margin figures' },

  // Sales & POS
  { code: 'pos.sell', module: 'Sales & POS', label: 'Operate the POS till' },
  { code: 'pos.discount', module: 'Sales & POS', label: 'Apply discounts' },
  { code: 'sales.view', module: 'Sales & POS', label: 'View sales' },
  { code: 'sales.credit', module: 'Sales & POS', label: 'Sell on credit' },
  { code: 'sales.void', module: 'Sales & POS', label: 'Void a sale' },
  { code: 'sales.return', module: 'Sales & POS', label: 'Process sales returns' },
  { code: 'customers.manage', module: 'Sales & POS', label: 'Manage customers' },

  // Inventory
  { code: 'inventory.view', module: 'Warehousing & Inventory', label: 'View stock' },
  { code: 'inventory.receive', module: 'Warehousing & Inventory', label: 'Receive goods' },
  { code: 'inventory.transfer', module: 'Warehousing & Inventory', label: 'Transfer stock' },
  { code: 'inventory.adjust', module: 'Warehousing & Inventory', label: 'Adjust stock' },
  { code: 'inventory.stocktake', module: 'Warehousing & Inventory', label: 'Run stock takes' },
  { code: 'products.manage', module: 'Warehousing & Inventory', label: 'Manage products' },

  // Purchasing
  { code: 'purchasing.view', module: 'Purchasing', label: 'View purchasing' },
  { code: 'purchasing.manage', module: 'Purchasing', label: 'Create purchase orders and invoices' },
  { code: 'purchasing.approve', module: 'Purchasing', label: 'Approve purchase orders' },
  { code: 'suppliers.manage', module: 'Purchasing', label: 'Manage suppliers' },

  // Import & clearing
  { code: 'imports.view', module: 'Import & Clearing', label: 'View imports' },
  { code: 'imports.manage', module: 'Import & Clearing', label: 'Manage imports, shipments and documents' },
  { code: 'imports.costs', module: 'Import & Clearing', label: 'Capture landed costs and customs' },

  // Finance
  { code: 'finance.view', module: 'Finance & Expenses', label: 'View finance' },
  { code: 'finance.payments', module: 'Finance & Expenses', label: 'Record payments and receipts' },
  { code: 'finance.expenses', module: 'Finance & Expenses', label: 'Record expenses' },
  { code: 'finance.cash', module: 'Finance & Expenses', label: 'Open and close cash sessions' },
  { code: 'finance.reconcile', module: 'Finance & Expenses', label: 'Reconcile accounts' },

  // Reports
  { code: 'reports.view', module: 'Reports & Analytics', label: 'View reports' },
  { code: 'reports.profit', module: 'Reports & Analytics', label: 'View profit reports' },

  // Administration
  { code: 'admin.users', module: 'Administration', label: 'Manage users' },
  { code: 'admin.roles', module: 'Administration', label: 'Manage roles and permissions' },
  { code: 'admin.settings', module: 'Administration', label: 'Change system settings' },
  { code: 'admin.audit', module: 'Administration', label: 'View the audit trail' },
  { code: 'admin.approvals', module: 'Administration', label: 'Action approvals' },
] as const

export type PermissionCode = (typeof PERMISSIONS)[number]['code']

export const ALL_PERMISSION_CODES = PERMISSIONS.map((p) => p.code)

/** Seeded roles. Administrator implicitly holds every permission. */
export const ROLE_TEMPLATES: Record<string, { description: string; permissions: string[] }> = {
  Administrator: {
    description: 'Full access to every module and setting',
    permissions: [...ALL_PERMISSION_CODES],
  },
  Director: {
    description: 'Management oversight, approvals and full financial visibility',
    permissions: ALL_PERMISSION_CODES.filter(
      (c) => !['admin.users', 'admin.roles', 'admin.settings'].includes(c),
    ),
  },
  Accountant: {
    description: 'Finance, purchasing, imports and reporting',
    permissions: [
      'dashboard.view', 'dashboard.financials',
      'sales.view', 'sales.credit',
      'inventory.view',
      'purchasing.view', 'purchasing.manage', 'suppliers.manage',
      'imports.view', 'imports.manage', 'imports.costs',
      'finance.view', 'finance.payments', 'finance.expenses', 'finance.cash', 'finance.reconcile',
      'reports.view', 'reports.profit',
      'customers.manage',
    ],
  },
  'Store Keeper': {
    description: 'Goods receiving, stock movements and stock takes',
    permissions: [
      'dashboard.view',
      'inventory.view', 'inventory.receive', 'inventory.transfer',
      'inventory.adjust', 'inventory.stocktake', 'products.manage',
      'purchasing.view', 'imports.view',
      'reports.view',
    ],
  },
  Cashier: {
    description: 'POS till operation and customer receipts',
    permissions: [
      'pos.sell', 'sales.view', 'sales.return',
      'customers.manage', 'inventory.view', 'finance.cash',
    ],
  },
}

export function hasPermission(
  userPermissions: readonly string[],
  required: string | string[],
): boolean {
  const list = Array.isArray(required) ? required : [required]
  return list.some((code) => userPermissions.includes(code))
}
