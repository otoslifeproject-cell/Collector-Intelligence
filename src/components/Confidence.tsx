import { confidenceTone } from '../lib/format'

export default function Confidence({label, value}: {label:string, value:number|null|undefined}) {
  return (
    <div className="confidence">
      <div className="confidenceHeader"><span>{label}</span><strong>{value ?? '—'}{value !== null && value !== undefined ? '%' : ''}</strong></div>
      <div className="confidenceTrack">
        <div className={`confidenceFill ${confidenceTone(value)}`} style={{width: `${value ?? 0}%`}} />
      </div>
    </div>
  )
}
