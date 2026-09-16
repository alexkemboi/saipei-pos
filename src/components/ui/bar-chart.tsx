import { formatKes } from '@/lib/utils'

export interface BarDatum {
  label: string
  value: number
  secondary?: number
}

/**
 * A compact SVG column chart. Rendered server-side with no charting library —
 * the shapes are simple and the page stays fast on a shop-floor machine.
 *
 * `secondary` draws a second, darker column behind the first (revenue vs cost).
 */
export function BarChart({
  data,
  height = 200,
  valueLabel = 'Value',
  secondaryLabel,
  format = formatKes,
}: {
  data: BarDatum[]
  height?: number
  valueLabel?: string
  secondaryLabel?: string
  format?: (value: number) => string
}) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-saipei-gray-500">
        No data for this period.
      </p>
    )
  }

  const max = Math.max(...data.map((d) => Math.max(d.value, d.secondary ?? 0)), 1)
  const barWidth = 100 / data.length

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-saipei-green-500" aria-hidden />
          <span className="text-saipei-gray-600">{valueLabel}</span>
        </span>
        {secondaryLabel ? (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-saipei-dark-300" aria-hidden />
            <span className="text-saipei-gray-600">{secondaryLabel}</span>
          </span>
        ) : null}
      </div>

      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`${valueLabel} by period`}
      >
        {/* Gridlines at quarter intervals */}
        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            key={fraction}
            x1="0"
            x2="100"
            y1={height * fraction}
            y2={height * fraction}
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-saipei-gray-200"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {data.map((datum, index) => {
          const x = index * barWidth
          const valueHeight = (datum.value / max) * (height - 8)
          const secondaryHeight = ((datum.secondary ?? 0) / max) * (height - 8)
          const pad = barWidth * 0.18

          return (
            <g key={datum.label}>
              {datum.secondary !== undefined ? (
                <rect
                  x={x + pad}
                  y={height - secondaryHeight}
                  width={barWidth - pad * 2}
                  height={secondaryHeight}
                  className="fill-saipei-dark-300"
                />
              ) : null}
              <rect
                x={x + pad + (datum.secondary !== undefined ? (barWidth - pad * 2) * 0.28 : 0)}
                y={height - valueHeight}
                width={
                  (barWidth - pad * 2) *
                  (datum.secondary !== undefined ? 0.72 : 1)
                }
                height={valueHeight}
                className="fill-saipei-green-500"
              >
                <title>
                  {datum.label}: {format(datum.value)}
                </title>
              </rect>
            </g>
          )
        })}
      </svg>

      {/* Labels are HTML so they do not stretch with the preserveAspectRatio */}
      <div className="mt-1 flex text-[10px] text-saipei-gray-500">
        {data.map((datum) => (
          <span
            key={datum.label}
            className="truncate px-0.5 text-center"
            style={{ width: `${barWidth}%` }}
          >
            {datum.label}
          </span>
        ))}
      </div>

      <p className="mt-2 text-xs text-saipei-gray-500">
        Peak: <span className="tabular font-medium">{format(max)}</span>
      </p>
    </div>
  )
}
