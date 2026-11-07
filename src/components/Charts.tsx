import { useId, useRef } from 'react'
import { downloadSvgElement } from '../lib/download.ts'

export type ChartPoint = { x: number; y: number }
export type ChartSeries = {
  id: string
  name: string
  color: string
  dash?: string
  points: ChartPoint[]
}
export type ChartGuide = { value: number; label?: string }

type XYChartProps = {
  series: ChartSeries[]
  mode?: 'line' | 'dots'
  xLabel: string
  yLabel: string
  caption: string
  filename: string
  yDomain?: [number, number]
  yGuides?: ChartGuide[]
}

const W = 760
const H = 300

function extent(values: number[], pad: number): [number, number] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  if (min === max) {
    const delta = Math.abs(min) || 1
    return [min - delta, max + delta]
  }
  const span = max - min
  return [min - span * pad, max + span * pad]
}

function ticks(min: number, max: number): number[] {
  const span = max - min
  if (!(span > 0)) return [min]
  const raw = span / 4
  const exp = Math.floor(Math.log10(raw))
  const base = 10 ** exp
  const fraction = raw / base
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * base
  const start = Math.ceil((min - step * 1e-9) / step) * step
  const out: number[] = []
  for (let value = start; value <= max + step * 1e-6; value += step) {
    if (value >= min - step * 1e-6) out.push(Number(value.toPrecision(12)))
    if (out.length > 6) break
  }
  return out.length ? out : [min, max]
}

function formatTick(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) < 1000) return String(value)
  const abs = Math.abs(value)
  if (abs !== 0 && (abs < 0.01 || abs >= 1000)) return value.toExponential(1)
  if (abs >= 100) return value.toFixed(0)
  if (abs >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

export function XYChart({
  series,
  mode = 'line',
  xLabel,
  yLabel,
  caption,
  filename,
  yDomain,
  yGuides = [],
}: XYChartProps) {
  const ref = useRef<SVGSVGElement>(null)
  const titleId = useId()
  const points = series.flatMap((item) => item.points)
  if (points.length === 0) {
    return <p className="status">No values to plot.</p>
  }
  const top = series.length > 1 ? 32 : 16
  const margin = { l: 78, r: 18, t: top, b: 46 }
  const plotW = W - margin.l - margin.r
  const plotH = H - margin.t - margin.b
  const [x0, x1] = extent(points.map((point) => point.x), 0.03)
  const [autoY0, autoY1] = extent(points.map((point) => point.y), 0.08)
  const y0 = yDomain ? yDomain[0] : autoY0
  const y1 = yDomain ? yDomain[1] : autoY1
  const spanX = x1 - x0 || 1
  const spanY = y1 - y0 || 1
  const X = (value: number) => margin.l + ((value - x0) / spanX) * plotW
  const Y = (value: number) => margin.t + (1 - (value - y0) / spanY) * plotH
  const xTicks = ticks(x0, x1).filter((value) => value >= x0 && value <= x1)
  const yTicks = ticks(y0, y1).filter((value) => value >= y0 && value <= y1)
  const showZero = y0 < 0 && y1 > 0

  return (
    <figure className="chart">
      <div className="chart-bar">
        <p id={titleId} className="chart-title">
          {caption}
        </p>
        <button
          type="button"
          onClick={() => {
            if (ref.current) downloadSvgElement(ref.current, filename)
          }}
        >
          Download SVG
        </button>
      </div>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={titleId}
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>{caption}</title>
        <rect width={W} height={H} fill="#070809" />
        {series.length > 1 && (
          <g aria-hidden="true">
            {series.map((item, index) => (
              <g key={item.id} transform={`translate(${margin.l + index * 120}, 16)`}>
                <line
                  x1={0}
                  x2={24}
                  y1={0}
                  y2={0}
                  stroke={item.color}
                  strokeWidth={1.6}
                  strokeDasharray={item.dash}
                />
                <text x={30} y={4} fill="#c5c7bf" fontSize={12} fontFamily="IBM Plex Mono, sans-serif">
                  {item.name}
                </text>
              </g>
            ))}
          </g>
        )}
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line x1={margin.l} x2={W - margin.r} y1={Y(tick)} y2={Y(tick)} stroke="#22252b" />
            <text
              x={margin.l - 8}
              y={Y(tick)}
              fill="#c5c7bf"
              fontSize={11}
              fontFamily="IBM Plex Mono, sans-serif"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {formatTick(tick)}
            </text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <text
            key={`x-${tick}`}
            x={X(tick)}
            y={H - 22}
            fill="#c5c7bf"
            fontSize={11}
            fontFamily="IBM Plex Mono, sans-serif"
            textAnchor="middle"
          >
            {formatTick(tick)}
          </text>
        ))}
        {showZero && <line x1={margin.l} x2={W - margin.r} y1={Y(0)} y2={Y(0)} stroke="#8d9088" />}
        {yGuides.map((guide) =>
          guide.value >= y0 && guide.value <= y1 ? (
            <g key={guide.value}>
              <line
                x1={margin.l}
                x2={W - margin.r}
                y1={Y(guide.value)}
                y2={Y(guide.value)}
                stroke="#9ec0ef"
                strokeDasharray="3 3"
              />
              {guide.label ? (
                <text
                  x={W - margin.r - 4}
                  y={Y(guide.value) - 4}
                  fill="#9ec0ef"
                  fontSize={11}
                  fontFamily="IBM Plex Mono, sans-serif"
                  textAnchor="end"
                >
                  {guide.label}
                </text>
              ) : null}
            </g>
          ) : null,
        )}
        <line x1={margin.l} x2={margin.l} y1={margin.t} y2={margin.t + plotH} stroke="#8d9088" />
        <line
          x1={margin.l}
          x2={margin.l + plotW}
          y1={margin.t + plotH}
          y2={margin.t + plotH}
          stroke="#8d9088"
        />
        {series.map((item) =>
          mode === 'line' ? (
            <polyline
              key={item.id}
              fill="none"
              stroke={item.color}
              strokeWidth={1.6}
              strokeDasharray={item.dash}
              points={item.points.map((point) => `${X(point.x)},${Y(point.y)}`).join(' ')}
            />
          ) : (
            <g key={item.id}>
              {item.points.map((point, index) => (
                <circle
                  key={`${item.id}-${index}`}
                  cx={X(point.x)}
                  cy={Y(point.y)}
                  r={2.6}
                  fill={item.color}
                />
              ))}
            </g>
          ),
        )}
        <text
          x={margin.l + plotW / 2}
          y={H - 4}
          fill="#c5c7bf"
          fontSize={12}
          fontFamily="pplxSans, Geist Variable, Segoe UI, sans-serif"
          textAnchor="middle"
        >
          {xLabel}
        </text>
        <text
          x={16}
          y={margin.t + plotH / 2}
          fill="#c5c7bf"
          fontSize={12}
          fontFamily="pplxSans, Geist Variable, Segoe UI, sans-serif"
          textAnchor="middle"
          transform={`rotate(-90 16 ${margin.t + plotH / 2})`}
        >
          {yLabel}
        </text>
      </svg>
    </figure>
  )
}

