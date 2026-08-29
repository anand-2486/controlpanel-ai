function RiskDistribution() {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
  
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Risk Distribution
            </h2>
          </div>
  
          <p className="mt-1 text-sm text-slate-400">
            Requests by overall risk level
          </p>
        </div>
  
  
        <div className="mt-4 flex items-center justify-center gap-12">
  
          <div className="relative h-56 w-56">
  
            <svg
              viewBox="0 0 200 200"
              className="h-full w-full -rotate-90"
            >
              <circle
                cx="100"
                cy="100"
                r="70"
                fill="none"
                stroke="#16a34a"
                strokeWidth="30"
                strokeDasharray="285 440"
              />
  
              <circle
                cx="100"
                cy="100"
                r="70"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="30"
                strokeDasharray="110 440"
                strokeDashoffset="-285"
              />
  
              <circle
                cx="100"
                cy="100"
                r="70"
                fill="none"
                stroke="#ef4444"
                strokeWidth="30"
                strokeDasharray="44 440"
                strokeDashoffset="-395"
              />
            </svg>
  
  
            <div className="absolute inset-0 flex flex-col items-center justify-center">
  
              <span className="text-3xl font-bold text-slate-900">
                1,248
              </span>
  
              <span className="mt-1 text-sm text-slate-400">
                requests
              </span>
  
            </div>
  
          </div>
  
  
          <div className="space-y-6">
  
            <RiskLegend
              color="bg-emerald-500"
              label="Low"
              range="0 – 0.3"
              percentage="65%"
              count="(811)"
            />
  
            <RiskLegend
              color="bg-orange-500"
              label="Medium"
              range="0.3 – 0.7"
              percentage="25%"
              count="(312)"
            />
  
            <RiskLegend
              color="bg-red-500"
              label="High"
              range="0.7 – 1.0"
              percentage="10%"
              count="(125)"
            />
  
          </div>
  
        </div>
  
      </div>
    )
  }
  
  
  function RiskLegend({
    color,
    label,
    range,
    percentage,
    count,
  }) {
    return (
      <div className="flex items-center gap-3">
  
        <span
          className={`h-3 w-3 rounded-full ${color}`}
        />
  
        <div className="min-w-[150px]">
  
          <p className="text-sm text-slate-700">
            <span className="font-semibold">
              {label}
            </span>
  
            <span className="ml-2 text-slate-400">
              ({range})
            </span>
          </p>
  
        </div>
  
        <div className="text-right">
  
          <p className="text-sm font-semibold text-slate-700">
            {percentage}
          </p>
  
          <p className="text-xs text-slate-400">
            {count}
          </p>
  
        </div>
  
      </div>
    )
  }
  
  export default RiskDistribution