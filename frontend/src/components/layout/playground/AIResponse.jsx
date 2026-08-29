import { Copy, CheckCircle2 } from "lucide-react"

function AIResponse() {
  return (
    <section className="flex min-w-0 flex-1 flex-col">

      {/* Section heading */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-800">
            AI Response
          </h2>

          <span className="text-xs text-slate-400">
            Interaction ID:
            <span className="ml-1 font-mono text-slate-500">
              int_8f7e2c1a
            </span>
          </span>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-medium text-emerald-600">
          <CheckCircle2 size={11} />
          Analyzed
        </span>
      </div>

      {/* Response card */}
      <div className="relative mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">

        <button
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white hover:text-slate-600"
          title="Copy response"
        >
          <Copy size={14} />
        </button>

        <p className="pr-8 text-sm leading-5 text-slate-700">
          Employees are entitled to 24 annual leaves per year.
          The HR manager's contact number is{" "}
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white">
            ██████████
          </span>{" "}
          and salary is ₹12,00,000 per annum.
        </p>

      </div>

    </section>
  )
}

export default AIResponse