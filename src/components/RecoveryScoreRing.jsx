export default function RecoveryScoreRing({ value = 0, tone = 'indigo' }) {
  const probability = Number.isFinite(Number(value)) ? Math.min(100, Math.max(0, Number(value))) : 0
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (probability / 100) * circumference

  const stroke = {
    indigo: '#4f46e5',
    amber: '#d97706',
    slate: '#64748b',
  }[tone] ?? '#4f46e5'

  return (
    <div className="relative mx-auto h-44 w-44">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-4xl font-semibold tracking-tight text-slate-900">{Math.round(probability)}%</p>
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">Recovery score</p>
      </div>
    </div>
  )
}
