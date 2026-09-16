'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { audit, requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { nextReference } from '@/lib/references'

export interface FormState {
  error?: string
  success?: string
  fieldErrors?: Record<string, string>
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '')
    if (key && !result[key]) result[key] = issue.message
  }
  return result
}

// ---------------------------------------------------------------------------
// Import order — step 1 of the business flow: order from China
// ---------------------------------------------------------------------------

const orderSchema = z.object({
  supplierId: z.string().min(1, 'Choose the supplier'),
  description: z.string().trim().max(400).optional(),
  currency: z.string().trim().length(3).default('USD'),
  exchangeRate: z.coerce.number().positive('Enter the exchange rate to KES'),
  goodsValue: z.coerce.number().min(0),
  orderDate: z.string().trim().optional(),
})

export async function createImportOrder(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePermission('imports.manage')

  const parsed = orderSchema.safeParse({
    supplierId: formData.get('supplierId'),
    description: formData.get('description') ?? undefined,
    currency: formData.get('currency') ?? 'USD',
    exchangeRate: formData.get('exchangeRate') ?? 1,
    goodsValue: formData.get('goodsValue') ?? 0,
    orderDate: formData.get('orderDate') ?? undefined,
  })
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }
  const data = parsed.data

  let id: string
  try {
    const order = await db.$transaction(async (tx) => {
      const reference = await nextReference(tx, 'importOrder')
      return tx.importOrder.create({
        data: {
          reference,
          supplierId: data.supplierId,
          description: data.description || null,
          currency: data.currency.toUpperCase(),
          exchangeRate: data.exchangeRate,
          goodsValue: data.goodsValue,
          orderDate: data.orderDate ? new Date(data.orderDate) : new Date(),
          stage: 'ORDER_PLACED',
        },
        select: { id: true, reference: true },
      })
    })
    id = order.id

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'ImportOrder',
      entityId: order.id,
      summary: `Import order ${order.reference} raised`,
    })
  } catch (error) {
    console.error('createImportOrder failed', error)
    return { error: 'The import order could not be saved. Please try again.' }
  }

  revalidatePath('/imports')
  redirect(`/imports/${id}`)
}

const stageSchema = z.object({
  importOrderId: z.string().min(1),
  stage: z.enum([
    'ORDER_PLACED',
    'SUPPLIER_INVOICED',
    'DEPOSIT_PAID',
    'DOCUMENTATION',
    'LOADED',
    'IN_TRANSIT',
    'ARRIVED',
    'CLEARING',
    'RELEASED',
    'RECEIVED',
    'CLOSED',
  ]),
})

export async function setImportStage(input: {
  importOrderId: string
  stage: string
}): Promise<FormState> {
  const user = await requirePermission('imports.manage')

  const parsed = stageSchema.safeParse(input)
  if (!parsed.success) return { error: 'That stage is not valid.' }

  try {
    const order = await db.importOrder.update({
      where: { id: parsed.data.importOrderId },
      data: { stage: parsed.data.stage },
      select: { reference: true },
    })

    await audit({
      userId: user.id,
      action: 'UPDATE',
      entity: 'ImportOrder',
      entityId: parsed.data.importOrderId,
      summary: `Import order ${order.reference} moved to ${parsed.data.stage}`,
    })
  } catch (error) {
    console.error('setImportStage failed', error)
    return { error: 'The stage could not be updated.' }
  }

  revalidatePath('/imports')
  revalidatePath(`/imports/${parsed.data.importOrderId}`)
  return { success: 'Stage updated.' }
}

// ---------------------------------------------------------------------------
// Shipment — loading, sailing, arrival
// ---------------------------------------------------------------------------

const shipmentSchema = z.object({
  importOrderId: z.string().min(1, 'Choose the import order'),
  containerNumber: z.string().trim().max(40).optional(),
  billOfLading: z.string().trim().max(60).optional(),
  vesselName: z.string().trim().max(120).optional(),
  portOfLoading: z.string().trim().max(120).optional(),
  clearingAgentId: z.string().trim().optional(),
  loadingDate: z.string().trim().optional(),
  departureDate: z.string().trim().optional(),
  expectedArrival: z.string().trim().optional(),
  actualArrival: z.string().trim().optional(),
  numberOfBales: z.coerce.number().int().min(0),
  totalWeightKg: z.coerce.number().min(0),
  containerCost: z.coerce.number().min(0),
  status: z.enum(['PENDING', 'LOADED', 'DEPARTED', 'ARRIVED', 'CLEARED', 'DELIVERED']),
  notes: z.string().trim().max(600).optional(),
})

