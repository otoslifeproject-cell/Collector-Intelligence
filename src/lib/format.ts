export const money = (value?: number | null, currency = 'GBP') => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(Number(value))
  } catch {
    return `${currency} ${Number(value).toFixed(0)}`
  }
}

export const date = (value?: string | null) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value))
}

export const confidenceTone = (value?: number | null) => {
  if (value === null || value === undefined) return 'neutral'
  if (value >= 80) return 'good'
  if (value >= 55) return 'warn'
  return 'risk'
}
