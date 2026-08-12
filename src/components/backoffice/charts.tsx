import { formatNumber } from "./ui"

// The portal's four chart forms, all rendered on the server.
//
// Three decisions worth stating, because they are the ones that usually go
// wrong:
//
//   1. **No chart library.** Every form here is a handful of divs or one small
//      SVG. A charting bundle would be the largest dependency in the app, for an
//      internal screen, to draw a bar.
//
//   2. **Columns are laid out in CSS, not SVG.** An SVG column chart has to
//      choose between distorting its rounded corners (preserveAspectRatio=none)
//      and scaling its type with the container. Flex children with percentage
//      heights are exactly responsive, and the labels stay real text at real
//      size — which also means they are selectable and searchable.
//
//   3. **One series per chart, one axis.** Trails and searches are both "events
//      per day", but they answer different questions and belong in different
//      cards. Nothing here plots two scales against one another.
//
// Marks follow one spec throughout: columns capped at 24px with a 4px rounded
// data-end and a square foot on the baseline, hairline gridlines a single step
// off the surface, values labelled selectively (the peak, the ends) rather than
// on every mark, and never a number in the series colour — text stays in the ink
// tokens and the coloured mark beside it carries identity.

const ACCENT = "var(--wf-primary)"
const ACCENT_SOFT = "#C9DCF2"

/** Round a maximum up to a clean axis top: 1, 2, 5 × 10ⁿ. */
function niceMax(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const scaled = value / magnitude
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return step * magnitude
}

export interface Point {
  /** Machine value, e.g. 2026-08-12. Used for the hover title. */
  key: string
  /** What the axis shows, when this point gets a tick. */
  label: string
  value: number
}

/**
 * Daily volume. Reads as a shape first — a run of quiet days, a spike — and only
 * then as numbers, which is the right order for a page someone scans.
 */
