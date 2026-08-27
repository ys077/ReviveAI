import { analyzeTransaction } from './recoveryEngine.js'
import { formatINR, toAmount } from './format.js'
import { EXECUTION_LOCKED_STATUSES, isOpen, isRecovered } from './status.js'

export { isOpen, isRecovered } from './status.js'

export const RECOVERABLE_STATUSES = new Set([
  'Pending',
  'Failed',
  'Recovering',
  'Alternative Required',
])

export const METHOD_ORDER = ['UPI', 'Card', 'Net Banking', 'Wallet']
export const OPPORTUNITY_ORDER = ['High Opportunity', 'Medium Opportunity', 'Low Opportunity']

export function isRecoverable(transaction) {
  return isOpen(transaction)
}

export function recoveredValue(transaction) {
  const amount = toAmount(transaction?.amount)
  if (!isRecovered(transaction)) return 0
  if (transaction.recoveredAmount != null && transaction.recoveredAmount !== '') {
    return Math.min(amount, Math.max(0, toAmount(transaction.recoveredAmount)))
  }
  return amount
}

export function safeAnalyze(transaction) {
  try {
    return analyzeTransaction(transaction)
  } catch {
    return {
      recoveryProbability: 0,
      opportunityLevel: 'Low Opportunity',
      expectedRecovery: 0,
    }
  }
}

function dayKey(iso) {
  if (!iso || typeof iso !== 'string') return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : date.toISOString().slice(0, 10)
}

function formatDayLabel(key) {
  const date = new Date(`${key}T00:00:00+05:30`)
  if (Number.isNaN(date.getTime())) return key
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date)
}

