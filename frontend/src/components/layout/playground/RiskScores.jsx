const risks = [
    {
      label: "Privacy",
      value: "0.92",
      level: "HIGH",
      description: "PII",
      tone: "red",
    },
    {
      label: "Hallucination",
      value: "0.85",
      level: "HIGH",
      description: "Risk",
      tone: "red",
    },
    {
      label: "Bias",
      value: "0.10",
      level: "LOW",
      description: "Risk",
      tone: "green",
    },
    {
      label: "Security",
      value: "0.20",
      level: "LOW",
      description: "Risk",
      tone: "green",
    },
  ]
  
  function RiskScores() {
    return (
      <section className="mt-5">
  
        <div className="mb-3 flex items-center justify-between">
  
          <h2 className="text-sm font-semibold text-slate-800">
            Risk Scores
          </h2>
  
          <button className="text-[10px] font-medium text-brand-600 hover:text-brand-700">
            View Details →
          </button>
  
        </div>
  
        <div className="grid grid-cols-4 gap-3">
  
          {risks.map((risk) => (
            <RiskCard
              key={risk.label}
              {...risk}
            />
          ))}
  
        </div>
  
      </section>
    )
  }
  
  function RiskCard({
    label,
    value,
    level,
    description,
    tone,
  }) {
    const isHigh = tone === "red"
  
    return (
      <div
        className={`
          rounded-lg border p-3
          ${
            isHigh
              ? "border-red-100 bg-red-50/60"
              : "border-emerald-100 bg-emerald-50/50"
          }
        `}
      >
  
        <div className="flex items-center justify-between">
  
          <span className="text-xs font-medium text-slate-600">
            {label}
          </span>
  
          <span
            className={`
              text-[8px] font-semibold
              ${
                isHigh
                  ? "text-red-500"
                  : "text-emerald-500"
              }
            `}
          >
            {description}
          </span>
  
        </div>
  
        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {value}
        </p>
  
        <div
          className={`
            mt-2 inline-flex rounded px-2 py-1 text-[10px] font-semibold
            ${
              isHigh
                ? "bg-red-100 text-red-600"
                : "bg-emerald-100 text-emerald-600"
            }
          `}
        >
          {level}
        </div>
  
      </div>
    )
  }
  
  export default RiskScores