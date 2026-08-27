import { Link, NavLink } from 'react-router-dom'
import { BarChart3, LayoutDashboard, Receipt, RotateCcw, Sparkles } from 'lucide-react'
import { useTransactions } from '../context/TransactionContext.jsx'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
]

export default function Sidebar() {
  const { resetDemoData } = useTransactions()

  function handleReset() {
    const confirmed = window.confirm(
      'Reset all ReviveAI demo data to the original 30 transactions? Unsaved recovery activity will be lost.',
    )
    if (confirmed) resetDemoData()
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <Link to="/dashboard" className="flex items-center gap-2 border-b border-slate-200 px-6 py-5">
        <Sparkles className="h-6 w-6 text-indigo-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-slate-900">ReviveAI</p>
          <p className="text-xs text-slate-500">Revenue recovery</p>
        </div>
      </Link>
      <nav className="flex flex-1 flex-col gap-1 p-4" aria-label="Primary">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              ].join(' ')
            }
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-4">
        <button
          type="button"
          onClick={handleReset}
          aria-label="Reset demo data to the original 30 transactions"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Reset Demo Data
        </button>
      </div>
    </aside>
  )
}