export function ColumnChart({
  points,
  height = 172,
  unit,
  emptyMessage = "Nothing recorded in this period.",
}: {
  points: Point[]
  height?: number
  unit: string
  emptyMessage?: string
}) {
  const total = points.reduce((sum, p) => sum + p.value, 0)
  if (points.length === 0 || total === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-wf-border text-[13px] text-wf-faint"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    )
  }

  const peak = Math.max(...points.map((p) => p.value))
  const top = niceMax(peak)
  const peakIndex = points.findIndex((p) => p.value === peak)

  return (
    <figure
      className="m-0"
      role="img"
      aria-label={`${unit} per day. ${formatNumber(total)} in total across ${points.length} days, peaking at ${formatNumber(peak)} on ${points[peakIndex]?.label}.`}
    >
      <div className="flex gap-3">
        {/* Y axis: two ticks. They carry the values the marks are not labelled with. */}
        <div
          className="flex w-9 flex-shrink-0 flex-col justify-between text-right text-[10.5px] tabular-nums text-wf-faint"
          style={{ height }}
          aria-hidden
        >
          <span>{formatNumber(top)}</span>
          <span>{formatNumber(top / 2)}</span>
          <span>0</span>
        </div>

        <div className="relative min-w-0 flex-1" style={{ height }}>
          {/* Hairline gridlines, one step off the surface, sitting behind the marks. */}
          <div className="absolute inset-x-0 top-0 border-t border-wf-border" aria-hidden />
          <div className="absolute inset-x-0 top-1/2 border-t border-wf-border-faint" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 border-t border-wf-border" aria-hidden />

          <div className="absolute inset-0 flex items-end justify-between gap-[2px]">
            {points.map((p, i) => {
              const pct = (p.value / top) * 100
              return (
                <div key={p.key} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
                  {/* The peak is the one mark worth labelling; the rest are read
                      off the axis or from the hover title. */}
                  {i === peakIndex && p.value > 0 ? (
                    <span
                      className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[10.5px] font-semibold tabular-nums text-wf-body"
                      style={{ bottom: `calc(${pct}% + 4px)` }}
                    >
                      {formatNumber(p.value)}
                    </span>
                  ) : null}
                  <div
                    title={`${p.label}: ${formatNumber(p.value)} ${unit}`}
                    className="w-full max-w-6 rounded-t-[4px] transition-opacity hover:opacity-80"
                    style={{
                      height: p.value === 0 ? 2 : `max(3px, ${pct}%)`,
                      background: p.value === 0 ? "var(--wf-border)" : ACCENT,
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <figcaption className="mt-2 flex justify-between pl-12 text-[11px] text-wf-faint">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </figcaption>
    </figure>
  )
}

/**
 * A twelve-point trend inside a stat tile. Context, not measurement: it has no
 * axis and no labels, because a tile's number is the measurement.
 */
export function Sparkline({ values, width = 104, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const stepX = width / (values.length - 1)
  const y = (v: number) => height - 2 - (v / max) * (height - 4)
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const lastX = width
  const lastY = y(values[values.length - 1])

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <path d={path} fill="none" stroke={ACCENT_SOFT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* The current period in the accent: an end-dot with a surface ring so it
          stays legible where it meets the line. */}
      <circle cx={lastX} cy={lastY} r={4} fill={ACCENT} stroke="white" strokeWidth={2} />
    </svg>
  )
}

/**
 * Magnitude, ranked. A horizontal bar list rather than a column chart because
 * the categories are long strings — a ward name reads across, not rotated 45°.
 */
export function BarList({
  items,
  unit,
  emptyMessage = "Nothing to show yet.",
}: {
  items: { key: string; label: string; value: number; meta?: string; href?: string }[]
  unit: string
  emptyMessage?: string
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-[13px] text-wf-faint">{emptyMessage}</p>
  }
  const max = Math.max(...items.map((i) => i.value), 1)

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-[13px] font-medium text-wf-ink" title={item.label}>
              {item.label}
            </p>
            <p className="flex-shrink-0 text-[12.5px] font-semibold tabular-nums text-wf-body">
              {formatNumber(item.value)}
              <span className="ml-1 font-normal text-wf-faint">{unit}</span>
            </p>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-wf-surface">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, background: ACCENT }}
            />
          </div>
          {item.meta ? <p className="mt-1 text-[11.5px] text-wf-faint">{item.meta}</p> : null}
        </li>
      ))}
    </ul>
  )
}

/**
 * Part-to-whole across an ordered scale, as one bar.
 *
 * The segments are steps of a single hue, dark to light, because the categories
 * are *ordered* — a venue people can navigate, a venue you can only look at, a
 * venue that is just a pin. Distinct hues would say these are three unrelated
 * kinds of thing; a ramp says they are three points on the way to done. Each
 * segment is separated by a 2px gap in the surface colour rather than a stroke,
 * and labelled beneath, so the reading never depends on the colour alone.
 */
export function ShareBar({
  segments,
}: {
  segments: { key: string; label: string; value: number; shade: string; ink?: string }[]
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  if (total === 0) return <p className="py-4 text-center text-[13px] text-wf-faint">Nothing to show yet.</p>

  return (
    <div>
      <div className="flex h-9 w-full gap-[2px] overflow-hidden rounded-lg">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => {
            const share = (s.value / total) * 100
            // Only print the count inside the segment when it comfortably fits;
            // otherwise the legend below carries it, uncropped.
            const roomy = share > 12
            return (
              <div
                key={s.key}
                title={`${s.label}: ${formatNumber(s.value)} (${share.toFixed(1)}%)`}
                className="flex items-center justify-center first:rounded-l-lg last:rounded-r-lg"
                style={{ width: `${share}%`, background: s.shade }}
              >
                {roomy ? (
                  <span className="text-[11.5px] font-semibold tabular-nums" style={{ color: s.ink ?? "white" }}>
                    {formatNumber(s.value)}
                  </span>
                ) : null}
              </div>
            )
          })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-[12.5px] text-wf-body">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-[3px]" style={{ background: s.shade }} aria-hidden />
            <span>{s.label}</span>
            <span className="font-semibold tabular-nums text-wf-ink">{formatNumber(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The single-hue ramp the ordered forms draw from: complete → barely started. */
export const COVERAGE_SHADES = {
  navigable: "#06336B",
  sheet: "#0A5DC2",
  located: "#9FC3EC",
} as const
