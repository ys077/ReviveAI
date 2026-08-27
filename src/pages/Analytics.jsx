import { useMemo } from 'react'
import {
  AlertTriangle,
  IndianRupee,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import StatCard from '../components/StatCard.jsx'
import { useTransactions } from '../context/TransactionContext.jsx'
import { buildAnalytics } from '../utils/analyticsMetrics.js'
import { formatINR, formatINRCompact, formatPercent } from '../utils/format.js'

const STATUS_COLORS = {
  Pending: '#4f46e5',
  Failed: '#e11d48',
  Recovering: '#0284c7',
  Recovered: '#059669',
  'Alternative Required': '#d97706',
  Deferred: '#64748b',
  Unknown: '#94a3b8',
}

const OPPORTUNITY_COLORS = {
  'High Opportunity': '#4f46e5',
  'Medium Opportunity': '#f59e0b',
  'Low Opportunity': '#94a3b8',
}

const METHOD_COLORS = {
  UPI: '#4f46e5',
  Card: '#0ea5e9',
  'Net Banking': '#7c3aed',
  Wallet: '#059669',
}

function EmptyChart({ label }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-200 px-4 py-16 text-center text-sm text-slate-500">
      {label}
    </p>
  )
}

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      {label ? <p className="mb-1 font-medium text-slate-700">{label}</p> : null}
      {payload.map((entry) => (
        <p key={entry.dataKey ?? entry.name} className="text-slate-600">
          {entry.name}: {entry.dataKey?.toLowerCase().includes('count') ? entry.value : formatINR(entry.value)}
        </p>
      ))}
    </div>
  )
}