const optionalDate = (value?: string) => (value ? new Date(value) : null)

export async function createShipment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePermission('imports.manage')

  const parsed = shipmentSchema.safeParse({
    importOrderId: formData.get('importOrderId'),
    containerNumber: formData.get('containerNumber') ?? undefined,
    billOfLading: formData.get('billOfLading') ?? undefined,
    vesselName: formData.get('vesselName') ?? undefined,
    portOfLoading: formData.get('portOfLoading') ?? undefined,
    clearingAgentId: formData.get('clearingAgentId') ?? undefined,
    loadingDate: formData.get('loadingDate') ?? undefined,
    departureDate: formData.get('departureDate') ?? undefined,
    expectedArrival: formData.get('expectedArrival') ?? undefined,
    actualArrival: formData.get('actualArrival') ?? undefined,
    numberOfBales: formData.get('numberOfBales') ?? 0,
    totalWeightKg: formData.get('totalWeightKg') ?? 0,
    containerCost: formData.get('containerCost') ?? 0,
    status: formData.get('status') ?? 'PENDING',
    notes: formData.get('notes') ?? undefined,
  })
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }
  const data = parsed.data

  try {
    const shipment = await db.$transaction(async (tx) => {
      const reference = await nextReference(tx, 'shipment')
      const created = await tx.shipment.create({
        data: {
          reference,
          importOrderId: data.importOrderId,
          containerNumber: data.containerNumber || null,
          billOfLading: data.billOfLading || null,
          vesselName: data.vesselName || null,
          portOfLoading: data.portOfLoading || null,
          clearingAgentId: data.clearingAgentId || null,
          loadingDate: optionalDate(data.loadingDate),
          departureDate: optionalDate(data.departureDate),
          expectedArrival: optionalDate(data.expectedArrival),
          actualArrival: optionalDate(data.actualArrival),
          numberOfBales: data.numberOfBales,
          totalWeightKg: data.totalWeightKg,
          containerCost: data.containerCost,
          status: data.status,
          notes: data.notes || null,
        },
        select: { id: true, reference: true },
      })

      // Keep the parent order's stage in step with the shipment.
      const stageForStatus: Record<string, string> = {
        LOADED: 'LOADED',
        DEPARTED: 'IN_TRANSIT',
        ARRIVED: 'ARRIVED',
        CLEARED: 'RELEASED',
        DELIVERED: 'RECEIVED',
      }
      const stage = stageForStatus[data.status]
      if (stage) {
        await tx.importOrder.update({
          where: { id: data.importOrderId },
          data: { stage },
        })
      }

      return created
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'Shipment',
      entityId: shipment.id,
      summary: `Shipment ${shipment.reference} created`,
    })
  } catch (error) {
    console.error('createShipment failed', error)
    return { error: 'The shipment could not be saved. Please try again.' }
  }

  revalidatePath('/imports/shipments')
  revalidatePath('/imports')
  return { success: 'Shipment saved.' }
}

export async function updateShipmentStatus(input: {
  shipmentId: string
  status: string
  actualArrival?: string
}): Promise<FormState> {
  const user = await requirePermission('imports.manage')

  const schema = z.object({
    shipmentId: z.string().min(1),
    status: z.enum(['PENDING', 'LOADED', 'DEPARTED', 'ARRIVED', 'CLEARED', 'DELIVERED']),
    actualArrival: z.string().trim().optional(),
  })
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { error: 'That status is not valid.' }

  try {
    await db.shipment.update({
      where: { id: parsed.data.shipmentId },
      data: {
        status: parsed.data.status,
        ...(parsed.data.status === 'ARRIVED' && parsed.data.actualArrival
          ? { actualArrival: new Date(parsed.data.actualArrival) }
          : {}),
        ...(parsed.data.status === 'CLEARED' ? { releasedAt: new Date() } : {}),
      },
    })

    await audit({
      userId: user.id,
      action: 'UPDATE',
      entity: 'Shipment',
      entityId: parsed.data.shipmentId,
      summary: `Shipment moved to ${parsed.data.status}`,
    })
  } catch (error) {
    console.error('updateShipmentStatus failed', error)
    return { error: 'The status could not be updated.' }
  }

  revalidatePath('/imports/shipments')
  revalidatePath('/imports/clearing')
  return { success: 'Status updated.' }
}

