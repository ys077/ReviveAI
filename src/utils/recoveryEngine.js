/**
 * ReviveAI recovery decision engine.
 *
 * Deterministic, rule-based scoring — no APIs and no Math.random().
 * The same transaction object always yields the same analysis.
 *
 * Scoring model (points, then clamped to 0–100):
 *   1. failureReason          — base potential (largest signal)
 *   2. customerSuccessRate    — historical reliability
 *   3. previousRecoveries     — proven recoverability for this customer
 *   4. retryAttempts          — diminishing returns / fatigue
 *   5. paymentMethod          — friction of retrying that rail
 *   6. amount                 — large tickets are harder to recover immediately
 *   7. transactionTime        — hour-of-day and weekday (IST), not wall-clock recency
 *
 * Recency vs Date.now() is intentionally unused so results stay stable over time.
 */

const FAILURE_BASE_SCORE = {
  'Network Timeout': 88,
  'Technical Error': 86,
  'Payment Gateway Timeout': 78,
  'Authentication Failed': 58,
  'User Abandoned': 52,
  'Bank Declined': 42,
  'Insufficient Funds': 32,
}

const TEMPORARY_FAILURES = new Set([
  'Network Timeout',
  'Technical Error',
  'Payment Gateway Timeout',
])

const VALID_METHODS = new Set(['UPI', 'Card', 'Net Banking', 'Wallet'])

