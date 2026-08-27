import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  Lightbulb,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { OpportunityBadge, StatusBadge } from '../components/Badges.jsx'
import RecoveryScoreRing from '../components/RecoveryScoreRing.jsx'
import {
  EXECUTION_STEPS,
  ExecutionProgress,
  RecoveryResultPanel,
  STEP_DELAYS_MS,
} from '../components/RecoveryWorkflow.jsx'
import { useTransactions } from '../context/TransactionContext.jsx'
import { analyzeTransaction } from '../utils/recoveryEngine.js'
import {
  executeRecoveryStrategy,
  toStatusUpdate,
} from '../utils/recoveryExecutionEngine.js'
import { isExecutionLocked } from '../utils/status.js'
import { formatDateTime, formatINR, toAmount } from '../utils/format.js'
const TEMPORARY_FAILURES = new Set([
  'Network Timeout',
  'Technical Error',
  'Payment Gateway Timeout',
])
const FUNDING_RISKS = new Set(['Bank Declined', 'Insufficient Funds'])

function opportunityCopy(level) {
  if (level === 'High Opportunity') return 'Strong recovery potential'
  if (level === 'Medium Opportunity') return 'Moderate recovery potential'
  return 'Limited immediate recovery potential'
}

function opportunityTone(level) {
  if (level === 'High Opportunity') return 'indigo'
  if (level === 'Medium Opportunity') return 'amber'
  return 'slate'
}

function processedMessage(status) {
  if (status === 'Recovered') {
    return 'This payment has already been recovered. You can still review the AI analysis.'
  }
  if (status === 'Alternative Required') {
    return 'An alternative payment method has already been requested. The recovery workflow has been processed.'
  }
  if (status === 'Deferred') {
    return 'Recovery for this payment was deferred. The original workflow has already been processed.'
  }
  return null
}

function safeAnalyze(transaction) {
  try {
    return analyzeTransaction(transaction)
  } catch {
    return {
      recoveryProbability: 0,
      opportunityLevel: 'Low Opportunity',
      recommendedAction: 'Defer recovery attempt',
      bestRetryTime: 'After 24 hours',
      alternativePaymentMethod: 'UPI',
      expectedRecovery: 0,
      reasoning: ['Analysis could not be generated for this transaction.'],
    }
  }
}

function buildSignals(transaction) {
  const positives = []
  const risks = []
  const successRate = toAmount(transaction.customerSuccessRate)
  const retries = toAmount(transaction.retryAttempts)
  const recoveries = toAmount(transaction.previousRecoveries)
  const amount = toAmount(transaction.amount)
  const reason = transaction.failureReason || ''

  if (successRate >= 70) {
    positives.push(`High customer success rate of ${successRate}%.`)
  } else if (successRate > 0 && successRate < 50) {
    risks.push(`Low customer success rate of ${successRate}%.`)
  }

  if (recoveries >= 1) {
    positives.push(`${recoveries} previous recover${recoveries === 1 ? 'y' : 'ies'} for this customer.`)
  }

  if (TEMPORARY_FAILURES.has(reason)) {
    positives.push(`${reason} is typically a temporary or technical failure.`)
  }

  if (retries <= 1) {
    positives.push(`Only ${retries} retry attempt${retries === 1 ? '' : 's'} so far.`)
  } else if (retries >= 3) {
    risks.push(`${retries} retry attempts have already been made.`)
  }

  if (FUNDING_RISKS.has(reason)) {
    risks.push(`${reason} usually needs more time or a different collection approach.`)
  }

  if (amount >= 25000) {
    risks.push(`High transaction amount of ${formatINR(amount)} can be harder to recover immediately.`)
  }

  return { positives, risks }
}

function InfoItem({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value ?? '—'}</p>
    </div>
  )
}

