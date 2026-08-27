import { Link, NavLink, useLocation } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

const titles = {
  '/dashboard': 'Dashboard',
  '/transactions': 'Transactions',
  '/analytics': 'Analytics',
}

const mobileNav = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/analytics', label: 'Analytics' },
]

export default function Header() {
  const { pathname } = useLocation()
  const title = pathname.startsWith('/analysis/')
    ? 'AI Recovery Analysis'
    : titles[pathname] ?? 'ReviveAI'

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/dashboard" className="flex items-center gap-2 lg:hidden" aria-label="ReviveAI dashboard">
          <Sparkles className="h-5 w-5 text-indigo-600" aria-hidden="true" />
          <span className="text-sm font-semibold text-slate-900">ReviveAI</span>
        </Link>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <span className="hidden text-sm text-slate-400 sm:block">Merchant console</span>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden" aria-label="Primary">
        {mobileNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium',
                isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
