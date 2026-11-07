import { pearson } from './stats.ts'

/** SHA-256 of public/data/features.csv at the time this project was assembled. */
export const RECORDED_SHA256 =
  '8613d4b390b7ae3769f8d957c7eda4827a7688f6fa57937afdad122fb5395110'

export const FEATURE_COLUMNS = ['theta', 'alpha', 'beta', 'variability', 'mean_amp'] as const
export type FeatureKey = (typeof FEATURE_COLUMNS)[number]

export type FeatureRow = {
  index: number
  theta: number
  alpha: number
  beta: number
  variability: number
  mean_amp: number
}

const HEADER = FEATURE_COLUMNS.join(',')

export function parseFeatures(text: string): FeatureRow[] {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/)
  if (lines.length < 2) throw new Error('features.csv has no data rows.')
  const header = lines[0].split(',').map((cell) => cell.trim())
  if (header.join(',') !== HEADER) {
    throw new Error('features.csv header is not theta,alpha,beta,variability,mean_amp.')
  }
  return lines.slice(1).map((line, rowIndex) => {
    const cells = line.split(',')
    if (cells.length !== FEATURE_COLUMNS.length) {
      throw new Error(`Row ${rowIndex + 1} does not have 5 columns.`)
    }
    const nums = cells.map((cell) => Number(cell.trim()))
    if (nums.some((value) => !Number.isFinite(value))) {
      throw new Error(`Row ${rowIndex + 1} has a non-numeric value.`)
    }
    return {
      index: rowIndex + 1,
      theta: nums[0],
      alpha: nums[1],
      beta: nums[2],
      variability: nums[3],
      mean_amp: nums[4],
    }
  })
}

export type BandShares = { theta: number; alpha: number; beta: number }

/** Share of each band in the sum of the three band columns. Null if the sum is not positive. */
export function bandShares(row: FeatureRow): BandShares | null {
  const total = row.theta + row.alpha + row.beta
  if (!(total > 0)) return null
  return {
    theta: row.theta / total,
    alpha: row.alpha / total,
    beta: row.beta / total,
  }
}

export type CorrelationCell = {
  a: FeatureKey
  b: FeatureKey
  r: number | null
}

export function correlationMatrix(rows: FeatureRow[]): CorrelationCell[] {
  const series = Object.fromEntries(
    FEATURE_COLUMNS.map((key) => [key, rows.map((row) => row[key])]),
  ) as Record<FeatureKey, number[]>
  const cells: CorrelationCell[] = []
  for (const a of FEATURE_COLUMNS) {
    for (const b of FEATURE_COLUMNS) {
      cells.push({ a, b, r: pearson(series[a], series[b]) })
    }
  }
  return cells
}
