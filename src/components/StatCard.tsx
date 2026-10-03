import React from 'react'

export default function StatCard({label, value, sub, icon}: {label:string, value:string|number, sub?:string, icon?:React.ReactNode}) {
  return (
    <div className="statCard">
      <div className="statIcon">{icon}</div>
      <div>
        <div className="statLabel">{label}</div>
        <div className="statValue">{value}</div>
        {sub && <div className="statSub">{sub}</div>}
      </div>
    </div>
  )
}
