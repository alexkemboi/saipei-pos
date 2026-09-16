import 'server-only'

/**
 * Safaricom Daraja client for Lipa na M-PESA Online (STK push).
 *
 * The till is a Buy Goods number (5606927 by default), so the transaction type
 * is CustomerBuyGoodsOnline and the party B is the till number.
 */

const BASE_URLS = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
} as const

export interface MpesaConfig {
  env: 'sandbox' | 'production'
  shortcode: string
  consumerKey: string
  consumerSecret: string
  passkey: string
  callbackUrl: string
}

export function readMpesaConfig(): MpesaConfig | null {
  const env = process.env.MPESA_ENV === 'production' ? 'production' : 'sandbox'
  const shortcode = process.env.MPESA_SHORTCODE
  const consumerKey = process.env.MPESA_CONSUMER_KEY
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET
  const passkey = process.env.MPESA_PASSKEY
  const callbackUrl = process.env.MPESA_CALLBACK_URL

  // Without credentials the till falls back to entering the code by hand.
  if (!shortcode || !consumerKey || !consumerSecret || !passkey || !callbackUrl) {
    return null
  }

  return { env, shortcode, consumerKey, consumerSecret, passkey, callbackUrl }
}

/** Daraja wants 2547XXXXXXXX, but people type 07XX, +2547XX and 7XX. */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  if (/^254\d{9}$/.test(digits)) return digits
  if (/^0\d{9}$/.test(digits)) return `254${digits.slice(1)}`
  if (/^\d{9}$/.test(digits)) return `254${digits}`
  return null
}

/** Daraja timestamps are yyyyMMddHHmmss in East African Time. */
function timestamp(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return (
    String(now.getFullYear()) +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  )
}

async function getAccessToken(config: MpesaConfig): Promise<string> {
  const credentials = Buffer.from(
    `${config.consumerKey}:${config.consumerSecret}`,
  ).toString('base64')

  const response = await fetch(
    `${BASE_URLS[config.env]}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: { Authorization: `Basic ${credentials}` },
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    throw new Error(`M-PESA auth failed with status ${response.status}`)
  }

  const body = (await response.json()) as { access_token?: string }
  if (!body.access_token) throw new Error('M-PESA auth returned no token')
  return body.access_token
}

export interface StkPushResult {
  ok: boolean
  merchantRequestId?: string
  checkoutRequestId?: string
  customerMessage?: string
  error?: string
}

/**
 * Sends the payment prompt to the customer's handset. A success here only
 * means the prompt was accepted for delivery — the money is confirmed later on
 * the callback, which is what actually completes the sale.
 */
export async function sendStkPush(input: {
  phone: string
  amount: number
  accountReference: string
  description?: string
}): Promise<StkPushResult> {
  const config = readMpesaConfig()
  if (!config) {
    return {
      ok: false,
      error:
        'M-PESA is not configured. Add the Daraja credentials under Administration › Integrations.',
    }
  }

  const phone = normalisePhone(input.phone)
  if (!phone) {
    return { ok: false, error: 'That does not look like a Kenyan mobile number.' }
  }

  // Daraja rejects fractional amounts on Buy Goods.
  const amount = Math.ceil(input.amount)
  if (amount < 1) return { ok: false, error: 'The amount must be at least KES 1.' }

  try {
    const token = await getAccessToken(config)
    const stamp = timestamp()
    const password = Buffer.from(
      `${config.shortcode}${config.passkey}${stamp}`,
    ).toString('base64')

    const response = await fetch(
      `${BASE_URLS[config.env]}/mpesa/stkpush/v1/processrequest`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          BusinessShortCode: config.shortcode,
          Password: password,
          Timestamp: stamp,
          TransactionType: 'CustomerBuyGoodsOnline',
          Amount: amount,
          PartyA: phone,
          PartyB: config.shortcode,
          PhoneNumber: phone,
          CallBackURL: config.callbackUrl,
          AccountReference: input.accountReference.slice(0, 12),
          TransactionDesc: (input.description ?? 'SAIPEI FOODS').slice(0, 13),
        }),
      },
    )

    const body = (await response.json()) as {
      MerchantRequestID?: string
      CheckoutRequestID?: string
      ResponseCode?: string
      CustomerMessage?: string
      errorMessage?: string
    }

    if (!response.ok || body.ResponseCode !== '0') {
      return {
        ok: false,
        error: body.errorMessage ?? 'M-PESA rejected the request. Please try again.',
      }
    }

    return {
      ok: true,
      merchantRequestId: body.MerchantRequestID,
      checkoutRequestId: body.CheckoutRequestID,
      customerMessage: body.CustomerMessage,
    }
  } catch (error) {
    console.error('sendStkPush failed', error)
    return {
      ok: false,
      error: 'M-PESA could not be reached. Take the payment another way.',
    }
  }
}

/** The shape Daraja posts back once the customer responds to the prompt. */
export interface StkCallback {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string
      CheckoutRequestID?: string
      ResultCode?: number
      ResultDesc?: string
      CallbackMetadata?: {
        Item?: { Name: string; Value?: string | number }[]
      }
    }
  }
}

export function readCallbackItem(
  callback: StkCallback,
  name: string,
): string | number | undefined {
  return callback.Body?.stkCallback?.CallbackMetadata?.Item?.find(
    (item) => item.Name === name,
  )?.Value
}
