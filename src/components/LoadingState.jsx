export default function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16">
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  )
}
