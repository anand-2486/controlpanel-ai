const incidents = [
    {
      id: "INC-1042",
      application: "HR Assistant",
      user: "john.doe@xyz.com",
      reason: "PII Disclosure",
      decision: "BLOCK",
      time: "2 mins ago",
    },
    {
      id: "INC-1041",
      application: "HR Assistant",
      user: "priya@xyz.com",
      reason: "Hallucination",
      decision: "FLAG",
      time: "15 mins ago",
    },
    {
      id: "INC-1040",
      application: "Finance Bot",
      user: "kiran@xyz.com",
      reason: "Prompt Injection",
      decision: "BLOCK",
      time: "28 mins ago",
    },
    {
      id: "INC-1039",
      application: "HR Assistant",
      user: "anita@xyz.com",
      reason: "PII Disclosure",
      decision: "REVIEW",
      time: "1 hour ago",
    },
    {
      id: "INC-1038",
      application: "Finance Bot",
      user: "rohit@xyz.com",
      reason: "Bias Detected",
      decision: "FLAG",
      time: "2 hours ago",
    },
  ]
  
  function RecentIncidents() {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
  
        {/* Header */}
        <div className="flex items-start justify-between">
  
          <div>
  
            <h2 className="text-base font-semibold text-slate-900">
              Recent Incidents
            </h2>
  
            <p className="mt-1 text-sm text-slate-400">
              Latest governance incidents detected across applications
            </p>
  
          </div>
  
          <button className="text-sm font-semibold text-purple-600">
            View all →
          </button>
  
        </div>
  
  
        {/* Divider */}
        <div className="mt-4 border-t border-slate-200" />
  
  
        {/* Table */}
        <div className="overflow-x-auto">
  
          <table className="w-full">
  
            <thead>
              <tr className="border-b border-slate-100">
  
                <Header>ID</Header>
                <Header>Application</Header>
                <Header>User</Header>
                <Header>Reason</Header>
                <Header>Decision</Header>
                <Header>Time</Header>
  
              </tr>
            </thead>
  
            <tbody>
  
              {incidents.map((incident) => (
                <tr
                  key={incident.id}
                  className="border-b border-slate-100 last:border-0"
                >
  
                  <td className="px-2 py-3 text-sm font-semibold text-purple-600">
                    {incident.id}
                  </td>
  
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
  
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                        <span className="text-xs">▦</span>
                      </div>
  
                      <span className="text-sm text-slate-600">
                        {incident.application}
                      </span>
  
                    </div>
                  </td>
  
                  <td className="px-2 py-3 text-sm text-slate-600">
                    {incident.user}
                  </td>
  
                  <td className="px-2 py-3 text-sm text-slate-600">
                    {incident.reason}
                  </td>
  
                  <td className="px-2 py-3">
                    <DecisionBadge decision={incident.decision} />
                  </td>
  
                  <td className="px-2 py-3 text-sm text-slate-500">
                    {incident.time}
                  </td>
  
                </tr>
              ))}
  
            </tbody>
  
          </table>
  
        </div>
  
      </div>
    )
  }
  
  
  function Header({ children }) {
    return (
      <th className="px-2 py-3 text-left text-xs font-semibold text-slate-800">
        {children}
      </th>
    )
  }
  
  
  function DecisionBadge({ decision }) {
  
    const styles = {
      BLOCK: "bg-red-50 text-red-600",
      FLAG: "bg-orange-50 text-orange-500",
      REVIEW: "bg-purple-50 text-purple-600",
    }
  
    return (
      <span
        className={`
          inline-flex rounded-md px-3 py-1.5
          text-xs font-semibold
          ${styles[decision]}
        `}
      >
        {decision}
      </span>
    )
  }
  
  export default RecentIncidents