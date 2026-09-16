import type { Metadata } from 'next'
import { requirePermission } from '@/lib/auth'
import { getTillData } from '@/lib/queries/pos'
import { PosTerminal } from './pos-terminal'

export const metadata: Metadata = { title: 'POS Till' }
export const dynamic = 'force-dynamic'

export default async function PosPage() {
  const user = await requirePermission('pos.sell')
  const till = await getTillData(user.id)

  return (
    <PosTerminal
      till={till}
      cashierName={user.fullName}
      canDiscount={user.permissions.includes('pos.discount')}
      canSellOnCredit={user.permissions.includes('sales.credit')}
    />
  )
}
