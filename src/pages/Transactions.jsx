import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import TransactionTable from '../components/TransactionTable.jsx'
import { useTransactions } from '../context/TransactionContext.jsx'
import { analyzeTransaction } from '../utils/recoveryEngine.js'
import { isOpen } from '../utils/status.js'
import { toAmount } from '../utils/format.js'

const DEFAULT_SORT = 'probability-desc'

const PAYMENT_METHODS = ['UPI', 'Card', 'Net Banking', 'Wallet']
const FAILURE_REASONS = [
  'Network Timeout',
  'Insufficient Funds',
  'Bank Declined',
  'User Abandoned',
  'Technical Error',
  'Authentication Failed',
  'Payment Gateway Timeout',
]
const STATUSES = [
  'Pending',
  'Failed',
  'Recovering',
  'Recovered',
  'Alternative Required',
  'Deferred',
]
const OPPORTUNITIES = ['High Opportunity', 'Medium Opportunity', 'Low Opportunity']

const SORT_OPTIONS = [
  { value: 'time-desc', label: 'Transaction Time: Newest First' },
  { value: 'time-asc', label: 'Transaction Time: Oldest First' },
  { value: 'amount-desc', label: 'Amount: High to Low' },
  { value: 'amount-asc', label: 'Amount: Low to High' },
  { value: 'probability-desc', label: 'Recovery Probability: High to Low' },
  { value: 'probability-asc', label: 'Recovery Probability: Low to High' },
]

function safeAnalyze(transaction) {
  try {
    return analyzeTransaction(transaction)
  } catch {
    return {
      recoveryProbability: 0,
      opportunityLevel: 'Low Opportunity',
    }
  }
}

function selectClassName() {
  return 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm'
}

export default function Transactions() {
  const { transactions } = useTransactions()
  const [query, setQuery] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('all')
  const [failureReason, setFailureReason] = useState('all')
  const [status, setStatus] = useState('all')
  const [opportunity, setOpportunity] = useState('all')
  const [sort, setSort] = useState(DEFAULT_SORT)

  const analyzedRows = useMemo(() => {
    const list = Array.isArray(transactions) ? transactions : []
    return list.filter(Boolean).map((transaction) => ({
      transaction,
      analysis: safeAnalyze(transaction),
    }))
  }, [transactions])

  const summary = useMemo(() => {
    const open = analyzedRows.filter(({ transaction }) => isOpen(transaction))
    const highOpportunity = open.filter(
      ({ analysis }) => analysis.opportunityLevel === 'High Opportunity',
    )
    return {
      openCount: open.length,
      highOpportunityCount: highOpportunity.length,
    }
  }, [analyzedRows])

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase()

    const filtered = analyzedRows.filter(({ transaction, analysis }) => {
      const matchesSearch =
        needle.length === 0 ||
        String(transaction.id ?? '').toLowerCase().includes(needle) ||
        String(transaction.customer ?? '').toLowerCase().includes(needle)

      const matchesMethod = paymentMethod === 'all' || transaction.paymentMethod === paymentMethod
      const matchesReason = failureReason === 'all' || transaction.failureReason === failureReason
      const matchesStatus = status === 'all' || transaction.status === status
      const matchesOpportunity =
        opportunity === 'all' || analysis.opportunityLevel === opportunity

      return matchesSearch && matchesMethod && matchesReason && matchesStatus && matchesOpportunity
    })

    const sorted = [...filtered].sort((a, b) => {
      const timeA = Date.parse(a.transaction.transactionTime || '') || 0
      const timeB = Date.parse(b.transaction.transactionTime || '') || 0
      const amountA = toAmount(a.transaction.amount)
      const amountB = toAmount(b.transaction.amount)
      const probA = a.analysis.recoveryProbability ?? 0
      const probB = b.analysis.recoveryProbability ?? 0

      switch (sort) {
        case 'time-desc':
          return timeB - timeA
        case 'time-asc':
          return timeA - timeB
        case 'amount-desc':
          return amountB - amountA
        case 'amount-asc':
          return amountA - amountB
        case 'probability-asc':
          return probA - probB
        case 'probability-desc':
        default:
          return probB - probA
      }
    })

    return sorted
  }, [analyzedRows, query, paymentMethod, failureReason, status, opportunity, sort])

  function clearFilters() {
    setQuery('')
    setPaymentMethod('all')
    setFailureReason('all')
    setStatus('all')
    setOpportunity('all')
    setSort(DEFAULT_SORT)
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Failed Transactions</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Analyze failed payments and prioritize the highest revenue recovery opportunities.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
            {summary.openCount} open
          </span>
          <span className="rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700">
            {summary.highOpportunityCount} high opportunity
          </span>
          <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-500 ring-1 ring-slate-200">
            {visibleRows.length} shown
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="relative md:col-span-2 xl:col-span-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by transaction ID or customer"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-800 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <select
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
            className={selectClassName()}
            aria-label="Payment method"
          >
            <option value="all">All Methods</option>
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>

          <select
            value={failureReason}
            onChange={(event) => setFailureReason(event.target.value)}
            className={selectClassName()}
            aria-label="Failure reason"
          >
            <option value="all">All Failure Reasons</option>
            {FAILURE_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={selectClassName()}
            aria-label="Status"
          >
            <option value="all">All Statuses</option>
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={opportunity}
            onChange={(event) => setOpportunity(event.target.value)}
            className={selectClassName()}
            aria-label="Opportunity level"
          >
            <option value="all">All Opportunities</option>
            {OPPORTUNITIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className={selectClassName()}
            aria-label="Sort transactions"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <TransactionTable
        rows={visibleRows}
        emptyMessage="No transactions match your current filters."
        onClearFilters={clearFilters}
      />
    </section>
  )
}
