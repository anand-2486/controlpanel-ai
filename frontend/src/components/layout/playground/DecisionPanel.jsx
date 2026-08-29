import {
    AlertCircle,
    ExternalLink,
    FileText,
  } from "lucide-react"
  
  function DecisionPanel() {
    return (
      <section className="mt-5">
  
        <div className="grid grid-cols-2 gap-3">
  
          <div className="rounded-lg border border-slate-200 bg-white p-4">
  
            <div className="flex items-center justify-between">
  
              <h3 className="text-[11px] font-semibold text-slate-700">
                Overall Risk Score
              </h3>
  
              <span className="rounded bg-red-50 px-2 py-1 text-[8px] font-semibold text-red-600">
                HIGH RISK
              </span>
  
            </div>
  
            <div className="mt-3 flex items-end gap-1">
  
              <span className="text-3xl font-semibold tracking-tight text-slate-900">
                0.72
              </span>
  
              <span className="mb-1 text-[9px] text-slate-400">
                / 1.00
              </span>
  
            </div>
  
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
  
              <div
                className="h-full rounded-full bg-red-500"
                style={{ width: "72%" }}
              />
  
            </div>
  
          </div>
  
          <div className="rounded-lg border border-red-100 bg-red-50/50 p-4">
  
            <h3 className="text-[11px] font-semibold text-slate-700">
              Decision
            </h3>
  
            <div className="mt-3 flex items-center gap-3">
  
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertCircle size={17} />
              </div>
  
              <div>
  
                <p className="text-base font-bold text-red-600">
                  BLOCK
                </p>
  
                <p className="mt-0.5 text-[9px] text-slate-500">
                  This request has been blocked by the system.
                </p>
  
              </div>
  
            </div>
  
          </div>
  
        </div>
  
  
        <div className="mt-3 grid grid-cols-2 gap-3">
  
          <div className="rounded-lg border border-slate-200 bg-white p-4">
  
            <h3 className="text-[11px] font-semibold text-slate-700">
              Reasons
            </h3>
  
            <ul className="mt-3 space-y-3">
  
              <Reason>
                PII detected: Phone number
              </Reason>
  
              <Reason>
                PII detected: Salary information
              </Reason>
  
              <Reason>
                HR Strict policy prohibits disclosure of personal and financial data
              </Reason>
  
            </ul>
  
          </div>
  
  
          <div className="rounded-lg border border-slate-200 bg-white p-4">
  
            <h3 className="text-sm font-semibold text-slate-700">
              Evidence
            </h3>
  
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
  
              <div className="flex items-center gap-2">
  
                <FileText
                  size={14}
                  className="text-brand-600"
                />
  
                <span className="text-[10px] font-medium text-slate-600">
                  Source: hr_policy.txt
                </span>
  
              </div>
  
              <p className="mt-2 text-xs leading-4 text-slate-500">
                HR policy prohibits sharing of employee contact details
                and compensation information.
              </p>
  
              <button className="mt-3 flex items-center gap-1 text-[9px] font-medium text-brand-600 hover:text-brand-700">
  
                View Source
  
                <ExternalLink size={10} />
  
              </button>
  
            </div>
  
          </div>
  
        </div>
  
      </section>
    )
  }
  
  
  function Reason({ children }) {
    return (
      <li className="flex gap-2 text-[9px] leading-4 text-slate-600">
  
        <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
  
        <span>
          {children}
        </span>
  
      </li>
    )
  }
  
  
  export default DecisionPanel