import { Link } from 'react-router-dom'
import { Check, Circle, LoaderCircle } from 'lucide-react'
import { formatINR } from '../utils/format.js'
import { StatusBadge } from './Badges.jsx'

export const EXECUTION_STEPS = [
  'Analyzing transaction signals',
  'Validating AI recovery strategy',
  'Initiating recommended action',
  'Processing recovery workflow',
  'Finalizing result',
]

export const STEP_DELAYS_MS = [550, 600, 700, 750, 600]

function ResultActions() {
  return (
    <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Link
        to="/dashboard"
        className="inline-flex justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
      >
        Back to Dashboard
      </Link>
      <Link
        to="/transactions"
        className="inline-flex justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Analyze Another Transaction
      </Link>
      <Link
        to="/analytics"
        className="inline-flex justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        View Updated Analytics
      </Link>
    </div>
  )
}

export function ExecutionProgress({ activeStep, running }) {
  const progress = running
    ? Math.round(((activeStep + 0.45) / EXECUTION_STEPS.length) * 100)
    : 100

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">Simulated recovery workflow</p>
      <h3 className="mt-1 text-lg font-semibold text-slate-900">Executing recovery strategy</h3>
      <p className="mt-1 text-sm text-slate-500">
        Prototype simulation only. No live payment gateway is contacted.
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-indigo-600 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <ol className="mt-5 space-y-3" aria-label="Recovery execution steps">
        {EXECUTION_STEPS.map((label, index) => {
          const complete = index < activeStep || (!running && index <= activeStep)
          const current = running && index === activeStep
          return (
            <li key={label} className="flex items-center gap-3 text-sm">
              {complete && !current ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : current ? (
                <LoaderCircle className="h-4 w-4 animate-spin text-indigo-600" />
              ) : (
                <Circle className="h-4 w-4 text-slate-300" />
              )}
              <span className={current ? 'font-medium text-indigo-700' : complete ? 'text-slate-700' : 'text-slate-400'}>
                {label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function RecoveryResultPanel({ result, transactionId }) {
  if (!result) return null

  const status = result.finalStatus || result.status

  if (status === 'Recovered') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold text-emerald-900">Revenue Recovered</h3>
          <StatusBadge status="Recovered" />
        </div>
        <p className="mt-3 text-2xl font-semibold text-emerald-900">
          {formatINR(result.recoveredAmount)} recovered successfully.
        </p>
        <p className="mt-2 text-sm text-emerald-800">{result.recoveryResult}</p>
        <dl className="mt-4 grid gap-2 text-sm text-emerald-900 sm:grid-cols-2">
          <div>
            <dt className="text-emerald-700">Transaction ID</dt>
            <dd className="font-medium">{transactionId}</dd>
          </div>
          <div>
            <dt className="text-emerald-700">Completed action</dt>
            <dd className="font-medium">{result.completedAction}</dd>
          </div>
        </dl>
        <ResultActions />
      </div>
    )
  }

  if (status === 'Alternative Required') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold text-amber-950">Alternative Payment Required</h3>
          <StatusBadge status="Alternative Required" />
        </div>
        <p className="mt-3 text-lg font-semibold text-amber-950">
          Next action: retry using {result.alternativePaymentMethod}.
        </p>
        <p className="mt-2 text-sm text-amber-900">{result.recoveryResult}</p>
        <dl className="mt-4 grid gap-2 text-sm text-amber-950 sm:grid-cols-2">
          <div>
            <dt className="text-amber-800">Transaction ID</dt>
            <dd className="font-medium">{transactionId}</dd>
          </div>
          <div>
            <dt className="text-amber-800">Recommended method</dt>
            <dd className="font-medium">{result.alternativePaymentMethod}</dd>
          </div>
        </dl>
        <ResultActions />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xl font-semibold text-slate-900">Recovery Deferred</h3>
        <StatusBadge status="Deferred" />
      </div>
      <p className="mt-3 text-lg font-semibold text-slate-900">
        Retry {result.deferredUntil ? String(result.deferredUntil).toLowerCase() : 'later'}.
      </p>
      <p className="mt-2 text-sm text-slate-600">{result.recoveryResult}</p>
      <dl className="mt-4 grid gap-2 text-sm text-slate-800 sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Transaction ID</dt>
          <dd className="font-medium">{transactionId}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Recommended timing</dt>
          <dd className="font-medium">{result.deferredUntil || 'After 24 hours'}</dd>
        </div>
      </dl>
      <ResultActions />
    </div>
  )
}
