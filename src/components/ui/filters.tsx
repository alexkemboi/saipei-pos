'use client'

import type { Route } from 'next'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { Search, X } from 'lucide-react'
import { Input, Select } from '@/components/ui/form'
import { Button } from '@/components/ui/button'

export interface FilterOption {
  value: string
  label: string
}

/**
 * List filters that live in the URL, so a filtered view can be bookmarked,
 * shared and reloaded. Each change is a server navigation.
 */
export function ListFilters({
  searchPlaceholder = 'Search…',
  selects = [],
  showDateRange = false,
  showSearch = true,
}: {
  searchPlaceholder?: string
  selects?: { name: string; label: string; options: FilterOption[] }[]
  showDateRange?: boolean
  /** Reports filter by date and dimension only - there is nothing to search. */
  showSearch?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function update(name: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(name, value)
    else next.delete(name)
    next.delete('page') // a new filter always starts at page one
    startTransition(() => router.push(`${pathname}?${next.toString()}` as Route))
  }

  const hasFilters = [...params.keys()].some((key) => key !== 'page')

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      {showSearch ? (
      <div className="relative min-w-[15rem] flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-saipei-gray-400"
          aria-hidden
        />
        <Input
          name="q"
          defaultValue={params.get('q') ?? ''}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="pl-9"
          onKeyDown={(e) => {
            if (e.key === 'Enter') update('q', e.currentTarget.value)
          }}
          onBlur={(e) => {
            if (e.currentTarget.value !== (params.get('q') ?? '')) {
              update('q', e.currentTarget.value)
            }
          }}
        />
      </div>
      ) : null}

      {selects.map((select) => (
        <div key={select.name}>
          <label
            htmlFor={`filter-${select.name}`}
            className="mb-1 block text-xs font-medium text-saipei-gray-500"
          >
            {select.label}
          </label>
          <Select
            id={`filter-${select.name}`}
            value={params.get(select.name) ?? ''}
            onChange={(e) => update(select.name, e.target.value)}
            className="w-auto min-w-[10rem]"
          >
            <option value="">All</option>
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      ))}

      {showDateRange ? (
        <>
          <div>
            <label htmlFor="filter-from" className="mb-1 block text-xs font-medium text-saipei-gray-500">
              From
            </label>
            <Input
              id="filter-from"
              type="date"
              value={params.get('from') ?? ''}
              onChange={(e) => update('from', e.target.value)}
              className="w-auto"
            />
          </div>
          <div>
            <label htmlFor="filter-to" className="mb-1 block text-xs font-medium text-saipei-gray-500">
              To
            </label>
            <Input
              id="filter-to"
              type="date"
              value={params.get('to') ?? ''}
              onChange={(e) => update('to', e.target.value)}
              className="w-auto"
            />
          </div>
        </>
      ) : null}

      {hasFilters ? (
        <Button
          variant="ghost"
          onClick={() => startTransition(() => router.push(pathname as Route))}
          icon={<X className="h-4 w-4" aria-hidden />}
          disabled={isPending}
        >
          Clear
        </Button>
      ) : null}
    </div>
  )
}

export function Pagination({
  page,
  pageCount,
  total,
}: {
  page: number
  pageCount: number
  total: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  if (pageCount <= 1) {
    return (
      <p className="mt-3 text-xs text-saipei-gray-500">
        {total} {total === 1 ? 'record' : 'records'}
      </p>
    )
  }

  function goTo(next: number) {
    const search = new URLSearchParams(params.toString())
    search.set('page', String(next))
    router.push(`${pathname}?${search.toString()}` as Route)
  }

  return (
    <nav
      className="mt-3 flex items-center justify-between gap-3"
      aria-label="Pagination"
    >
      <p className="text-xs text-saipei-gray-500">
        Page <span className="tabular font-medium">{page}</span> of{' '}
        <span className="tabular font-medium">{pageCount}</span> ·{' '}
        <span className="tabular">{total}</span> records
      </p>
      <div className="flex gap-2">
        <Button
          variant="neutral"
          size="sm"
          disabled={page <= 1}
          onClick={() => goTo(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="neutral"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => goTo(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  )
}
