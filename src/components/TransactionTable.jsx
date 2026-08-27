import { Link } from 'react-router-dom'
import { formatDateTime, formatINR } from '../utils/format.js'
import { OpportunityBadge, StatusBadge } from './Badges.jsx'

function AnalyzeLink({ id }) {
  return (
    <Link
      to={`/analysis/${id}`}
      aria-label={`Analyze transaction ${id}`}
      className="inline-flex rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
    >
      Analyze
    </Link>
  )
}

function TransactionCard({ transaction, analysis }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{transaction.id}</p>
          <p className="text-sm text-slate-600">{transaction.customer}</p>
        </div>
        <StatusBadge status={transaction.status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
        <div>
          <dt>Amount</dt>
          <dd className="font-medium text-slate-800">{formatINR(transaction.amount)}</dd>
        </div>
        <div>
          <dt>Method</dt>
          <dd className="font-medium text-slate-800">{transaction.paymentMethod}</dd>
        </div>
        <div className="col-span-2">
          <dt>Failure</dt>
          <dd className="font-medium text-slate-800">{transaction.failureReason}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd className="font-medium text-slate-800">{formatDateTime(transaction.transactionTime)}</dd>
        </div>
        <div>
          <dt>Retries</dt>
          <dd className="font-medium text-slate-800">{transaction.retryAttempts ?? 0}</dd>
        </div>
        <div>
          <dt>Probability</dt>
          <dd className="font-medium text-indigo-700">{analysis.recoveryProbability}%</dd>
        </div>
        <div>
          <dt>Opportunity</dt>
          <dd className="mt-1">
            <OpportunityBadge level={analysis.opportunityLevel} />
          </dd>
        </div>
      </dl>
      <div className="mt-4">
        <AnalyzeLink id={transaction.id} />
      </div>
    </article>
  )
}

export default function TransactionTable({ rows = [], emptyMessage, onClearFilters }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
        <p className="text-sm font-medium text-slate-700">
          {emptyMessage || 'No transactions match your current filters.'}
        </p>
        {onClearFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Clear Filters
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {rows.map(({ transaction, analysis }) => (
          <TransactionCard
            key={transaction.id}
            transaction={transaction}
            analysis={analysis}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-[1100px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Transaction ID</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Method</th>
              <th className="px-4 py-3 font-medium">Failure Reason</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Retries</th>
              <th className="px-4 py-3 font-medium">Probability</th>
              <th className="px-4 py-3 font-medium">Opportunity</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ transaction, analysis }) => (
              <tr key={transaction.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{transaction.id}</td>
                <td className="px-4 py-3 text-slate-700">{transaction.customer}</td>
                <td className="px-4 py-3 text-slate-700">{formatINR(transaction.amount)}</td>
                <td className="px-4 py-3 text-slate-600">{transaction.paymentMethod}</td>
                <td className="px-4 py-3 text-slate-600">{transaction.failureReason}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                  {formatDateTime(transaction.transactionTime)}
                </td>
                <td className="px-4 py-3 text-slate-600">{transaction.retryAttempts ?? 0}</td>
                <td className="px-4 py-3 font-medium text-indigo-700">
                  {analysis.recoveryProbability}%
                </td>
                <td className="px-4 py-3">
                  <OpportunityBadge level={analysis.opportunityLevel} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={transaction.status} />
                </td>
                <td className="px-4 py-3">
                  <AnalyzeLink id={transaction.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