export function buildAnalytics(transactions) {
  const list = Array.isArray(transactions) ? transactions.filter(Boolean) : []
  const rows = list.map((transaction) => ({
    transaction,
    analysis: safeAnalyze(transaction),
  }))

  const open = rows.filter(({ transaction }) => isOpen(transaction))
  const recoverable = rows.filter(({ transaction }) => isRecoverable(transaction))
  const recovered = list.filter(isRecovered)

  const revenueAtRisk = recoverable.reduce(
    (sum, row) => sum + toAmount(row.analysis.expectedRecovery),
    0,
  )
  const recoveredRevenue = recovered.reduce((sum, tx) => sum + recoveredValue(tx), 0)
  const recoveryRate = list.length === 0 ? 0 : (recovered.length / list.length) * 100
  const highOpportunityPipeline = open
    .filter(({ analysis }) => analysis.opportunityLevel === 'High Opportunity')
    .reduce((sum, row) => sum + toAmount(row.analysis.expectedRecovery), 0)

  const statusMap = new Map()
  list.forEach((transaction) => {
    const status = transaction.status || 'Unknown'
    const current = statusMap.get(status) || { status, count: 0 }
    current.count += 1
    statusMap.set(status, current)
  })
  const statusChart = [...statusMap.values()].sort((a, b) => b.count - a.count)

  const opportunityMap = new Map(
    OPPORTUNITY_ORDER.map((name) => [name, { name, count: 0, expectedRecovery: 0 }]),
  )
  rows.forEach(({ analysis }) => {
    const name = OPPORTUNITY_ORDER.includes(analysis.opportunityLevel)
      ? analysis.opportunityLevel
      : 'Low Opportunity'
    const current = opportunityMap.get(name)
    current.count += 1
    current.expectedRecovery += toAmount(analysis.expectedRecovery)
  })
  const opportunityChart = OPPORTUNITY_ORDER.map((name) => opportunityMap.get(name))

  const failureMap = new Map()
  rows.forEach(({ transaction, analysis }) => {
    const reason = transaction.failureReason || 'Unknown'
    const current = failureMap.get(reason) || {
      reason,
      count: 0,
      amount: 0,
      probabilitySum: 0,
      expectedRecovery: 0,
    }
    current.count += 1
    current.amount += toAmount(transaction.amount)
    current.probabilitySum += toAmount(analysis.recoveryProbability)
    current.expectedRecovery += toAmount(analysis.expectedRecovery)
    failureMap.set(reason, current)
  })
  const failureRows = [...failureMap.values()]
    .map((row) => ({
      ...row,
      averageProbability: row.count ? row.probabilitySum / row.count : 0,
    }))
    .sort((a, b) => b.expectedRecovery - a.expectedRecovery)

  const methodMap = new Map(
    METHOD_ORDER.map((method) => [
      method,
      {
        method,
        count: 0,
        amount: 0,
        probabilitySum: 0,
        expectedRecovery: 0,
        recoveredRevenue: 0,
      },
    ]),
  )
  rows.forEach(({ transaction, analysis }) => {
    const method = METHOD_ORDER.includes(transaction.paymentMethod)
      ? transaction.paymentMethod
      : 'UPI'
    const current = methodMap.get(method)
    current.count += 1
    current.amount += toAmount(transaction.amount)
    current.probabilitySum += toAmount(analysis.recoveryProbability)
    current.expectedRecovery += toAmount(analysis.expectedRecovery)
    if (isRecovered(transaction)) current.recoveredRevenue += recoveredValue(transaction)
  })
  const methodRows = METHOD_ORDER.map((method) => {
    const row = methodMap.get(method)
    return {
      ...row,
      averageProbability: row.count ? row.probabilitySum / row.count : 0,
    }
  })

  const unprocessed = list.filter((tx) => !EXECUTION_LOCKED_STATUSES.has(tx.status))
  const outcomeRows = [
    {
      outcome: 'Recovered',
      count: recovered.length,
      revenue: recoveredRevenue,
    },
    {
      outcome: 'Alternative Required',
      count: list.filter((tx) => tx.status === 'Alternative Required').length,
      revenue: 0,
    },
    {
      outcome: 'Deferred',
      count: list.filter((tx) => tx.status === 'Deferred').length,
      revenue: 0,
    },
    {
      outcome: 'Pending / Not Yet Processed',
      count: unprocessed.length,
      revenue: 0,
    },
  ]

  const timeMap = new Map()
  let validTimes = 0
  recoverable.forEach(({ transaction, analysis }) => {
    const key = dayKey(transaction.transactionTime)
    if (!key) return
    validTimes += 1
    const current = timeMap.get(key) || { day: key, label: formatDayLabel(key), count: 0, expectedRecovery: 0 }
    current.count += 1
    current.expectedRecovery += toAmount(analysis.expectedRecovery)
    timeMap.set(key, current)
  })
  const timeChart = [...timeMap.values()].sort((a, b) => a.day.localeCompare(b.day))
  const hasTimeView = validTimes >= 2 && timeChart.length >= 2

  const insights = []
  const topAvgFailure = [...failureRows].sort((a, b) => b.averageProbability - a.averageProbability)[0]
  if (topAvgFailure?.count) {
    insights.push(
      `${topAvgFailure.reason} currently has the highest average recovery probability at ${Math.round(topAvgFailure.averageProbability)}%.`,
    )
  }
  if (failureRows[0]?.expectedRecovery) {
    insights.push(
      `${failureRows[0].reason} holds the largest expected recoverable revenue at ${formatINR(failureRows[0].expectedRecovery)}.`,
    )
  }
  const topMethod = [...methodRows].sort((a, b) => b.expectedRecovery - a.expectedRecovery)[0]
  if (topMethod?.expectedRecovery) {
    insights.push(
      `${topMethod.method} has the strongest recovery potential, with ${formatINR(topMethod.expectedRecovery)} in expected recoverable value.`,
    )
  }
  if (list.length) {
    insights.push(
      `${formatINR(revenueAtRisk)} remains available for recovery across ${recoverable.length} open recoverable payment${recoverable.length === 1 ? '' : 's'}.`,
    )
    insights.push(
      `Current recovery rate is ${recoveryRate.toFixed(1)}%, with ${recovered.length} successfully recovered transaction${recovered.length === 1 ? '' : 's'}.`,
    )
  }
  const executed = outcomeRows.filter((row) => row.outcome !== 'Pending / Not Yet Processed' && row.count > 0)
  if (executed.length) {
    const topOutcome = [...executed].sort((a, b) => b.count - a.count)[0]
    insights.push(`The most common execution outcome so far is ${topOutcome.outcome} (${topOutcome.count}).`)
  }

  return {
    list,
    rows,
    total: list.length,
    openCount: open.length,
    recoveredCount: recovered.length,
    revenueAtRisk,
    recoveredRevenue,
    recoveryRate,
    highOpportunityPipeline,
    highOpportunityCount: open.filter(({ analysis }) => analysis.opportunityLevel === 'High Opportunity').length,
    statusChart,
    opportunityChart,
    failureRows,
    methodRows,
    outcomeRows,
    timeChart,
    hasTimeView,
    insights: insights.slice(0, 5),
  }
}
