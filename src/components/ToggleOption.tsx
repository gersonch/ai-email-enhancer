interface ToggleOptionProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function ToggleOption({ label, description, checked, onChange }: ToggleOptionProps) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: "1px solid #f0f0f0",
        cursor: "pointer"
      }}
    >
      <div>
        <p style={{ fontSize: 12, fontWeight: 500, margin: 0, color: "#333" }}>{label}</p>
        <p style={{ fontSize: 10, color: "#888", margin: 0 }}>{description}</p>
      </div>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          background: checked ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "#e9ecef",
          position: "relative",
          transition: "all 0.2s",
          cursor: "pointer"
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "white",
            position: "absolute",
            top: 3,
            left: checked ? 23 : 3,
            transition: "all 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
          }}
        />
      </div>
    </label>
  )
}
