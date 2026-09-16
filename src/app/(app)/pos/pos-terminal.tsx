'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Minus,
  Package,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, Input, Select } from '@/components/ui/form'
import { Badge } from '@/components/ui/badge'
import type { PosProduct, PosTillData } from '@/lib/queries/pos'
import { cn, formatKes, formatNumber } from '@/lib/utils'
import { completeSale } from './actions'
import { PaymentDialog } from './payment-dialog'
import { ReceiptDialog, type CompletedSale } from './receipt-dialog'

export interface CartLine {
  product: PosProduct
  quantity: number
  discount: number
}

export function PosTerminal({
  till,
  cashierName,
  canDiscount,
  canSellOnCredit,
}: {
  till: PosTillData
  cashierName: string
  canDiscount: boolean
  canSellOnCredit: boolean
}) {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerId, setCustomerId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [completed, setCompleted] = useState<CompletedSale | null>(null)
  const [isPending, startTransition] = useTransition()
  const searchRef = useRef<HTMLInputElement>(null)

  // Local stock mirror so the grid reflects what is already in the cart.
  const [soldSinceLoad, setSoldSinceLoad] = useState<Record<string, number>>({})

  const availableOf = (product: PosProduct) =>
    product.quantity - (soldSinceLoad[product.id] ?? 0)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return till.products.filter((product) => {
      if (categoryId && product.categoryId !== categoryId) return false
      if (!term) return true
      return (
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        (product.barcode?.toLowerCase().includes(term) ?? false)
      )
    })
  }, [till.products, search, categoryId])

  const totals = useMemo(() => {
    let gross = 0
    let discount = 0
    for (const line of cart) {
      gross += line.product.sellingPrice * line.quantity
      discount += line.discount
    }
    return { gross, discount, total: Math.max(0, gross - discount) }
  }, [cart])

  const selectedCustomer = till.customers.find((c) => c.id === customerId) ?? null

  function addToCart(product: PosProduct) {
    setError(null)
    const available = availableOf(product)

    // A barcode scanner fires several adds in one tick, so the new quantity
    // must be derived inside the updater - reading `cart` from the closure
    // goes stale and appends a duplicate line per scan.
    setCart((current) => {
      const inCart = current.find((l) => l.product.id === product.id)
      const wanted = (inCart?.quantity ?? 0) + 1

      if (wanted > available) {
        setError(`Only ${formatNumber(available)} of ${product.name} left in stock.`)
        return current
      }

      return inCart
        ? current.map((l) =>
            l.product.id === product.id ? { ...l, quantity: wanted } : l,
          )
        : [...current, { product, quantity: 1, discount: 0 }]
    })
  }

  function setQuantity(productId: string, quantity: number) {
    setError(null)
    if (quantity <= 0) {
      setCart((current) => current.filter((l) => l.product.id !== productId))
      return
    }
    const line = cart.find((l) => l.product.id === productId)
    if (line && quantity > availableOf(line.product)) {
      setError(`Only ${formatNumber(availableOf(line.product))} of ${line.product.name} left in stock.`)
      return
    }
    setCart((current) =>
      current.map((l) => (l.product.id === productId ? { ...l, quantity } : l)),
    )
  }

  function setDiscount(productId: string, discount: number) {
    setCart((current) =>
      current.map((l) =>
        l.product.id === productId
          ? {
              ...l,
              discount: Math.max(
                0,
                Math.min(discount, l.product.sellingPrice * l.quantity),
              ),
            }
          : l,
      ),
    )
  }

  function clearCart() {
    setCart([])
    setCustomerId('')
    setError(null)
  }

  /** Barcode scanners type the code then press Enter. */
  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const term = search.trim().toLowerCase()
    if (!term) return

    const exact = till.products.find(
      (p) =>
        p.barcode?.toLowerCase() === term || p.sku.toLowerCase() === term,
    )
    const match = exact ?? (filtered.length === 1 ? filtered[0] : null)
    if (match) {
      addToCart(match)
      setSearch('')
    }
  }

  function handlePay(payload: {
    method: 'CASH' | 'MPESA' | 'BANK_TRANSFER' | 'CARD' | 'CREDIT'
    amountTendered: number
    mpesaCode?: string
  }) {
    setError(null)
    startTransition(async () => {
      const result = await completeSale({
        warehouseId: till.warehouseId,
        customerId: customerId || null,
        method: payload.method,
        amountTendered: payload.amountTendered,
        mpesaCode: payload.mpesaCode,
        lines: cart.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
          discount: l.discount,
        })),
      })

      if (!result.ok) {
        setError(result.error)
        return
      }

      setSoldSinceLoad((current) => {
        const next = { ...current }
        for (const line of cart) {
          next[line.product.id] = (next[line.product.id] ?? 0) + line.quantity
        }
        return next
      })

      setCompleted({
        reference: result.reference,
        lines: cart.map((l) => ({
          name: l.product.name,
          quantity: l.quantity,
          unitPrice: l.product.sellingPrice,
          lineTotal: l.product.sellingPrice * l.quantity - l.discount,
        })),
        total: totals.total,
        discount: totals.discount,
        method: payload.method,
        amountTendered: payload.amountTendered,
        change: result.change,
        customerName: selectedCustomer?.name ?? 'Walk-in customer',
        cashierName,
        soldAt: new Date(),
      })
      setPayOpen(false)
      clearCart()
      searchRef.current?.focus()
    })
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4 lg:flex-row">
      {/* ================= Product area ================= */}
      <section className="flex min-h-0 flex-1 flex-col rounded-[var(--radius-card)] border border-saipei-gray-200 bg-white">
        <div className="border-b border-saipei-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[16rem] flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-saipei-gray-400"
                aria-hidden
              />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Scan a barcode or search by name or SKU…"
                className="h-12 pl-9 text-base"
                autoFocus
                aria-label="Search products"
              />
            </div>
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-12 w-auto min-w-[12rem] text-base"
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {till.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>

          <p className="mt-2 text-xs text-saipei-gray-500">
            Selling from <span className="font-medium text-saipei-dark-700">{till.warehouseName}</span>
            {till.cashSession ? (
              <> · till session <span className="tabular">{till.cashSession.reference}</span></>
            ) : (
              <> · <span className="text-saipei-amber-700">no cash session open</span></>
            )}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span className="rounded-full bg-saipei-green-50 p-3 text-saipei-green-600">
                <Package className="h-6 w-6" aria-hidden />
              </span>
              <p className="font-semibold text-saipei-dark-800">No products match</p>
              <p className="max-w-xs text-sm text-saipei-gray-500">
                Try a different search term or clear the category filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filtered.map((product) => {
                const available = availableOf(product)
                const outOfStock = available <= 0
                const low = !outOfStock && available <= product.reorderLevel

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
                    disabled={outOfStock}
                    className={cn(
                      'flex flex-col justify-between rounded-lg border p-3 text-left transition-colors',
                      outOfStock
                        ? 'cursor-not-allowed border-saipei-gray-200 bg-saipei-gray-50 opacity-60'
                        : 'border-saipei-gray-200 bg-white hover:border-saipei-green-500 hover:bg-saipei-green-50',
                    )}
                  >
                    <div>
                      <p className="tabular text-[11px] text-saipei-gray-500">
                        {product.sku}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-saipei-dark-800">
                        {product.name}
                      </p>
                    </div>
                    <div className="mt-3">
                      <p className="tabular text-base font-bold text-saipei-dark-800">
                        {formatKes(product.sellingPrice)}
                      </p>
                      <p
                        className={cn(
                          'mt-1 flex items-center gap-1 text-[11px] font-medium',
                          outOfStock && 'text-saipei-red-600',
                          low && 'text-saipei-amber-700',
                          !outOfStock && !low && 'text-saipei-green-700',
                        )}
                      >
                        {outOfStock ? (
                          <>
                            <Ban className="h-3 w-3" aria-hidden /> Out of stock
                          </>
                        ) : low ? (
                          <>
                            <AlertTriangle className="h-3 w-3" aria-hidden />
                            Low · {formatNumber(available)} left
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3 w-3" aria-hidden />
                            {formatNumber(available)} in stock
                          </>
                        )}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ================= Cart ================= */}
      <aside className="flex min-h-0 w-full flex-col rounded-[var(--radius-card)] border border-saipei-gray-200 bg-white lg:w-[24rem] xl:w-[26rem]">
        <div className="flex items-center justify-between border-b border-saipei-gray-200 px-4 py-3">
          <h2 className="flex items-center gap-2 font-semibold text-saipei-dark-800">
            <ShoppingCart className="h-4.5 w-4.5 text-saipei-green-600" aria-hidden />
            Current sale
          </h2>
          {cart.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearCart} icon={<Trash2 className="h-3.5 w-3.5" aria-hidden />}>
              Clear
            </Button>
          ) : null}
        </div>

        <div className="border-b border-saipei-gray-200 px-4 py-3">
          <label
            htmlFor="pos-customer"
            className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-saipei-gray-500 uppercase"
          >
            <UserRound className="h-3.5 w-3.5" aria-hidden />
            Customer
          </label>
          <Select
            id="pos-customer"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Walk-in customer</option>
            {till.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
                {customer.balance > 0 ? ` — owes ${formatKes(customer.balance)}` : ''}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <span className="rounded-full bg-saipei-green-50 p-3 text-saipei-green-600">
                <ShoppingCart className="h-6 w-6" aria-hidden />
              </span>
              <p className="font-medium text-saipei-dark-800">No items yet</p>
              <p className="text-sm text-saipei-gray-500">
                Scan a barcode or tap a product to start the sale.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-saipei-gray-100">
              {cart.map((line) => (
                <li key={line.product.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-saipei-dark-800">
                        {line.product.name}
                      </p>
                      <p className="tabular text-xs text-saipei-gray-500">
                        {formatKes(line.product.sellingPrice)} each
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuantity(line.product.id, 0)}
                      aria-label={`Remove ${line.product.name}`}
                      className="rounded p-1 text-saipei-gray-400 hover:bg-saipei-red-50 hover:text-saipei-red-600"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setQuantity(line.product.id, line.quantity - 1)}
                        aria-label={`Reduce ${line.product.name}`}
                        className="rounded-md border border-saipei-gray-300 p-1.5 text-saipei-gray-600 hover:bg-saipei-gray-50"
                      >
                        <Minus className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) =>
                          setQuantity(line.product.id, Number(e.target.value))
                        }
                        aria-label={`Quantity of ${line.product.name}`}
                        className="tabular h-8 w-14 rounded-md border border-saipei-gray-300 text-center text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity(line.product.id, line.quantity + 1)}
                        aria-label={`Add one ${line.product.name}`}
                        className="rounded-md border border-saipei-gray-300 p-1.5 text-saipei-gray-600 hover:bg-saipei-gray-50"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>

                    <p className="tabular text-sm font-bold text-saipei-dark-800">
                      {formatKes(
                        line.product.sellingPrice * line.quantity - line.discount,
                      )}
                    </p>
                  </div>

                  {canDiscount ? (
                    <div className="mt-2 flex items-center gap-2">
                      <label
                        htmlFor={`discount-${line.product.id}`}
                        className="text-xs text-saipei-gray-500"
                      >
                        Discount
                      </label>
                      <input
                        id={`discount-${line.product.id}`}
                        type="number"
                        min={0}
                        value={line.discount || ''}
                        placeholder="0"
                        onChange={(e) =>
                          setDiscount(line.product.id, Number(e.target.value))
                        }
                        className="tabular h-8 w-24 rounded-md border border-saipei-gray-300 px-2 text-sm"
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* --- Totals + checkout --- */}
        <div className="border-t border-saipei-gray-200 bg-saipei-gray-50 px-4 py-4">
          {error ? (
            <div className="mb-3">
              <Alert tone="danger">{error}</Alert>
            </div>
          ) : null}

          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-saipei-gray-600">Subtotal</dt>
              <dd className="tabular font-medium text-saipei-gray-900">
                {formatKes(totals.gross)}
              </dd>
            </div>
            {totals.discount > 0 ? (
              <div className="flex justify-between">
                <dt className="text-saipei-gray-600">Discount</dt>
                <dd className="tabular font-medium text-saipei-red-600">
                  −{formatKes(totals.discount)}
                </dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between border-t border-saipei-gray-200 pt-2">
              <dt className="font-semibold text-saipei-dark-800">Amount payable</dt>
              <dd className="tabular text-2xl font-bold text-saipei-red-600">
                {formatKes(totals.total)}
              </dd>
            </div>
          </dl>

          {selectedCustomer && selectedCustomer.balance > 0 ? (
            <p className="mt-2">
              <Badge tone="warning">
                Outstanding balance {formatKes(selectedCustomer.balance)}
              </Badge>
            </p>
          ) : null}

          <Button
            size="pos"
            fullWidth
            className="mt-4"
            disabled={cart.length === 0 || isPending}
            onClick={() => setPayOpen(true)}
            icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
          >
            {isPending ? 'Saving…' : 'Charge'}
          </Button>
        </div>
      </aside>

      {payOpen ? (
        <PaymentDialog
          total={totals.total}
          customerName={selectedCustomer?.name ?? null}
          canSellOnCredit={canSellOnCredit && Boolean(customerId)}
          isPending={isPending}
          onCancel={() => setPayOpen(false)}
          onConfirm={handlePay}
        />
      ) : null}

      {completed ? (
        <ReceiptDialog sale={completed} onClose={() => setCompleted(null)} />
      ) : null}
    </div>
  )
}
