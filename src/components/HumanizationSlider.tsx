import { HUMANIZADO_LABELS } from "../config"

interface HumanizationSliderProps {
  value: number
  onChange: (value: number) => void
}

function getHumanizadoLabel(value: number): string {
  if (value < 33) return HUMANIZADO_LABELS.bajo
  if (value < 66) return HUMANIZADO_LABELS.medio
  return HUMANIZADO_LABELS.alto
}

export function HumanizationSlider({ value, onChange }: HumanizationSliderProps) {
  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: "#888" }}>🤖 Robótico</span>
        <span style={{ fontSize: 10, color: "#888" }}>👤 Humanizado</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%",
          height: 6,
          borderRadius: 3,
          appearance: "none",
          background: `linear-gradient(to right, #667eea 0%, #764ba2 ${value}%, #e9ecef ${value}%, #e9ecef 100%)`,
          cursor: "pointer"
        }}
      />
      <p style={{ fontSize: 10, color: "#666", textAlign: "center", marginTop: 6 }}>
        {getHumanizadoLabel(value)}
      </p>
    </div>
  )
}
