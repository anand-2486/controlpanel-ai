import {
    BarChart3,
    ShieldCheck,
    Flag,
    Ban,
    UserRoundCheck,
  } from "lucide-react"
  
  const cards = [
    {
      title: "Total Requests",
      value: "1,248",
      change: "12%",
      description: "vs yesterday",
      color: "blue",
      icon: BarChart3,
    },
    {
      title: "Allowed",
      value: "1,042",
      change: "83.7%",
      description: "of requests",
      color: "green",
      icon: ShieldCheck,
    },
    {
      title: "Flagged",
      value: "108",
      change: "8.7%",
      description: "of requests",
      color: "orange",
      icon: Flag,
    },
    {
      title: "Blocked",
      value: "61",
      change: "4.9%",
      description: "of requests",
      color: "red",
      icon: Ban,
    },
    {
      title: "Human Review",
      value: "37",
      change: "3.0%",
      description: "of requests",
      color: "purple",
      icon: UserRoundCheck,
    },
  ]
  
  const styles = {
    blue: {
      text: "text-blue-600",
      bg: "bg-blue-50",
      icon: "text-blue-600",
    },
    green: {
      text: "text-emerald-600",
      bg: "bg-emerald-50",
      icon: "text-emerald-600",
    },
    orange: {
      text: "text-orange-500",
      bg: "bg-orange-50",
      icon: "text-orange-500",
    },
    red: {
      text: "text-red-600",
      bg: "bg-red-50",
      icon: "text-red-600",
    },
    purple: {
      text: "text-purple-600",
      bg: "bg-purple-50",
      icon: "text-purple-600",
    },
  }
  
  function KPICards() {
    return (
      <div className="grid grid-cols-5 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          const style = styles[card.color]
  
          return (
            <div
              key={card.title}
              className="relative rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
            >
              {/* Text */}
              <div>
                <p
                  className={`text-sm font-semibold ${style.text}`}
                >
                  {card.title}
                </p>
  
                <p className="mt-2 text-[28px] font-bold leading-none text-slate-900">
                  {card.value}
                </p>
  
                <p className="mt-3 text-sm">
                  <span className={`font-semibold ${style.text}`}>
                    {card.change}
                  </span>
  
                  <span className="ml-1 text-slate-400">
                    {card.description}
                  </span>
                </p>
              </div>
  
              {/* Icon box */}
              <div
                className={`
                  absolute right-5 top-1/2
                  flex h-14 w-14
                  -translate-y-1/2
                  items-center justify-center
                  rounded-xl
                  ${style.bg}
                `}
              >
                <Icon
                  size={28}
                  strokeWidth={2}
                  className={style.icon}
                />
              </div>
            </div>
          )
        })}
      </div>
    )
  }
  
  export default KPICards