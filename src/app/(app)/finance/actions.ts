'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit, requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { nextReference } from '@/lib/references'
import { toNumber } from '@/lib/utils'

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

const round2 = (n: number) => Math.round(n * 100) / 100

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

const expenseSchema = z.object({
  categoryId: z.string().min(1, 'Choose a category'),
  description: z.string().trim().min(2, 'Describe the expense'),
  amount: z.coerce.number().positive('Enter an amount greater than zero'),
  method: z.enum(['CASH', 'MPESA', 'BANK_TRANSFER', 'CHEQUE', 'CARD']),
  expenseDate: z.string().trim().optional(),
  payeeName: z.string().trim().max(160).optional(),
})

export async function createExpense(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePermission('finance.expenses')

  const parsed = expenseSchema.safeParse({
    categoryId: formData.get('categoryId'),
    description: formData.get('description'),
    amount: formData.get('amount') ?? 0,
    method: formData.get('method') ?? 'CASH',
    expenseDate: formData.get('expenseDate') ?? undefined,
    payeeName: formData.get('payeeName') ?? undefined,
  })
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }
  const data = parsed.data

  try {
    const reference = await db.$transaction(async (tx) => {
      const ref = await nextReference(tx, 'expense')
      await tx.expense.create({
        data: {
          reference: ref,
          categoryId: data.categoryId,
          description: data.description,
          amount: data.amount,
          method: data.method,
          expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
          payeeName: data.payeeName || null,
          status: 'APPROVED',
          userId: user.id,
        },
      })
      return ref
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'Expense',
      summary: `Expense ${reference} of ${data.amount} — ${data.description}`,
    })

    revalidatePath('/finance/expenses')
    revalidatePath('/finance/profit-loss')

    return { success: `Expense ${reference} recorded.` }
  } catch (error) {
    console.error('createExpense failed', error)
    return { error: 'The expense could not be saved. Please try again.' }
  }
}

export async function createExpenseCategory(name: string): Promise<FormState> {
  const user = await requirePermission('finance.expenses')
  const trimmed = name.trim()
  if (trimmed.length < 2) return { error: 'Enter a category name.' }

  try {
    await db.expenseCategory.create({ data: { name: trimmed } })
    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'ExpenseCategory',
      summary: `Expense category "${trimmed}" created`,
    })
  } catch {
    return { error: 'That category already exists.' }
  }

  revalidatePath('/finance/expenses')
  return { success: `Category "${trimmed}" added.` }
}

// ---------------------------------------------------------------------------
// Cash sessions — the till float, and counting it down at close
// ---------------------------------------------------------------------------

export async function openCashSession(openingFloat: number): Promise<FormState> {
  const user = await requirePermission('finance.cash')

  if (!Number.isFinite(openingFloat) || openingFloat < 0) {
    return { error: 'Enter the opening float.' }
  }

  try {
    const existing = await db.cashSession.findFirst({
      where: { userId: user.id, status: 'OPEN' },
      select: { reference: true },
    })
    if (existing) {
      return { error: `Session ${existing.reference} is already open. Close it first.` }
    }

    const reference = await db.$transaction(async (tx) => {
      const ref = await nextReference(tx, 'cashSession')
      await tx.cashSession.create({
        data: {
          reference: ref,
          userId: user.id,
          openingFloat,
          expectedCash: openingFloat,
          status: 'OPEN',
        },
      })
      return ref
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'CashSession',
      summary: `Cash session ${reference} opened with a float of ${openingFloat}`,
    })

    revalidatePath('/finance/cash')
    revalidatePath('/pos')

    return { success: `Session ${reference} is open.` }
  } catch (error) {
    console.error('openCashSession failed', error)
    return { error: 'The session could not be opened. Please try again.' }
  }
}

export async function closeCashSession(input: {
  sessionId: string
  countedCash: number
  notes?: string
}): Promise<FormState> {
  const user = await requirePermission('finance.cash')

  if (!Number.isFinite(input.countedCash) || input.countedCash < 0) {
    return { error: 'Enter the cash counted in the drawer.' }
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const session = await tx.cashSession.findUnique({
        where: { id: input.sessionId },
        select: { id: true, reference: true, openingFloat: true, status: true },
      })
      if (!session) throw new CashError('That session no longer exists.')
      if (session.status !== 'OPEN') {
        throw new CashError('That session has already been closed.')
      }

      // Expected cash = float + cash receipts taken during the session.
      const cashTaken = await tx.receipt.aggregate({
        where: { cashSessionId: session.id, method: 'CASH', status: 'COMPLETED' },
        _sum: { amount: true },
      })

      const expected = round2(
        toNumber(session.openingFloat) + toNumber(cashTaken._sum.amount),
      )
      const variance = round2(input.countedCash - expected)

      await tx.cashSession.update({
        where: { id: session.id },
        data: {
          closingCount: input.countedCash,
          expectedCash: expected,
          variance,
          status: 'CLOSED',
          closedAt: new Date(),
          notes: input.notes || null,
        },
      })

      return { reference: session.reference, expected, variance }
    })

    await audit({
      userId: user.id,
      action: 'UPDATE',
      entity: 'CashSession',
      entityId: input.sessionId,
      summary: `Cash session ${result.reference} closed with a variance of ${result.variance}`,
    })

    revalidatePath('/finance/cash')

    return {
      success:
        result.variance === 0
          ? `Session ${result.reference} closed and balanced exactly.`
          : `Session ${result.reference} closed with a variance of ${result.variance.toFixed(2)}.`,
    }
  } catch (error) {
    if (error instanceof CashError) return { error: error.message }
    console.error('closeCashSession failed', error)
    return { error: 'The session could not be closed. Please try again.' }
  }
}

class CashError extends Error {}
