import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  IndianRupee,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { OpportunityBadge, StatusBadge } from '../components/Badges.jsx'
import StatCard from '../components/StatCard.jsx'
import { useTransactions } from '../context/TransactionContext.jsx'
import {
  isOpen,
  isRecoverable,
  isRecovered,
  METHOD_ORDER,
  recoveredValue,
  safeAnalyze,
} from '../utils/analyticsMetrics.js'
import { formatDateTime, formatINR, formatINRCompact, formatPercent, toAmount } from '../utils/format.js'

const ACTIVITY_STATUSES = new Set([
  'Recovered',
  'Alternative Required',
  'Deferred',
  'Failed',
])

const OPPORTUNITY_COLORS = {
  'High Opportunity': '#4f46e5',
  'Medium Opportunity': '#f59e0b',
  'Low Opportunity': '#94a3b8',
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      {label ? <p className="mb-1 font-medium text-slate-700">{label}</p> : null}
      {payload.map((entry) => (
        <p key={entry.dataKey ?? entry.name} className="text-slate-600">
          {entry.name}: {entry.dataKey === 'amount' ? formatINR(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}

function buildInsight(metrics) {
  const { open, revenueAtRisk, highOpportunity, failureAverages, methodRecoverable } = metrics

  if (!open.length) {
    return 'AI Insight: There are currently no open failed payments available for recovery.'
  }

  const strongestFailure = failureAverages[0]
  if (strongestFailure && Number.isFinite(strongestFailure.average)) {
    return `AI Insight: ${strongestFailure.reason} transactions currently represent the strongest recovery opportunity, with an average recovery probability of ${Math.round(strongestFailure.average)}%.`
  }

  const strongestMethod = methodRecoverable[0]
  if (strongestMethod && strongestMethod.recoverable > 0) {
    return `AI Insight: ${strongestMethod.method} currently holds the highest recoverable revenue at ${formatINR(strongestMethod.recoverable)}.`
  }

  if (highOpportunity.length) {
    return `AI Insight: ${highOpportunity.length} high-opportunity payment${highOpportunity.length === 1 ? '' : 's'} can be actioned, with ${formatINR(revenueAtRisk)} currently available for recovery.`
  }

  return `AI Insight: ${formatINR(revenueAtRisk)} is currently available for recovery across ${open.length} open transaction${open.length === 1 ? '' : 's'}.`
}

export default function Dashboard() {
  const { transactions, resetDemoData } = useTransactions()
  const navigate = useNavigate()

  const todayLabel = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  const metrics = useMemo(() => {
    const list = Array.isArray(transactions) ? transactions.filter(Boolean) : []
    const enriched = list.map((transaction) => ({
      transaction,
      analysis: safeAnalyze(transaction),
    }))

    const open = enriched.filter(({ transaction }) => isOpen(transaction))
    const recoverable = enriched.filter(({ transaction }) => isRecoverable(transaction))
    const recovered = list.filter(isRecovered)

    const failedCount = open.length
    const failedValue = open.reduce((sum, row) => sum + toAmount(row.transaction.amount), 0)
    const revenueAtRisk = recoverable.reduce(
      (sum, row) => sum + toAmount(row.analysis.expectedRecovery),
      0,
    )
    const recoveredRevenue = recovered.reduce((sum, tx) => sum + recoveredValue(tx), 0)
    const recoveryRate = list.length === 0 ? 0 : (recovered.length / list.length) * 100

    const highOpportunity = open
      .filter((row) => row.analysis.opportunityLevel === 'High Opportunity')
      .sort((a, b) => b.analysis.recoveryProbability - a.analysis.recoveryProbability)

    const topOpportunities = [...open]
      .sort((a, b) => b.analysis.recoveryProbability - a.analysis.recoveryProbability)
      .slice(0, 5)

    const activity = list
      .filter((tx) => ACTIVITY_STATUSES.has(tx.status))
      .sort((a, b) => {
        const aTime = Date.parse(a.recoveredAt || a.transactionTime || '') || 0
        const bTime = Date.parse(b.recoveredAt || b.transactionTime || '') || 0
        return bTime - aTime
      })
      .slice(0, 8)

    const opportunityCounts = {
      'High Opportunity': 0,
      'Medium Opportunity': 0,
      'Low Opportunity': 0,
    }
    open.forEach(({ analysis }) => {
      if (opportunityCounts[analysis.opportunityLevel] != null) {
        opportunityCounts[analysis.opportunityLevel] += 1
      }
    })
    const opportunityChart = Object.entries(opportunityCounts).map(([name, value]) => ({
      name,
      value,
    }))

    const failureMap = new Map()
    list.forEach((transaction) => {
      const reason = transaction.failureReason || 'Unknown'
      const current = failureMap.get(reason) || { reason, count: 0, amount: 0, probabilitySum: 0, openCount: 0 }
      current.count += 1
      current.amount += toAmount(transaction.amount)
      failureMap.set(reason, current)
    })
    open.forEach(({ transaction, analysis }) => {
      const reason = transaction.failureReason || 'Unknown'
      const current = failureMap.get(reason) || { reason, count: 0, amount: 0, probabilitySum: 0, openCount: 0 }
      current.probabilitySum += analysis.recoveryProbability
      current.openCount += 1
      failureMap.set(reason, current)
    })
    const failureChart = [...failureMap.values()].sort((a, b) => b.count - a.count)
    const failureAverages = failureChart
      .filter((row) => row.openCount > 0)
      .map((row) => ({
        reason: row.reason,
        average: row.probabilitySum / row.openCount,
      }))
      .sort((a, b) => b.average - a.average)

    const methodMap = new Map(
      METHOD_ORDER.map((method) => [method, { method, count: 0, amount: 0, recoverable: 0 }]),
    )
    list.forEach((transaction) => {
      const method = METHOD_ORDER.includes(transaction.paymentMethod)
        ? transaction.paymentMethod
        : 'UPI'
      const current = methodMap.get(method) || { method, count: 0, amount: 0, recoverable: 0 }
      current.count += 1
      current.amount += toAmount(transaction.amount)
      methodMap.set(method, current)
    })
    recoverable.forEach(({ transaction, analysis }) => {
      const method = METHOD_ORDER.includes(transaction.paymentMethod)
        ? transaction.paymentMethod
        : 'UPI'
      const current = methodMap.get(method)
      if (current) current.recoverable += toAmount(analysis.expectedRecovery)
    })
    const methods = METHOD_ORDER.map((method) => methodMap.get(method))
    const methodRecoverable = [...methods].sort((a, b) => b.recoverable - a.recoverable)

    return {
      list,
      open,
      failedCount,
      failedValue,
      revenueAtRisk,
      recoveredRevenue,
      recoveryRate,
      recoveredCount: recovered.length,
      highOpportunity,
      topOpportunities,
      activity,
      opportunityChart,
      failureChart,
      failureAverages,
      methods,
      methodRecoverable,
    }
  }, [transactions])

  const insight = buildInsight(metrics)

  function handleReset() {
    const confirmed = window.confirm(
      'Reset all ReviveAI demo data to the original 30 transactions? Unsaved recovery activity will be lost.',
    )
    if (confirmed) resetDemoData()
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-600">{todayLabel}</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Revenue Recovery Overview</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Monitor failed payments, recovery opportunities, and AI-driven revenue performance.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          aria-label="Reset demo data to the original 30 transactions"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Reset Demo Data
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Failed Payments"
          value={metrics.failedCount}
          hint={`${formatINR(metrics.failedValue)} still open`}
          icon={AlertTriangle}
          tone="amber"
        />
        <StatCard
          title="Revenue at Risk"
          value={formatINR(metrics.revenueAtRisk)}
          hint="Expected recovery on open payments"
          icon={IndianRupee}
          tone="indigo"
        />
        <StatCard
          title="Recovered Revenue"
          value={formatINR(metrics.recoveredRevenue)}
          hint={`${metrics.recoveredCount} recovered transaction${metrics.recoveredCount === 1 ? '' : 's'}`}
          icon={Wallet}
          tone="emerald"
        />
        <StatCard
          title="Recovery Rate"
          value={formatPercent(metrics.recoveryRate)}
          hint="Recovered transactions / total"
          icon={TrendingUp}
          tone="slate"
        />
      </div>

      <article className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-white p-2 text-indigo-600 shadow-sm">
            <Sparkles className="h-5 w-5" />
          </span>
          <p className="text-sm leading-6 text-slate-800">{insight}</p>
        </div>
      </article>

      <div className="grid gap-6 xl:grid-cols-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">High opportunity transactions</h3>
              <p className="text-xs text-slate-500">Top 5 open payments by AI recovery probability</p>
            </div>
            <Link to="/transactions" className="text-xs font-medium text-indigo-600 hover:text-indigo-500">
              View all
            </Link>
          </div>
          {metrics.topOpportunities.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              No recoverable transactions right now.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">ID</th>
                    <th className="py-2 pr-3 font-medium">Customer</th>
                    <th className="py-2 pr-3 font-medium">Amount</th>
                    <th className="hidden py-2 pr-3 font-medium md:table-cell">Failure</th>
                    <th className="py-2 pr-3 font-medium">Prob.</th>
                    <th className="hidden py-2 pr-3 font-medium lg:table-cell">Opportunity</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.topOpportunities.map(({ transaction, analysis }) => (
                    <tr
                      key={transaction.id}
                      className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                      onClick={() => navigate(`/analysis/${transaction.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          navigate(`/analysis/${transaction.id}`)
                        }
                      }}
                      tabIndex={0}
                    >
                      <td className="py-3 pr-3 font-medium text-slate-900">{transaction.id}</td>
                      <td className="py-3 pr-3 text-slate-700">{transaction.customer}</td>
                      <td className="py-3 pr-3 text-slate-700">{formatINR(transaction.amount)}</td>
                      <td className="hidden py-3 pr-3 text-slate-500 md:table-cell">
                        {transaction.failureReason}
                      </td>
                      <td className="py-3 pr-3 font-medium text-indigo-700">
                        {analysis.recoveryProbability}%
                      </td>
                      <td className="hidden py-3 pr-3 lg:table-cell">
                        <OpportunityBadge level={analysis.opportunityLevel} />
                      </td>
                      <td className="py-3 pr-3">
                        <StatusBadge status={transaction.status} />
                      </td>
                      <td className="py-3">
                        <Link
                          to={`/analysis/${transaction.id}`}
                          aria-label={`Analyze transaction ${transaction.id}`}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Analyze
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h3 className="text-base font-semibold text-slate-900">Recent recovery activity</h3>
          <p className="mb-4 text-xs text-slate-500">Recovered, deferred, failed, and alternative-method events</p>
          {metrics.activity.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              No recovery activity yet. Execute an AI recovery strategy to see results here.
            </p>
          ) : (
            <ul className="space-y-3">
              {metrics.activity.map((transaction) => (
                <li key={transaction.id}>
                  <Link
                    to={`/analysis/${transaction.id}`}
                    className="block rounded-lg border border-slate-100 px-3 py-3 hover:border-indigo-100 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {transaction.id} · {transaction.customer}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {transaction.recoveryResult || transaction.status}
                          {transaction.status === 'Recovered'
                            ? ` · ${formatINR(recoveredValue(transaction))}`
                            : ` · ${formatINR(transaction.amount)}`}
                        </p>
                        {transaction.recoveredAt ? (
                          <p className="mt-1 text-xs text-slate-400">
                            {formatDateTime(transaction.recoveredAt)}
                          </p>
                        ) : null}
                      </div>
                      <StatusBadge status={transaction.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Recovery opportunity distribution</h3>
          <p className="mb-4 text-xs text-slate-500">Open transactions scored by the recovery engine</p>
          {metrics.open.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-4 py-16 text-center text-sm text-slate-500">
              No open transactions to chart.
            </p>
          ) : (
            <div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.opportunityChart}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={92}
                      paddingAngle={3}
                    >
                      {metrics.opportunityChart.map((entry) => (
                        <Cell key={entry.name} fill={OPPORTUNITY_COLORS[entry.name]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-slate-600">
                {metrics.opportunityChart.map((entry) => (
                  <span key={entry.name} className="inline-flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: OPPORTUNITY_COLORS[entry.name] }}
                    />
                    {entry.name.replace(' Opportunity', '')}: {entry.value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Failure reason breakdown</h3>
          <p className="mb-4 text-xs text-slate-500">Transaction count with total value in tooltips</p>
          {metrics.failureChart.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-4 py-16 text-center text-sm text-slate-500">
              No failure reasons to chart.
            </p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.failureChart} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="reason"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const row = payload[0].payload
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
                          <p className="font-medium text-slate-700">{label}</p>
                          <p className="mt-1 text-slate-600">Transactions: {row.count}</p>
                          <p className="text-slate-600">Amount: {formatINR(row.amount)}</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="count" name="Transactions" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Payment method distribution</h3>
        <p className="mb-4 text-xs text-slate-500">Live count and value by payment rail</p>
        {metrics.list.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
            No transactions available.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.methods.map((method) => (
              <article key={method.method} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-4">
                <p className="text-sm font-medium text-slate-500">{method.method}</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{method.count}</p>
                <p className="mt-1 text-xs text-slate-500">{formatINRCompact(method.amount)} total</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