type HistogramProps = {
  bins: { x0: number; x1: number; count: number }[]
  xGuides?: ChartGuide[]
  xLabel: string
  caption: string
  filename: string
}

export function HistogramChart({ bins, xGuides = [], xLabel, caption, filename }: HistogramProps) {
  const ref = useRef<SVGSVGElement>(null)
  const titleId = useId()
  if (bins.length === 0) return <p className="status">No values to plot.</p>
  const margin = { l: 48, r: 16, t: 16, b: 46 }
  const plotW = W - margin.l - margin.r
  const plotH = H - margin.t - margin.b
  const x0 = bins[0].x0
  const x1 = bins[bins.length - 1].x1
  const yMax = Math.max(...bins.map((bin) => bin.count), 1)
  const X = (value: number) => margin.l + ((value - x0) / (x1 - x0 || 1)) * plotW
  const Y = (count: number) => margin.t + (1 - count / (yMax * 1.1)) * plotH
  const yTicks = ticks(0, yMax).filter((value) => value >= 0 && value <= yMax * 1.1)
  const xTicks = ticks(x0, x1).filter((value) => value >= x0 && value <= x1)

  return (
    <figure className="chart">
      <div className="chart-bar">
        <p id={titleId} className="chart-title">
          {caption}
        </p>
        <button
          type="button"
          onClick={() => {
            if (ref.current) downloadSvgElement(ref.current, filename)
          }}
        >
          Download SVG
        </button>
      </div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={titleId} xmlns="http://www.w3.org/2000/svg">
        <title>{caption}</title>
        <rect width={W} height={H} fill="#070809" />
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={margin.l} x2={W - margin.r} y1={Y(tick)} y2={Y(tick)} stroke="#22252b" />
            <text
              x={margin.l - 8}
              y={Y(tick)}
              fill="#c5c7bf"
              fontSize={11}
              fontFamily="IBM Plex Mono, sans-serif"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {formatTick(tick)}
            </text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <text
            key={tick}
            x={X(tick)}
            y={H - 22}
            fill="#c5c7bf"
            fontSize={11}
            fontFamily="IBM Plex Mono, sans-serif"
            textAnchor="middle"
          >
            {formatTick(tick)}
          </text>
        ))}
        {bins.map((bin) => {
          const left = X(bin.x0) + 1
          const right = X(bin.x1) - 1
          return (
            <rect
              key={`${bin.x0}-${bin.x1}`}
              x={left}
              y={Y(bin.count)}
              width={Math.max(0, right - left)}
              height={Y(0) - Y(bin.count)}
              fill="#9ec0ef"
            />
          )
        })}
        {xGuides.map((guide) =>
          guide.value >= x0 && guide.value <= x1 ? (
            <line
              key={guide.value}
              x1={X(guide.value)}
              x2={X(guide.value)}
              y1={margin.t}
              y2={margin.t + plotH}
              stroke="#e0b4a8"
              strokeDasharray="3 3"
            />
          ) : null,
        )}
        <line x1={margin.l} x2={margin.l} y1={margin.t} y2={margin.t + plotH} stroke="#8d9088" />
        <line
          x1={margin.l}
          x2={margin.l + plotW}
          y1={margin.t + plotH}
          y2={margin.t + plotH}
          stroke="#8d9088"
        />
        <text
          x={margin.l + plotW / 2}
          y={H - 4}
          fill="#c5c7bf"
          fontSize={12}
          fontFamily="pplxSans, Geist Variable, Segoe UI, sans-serif"
          textAnchor="middle"
        >
          {xLabel}
        </text>
        <text
          x={14}
          y={margin.t + plotH / 2}
          fill="#c5c7bf"
          fontSize={12}
          fontFamily="pplxSans, Geist Variable, Segoe UI, sans-serif"
          textAnchor="middle"
          transform={`rotate(-90 14 ${margin.t + plotH / 2})`}
        >
          Rows
        </text>
      </svg>
    </figure>
  )
}