export default function Analysis() {
  const { id } = useParams()
  const { transactions, updateTransactionStatus } = useTransactions()
  const [phase, setPhase] = useState('idle')
  const [activeStep, setActiveStep] = useState(0)
  const [executionResult, setExecutionResult] = useState(null)
  const startedRef = useRef(false)
  const committedRef = useRef(false)
  const timersRef = useRef([])

  const transaction = useMemo(() => {
    const list = Array.isArray(transactions) ? transactions : []
    return list.find((item) => item?.id === id) ?? null
  }, [transactions, id])

  const analysis = useMemo(() => {
    if (!transaction) return null
    return safeAnalyze(transaction)
  }, [transaction])

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  if (!transaction) {
    return (
      <section className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
        <p className="text-sm font-medium text-indigo-600">Transaction not found</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">No analysis available</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          ReviveAI could not find a payment with ID {id || 'unknown'} in the current merchant data.
        </p>
        <Link
          to="/transactions"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to transactions
        </Link>
      </section>
    )
  }

  const probability = Number.isFinite(analysis?.recoveryProbability) ? analysis.recoveryProbability : 0
  const expectedRecovery = toAmount(analysis?.expectedRecovery)
  const amount = toAmount(transaction.amount)
  const alreadyProcessed = isExecutionLocked(transaction)
  const notice = processedMessage(transaction.status)
  const isRunning = phase === 'running'
  const canExecute = !alreadyProcessed && !isRunning && !startedRef.current

  function commitResult(result) {
    if (committedRef.current || !transaction?.id || result?.skipped) return
    const payload = toStatusUpdate(result)
    if (!payload) return
    committedRef.current = true
    updateTransactionStatus(transaction.id, payload.status, payload.additionalData)
  }

  function handleExecute() {
    if (startedRef.current || alreadyProcessed || isRunning || !transaction) return
    startedRef.current = true
    setPhase('running')
    setActiveStep(0)
    setExecutionResult(null)

    const result = executeRecoveryStrategy(transaction)
    let elapsed = 0

    STEP_DELAYS_MS.forEach((delay, index) => {
      elapsed += delay
      const timer = window.setTimeout(() => {
        const isLast = index === STEP_DELAYS_MS.length - 1
        if (isLast) {
          setActiveStep(EXECUTION_STEPS.length)
          commitResult(result)
          setExecutionResult(result)
          setPhase('complete')
        } else {
          setActiveStep(index + 1)
        }
      }, elapsed)
      timersRef.current.push(timer)
    })
  }

  const signals = buildSignals(transaction)
  const reasoning = Array.isArray(analysis?.reasoning) ? analysis.reasoning : []
  const tone = opportunityTone(analysis?.opportunityLevel)

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to="/transactions"
            className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to transactions
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold text-slate-900">AI Recovery Analysis</h2>
            <StatusBadge status={transaction.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {transaction.id} · Review the transaction signals and execute the AI-recommended recovery strategy.
          </p>
        </div>
      </div>

      {notice ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {notice}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Transaction overview</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <InfoItem label="Transaction ID" value={transaction.id} />
          <InfoItem label="Customer" value={transaction.customer} />
          <InfoItem label="Amount" value={formatINR(amount)} />
          <InfoItem label="Payment method" value={transaction.paymentMethod} />
          <InfoItem label="Failure reason" value={transaction.failureReason} />
          <InfoItem label="Transaction time" value={formatDateTime(transaction.transactionTime)} />
          <InfoItem label="Retry attempts" value={transaction.retryAttempts ?? 0} />
          <InfoItem label="Customer success rate" value={`${transaction.customerSuccessRate ?? 0}%`} />
          <InfoItem label="Previous recoveries" value={transaction.previousRecoveries ?? 0} />
          <InfoItem label="Current status" value={transaction.status} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h3 className="text-base font-semibold text-slate-900">AI recovery score</h3>
          <p className="mt-1 text-xs text-slate-500">Generated by the ReviveAI recovery engine</p>
          <div className="mt-6">
            <RecoveryScoreRing value={probability} tone={tone} />
          </div>
          <div className="mt-4 flex flex-col items-center gap-2 text-center">
            <OpportunityBadge level={analysis?.opportunityLevel} />
            <p className="text-sm text-slate-600">{opportunityCopy(analysis?.opportunityLevel)}</p>
          </div>
        </section>

        <section className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-5 shadow-sm xl:col-span-3">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">Recommended action</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">
            {analysis?.recommendedAction || 'Defer recovery attempt'}
          </h3>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-slate-500">
                <Clock3 className="h-4 w-4" />
                <p className="text-xs font-medium uppercase tracking-wide">Best retry time</p>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">{analysis?.bestRetryTime || '—'}</p>
            </div>
            <div className="rounded-lg bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-slate-500">
                <CreditCard className="h-4 w-4" />
                <p className="text-xs font-medium uppercase tracking-wide">Alternative method</p>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {analysis?.alternativePaymentMethod || '—'}
              </p>
            </div>
            <div className="rounded-lg bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-slate-500">
                <Banknote className="h-4 w-4" />
                <p className="text-xs font-medium uppercase tracking-wide">Expected recovery</p>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatINR(expectedRecovery)}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Why this recommendation?</h3>
          <ul className="mt-4 space-y-3">
            {reasoning.length === 0 ? (
              <li className="text-sm text-slate-500">No reasoning was returned for this transaction.</li>
            ) : (
              reasoning.map((item) => (
                <li key={item} className="flex gap-3 rounded-lg bg-slate-50 px-3 py-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                  <p className="text-sm text-slate-700">{item}</p>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Recovery signal breakdown</h3>
          <p className="mt-1 text-xs text-slate-500">
            Explanatory view of the same transaction signals used by the recovery engine.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">Positive signals</p>
              {signals.positives.length === 0 ? (
                <p className="text-sm text-slate-500">No strong positive signals on this payment.</p>
              ) : (
                <ul className="space-y-2">
                  {signals.positives.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">Risk signals</p>
              {signals.risks.length === 0 ? (
                <p className="text-sm text-slate-500">No major risk signals on this payment.</p>
              ) : (
                <ul className="space-y-2">
                  {signals.risks.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-slate-700">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Expected business impact</h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          ReviveAI estimates that {formatINR(expectedRecovery)} of this {formatINR(amount)} transaction has a{' '}
          {probability}% recovery opportunity.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2 text-slate-500">
              <Wallet className="h-4 w-4" />
              <p className="text-xs font-medium uppercase tracking-wide">Transaction amount</p>
            </div>
            <p className="mt-2 text-lg font-semibold text-slate-900">{formatINR(amount)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2 text-slate-500">
              <TrendingUp className="h-4 w-4" />
              <p className="text-xs font-medium uppercase tracking-wide">Expected recoverable</p>
            </div>
            <p className="mt-2 text-lg font-semibold text-slate-900">{formatINR(expectedRecovery)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2 text-slate-500">
              <Lightbulb className="h-4 w-4" />
              <p className="text-xs font-medium uppercase tracking-wide">Recovery probability</p>
            </div>
            <p className="mt-2 text-lg font-semibold text-slate-900">{probability}%</p>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-600"
            style={{ width: `${Math.min(100, Math.max(0, probability))}%` }}
          />
        </div>
      </section>

      {isRunning ? <ExecutionProgress activeStep={activeStep} running /> : null}

      {executionResult && !executionResult.skipped ? (
        <RecoveryResultPanel result={executionResult} transactionId={transaction.id} />
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {alreadyProcessed ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-slate-500" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Recovery workflow already processed</p>
                <p className="mt-1 text-sm text-slate-500">
                  Execute is unavailable because this transaction is marked {transaction.status}.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled
              title={`Execute is unavailable because this transaction is ${transaction.status}`}
              aria-disabled="true"
              className="cursor-not-allowed rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-500"
            >
              Execute Recovery Strategy
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Ready to recover this payment</p>
              <p className="mt-1 text-sm text-slate-500">
                Run a simulated recovery workflow. This prototype does not contact Razorpay or any live gateway.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExecute}
              disabled={!canExecute}
              aria-busy={isRunning}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {isRunning ? 'Processing…' : 'Execute Recovery Strategy'}
            </button>
          </div>
        )}
      </section>
    </section>
  )
}
