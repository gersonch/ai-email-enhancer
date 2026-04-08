interface LengthSliderProps {
  value: number
  onChange: (value: number) => void
}

export function LengthSlider({ value, onChange }: LengthSliderProps) {
  const percentage = ((value - 50) / 450) * 100

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <input
        type="range"
        min="50"
        max="500"
        step="50"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          appearance: "none",
          background: `linear-gradient(to right, #667eea 0%, #764ba2 ${percentage}%, #e9ecef ${percentage}%, #e9ecef 100%)`,
          cursor: "pointer"
        }}
      />
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#667eea",
          minWidth: 45,
          textAlign: "right"
        }}
      >
        {value}
      </span>
    </div>
  )
}
