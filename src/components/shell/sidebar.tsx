'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, X } from 'lucide-react'
import { NAVIGATION } from '@/lib/navigation'
import { hasPermission } from '@/lib/permissions'
import { LogoLockup } from '@/components/ui/logo'
import { cn } from '@/lib/utils'

/**
 * Primary navigation. Dark green is the structural colour; the active item is
 * SAIPEI green, and the Sales & POS group carries the brand red accent.
 */
export function Sidebar({
  permissions,
  mobileOpen,
  onClose,
}: {
  permissions: string[]
  mobileOpen: boolean
  onClose: () => void
}) {
  const pathname = usePathname()

  const groups = NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.permission || hasPermission(permissions, item.permission),
    ),
  })).filter((group) => group.items.length > 0)

  const activeGroup = groups.find((group) =>
    group.items.some((item) => isActive(pathname, item.href)),
  )

  const [openGroups, setOpenGroups] = useState<string[]>(
    activeGroup ? [activeGroup.label] : ['Dashboard'],
  )

  const toggle = (label: string) =>
    setOpenGroups((current) =>
      current.includes(label)
        ? current.filter((l) => l !== label)
        : [...current, label],
    )

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-saipei-dark-950/50 lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-saipei-dark-800 transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-saipei-dark-700 px-4 py-4">
          <Link href="/dashboard">
            <LogoLockup />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-md p-1.5 text-saipei-dark-200 hover:bg-saipei-dark-700 lg:hidden"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {groups.map((group) => {
            const isOpen = openGroups.includes(group.label)
            const groupActive = group.items.some((item) => isActive(pathname, item.href))

            return (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() => toggle(group.label)}
                  aria-expanded={isOpen}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors',
                    groupActive
                      ? 'text-white'
                      : 'text-saipei-dark-200 hover:bg-saipei-dark-700 hover:text-white',
                  )}
                >
                  <group.icon
                    className={cn(
                      'h-4.5 w-4.5 shrink-0',
                      group.accent === 'red' && 'text-saipei-red-400',
                      group.accent !== 'red' && groupActive && 'text-saipei-green-400',
                    )}
                    aria-hidden
                  />
                  <span className="flex-1">{group.label}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isOpen && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>

                {isOpen ? (
                  <ul className="mt-0.5 mb-1 space-y-0.5 pl-3">
                    {group.items.map((item) => {
                      const active = isActive(pathname, item.href)
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={onClose}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                              active
                                ? 'bg-saipei-green-500 font-semibold text-white'
                                : 'text-saipei-dark-200 hover:bg-saipei-dark-700 hover:text-white',
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                            {item.label}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>
            )
          })}
        </nav>

        <div className="border-t border-saipei-dark-700 px-4 py-3">
          <p className="text-[11px] text-saipei-dark-300">
            SAIPEI FOODS LIMITED
          </p>
          <p className="text-[11px] text-saipei-dark-400">From Kenya with Love</p>
        </div>
      </aside>
    </>
  )
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  // A parent route should not stay highlighted while a sibling is open.
  return pathname === href || pathname.startsWith(`${href}/`)
}
