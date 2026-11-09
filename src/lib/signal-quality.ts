import { VOCAB } from './vocabulary.ts'

/**
 * Intended board sizes for a future quality assessment.
 * They are not applied. This module does not assign good, intermediate, or poor.
 */
export const PROPOSED_BOARD_SIZES = {
  good: VOCAB.high.length,
  intermediate: VOCAB.medium.length,
  poor: VOCAB.low.length,
} as const

export const PLANNED_INDICATORS = [
  {
    id: 'amplitude',
    text: 'Proportion of samples outside a pre-specified amplitude range, in the recording units.',
  },
  {
    id: 'flatline',
    text: 'Proportion of consecutive samples whose difference is below a pre-specified limit.',
  },
  {
    id: 'high-frequency',
    text: 'Power above a stated frequency cutoff divided by power in a stated reference band.',
  },
  {
    id: 'line-noise',
    text: 'Power at the mains frequency and its harmonic. This requires the sampling rate and the mains frequency.',
  },
  {
    id: 'discontinuity',
    text: 'Count of sample-to-sample jumps above a pre-specified limit.',
  },
] as const

export const RECORDING_REQUIREMENTS = [
  'Continuous multichannel samples, not a screenshot and not a feature table.',
  'Sampling rate in hertz.',
  'Channel names and montage.',
  'Units of the samples.',
  'Reference, and any filters already applied.',
  'The time window for each feature row, if those rows are retained.',
  'An independent artifact or quality label, or a published standard, before any cutoff is chosen.',
] as const

export type QualityReason = 'no-recording' | 'incomplete-recording' | 'no-thresholds'

export type QualityAssessment = {
  status: 'unavailable'
  reason: QualityReason
  missing: readonly string[]
  thresholdsSet: false
}

export type RecordingInput = {
  samplingRateHz?: unknown
  channelNames?: unknown
  unit?: unknown
  reference?: unknown
  filters?: unknown
  samples?: unknown
}

function hasSamples(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false
  return value.every((row) => Array.isArray(row) && row.length > 0 && row.every((sample) => typeof sample === 'number' && Number.isFinite(sample)))
}

export function assessSuppliedMaterials(): QualityAssessment {
  return {
    status: 'unavailable',
    reason: 'no-recording',
    missing: RECORDING_REQUIREMENTS,
    thresholdsSet: false,
  }
}

/**
 * Checks whether a recording object has the fields a later pipeline would need.
 * A complete object still does not receive a score. No cutoff has been established,
 * and this function does not calculate one from the samples.
 */
export function assessRecording(recording: RecordingInput | null | undefined): QualityAssessment {
  if (!recording) return assessSuppliedMaterials()
  const missing: string[] = []
  if (typeof recording.samplingRateHz !== 'number' || !(recording.samplingRateHz > 0)) {
    missing.push('Sampling rate in hertz.')
  }
  if (!Array.isArray(recording.channelNames) || recording.channelNames.length === 0 || recording.channelNames.some((name) => typeof name !== 'string' || name.length === 0)) {
    missing.push('Channel names and montage.')
  }
  if (typeof recording.unit !== 'string' || recording.unit.length === 0) {
    missing.push('Units of the samples.')
  }
  if (typeof recording.reference !== 'string' || recording.reference.length === 0) {
    missing.push('Reference, and any filters already applied.')
  }
  if (!hasSamples(recording.samples)) {
    missing.push('Continuous multichannel samples, not a screenshot and not a feature table.')
  }
  if (missing.length > 0) {
    return { status: 'unavailable', reason: 'incomplete-recording', missing, thresholdsSet: false }
  }
  return {
    status: 'unavailable',
    reason: 'no-thresholds',
    missing: ['An independent artifact or quality label, or a published standard, before any cutoff is chosen.'],
    thresholdsSet: false,
  }
}

/** The supplied project cannot select 16, 8, or 4 from a quality score. */
export function appliedBoardSize(_assessment: QualityAssessment = assessSuppliedMaterials()): null {
  return null
}