export default function Analytics() {
  const { transactions } = useTransactions()
  const metrics = useMemo(() => buildAnalytics(transactions), [transactions])

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Revenue Recovery Analytics</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Understand failure patterns, recovery opportunities, and the business impact of AI-driven payment recovery.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
            {metrics.total} total
          </span>
          <span className="rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700">
            {metrics.openCount} open
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
            {metrics.recoveredCount} recovered
          </span>
        </div>
      </div>

      {metrics.total === 0 ? (
        <EmptyChart label="No transaction data is available to analyze." />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Revenue at Risk"
          value={formatINR(metrics.revenueAtRisk)}
          hint="Expected recovery on open recoverable payments"
          icon={AlertTriangle}
          tone="amber"
        />
        <StatCard
          title="Recovered Revenue"
          value={formatINR(metrics.recoveredRevenue)}
          hint={`${metrics.recoveredCount} recovered transaction${metrics.recoveredCount === 1 ? '' : 's'}`}
          icon={IndianRupee}
          tone="emerald"
        />
        <StatCard
          title="Current Recovery Rate"
          value={formatPercent(metrics.recoveryRate)}
          hint="Recovered transactions / total"
          icon={TrendingUp}
          tone="slate"
        />
        <StatCard
          title="High Opportunity Pipeline"
          value={formatINR(metrics.highOpportunityPipeline)}
          hint={`${metrics.highOpportunityCount} high-opportunity open payment${metrics.highOpportunityCount === 1 ? '' : 's'}`}
          icon={Target}
          tone="indigo"
        />
      </div>

      <section>
        <h3 className="text-base font-semibold text-slate-900">AI Insights</h3>
        <p className="mt-1 text-xs text-slate-500">Generated from the current merchant dataset, not hardcoded copy.</p>
        {metrics.insights.length === 0 ? (
          <EmptyChart label="Insights will appear when transaction data is available." />
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {metrics.insights.map((insight) => (
              <article key={insight} className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <p className="mt-2 text-sm leading-6 text-slate-800">{insight}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Revenue recovery status</h3>
          <p className="mb-4 text-xs text-slate-500">Live transaction counts by current status</p>
          {metrics.statusChart.length === 0 ? (
            <EmptyChart label="No status data to chart." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.statusChart} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Transactions" radius={[6, 6, 0, 0]}>
                    {metrics.statusChart.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || STATUS_COLORS.Unknown} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Recovery opportunity distribution</h3>
          <p className="mb-4 text-xs text-slate-500">Count and expected recovery from analyzeTransaction()</p>
          {metrics.total === 0 ? (
            <EmptyChart label="No opportunity data to chart." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.opportunityChart} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Bar dataKey="expectedRecovery" name="Expected recovery" radius={[6, 6, 0, 0]}>
                    {metrics.opportunityChart.map((entry) => (
                      <Cell key={entry.name} fill={OPPORTUNITY_COLORS[entry.name]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
            {metrics.opportunityChart.map((entry) => (
              <p key={entry.name}>
                {entry.name.replace(' Opportunity', '')}: {entry.count} · {formatINRCompact(entry.expectedRecovery)}
              </p>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Failure reason performance</h3>
        <p className="mb-4 text-xs text-slate-500">Sorted by total expected recovery so merchants can focus effort</p>
        {metrics.failureRows.length === 0 ? (
          <EmptyChart label="No failure reasons to analyze." />
        ) : (
          <>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.failureRows} margin={{ top: 8, right: 8, left: 0, bottom: 56 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="reason"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const row = payload[0].payload
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
                          <p className="font-medium text-slate-700">{label}</p>
                          <p className="mt-1 text-slate-600">Transactions: {row.count}</p>
                          <p className="text-slate-600">Amount: {formatINR(row.amount)}</p>
                          <p className="text-slate-600">Avg probability: {Math.round(row.averageProbability)}%</p>
                          <p className="text-slate-600">Expected recovery: {formatINR(row.expectedRecovery)}</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="expectedRecovery" name="Expected recovery" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Failure reason</th>
                    <th className="py-2 pr-3 font-medium">Count</th>
                    <th className="py-2 pr-3 font-medium">Amount</th>
                    <th className="py-2 pr-3 font-medium">Avg probability</th>
                    <th className="py-2 font-medium">Expected recovery</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.failureRows.map((row) => (
                    <tr key={row.reason} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-800">{row.reason}</td>
                      <td className="py-2 pr-3 text-slate-600">{row.count}</td>
                      <td className="py-2 pr-3 text-slate-600">{formatINR(row.amount)}</td>
                      <td className="py-2 pr-3 text-slate-600">{Math.round(row.averageProbability)}%</td>
                      <td className="py-2 font-medium text-indigo-700">{formatINR(row.expectedRecovery)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Payment method performance</h3>
        <p className="mb-4 text-xs text-slate-500">Live count, value, AI probability, and recovered revenue by rail</p>
        {metrics.total === 0 ? (
          <EmptyChart label="No payment method data to analyze." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Method</th>
                  <th className="py-2 pr-3 font-medium">Transactions</th>
                  <th className="py-2 pr-3 font-medium">Failed value</th>
                  <th className="py-2 pr-3 font-medium">Avg probability</th>
                  <th className="py-2 pr-3 font-medium">Expected recovery</th>
                  <th className="py-2 font-medium">Recovered</th>
                </tr>
              </thead>
              <tbody>
                {metrics.methodRows.map((row) => (
                  <tr key={row.method} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 pr-3 font-medium text-slate-800">
                      <span
                        className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: METHOD_COLORS[row.method] }}
                      />
                      {row.method}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{row.count}</td>
                    <td className="py-2 pr-3 text-slate-600">{formatINR(row.amount)}</td>
                    <td className="py-2 pr-3 text-slate-600">{Math.round(row.averageProbability)}%</td>
                    <td className="py-2 pr-3 text-indigo-700">{formatINR(row.expectedRecovery)}</td>
                    <td className="py-2 text-emerald-700">{formatINR(row.recoveredRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Recovery strategy outcomes</h3>
          <p className="mb-4 text-xs text-slate-500">Actual execution results, not AI opportunity levels</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {metrics.outcomeRows.map((row) => (
              <article key={row.outcome} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{row.outcome}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{row.count}</p>
                {row.outcome === 'Recovered' ? (
                  <p className="mt-1 text-xs text-emerald-700">{formatINR(row.revenue)} recovered</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">No recovered amount</p>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Recovery value by payment method</h3>
          <p className="mb-4 text-xs text-slate-500">Expected recoverable vs actual recovered revenue</p>
          {metrics.total === 0 ? (
            <EmptyChart label="No payment method comparison available." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.methodRows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="method" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Legend />
                  <Bar dataKey="expectedRecovery" name="Expected recovery" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="recoveredRevenue" name="Actual recovered" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Time-based recovery view</h3>
        <p className="mb-4 text-xs text-slate-500">Open recoverable payments grouped by transaction day</p>
        {metrics.hasTimeView ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.timeChart} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const row = payload[0].payload
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
                        <p className="font-medium text-slate-700">{label}</p>
                        <p className="mt-1 text-slate-600">Failed transactions: {row.count}</p>
                        <p className="text-slate-600">Expected recovery: {formatINR(row.expectedRecovery)}</p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="expectedRecovery" name="Expected recovery" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
            Transaction timestamps are not varied enough for a trend chart. {metrics.total} payment
            {metrics.total === 1 ? ' is' : 's are'} available in the current dataset.
          </p>
        )}
      </section>
    </section>
  )
}
