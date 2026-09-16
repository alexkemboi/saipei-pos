// Generated from prisma/schema.prisma.
// SQL Server has no native Prisma enums, so these values are stored as
// NVarChar(30). These constants are the single source of truth for them.

export const ApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const
export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus]
export const ApprovalStatusValues: readonly ApprovalStatus[] = ['PENDING', 'APPROVED', 'REJECTED']

export const SupplierType = {
  LOCAL: 'LOCAL',
  FOREIGN: 'FOREIGN',
} as const
export type SupplierType = (typeof SupplierType)[keyof typeof SupplierType]
export const SupplierTypeValues: readonly SupplierType[] = ['LOCAL', 'FOREIGN']

export const PurchaseOrderStatus = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const
export type PurchaseOrderStatus = (typeof PurchaseOrderStatus)[keyof typeof PurchaseOrderStatus]
export const PurchaseOrderStatusValues: readonly PurchaseOrderStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']

export const InvoiceStatus = {
  UNPAID: 'UNPAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
} as const
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus]
export const InvoiceStatusValues: readonly InvoiceStatus[] = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED']

export const ImportStage = {
  ORDER_PLACED: 'ORDER_PLACED',
  SUPPLIER_INVOICED: 'SUPPLIER_INVOICED',
  DEPOSIT_PAID: 'DEPOSIT_PAID',
  DOCUMENTATION: 'DOCUMENTATION',
  LOADED: 'LOADED',
  IN_TRANSIT: 'IN_TRANSIT',
  ARRIVED: 'ARRIVED',
  CLEARING: 'CLEARING',
  RELEASED: 'RELEASED',
  RECEIVED: 'RECEIVED',
  CLOSED: 'CLOSED',
} as const
export type ImportStage = (typeof ImportStage)[keyof typeof ImportStage]
export const ImportStageValues: readonly ImportStage[] = ['ORDER_PLACED', 'SUPPLIER_INVOICED', 'DEPOSIT_PAID', 'DOCUMENTATION', 'LOADED', 'IN_TRANSIT', 'ARRIVED', 'CLEARING', 'RELEASED', 'RECEIVED', 'CLOSED']

export const ShipmentStatus = {
  PENDING: 'PENDING',
  LOADED: 'LOADED',
  DEPARTED: 'DEPARTED',
  ARRIVED: 'ARRIVED',
  CLEARED: 'CLEARED',
  DELIVERED: 'DELIVERED',
} as const
export type ShipmentStatus = (typeof ShipmentStatus)[keyof typeof ShipmentStatus]
export const ShipmentStatusValues: readonly ShipmentStatus[] = ['PENDING', 'LOADED', 'DEPARTED', 'ARRIVED', 'CLEARED', 'DELIVERED']

export const DocumentType = {
  IDF: 'IDF',
  CUSTOMS_DECLARATION: 'CUSTOMS_DECLARATION',
  ACA_PERMIT: 'ACA_PERMIT',
  UCR: 'UCR',
  BILL_OF_LADING: 'BILL_OF_LADING',
  PACKING_LIST: 'PACKING_LIST',
  COMMERCIAL_INVOICE: 'COMMERCIAL_INVOICE',
  PVOC_KEBS: 'PVOC_KEBS',
  FUMIGATION_CERT: 'FUMIGATION_CERT',
  HEALTH_CERT: 'HEALTH_CERT',
  RELEASE_ORDER: 'RELEASE_ORDER',
  OTHER: 'OTHER',
} as const
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType]
export const DocumentTypeValues: readonly DocumentType[] = ['IDF', 'CUSTOMS_DECLARATION', 'ACA_PERMIT', 'UCR', 'BILL_OF_LADING', 'PACKING_LIST', 'COMMERCIAL_INVOICE', 'PVOC_KEBS', 'FUMIGATION_CERT', 'HEALTH_CERT', 'RELEASE_ORDER', 'OTHER']

export const ChargeCategory = {
  FREIGHT: 'FREIGHT',
  CLEARING_AGENT_FEE: 'CLEARING_AGENT_FEE',
  CUSTOMS_TAXES: 'CUSTOMS_TAXES',
  PORT_CFS: 'PORT_CFS',
  SHIPPING: 'SHIPPING',
  TRANSPORT: 'TRANSPORT',
  OFFLOADING: 'OFFLOADING',
  WAREHOUSE: 'WAREHOUSE',
  INSPECTION: 'INSPECTION',
  ACA_PAYMENT: 'ACA_PAYMENT',
  FUMIGATION: 'FUMIGATION',
  OTHER: 'OTHER',
} as const
export type ChargeCategory = (typeof ChargeCategory)[keyof typeof ChargeCategory]
export const ChargeCategoryValues: readonly ChargeCategory[] = ['FREIGHT', 'CLEARING_AGENT_FEE', 'CUSTOMS_TAXES', 'PORT_CFS', 'SHIPPING', 'TRANSPORT', 'OFFLOADING', 'WAREHOUSE', 'INSPECTION', 'ACA_PAYMENT', 'FUMIGATION', 'OTHER']

