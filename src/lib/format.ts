export function formatSci(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return ''
  return value.toExponential(digits)
}

export function formatShare(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return ''
  return value.toFixed(3)
}

export function formatR(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return ''
  return value.toFixed(3)
}

export function formatMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return ''
  return `${(ms / 1000).toFixed(2)} s`
}

export function formatCountPhrase(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function spokenForm(token: string): string {
  if (token === 'OK') return 'okay'
  return token.toLowerCase()
}

export function stamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
