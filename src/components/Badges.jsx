export function StatusBadge({ status }) {
  const styles = {
    Recovered: 'bg-emerald-50 text-emerald-700',
    Failed: 'bg-rose-50 text-rose-700',
    Recovering: 'bg-sky-50 text-sky-700',
    'Alternative Required': 'bg-amber-50 text-amber-700',
    Deferred: 'bg-slate-100 text-slate-600',
    Pending: 'bg-indigo-50 text-indigo-700',
  }

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-slate-100 text-slate-600'}`}
    >
      {status || 'Unknown'}
    </span>
  )
}

export function OpportunityBadge({ level }) {
  const styles = {
    'High Opportunity': 'bg-indigo-50 text-indigo-700',
    'Medium Opportunity': 'bg-amber-50 text-amber-700',
    'Low Opportunity': 'bg-slate-100 text-slate-600',
  }

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[level] ?? 'bg-slate-100 text-slate-600'}`}>
      {level || 'Low Opportunity'}
    </span>
  )
}
