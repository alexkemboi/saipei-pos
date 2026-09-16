'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** `window.print()` needs the browser, so this stays a tiny client island. */
export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <Button
      variant="secondary"
      onClick={() => window.print()}
      icon={<Printer className="h-4 w-4" aria-hidden />}
    >
      {label}
    </Button>
  )
}
