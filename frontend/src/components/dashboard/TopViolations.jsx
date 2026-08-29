const violations = [
    {
      name: "PII Disclosure",
      count: 42,
      percentage: 34,
      color: "bg-red-500",
    },
    {
      name: "Hallucination",
      count: 31,
      percentage: 25,
      color: "bg-orange-500",
    },
    {
      name: "Prompt Injection",
      count: 18,
      percentage: 15,
      color: "bg-amber-400",
    },
    {
      name: "Bias Detected",
      count: 12,
      percentage: 10,
      color: "bg-emerald-500",
    },
    {
      name: "Security Risk",
      count: 8,
      percentage: 6,
      color: "bg-blue-500",
    },
  ]
  
  function TopViolations() {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
  
        <div className="flex items-start justify-between">
  
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Top Violations
            </h2>
  
            <p className="mt-1 text-sm text-slate-400">
              Most frequently detected governance issues
            </p>
          </div>
  
          <button className="text-sm font-semibold text-purple-600 hover:text-purple-700">
            View all →
          </button>
  
        </div>
        <div className="mt-6 space-y-4">
  
          {violations.map((violation) => (
            <Violation
              key={violation.name}
              {...violation}
            />
          ))}
  
        </div>
  
      </div>
    )
  }
  
  
  function Violation({
    name,
    count,
    percentage,
    color,
  }) {
    return (
      <div>
  
        <div className="mb-2 flex items-center justify-between">
  
          <span className="text-sm font-medium text-slate-700">
            {name}
          </span>
  
          <div className="flex items-center gap-5">
  
            <span className="text-sm font-semibold text-slate-600">
              {count}
            </span>
  
            <span className="w-7 text-right text-xs text-slate-400">
              {percentage}%
            </span>
  
          </div>
  
        </div>
  
  
        <div className="h-1.5 w-full rounded-full bg-slate-100">
  
          <div
            className={`h-full rounded-full ${color}`}
            style={{
              width: `${percentage * 2.9}%`,
            }}
          />
  
        </div>
  
      </div>
    )
  }
  
  export default TopViolations