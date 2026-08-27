const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const inrCompactFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatINR(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return inrFormatter.format(0)
  return inrFormatter.format(amount)
}

export function formatINRCompact(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return inrCompactFormatter.format(0)
  return inrCompactFormatter.format(amount)
}

export function formatPercent(value, digits = 1) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '0%'
  return `${amount.toFixed(digits)}%`
}

export function toAmount(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

