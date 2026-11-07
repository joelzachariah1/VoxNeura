export function mean(values: number[]): number {
  if (values.length === 0) throw new Error('mean of an empty list')
  let sum = 0
  for (const value of values) sum += value
  return sum / values.length
}

/** Sample standard deviation. Divisor is n - 1. */
export function sampleSd(values: number[]): number | null {
  if (values.length < 2) return null
  const center = mean(values)
  let sum = 0
  for (const value of values) {
    const delta = value - center
    sum += delta * delta
  }
  return Math.sqrt(sum / (values.length - 1))
}

/**
 * Linear-interpolation quantile (Hyndman and Fan, type 7).
 * `sortedAscending` must already be sorted from low to high.
 */
export function quantile(sortedAscending: number[], p: number): number {
  if (sortedAscending.length === 0) throw new Error('quantile of an empty list')
  const pc = Math.min(1, Math.max(0, p))
  if (sortedAscending.length === 1) return sortedAscending[0]
  const index = (sortedAscending.length - 1) * pc
  const low = Math.floor(index)
  const high = Math.ceil(index)
  if (low === high) return sortedAscending[low]
  const weight = index - low
  return sortedAscending[low] * (1 - weight) + sortedAscending[high] * weight
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return quantile(sorted, 0.5)
}

/** Pearson correlation. Null when either input has no variance. */
export function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null
  const xMean = mean(xs)
  const yMean = mean(ys)
  let num = 0
  let xSum = 0
  let ySum = 0
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - xMean
    const dy = ys[i] - yMean
    num += dx * dy
    xSum += dx * dx
    ySum += dy * dy
  }
  if (xSum === 0 || ySum === 0) return null
  return num / Math.sqrt(xSum * ySum)
}

export type ColumnStat = {
  column: string
  source: 'file' | 'computed'
  n: number
  min: number
  max: number
  mean: number
  sampleSd: number | null
  q1: number
  median: number
  q3: number
}

export function columnStat(
  column: string,
  source: 'file' | 'computed',
  values: number[],
): ColumnStat {
  if (values.length === 0) throw new Error(`no values for ${column}`)
  const sorted = [...values].sort((a, b) => a - b)
  return {
    column,
    source,
    n: values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: mean(values),
    sampleSd: sampleSd(values),
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
  }
}

export type HistogramBin = { x0: number; x1: number; count: number }

/** Equal-width bins from the minimum to the maximum. */
export function histogram(values: number[], binCount = 10): HistogramBin[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const width = max === min ? 1 : (max - min) / binCount
  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => ({
    x0: min + i * width,
    x1: min + (i + 1) * width,
    count: 0,
  }))
  for (const value of values) {
    let index = Math.floor((value - min) / width)
    if (index >= binCount) index = binCount - 1
    if (index < 0) index = 0
    bins[index].count += 1
  }
  return bins
}
