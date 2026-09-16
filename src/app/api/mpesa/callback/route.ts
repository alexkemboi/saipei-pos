import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readCallbackItem, type StkCallback } from '@/lib/mpesa'

/**
 * Daraja posts the outcome of an STK push here.
 *
 * Safaricom retries on a non-200, so this always answers 200 once the payload
 * has been stored — a failure to match a transaction is our problem to
 * investigate, not a reason to have the callback delivered again forever.
 *
 * The body is untrusted input from the network: it is recorded and matched on
 * CheckoutRequestID, and nothing in it is executed.
 */
export async function POST(request: Request) {
  let payload: StkCallback

  try {
    payload = (await request.json()) as StkCallback
  } catch {
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Malformed body ignored' })
  }

  const callback = payload.Body?.stkCallback
  const checkoutRequestId = callback?.CheckoutRequestID

  if (!checkoutRequestId) {
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'No checkout id' })
  }

  try {
    const transaction = await db.mpesaTransaction.findFirst({
      where: { checkoutRequestId },
      select: { id: true, saleId: true, status: true },
    })

    if (!transaction) {
      console.warn('M-PESA callback for an unknown checkout', checkoutRequestId)
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Unknown transaction' })
    }

    // Safaricom can deliver the same callback more than once.
    if (transaction.status !== 'PENDING') {
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Already processed' })
    }

    const succeeded = callback?.ResultCode === 0
    const receipt = readCallbackItem(payload, 'MpesaReceiptNumber')
    const amount = readCallbackItem(payload, 'Amount')

    await db.$transaction(async (tx) => {
      await tx.mpesaTransaction.update({
        where: { id: transaction.id },
        data: {
          status: succeeded ? 'COMPLETED' : 'FAILED',
          mpesaReceipt: receipt ? String(receipt) : null,
          resultCode: callback?.ResultCode ?? null,
          resultDesc: callback?.ResultDesc?.slice(0, 300) ?? null,
          rawCallback: JSON.stringify(payload),
        },
      })

      // A confirmed payment settles the sale it was raised against.
      if (succeeded && transaction.saleId) {
        await tx.receipt.updateMany({
          where: { saleId: transaction.saleId, method: 'MPESA', status: 'PENDING' },
          data: {
            status: 'COMPLETED',
            mpesaCode: receipt ? String(receipt) : null,
            ...(amount ? { amount: Number(amount) } : {}),
          },
        })

        await tx.sale.updateMany({
          where: { id: transaction.saleId, status: 'DRAFT' },
          data: { status: 'COMPLETED' },
        })
      }
    })

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  } catch (error) {
    console.error('M-PESA callback handling failed', error)
    // Still 200: the retry would hit the same error.
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }
}
