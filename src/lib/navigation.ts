import type { Route } from 'next'
import type { LucideIcon } from 'lucide-react'
import {
  Anchor,
  BadgeCheck,
  BarChart3,
  Banknote,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  Container,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Files,
  History,
  LayoutDashboard,
  Package,
  PackageCheck,
  PiggyBank,
  Receipt,
  RefreshCw,
  Repeat,
  Scale,
  Settings,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  Ship,
  Store,
  Truck,
  Undo2,
  Users,
  UserCog,
  Wallet,
  Warehouse,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: Route
  icon: LucideIcon
  permission?: string | string[]
}

export interface NavGroup {
  label: string
  icon: LucideIcon
  /** POS carries the brand red accent - it is the money-making screen. */
  accent?: 'red' | 'green'
  items: NavItem[]
}

export const NAVIGATION: NavGroup[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
      { label: 'Sales Overview', href: '/dashboard/sales', icon: BarChart3, permission: 'dashboard.view' },
      { label: 'Stock Overview', href: '/dashboard/stock', icon: Boxes, permission: 'dashboard.view' },
      { label: 'Import Status', href: '/dashboard/imports', icon: Ship, permission: 'dashboard.view' },
      { label: 'Debtors', href: '/dashboard/debtors', icon: Users, permission: 'dashboard.view' },
      { label: 'Profitability', href: '/dashboard/profitability', icon: PiggyBank, permission: 'dashboard.financials' },
    ],
  },
  {
    label: 'Sales & POS',
    icon: Store,
    accent: 'red',
    items: [
      { label: 'POS Till', href: '/pos', icon: ShoppingCart, permission: 'pos.sell' },
      { label: 'Sales', href: '/sales', icon: Receipt, permission: 'sales.view' },
      { label: 'Credit Sales', href: '/sales/credit', icon: CreditCard, permission: 'sales.view' },
      { label: 'Customers', href: '/sales/customers', icon: Users, permission: 'customers.manage' },
      { label: 'Customer Payments', href: '/sales/payments', icon: Wallet, permission: 'finance.payments' },
      { label: 'Sales Returns', href: '/sales/returns', icon: Undo2, permission: 'sales.return' },
      { label: 'Receipts', href: '/sales/receipts', icon: ScrollText, permission: 'sales.view' },
    ],
  },
  {
    label: 'Warehousing & Inventory',
    icon: Warehouse,
    items: [
      { label: 'Goods Receiving', href: '/inventory/receiving', icon: PackageCheck, permission: 'inventory.receive' },
      { label: 'Stock Management', href: '/inventory/stock', icon: Boxes, permission: 'inventory.view' },
      { label: 'Products', href: '/inventory/products', icon: Package, permission: 'inventory.view' },
      { label: 'Bales', href: '/inventory/bales', icon: Container, permission: 'inventory.view' },
      { label: 'Stock Transfers', href: '/inventory/transfers', icon: Repeat, permission: 'inventory.transfer' },
      { label: 'Stock Adjustments', href: '/inventory/adjustments', icon: RefreshCw, permission: 'inventory.adjust' },
      { label: 'Stock Take', href: '/inventory/stock-take', icon: ClipboardCheck, permission: 'inventory.stocktake' },
      { label: 'Inventory Valuation', href: '/inventory/valuation', icon: Scale, permission: 'inventory.view' },
    ],
  },
  {
    label: 'Import & Clearing',
    icon: Ship,
    items: [
      { label: 'Import Orders', href: '/imports', icon: ClipboardList, permission: 'imports.view' },
      { label: 'Shipments', href: '/imports/shipments', icon: Container, permission: 'imports.view' },
      { label: 'Clearing', href: '/imports/clearing', icon: Anchor, permission: 'imports.view' },
      { label: 'Customs & Taxes', href: '/imports/customs', icon: BadgeCheck, permission: 'imports.costs' },
      { label: 'Import Documents', href: '/imports/documents', icon: Files, permission: 'imports.view' },
      { label: 'Landed Cost', href: '/imports/landed-cost', icon: Truck, permission: 'imports.costs' },
      { label: 'Reconciliation', href: '/imports/reconciliation', icon: Scale, permission: 'imports.view' },
    ],
  },
  {
    label: 'Purchasing',
    icon: ShoppingCart,
    items: [
      { label: 'Suppliers', href: '/purchasing/suppliers', icon: Users, permission: 'suppliers.manage' },
      { label: 'Purchase Orders', href: '/purchasing/orders', icon: ClipboardList, permission: 'purchasing.view' },
      { label: 'Supplier Invoices', href: '/purchasing/invoices', icon: FileText, permission: 'purchasing.view' },
      { label: 'Payments', href: '/purchasing/payments', icon: Banknote, permission: 'finance.payments' },
      { label: 'Purchase Returns', href: '/purchasing/returns', icon: Undo2, permission: 'purchasing.manage' },
      { label: 'Approvals', href: '/purchasing/approvals', icon: ShieldCheck, permission: 'purchasing.approve' },
    ],
  },
  {
    label: 'Finance & Expenses',
    icon: Banknote,
    items: [
      { label: 'Expenses', href: '/finance/expenses', icon: Receipt, permission: 'finance.expenses' },
      { label: 'Supplier Payments', href: '/purchasing/payments', icon: Banknote, permission: 'finance.payments' },
      { label: 'Customer Payments', href: '/sales/payments', icon: Wallet, permission: 'finance.payments' },
      { label: 'Cash Management', href: '/finance/cash', icon: PiggyBank, permission: 'finance.cash' },
      { label: 'Reconciliation', href: '/finance/reconciliation', icon: Scale, permission: 'finance.reconcile' },
      { label: 'Profit & Loss', href: '/finance/profit-loss', icon: BarChart3, permission: 'reports.profit' },
    ],
  },
  {
    label: 'Reports & Analytics',
    icon: BarChart3,
    items: [
      { label: 'Sales Reports', href: '/reports/sales', icon: BarChart3, permission: 'reports.view' },
      { label: 'Purchase Reports', href: '/reports/purchases', icon: FileSpreadsheet, permission: 'reports.view' },
      { label: 'Stock Reports', href: '/reports/stock', icon: Boxes, permission: 'reports.view' },
      { label: 'Import Reports', href: '/reports/imports', icon: Ship, permission: 'reports.view' },
      { label: 'Expense Reports', href: '/reports/expenses', icon: Receipt, permission: 'reports.view' },
      { label: 'Profit Reports', href: '/reports/profit', icon: PiggyBank, permission: 'reports.profit' },
    ],
  },
  {
    label: 'Administration',
    icon: Settings,
    items: [
      { label: 'Users', href: '/admin/users', icon: UserCog, permission: 'admin.users' },
      { label: 'Roles & Permissions', href: '/admin/roles', icon: ShieldCheck, permission: 'admin.roles' },
      { label: 'Approvals', href: '/admin/approvals', icon: ClipboardCheck, permission: 'admin.approvals' },
      { label: 'Audit Trail', href: '/admin/audit', icon: History, permission: 'admin.audit' },
      { label: 'System Settings', href: '/admin/settings', icon: Settings, permission: 'admin.settings' },
      { label: 'Integrations', href: '/admin/integrations', icon: CreditCard, permission: 'admin.settings' },
    ],
  },
]