// ---------------------------------------------------------------------------
// Import documents — IDF, UCR, ACA permit, BL, PVOC and the rest
// ---------------------------------------------------------------------------

const documentSchema = z.object({
  importOrderId: z.string().min(1, 'Choose the import order'),
  shipmentId: z.string().trim().optional(),
  type: z.enum([
    'IDF',
    'CUSTOMS_DECLARATION',
    'ACA_PERMIT',
    'UCR',
    'BILL_OF_LADING',
    'PACKING_LIST',
    'COMMERCIAL_INVOICE',
    'PVOC_KEBS',
    'FUMIGATION_CERT',
    'HEALTH_CERT',
    'RELEASE_ORDER',
    'OTHER',
  ]),
  reference: z.string().trim().max(80).optional(),
  issueDate: z.string().trim().optional(),
  expiryDate: z.string().trim().optional(),
  fileUrl: z.string().trim().max(400).optional(),
  notes: z.string().trim().max(400).optional(),
})

export async function addImportDocument(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePermission('imports.manage')

  const parsed = documentSchema.safeParse({
    importOrderId: formData.get('importOrderId'),
    shipmentId: formData.get('shipmentId') ?? undefined,
    type: formData.get('type'),
    reference: formData.get('reference') ?? undefined,
    issueDate: formData.get('issueDate') ?? undefined,
    expiryDate: formData.get('expiryDate') ?? undefined,
    fileUrl: formData.get('fileUrl') ?? undefined,
    notes: formData.get('notes') ?? undefined,
  })
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }
  const data = parsed.data

  try {
    await db.importDocument.create({
      data: {
        importOrderId: data.importOrderId,
        shipmentId: data.shipmentId || null,
        type: data.type,
        reference: data.reference || null,
        issueDate: optionalDate(data.issueDate),
        expiryDate: optionalDate(data.expiryDate),
        fileUrl: data.fileUrl || null,
        notes: data.notes || null,
      },
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'ImportDocument',
      summary: `${data.type} captured for import order`,
    })
  } catch (error) {
    console.error('addImportDocument failed', error)
    return { error: 'The document could not be saved. Please try again.' }
  }

  revalidatePath('/imports/documents')
  revalidatePath(`/imports/${data.importOrderId}`)
  return { success: `${data.type.replace(/_/g, ' ')} captured.` }
}

// ---------------------------------------------------------------------------
// Customs entry — KRA taxes and levies
// ---------------------------------------------------------------------------

const customsSchema = z.object({
  shipmentId: z.string().min(1, 'Choose the shipment'),
  entryNumber: z.string().trim().min(1, 'Enter the customs entry number'),
  entryDate: z.string().trim().optional(),
  customsValue: z.coerce.number().min(0),
  importDuty: z.coerce.number().min(0),
  vat: z.coerce.number().min(0),
  idfFee: z.coerce.number().min(0),
  railwayLevy: z.coerce.number().min(0),
  importDeclLevy: z.coerce.number().min(0),
  exciseDuty: z.coerce.number().min(0),
  otherLevies: z.coerce.number().min(0),
  markPaid: z.boolean().default(false),
})

