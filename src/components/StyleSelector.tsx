import type { Estilo } from "../config"

interface StyleSelectorProps {
  value: Estilo
  onChange: (estilo: Estilo) => void
}

const ESTILOS: { value: Estilo; label: string; icon: string }[] = [
  { value: "formal", label: "Formal", icon: "📋" },
  { value: "casual", label: "Casual", icon: "💬" },
  { value: "friendly", label: "Friendly", icon: "🤗" }
]

export function StyleSelector({ value, onChange }: StyleSelectorProps) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {ESTILOS.map((estilo) => (
        <button
          key={estilo.value}
          onClick={() => onChange(estilo.value)}
          style={{
            flex: 1,
            padding: "10px 8px",
            border: "none",
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s",
            background:
              value === estilo.value
                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                : "#e9ecef",
            color: value === estilo.value ? "white" : "#666"
          }}
        >
          {estilo.icon} {estilo.label}
        </button>
      ))}
    </div>
  )
}
