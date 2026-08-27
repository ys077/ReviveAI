import { analyzeTransaction } from './recoveryEngine.js'
import { EXECUTION_LOCKED_STATUSES } from './status.js'

export const PROCESSED_STATUSES = EXECUTION_LOCKED_STATUSES

const TEMPORARY_FAILURES = new Set([
  'Network Timeout',
  'Technical Error',
  'Payment Gateway Timeout',
])

const METHOD_FRICTION = new Set(['User Abandoned', 'Authentication Failed'])
const FUNDING_ISSUES = new Set(['Insufficient Funds', 'Bank Declined'])

function toNumber(value, fallback = 0) {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Simulated recovered rupees: amount × probability, at least ₹1 when amount > 0,
 * never above the original ticket.
 */
export function calculateRecoveredAmount(amount, recoveryProbability) {
  const safeAmount = Math.max(0, toNumber(amount, 0))
  if (safeAmount <= 0) return 0

  const rate = clamp(toNumber(recoveryProbability, 0) / 100, 0.5, 1)
  return Math.min(safeAmount, Math.max(1, Math.round(safeAmount * rate)))
}

/**
 * Deterministic simulated outcome. Does not recompute scoring; it consumes analyzeTransaction().
 *
 * High Opportunity → Recovered, unless funding/method friction suggests otherwise.
 * Medium Opportunity → Alternative Required, unless funding/retries suggest Deferred,
 *   or a clean temporary failure still looks recoverable.
 * Low Opportunity → Deferred, unless a high-success abandoned/auth case should switch methods.
 */
export function decideFinalStatus(transaction, analysis) {
  const level = analysis?.opportunityLevel || 'Low Opportunity'
  const reason = transaction?.failureReason || ''
  const retries = toNumber(transaction?.retryAttempts, 0)
  const successRate = toNumber(transaction?.customerSuccessRate, 0)
  const amount = toNumber(transaction?.amount, 0)
  const method = transaction?.paymentMethod || ''
  const probability = toNumber(analysis?.recoveryProbability, 0)

  if (level === 'High Opportunity') {
    if (reason === 'Insufficient Funds') return 'Deferred'
    if (FUNDING_ISSUES.has(reason) && retries >= 2) return 'Deferred'
    if (METHOD_FRICTION.has(reason) && retries >= 2) return 'Alternative Required'
    if (amount >= 40000 && retries >= 2) return 'Alternative Required'
    if (method === 'Net Banking' && reason === 'Bank Declined') return 'Alternative Required'
    return 'Recovered'
  }

  if (level === 'Medium Opportunity') {
    if (FUNDING_ISSUES.has(reason)) return 'Deferred'
    if (retries >= 3) return 'Deferred'
    if (successRate < 45) return 'Deferred'
    if (TEMPORARY_FAILURES.has(reason) && retries <= 1 && probability >= 70) return 'Recovered'
    return 'Alternative Required'
  }

  if (METHOD_FRICTION.has(reason) && retries <= 1 && successRate >= 70) {
    return 'Alternative Required'
  }

  return 'Deferred'
}

function buildRecoveredResult(transaction, analysis, processedAt) {
  const recoveredAmount = calculateRecoveredAmount(transaction.amount, analysis.recoveryProbability)

  return {
    finalStatus: 'Recovered',
    status: 'Recovered',
    recoveredAmount,
    recoveredAt: processedAt,
    processedAt,
    completedAction: 'Retry Payment',
    recoveryResult:
      'Payment recovery completed successfully using the AI-recommended retry strategy. This is a simulated prototype outcome and does not process a live payment.',
    alternativePaymentMethod: analysis.alternativePaymentMethod,
    deferredUntil: null,
  }
}

function buildAlternativeResult(transaction, analysis, processedAt) {
  const method = analysis.alternativePaymentMethod || 'UPI'

  return {
    finalStatus: 'Alternative Required',
    status: 'Alternative Required',
    processedAt,
    completedAction: 'Alternative payment method recommended',
    alternativePaymentMethod: method,
    recoveryResult: `The original ${transaction.paymentMethod || 'payment'} method was not recovered. ReviveAI recommends switching to ${method}. This is a simulated prototype outcome and does not process a live payment.`,
    recoveredAmount: null,
    recoveredAt: null,
    deferredUntil: null,
  }
}

function buildDeferredResult(transaction, analysis, processedAt) {
  const deferredUntil = analysis.bestRetryTime || 'After 24 hours'

  return {
    finalStatus: 'Deferred',
    status: 'Deferred',
    processedAt,
    completedAction: 'Recovery deferred',
    deferredUntil,
    recoveryResult:
      'Recovery has been deferred because the current transaction signals indicate a low probability of immediate success. This is a simulated prototype outcome and does not process a live payment.',
    recoveredAmount: null,
    recoveredAt: null,
    alternativePaymentMethod: analysis.alternativePaymentMethod,
  }
}

/**
 * Simulated recovery execution. Same transaction + analysis always yield the same status and amounts.
 * processedAt may vary because it is captured at click time and is not used for scoring.
 */
export function executeRecoveryStrategy(transaction, options = {}) {
  if (!transaction || typeof transaction !== 'object') {
    return {
      finalStatus: 'Deferred',
      status: 'Deferred',
      completedAction: 'Recovery deferred',
      deferredUntil: 'After 24 hours',
      recoveryResult: 'Recovery could not run because transaction data was missing.',
      processedAt: options.processedAt || new Date().toISOString(),
      recoveredAmount: null,
      recoveredAt: null,
      alternativePaymentMethod: 'UPI',
      skipped: true,
    }
  }

  if (PROCESSED_STATUSES.has(transaction.status)) {
    return {
      finalStatus: transaction.status,
      status: transaction.status,
      skipped: true,
      completedAction: 'Already processed',
      recoveryResult: transaction.recoveryResult || 'This transaction was already processed.',
      recoveredAmount: transaction.recoveredAmount ?? null,
      recoveredAt: transaction.recoveredAt ?? null,
      alternativePaymentMethod: transaction.alternativePaymentMethod ?? null,
      deferredUntil: transaction.deferredUntil ?? null,
      processedAt: transaction.recoveredAt || options.processedAt || new Date().toISOString(),
    }
  }

  let analysis
  try {
    analysis = analyzeTransaction(transaction)
  } catch {
    analysis = {
      recoveryProbability: 0,
      opportunityLevel: 'Low Opportunity',
      alternativePaymentMethod: 'UPI',
      bestRetryTime: 'After 24 hours',
    }
  }

  const processedAt = options.processedAt || new Date().toISOString()
  const finalStatus = decideFinalStatus(transaction, analysis)

  if (finalStatus === 'Recovered') return buildRecoveredResult(transaction, analysis, processedAt)
  if (finalStatus === 'Alternative Required') return buildAlternativeResult(transaction, analysis, processedAt)
  return buildDeferredResult(transaction, analysis, processedAt)
}

export function toStatusUpdate(result) {
  if (!result || result.skipped) return null

  if (result.finalStatus === 'Recovered') {
    return {
      status: 'Recovered',
      additionalData: {
        recoveredAmount: result.recoveredAmount,
        recoveredAt: result.recoveredAt,
        recoveryResult: result.recoveryResult,
        completedAction: result.completedAction,
      },
    }
  }

  if (result.finalStatus === 'Alternative Required') {
    return {
      status: 'Alternative Required',
      additionalData: {
        alternativePaymentMethod: result.alternativePaymentMethod,
        recoveryResult: result.recoveryResult,
        completedAction: result.completedAction,
      },
    }
  }

  return {
    status: 'Deferred',
    additionalData: {
      deferredUntil: result.deferredUntil,
      recoveryResult: result.recoveryResult,
      completedAction: result.completedAction,
    },
  }
}
