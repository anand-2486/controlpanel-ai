import { ChevronDown, Play, Search } from "lucide-react"

function PlaygroundSidebar() {
  return (
    <section className="flex w-[255px] shrink-0 flex-col border-r border-slate-200 bg-white">

      <div className="flex-1 p-4">

        {/* Application */}
        <div>
          <label className="text-[11px] font-semibold text-slate-700">
            Application
          </label>

          <button className="mt-2 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm">

            <div>
              <p className="text-[12px] font-medium text-slate-800">
                HR Assistant
              </p>

              <p className="mt-0.5 text-[10px] text-slate-400">
                HR Strict
              </p>
            </div>

            <ChevronDown
              size={15}
              className="text-slate-400"
            />

          </button>
        </div>

        {/* Prompt */}
        <div className="mt-6">

          <label className="text-[11px] font-semibold text-slate-700">
            Ask the AI
          </label>

          <textarea
            defaultValue="What is the employee leave policy? Also, give me the HR manager's phone number and salary details."
            className="mt-2 h-[130px] w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-[11px] leading-5 text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />

          <div className="mt-1 text-right text-[9px] text-slate-400">
            102 / 2000
          </div>

          <button className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-brand-700">

            <Play size={13} fill="currentColor" />

            Analyze

          </button>

        </div>

        {/* Recent prompts */}
        <div className="mt-7">

          <div className="flex items-center justify-between">

            <h3 className="text-[11px] font-semibold text-slate-700">
              Recent Prompts
            </h3>

            <Search
              size={13}
              className="text-slate-400"
            />

          </div>

          <div className="mt-3 space-y-2">

            <Prompt text="What is the leave policy?" status="ALLOW" />

            <Prompt text="Show employee salary details" status="BLOCK" />

            <Prompt text="How to claim medical insurance?" status="ALLOW" />

          </div>

          <button className="mt-4 text-[10px] font-medium text-brand-600 hover:text-brand-700">
            View all history →
          </button>

        </div>

      </div>

    </section>
  )
}

function Prompt({ text, status }) {
  const allowed = status === "ALLOW"

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5">

      <p className="min-w-0 truncate text-[10px] text-slate-600">
        {text}
      </p>

      <span
        className={`
          shrink-0 rounded px-1.5 py-0.5 text-[8px] font-semibold
          ${
            allowed
              ? "bg-emerald-50 text-emerald-600"
              : "bg-red-50 text-red-600"
          }
        `}
      >
        {status}
      </span>

    </div>
  )
}

export default PlaygroundSidebar