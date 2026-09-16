'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { LogOut, Menu, ShoppingCart, User } from 'lucide-react'
import { Sidebar } from '@/components/shell/sidebar'
import { Button } from '@/components/ui/button'
import { hasPermission } from '@/lib/permissions'

export function AppShell({
  user,
  children,
}: {
  user: { fullName: string; roleName: string; permissions: string[] }
  children: ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-saipei-gray-50">
      <Sidebar
        permissions={user.permissions}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-saipei-dark-800 bg-saipei-dark-700 px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-md p-2 text-white hover:bg-saipei-dark-600 lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              SAIPEI FOODS LIMITED
            </p>
            <p className="truncate text-xs text-saipei-green-200">
              Import, Inventory &amp; Point of Sale
            </p>
          </div>

          {hasPermission(user.permissions, 'pos.sell') ? (
            <Link href="/pos" className="hidden sm:block">
              <Button
                variant="danger"
                size="sm"
                icon={<ShoppingCart className="h-4 w-4" aria-hidden />}
              >
                Open POS
              </Button>
            </Link>
          ) : null}

          <div className="hidden items-center gap-2.5 border-l border-saipei-dark-600 pl-3 md:flex">
            <span className="rounded-full bg-saipei-green-500 p-1.5 text-white">
              <User className="h-4 w-4" aria-hidden />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-medium text-white">{user.fullName}</p>
              <p className="text-xs text-saipei-green-200">{user.roleName}</p>
            </div>
          </div>

          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-md p-2 text-saipei-dark-100 transition-colors hover:bg-saipei-dark-600 hover:text-white"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" aria-hidden />
            </button>
          </form>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
