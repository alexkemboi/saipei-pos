import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * The supplied SAIPEI FOODS LIMITED mark, cropped to the artwork (719x436 of
 * the original 1024x684 - margins only, no resampling). Width and height are
 * derived from one scale factor, so it is never stretched, rotated or recoloured.
 */
const RATIO = 719 / 436

export function Logo({
  height = 44,
  className,
  priority,
}: {
  height?: number
  className?: string
  priority?: boolean
}) {
  return (
    <Image
      src="/logo.png"
      alt="SAIPEI FOODS LIMITED"
      width={Math.round(height * RATIO)}
      height={height}
      priority={priority}
      // Height drives the size; width follows the intrinsic ratio.
      style={{ height: `${height}px`, width: 'auto' }}
      className={cn('object-contain', className)}
    />
  )
}

/**
 * Sidebar/header lockup for use on dark green. The logo artwork is on a white
 * plate so the mark keeps its own colours rather than being tinted.
 */
export function LogoLockup({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center justify-center rounded-md bg-white p-1.5">
        <Logo height={28} />
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-md bg-white px-2.5 py-2">
        <Logo height={34} priority />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-wide text-white">SAIPEI POS</p>
        <p className="text-[11px] text-saipei-green-200">Foods Limited</p>
      </div>
    </div>
  )
}
