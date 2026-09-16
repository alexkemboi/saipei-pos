import type { ReactNode } from 'react'
import { AppShell } from '@/components/shell/app-shell'
import { requireUser } from '@/lib/auth'

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await requireUser()

  return (
    <AppShell
      user={{
        fullName: user.fullName,
        roleName: user.roleName,
        permissions: user.permissions,
      }}
    >
      {children}
    </AppShell>
  )
}
