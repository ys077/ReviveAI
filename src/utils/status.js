/**
 * Canonical status interpretation for ReviveAI.
 *
 * Open (pipeline, KPIs, revenue at risk):
 *   Pending, Failed, Recovering, Alternative Required
 *
 * Closed (excluded from open pipeline):
 *   Recovered, Deferred
 *
 * Execution lock (do not run the simulation again):
 *   Recovered, Deferred, Alternative Required
 *
 * Alternative Required stays in the open recovery pipeline because revenue is
 * still outstanding, but the simulated workflow has already produced an outcome.
 */

export const OPEN_STATUSES = new Set([
  'Pending',
  'Failed',
  'Recovering',
  'Alternative Required',
])

export const CLOSED_STATUSES = new Set(['Recovered', 'Deferred'])

export const EXECUTION_LOCKED_STATUSES = new Set([
  'Recovered',
  'Deferred',
  'Alternative Required',
])

export function isOpen(transaction) {
  if (!transaction) return false
  if (!transaction.status) return true
  return OPEN_STATUSES.has(transaction.status)
}

export function isClosed(transaction) {
  return CLOSED_STATUSES.has(transaction?.status)
}

export function isRecovered(transaction) {
  return transaction?.status === 'Recovered'
}

export function isExecutionLocked(transaction) {
  return EXECUTION_LOCKED_STATUSES.has(transaction?.status)
}