const DEFAULT_TRANSACTION = {
  id: '',
  customer: '',
  amount: 0,
  paymentMethod: 'UPI',
  failureReason: 'Technical Error',
  transactionTime: '',
  retryAttempts: 0,
  customerSuccessRate: 50,
  previousRecoveries: 0,
  status: 'Pending',
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function toNumber(value, fallback) {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return isFiniteNumber(parsed) ? parsed : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function clampInt(value, min, max) {
  return Math.round(clamp(value, min, max))
}

function hasTransactionSignal(transaction) {
  if (!transaction || typeof transaction !== 'object') return false

  return [
    'id',
    'amount',
    'failureReason',
    'paymentMethod',
    'customerSuccessRate',
    'retryAttempts',
    'previousRecoveries',
    'transactionTime',
  ].some((key) => {
    const value = transaction[key]
    return value !== undefined && value !== null && value !== ''
  })
}

const INVALID_ANALYSIS = {
  recoveryProbability: 0,
  opportunityLevel: 'Low Opportunity',
  recommendedAction: 'Defer recovery attempt',
  bestRetryTime: 'After 24 hours',
  alternativePaymentMethod: 'UPI',
  expectedRecovery: 0,
  reasoning: [
    'Transaction data is missing or invalid, so recovery cannot be scored.',
    'Provide a complete transaction record to generate a recommendation.',
    'No retry window can be determined without valid payment details.',
  ],
}

/**
 * Coerce a possibly incomplete transaction into a safe, typed shape.
 */
export function normalizeTransaction(transaction) {
  if (!transaction || typeof transaction !== 'object') {
    return { ...DEFAULT_TRANSACTION }
  }

  const retryAttempts = clamp(toNumber(transaction.retryAttempts, 0), 0, 20)
  const customerSuccessRate = clamp(toNumber(transaction.customerSuccessRate, 50), 0, 100)
  const previousRecoveries = clamp(toNumber(transaction.previousRecoveries, 0), 0, 50)
  const amount = clamp(toNumber(transaction.amount, 0), 0, 1_000_000_000)
  const paymentMethod = VALID_METHODS.has(transaction.paymentMethod)
    ? transaction.paymentMethod
    : DEFAULT_TRANSACTION.paymentMethod
  const failureReason =
    transaction.failureReason in FAILURE_BASE_SCORE
      ? transaction.failureReason
      : DEFAULT_TRANSACTION.failureReason

  return {
    id: typeof transaction.id === 'string' ? transaction.id : DEFAULT_TRANSACTION.id,
    customer: typeof transaction.customer === 'string' ? transaction.customer : '',
    amount,
    paymentMethod,
    failureReason,
    transactionTime:
      typeof transaction.transactionTime === 'string' ? transaction.transactionTime : '',
    retryAttempts,
    customerSuccessRate,
    previousRecoveries,
    status: typeof transaction.status === 'string' ? transaction.status : 'Pending',
  }
}

/**
 * Parse transactionTime into IST hour (0–23) and weekday (0=Sun).
 * Invalid timestamps return null so timing simply contributes 0.
 */
function getIstTiming(transactionTime) {
  if (!transactionTime) return null

  const date = new Date(transactionTime)
  if (Number.isNaN(date.getTime())) return null

  const istMs = date.getTime() + 5.5 * 60 * 60 * 1000
  const ist = new Date(istMs)

  return {
    hour: ist.getUTCHours(),
    weekday: ist.getUTCDay(),
  }
}

function failureReasonAdjustment(failureReason) {
  return FAILURE_BASE_SCORE[failureReason] ?? FAILURE_BASE_SCORE['Technical Error']
}

/** Maps 0–100 success rate around a 50% baseline. High history lifts the score. */
function successRateAdjustment(customerSuccessRate) {
  return (customerSuccessRate - 50) * 0.4
}

/** Each prior recovery is evidence the customer can be won back. Capped to avoid runaway scores. */
function previousRecoveriesAdjustment(previousRecoveries) {
  return Math.min(previousRecoveries, 8) * 2
}

/** Each additional retry reduces remaining opportunity. */
function retryAttemptsAdjustment(retryAttempts) {
  return retryAttempts * -9
}

function paymentMethodAdjustment(paymentMethod) {
  switch (paymentMethod) {
    case 'UPI':
      return 6
    case 'Wallet':
      return 4
    case 'Card':
      return 1
    case 'Net Banking':
      return -4
    default:
      return 0
  }
}

/** Smaller tickets recover more easily; very large tickets need more coordination. */
function amountAdjustment(amount) {
  if (amount < 2000) return 6
  if (amount < 10000) return 2
  if (amount < 25000) return 0
  if (amount < 40000) return -4
  return -10
}

/**
 * Time-of-day and weekday in IST only — never compared to "now".
 * Net Banking is weaker on weekends and outside typical bank hours.
 */
function timingAdjustment(transaction) {
  const timing = getIstTiming(transaction.transactionTime)
  if (!timing) return 0

  let points = 0
  const { hour, weekday } = timing
  const isWeekend = weekday === 0 || weekday === 6

  if (hour >= 10 && hour < 18) points += 4
  else if (hour >= 18 && hour < 22) points += 2
  else if (hour >= 6 && hour < 10) points += 0
  else points -= 4

  if (transaction.paymentMethod === 'Net Banking') {
    points += isWeekend ? -5 : 2
    if (hour < 9 || hour >= 19) points -= 3
  }

  if (transaction.paymentMethod === 'UPI' && hour >= 18 && hour < 22) {
    points += 1
  }

  return points
}

function opportunityLevelFromScore(score) {
  if (score >= 75) return 'High Opportunity'
  if (score >= 45) return 'Medium Opportunity'
  return 'Low Opportunity'
}

/**
 * Weighted recovery probability for a single failed payment.
 * @returns {number} integer 0–100
 */
export function calculateRecoveryProbability(transaction) {
  if (!hasTransactionSignal(transaction)) return 0

  const tx = normalizeTransaction(transaction)

  const rawScore =
    failureReasonAdjustment(tx.failureReason) +
    successRateAdjustment(tx.customerSuccessRate) +
    previousRecoveriesAdjustment(tx.previousRecoveries) +
    retryAttemptsAdjustment(tx.retryAttempts) +
    paymentMethodAdjustment(tx.paymentMethod) +
    amountAdjustment(tx.amount) +
    timingAdjustment(tx)

  return clampInt(rawScore, 0, 100)
}

/**
 * Single, context-aware next action for the given score and transaction.
 */
export function recommendStrategy(transaction, score) {
  const tx = normalizeTransaction(transaction)
  const probability = clampInt(toNumber(score, calculateRecoveryProbability(tx)), 0, 100)
  const level = opportunityLevelFromScore(probability)

  if (level === 'High Opportunity') {
    if (TEMPORARY_FAILURES.has(tx.failureReason) && tx.retryAttempts <= 1) {
      return 'Retry payment immediately'
    }
    if (tx.retryAttempts === 0) {
      return 'Retry through the original payment method'
    }
    return 'Retry within 30 minutes'
  }

  if (level === 'Medium Opportunity') {
    if (tx.failureReason === 'Insufficient Funds') {
      return 'Send a payment reminder'
    }
    if (tx.failureReason === 'User Abandoned' || tx.failureReason === 'Authentication Failed') {
      return 'Retry later'
    }
    return 'Suggest an alternative payment method'
  }

  if (tx.retryAttempts >= 3) {
    return 'Defer recovery attempt'
  }
  if (tx.failureReason === 'Insufficient Funds' || tx.failureReason === 'Bank Declined') {
    return 'Send a personalized payment reminder'
  }
  return 'Retry after 24 hours'
}

/**
 * Human-readable retry window derived from score, failure type, retries, and IST hour.
 */
export function getBestRetryTime(transaction, score) {
  const tx = normalizeTransaction(transaction)
  const probability = clampInt(toNumber(score, calculateRecoveryProbability(tx)), 0, 100)
  const timing = getIstTiming(tx.transactionTime)
  const hour = timing?.hour
  const overnight = typeof hour === 'number' && (hour < 7 || hour >= 22)

  if (tx.retryAttempts >= 3 || probability < 45) {
    return 'After 24 hours'
  }

  if (tx.failureReason === 'Insufficient Funds') {
    return probability >= 60 ? 'After 6 hours' : 'After 24 hours'
  }

  if (tx.failureReason === 'Bank Declined') {
    return 'After 6 hours'
  }

  if (tx.failureReason === 'User Abandoned') {
    return overnight ? 'After 6 hours' : 'After 2 hours'
  }

  if (tx.failureReason === 'Authentication Failed') {
    return 'After 2 hours'
  }

  if (TEMPORARY_FAILURES.has(tx.failureReason)) {
    if (probability >= 75 && tx.retryAttempts <= 1 && !overnight) {
      return 'Immediately'
    }
    if (overnight) {
      return 'After 6 hours'
    }
    return probability >= 70 ? 'Within 30 minutes' : 'After 2 hours'
  }

  return probability >= 60 ? 'After 2 hours' : 'After 6 hours'
}

/**
 * Sensible alternative rail based on the original method and ticket size.
 */
export function suggestAlternativeMethod(transaction) {
  const tx = normalizeTransaction(transaction)

  switch (tx.paymentMethod) {
    case 'Card':
      return tx.amount >= 20000 ? 'Net Banking' : 'UPI'
    case 'UPI':
      return 'Card'
    case 'Net Banking':
      return 'UPI'
    case 'Wallet':
      return tx.amount >= 15000 ? 'Card' : 'UPI'
    default:
      return 'UPI'
  }
}

/**
 * Expected recoverable rupees: amount × probability, rounded to the nearest rupee.
 */
export function calculateExpectedRecovery(transaction, score) {
  const tx = normalizeTransaction(transaction)
  const probability = clampInt(toNumber(score, calculateRecoveryProbability(tx)), 0, 100)
  return Math.round(tx.amount * (probability / 100))
}

function buildReasoning(tx, score, alternativePaymentMethod, recommendedAction, bestRetryTime) {
  const reasons = []

  if (TEMPORARY_FAILURES.has(tx.failureReason)) {
    reasons.push(
      `${tx.failureReason} is typically a temporary or technical issue, so recovery potential is high.`,
    )
  } else if (tx.failureReason === 'Insufficient Funds') {
    reasons.push(
      'Insufficient funds usually recover later in the billing cycle rather than immediately.',
    )
  } else if (tx.failureReason === 'Bank Declined') {
    reasons.push(
      'Bank declines are harder to reverse immediately and often need a later retry or another method.',
    )
  } else if (tx.failureReason === 'User Abandoned') {
    reasons.push(
      'The customer abandoned checkout, so a timed reminder is more effective than an instant retry.',
    )
  } else {
    reasons.push(
      `Authentication issues can recover after the customer re-verifies; current probability is ${score}%.`,
    )
  }

  reasons.push(
    `The customer has a historical payment success rate of ${tx.customerSuccessRate}%.`,
  )

  if (tx.retryAttempts === 0) {
    reasons.push('No retry has been attempted yet, so additional recovery attempts remain available.')
  } else if (tx.retryAttempts === 1) {
    reasons.push('Only one retry attempt has been made, leaving additional recovery opportunities.')
  } else if (tx.retryAttempts >= 3) {
    reasons.push(
      `${tx.retryAttempts} retry attempts have already been made, which lowers the chance of an immediate recovery.`,
    )
  } else {
    reasons.push(
      `${tx.retryAttempts} retry attempts have been made; space out the next attempt to avoid payment fatigue.`,
    )
  }

  if (tx.previousRecoveries >= 3) {
    reasons.push(
      `This customer has ${tx.previousRecoveries} previous recoveries, which supports a more aggressive retry.`,
    )
  } else if (reasons.length < 5) {
    reasons.push(
      `Recommended next step: ${recommendedAction.toLowerCase()} (${bestRetryTime.toLowerCase()}). ${alternativePaymentMethod} is the suggested alternative to ${tx.paymentMethod}.`,
    )
  }

  return reasons.slice(0, 5)
}

/**
 * Full deterministic analysis used by later UI phases.
 */
export function analyzeTransaction(transaction) {
  if (!hasTransactionSignal(transaction)) {
    return { ...INVALID_ANALYSIS, reasoning: [...INVALID_ANALYSIS.reasoning] }
  }

  const tx = normalizeTransaction(transaction)
  const recoveryProbability = calculateRecoveryProbability(tx)
  const opportunityLevel = opportunityLevelFromScore(recoveryProbability)
  const recommendedAction = recommendStrategy(tx, recoveryProbability)
  const bestRetryTime = getBestRetryTime(tx, recoveryProbability)
  const alternativePaymentMethod = suggestAlternativeMethod(tx)
  const expectedRecovery = calculateExpectedRecovery(tx, recoveryProbability)
  const reasoning = buildReasoning(
    tx,
    recoveryProbability,
    alternativePaymentMethod,
    recommendedAction,
    bestRetryTime,
  )

  return {
    recoveryProbability,
    opportunityLevel,
    recommendedAction,
    bestRetryTime,
    alternativePaymentMethod,
    expectedRecovery,
    reasoning,
  }
}

/**
 * Optional no-dependency self-check. Run:
 *   node --input-type=module -e "import { selfCheckRecoveryEngine } from './src/utils/recoveryEngine.js'; import { transactions } from './src/data/transactions.js'; console.log(selfCheckRecoveryEngine(transactions.slice(0,3)))"
 */
export function selfCheckRecoveryEngine(samples = []) {
  const list = Array.isArray(samples) ? samples : []
  const results = list.map((tx) => {
    const first = analyzeTransaction(tx)
    const second = analyzeTransaction(tx)
    const deterministic = JSON.stringify(first) === JSON.stringify(second)
    const reasoningOk =
      Array.isArray(first.reasoning) &&
      first.reasoning.length >= 3 &&
      first.reasoning.length <= 5
    const probabilityOk =
      Number.isInteger(first.recoveryProbability) &&
      first.recoveryProbability >= 0 &&
      first.recoveryProbability <= 100

    return {
      id: tx?.id ?? 'unknown',
      deterministic,
      reasoningOk,
      probabilityOk,
      analysis: first,
    }
  })

  const passed = results.every((row) => row.deterministic && row.reasoningOk && row.probabilityOk)
  return { passed, results }
}

/** Preserved stub API: same as analyzeTransaction. */
export function recoverPayment(transaction) {
  return analyzeTransaction(transaction)
}