export const UnitOfMeasure = {
  PIECE: 'PIECE',
  PAIR: 'PAIR',
  BALE: 'BALE',
  KG: 'KG',
  CARTON: 'CARTON',
  DOZEN: 'DOZEN',
} as const
export type UnitOfMeasure = (typeof UnitOfMeasure)[keyof typeof UnitOfMeasure]
export const UnitOfMeasureValues: readonly UnitOfMeasure[] = ['PIECE', 'PAIR', 'BALE', 'KG', 'CARTON', 'DOZEN']

export const MovementType = {
  GRN: 'GRN',
  SALE: 'SALE',
  SALE_RETURN: 'SALE_RETURN',
  PURCHASE_RETURN: 'PURCHASE_RETURN',
  ADJUSTMENT: 'ADJUSTMENT',
  TRANSFER_IN: 'TRANSFER_IN',
  TRANSFER_OUT: 'TRANSFER_OUT',
  STOCK_TAKE: 'STOCK_TAKE',
  OPENING: 'OPENING',
} as const
export type MovementType = (typeof MovementType)[keyof typeof MovementType]
export const MovementTypeValues: readonly MovementType[] = ['GRN', 'SALE', 'SALE_RETURN', 'PURCHASE_RETURN', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'STOCK_TAKE', 'OPENING']

export const TransferStatus = {
  DRAFT: 'DRAFT',
  IN_TRANSIT: 'IN_TRANSIT',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const
export type TransferStatus = (typeof TransferStatus)[keyof typeof TransferStatus]
export const TransferStatusValues: readonly TransferStatus[] = ['DRAFT', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED']

export const AdjustmentReason = {
  DAMAGE: 'DAMAGE',
  LOSS: 'LOSS',
  THEFT: 'THEFT',
  EXPIRY: 'EXPIRY',
  COUNT_CORRECTION: 'COUNT_CORRECTION',
  OPENING_BALANCE: 'OPENING_BALANCE',
  OTHER: 'OTHER',
} as const
export type AdjustmentReason = (typeof AdjustmentReason)[keyof typeof AdjustmentReason]
export const AdjustmentReasonValues: readonly AdjustmentReason[] = ['DAMAGE', 'LOSS', 'THEFT', 'EXPIRY', 'COUNT_CORRECTION', 'OPENING_BALANCE', 'OTHER']

export const StockTakeStatus = {
  OPEN: 'OPEN',
  COUNTING: 'COUNTING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const
export type StockTakeStatus = (typeof StockTakeStatus)[keyof typeof StockTakeStatus]
export const StockTakeStatusValues: readonly StockTakeStatus[] = ['OPEN', 'COUNTING', 'COMPLETED', 'CANCELLED']

export const SaleStatus = {
  DRAFT: 'DRAFT',
  COMPLETED: 'COMPLETED',
  CREDIT: 'CREDIT',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  CANCELLED: 'CANCELLED',
  VOIDED: 'VOIDED',
} as const
export type SaleStatus = (typeof SaleStatus)[keyof typeof SaleStatus]
export const SaleStatusValues: readonly SaleStatus[] = ['DRAFT', 'COMPLETED', 'CREDIT', 'PARTIALLY_PAID', 'CANCELLED', 'VOIDED']

export const SaleChannel = {
  POS: 'POS',
  ORDER: 'ORDER',
  WHOLESALE: 'WHOLESALE',
} as const
export type SaleChannel = (typeof SaleChannel)[keyof typeof SaleChannel]
export const SaleChannelValues: readonly SaleChannel[] = ['POS', 'ORDER', 'WHOLESALE']

export const PaymentMethod = {
  CASH: 'CASH',
  MPESA: 'MPESA',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CHEQUE: 'CHEQUE',
  CARD: 'CARD',
  CREDIT: 'CREDIT',
} as const
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]
export const PaymentMethodValues: readonly PaymentMethod[] = ['CASH', 'MPESA', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'CREDIT']

export const PaymentStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REVERSED: 'REVERSED',
} as const
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]
export const PaymentStatusValues: readonly PaymentStatus[] = ['PENDING', 'COMPLETED', 'FAILED', 'REVERSED']

export const PayeeType = {
  SUPPLIER: 'SUPPLIER',
  CLEARING_AGENT: 'CLEARING_AGENT',
  KRA: 'KRA',
  TRANSPORTER: 'TRANSPORTER',
  OTHER: 'OTHER',
} as const
export type PayeeType = (typeof PayeeType)[keyof typeof PayeeType]
export const PayeeTypeValues: readonly PayeeType[] = ['SUPPLIER', 'CLEARING_AGENT', 'KRA', 'TRANSPORTER', 'OTHER']

export const CashSessionStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const
export type CashSessionStatus = (typeof CashSessionStatus)[keyof typeof CashSessionStatus]
export const CashSessionStatusValues: readonly CashSessionStatus[] = ['OPEN', 'CLOSED']