export async function createCustomsEntry(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePermission('imports.costs')

  const parsed = customsSchema.safeParse({
    shipmentId: formData.get('shipmentId'),
    entryNumber: formData.get('entryNumber'),
    entryDate: formData.get('entryDate') ?? undefined,
    customsValue: formData.get('customsValue') ?? 0,
    importDuty: formData.get('importDuty') ?? 0,
    vat: formData.get('vat') ?? 0,
    idfFee: formData.get('idfFee') ?? 0,
    railwayLevy: formData.get('railwayLevy') ?? 0,
    importDeclLevy: formData.get('importDeclLevy') ?? 0,
    exciseDuty: formData.get('exciseDuty') ?? 0,
    otherLevies: formData.get('otherLevies') ?? 0,
    markPaid: formData.get('markPaid') !== null,
  })
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }
  const data = parsed.data

  const totalTaxes =
    data.importDuty +
    data.vat +
    data.idfFee +
    data.railwayLevy +
    data.importDeclLevy +
    data.exciseDuty +
    data.otherLevies

  try {
    await db.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id: data.shipmentId },
        select: { importOrderId: true, reference: true },
      })
      if (!shipment) throw new Error('SHIPMENT_MISSING')

      await tx.customsEntry.create({
        data: {
          shipmentId: data.shipmentId,
          entryNumber: data.entryNumber,
          entryDate: data.entryDate ? new Date(data.entryDate) : new Date(),
          customsValue: data.customsValue,
          importDuty: data.importDuty,
          vat: data.vat,
          idfFee: data.idfFee,
          railwayLevy: data.railwayLevy,
          importDeclLevy: data.importDeclLevy,
          exciseDuty: data.exciseDuty,
          otherLevies: data.otherLevies,
          totalTaxes,
          paidAt: data.markPaid ? new Date() : null,
        },
      })

      // Customs taxes are part of what the goods cost to land.
      await tx.landedCostCharge.create({
        data: {
          importOrderId: shipment.importOrderId,
          shipmentId: data.shipmentId,
          category: 'CUSTOMS_TAXES',
          description: `KRA entry ${data.entryNumber}`,
          currency: 'KES',
          exchangeRate: 1,
          amount: totalTaxes,
          amountKes: totalTaxes,
          isPaid: data.markPaid,
          payeeName: 'Kenya Revenue Authority',
          reference: data.entryNumber,
        },
      })
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'CustomsEntry',
      summary: `Customs entry ${data.entryNumber} for ${totalTaxes} KES`,
    })
  } catch (error) {
    console.error('createCustomsEntry failed', error)
    return { error: 'The customs entry could not be saved. Please try again.' }
  }

  revalidatePath('/imports/customs')
  revalidatePath('/imports/landed-cost')
  return { success: `Customs entry ${data.entryNumber} captured.` }
}

// ---------------------------------------------------------------------------
// Landed cost charges — freight, agent fees, port, transport
// ---------------------------------------------------------------------------

const chargeSchema = z.object({
  importOrderId: z.string().min(1, 'Choose the import order'),
  shipmentId: z.string().trim().optional(),
  category: z.enum([
    'FREIGHT',
    'CLEARING_AGENT_FEE',
    'CUSTOMS_TAXES',
    'PORT_CFS',
    'SHIPPING',
    'TRANSPORT',
    'OFFLOADING',
    'WAREHOUSE',
    'INSPECTION',
    'ACA_PAYMENT',
    'FUMIGATION',
    'OTHER',
  ]),
  description: z.string().trim().min(1, 'Describe the charge'),
  currency: z.string().trim().length(3).default('KES'),
  exchangeRate: z.coerce.number().positive(),
  amount: z.coerce.number().min(0),
  chargeDate: z.string().trim().optional(),
  payeeName: z.string().trim().max(160).optional(),
  reference: z.string().trim().max(80).optional(),
  isPaid: z.boolean().default(false),
})

export async function addLandedCostCharge(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePermission('imports.costs')

  const parsed = chargeSchema.safeParse({
    importOrderId: formData.get('importOrderId'),
    shipmentId: formData.get('shipmentId') ?? undefined,
    category: formData.get('category'),
    description: formData.get('description'),
    currency: formData.get('currency') ?? 'KES',
    exchangeRate: formData.get('exchangeRate') ?? 1,
    amount: formData.get('amount') ?? 0,
    chargeDate: formData.get('chargeDate') ?? undefined,
    payeeName: formData.get('payeeName') ?? undefined,
    reference: formData.get('reference') ?? undefined,
    isPaid: formData.get('isPaid') !== null,
  })
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }
  const data = parsed.data

  try {
    await db.landedCostCharge.create({
      data: {
        importOrderId: data.importOrderId,
        shipmentId: data.shipmentId || null,
        category: data.category,
        description: data.description,
        currency: data.currency.toUpperCase(),
        exchangeRate: data.exchangeRate,
        amount: data.amount,
        amountKes: Math.round(data.amount * data.exchangeRate * 100) / 100,
        chargeDate: data.chargeDate ? new Date(data.chargeDate) : new Date(),
        payeeName: data.payeeName || null,
        reference: data.reference || null,
        isPaid: data.isPaid,
      },
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'LandedCostCharge',
      summary: `${data.category} charge of ${data.amount} ${data.currency}`,
    })
  } catch (error) {
    console.error('addLandedCostCharge failed', error)
    return { error: 'The charge could not be saved. Please try again.' }
  }

  revalidatePath('/imports/landed-cost')
  revalidatePath(`/imports/${data.importOrderId}`)
  return { success: 'Charge captured.' }
}
