import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-indigo-400" aria-hidden="true" />
          <span className="text-lg font-semibold">ReviveAI</span>
        </div>
        <Link
          to="/dashboard"
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-400"
        >
          Open dashboard
        </Link>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-24">
        <p className="text-sm font-medium uppercase tracking-wider text-indigo-300">
          AI-powered revenue recovery
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Recover failed payments before the revenue is gone.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-300">
          ReviveAI scores failed UPI, card, net banking, and wallet payments, recommends
          a recovery strategy, and simulates the outcome so merchants can see recoverable
          revenue before it is written off.
        </p>
        <Link
          to="/dashboard"
          className="mt-10 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100"
        >
          Go to dashboard
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <p className="mt-10 max-w-2xl text-xs leading-5 text-slate-500">
          This project is a prototype built using simulated transaction data. It does not
          process real customer payment information or execute real payment retries.
        </p>
      </main>
    </div>
  )
}
