import { IDIOMAS } from "../config"
import type { Idioma } from "../config"

interface LanguageSelectorProps {
  value: string
  onChange: (code: string) => void
}

export function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {IDIOMAS.map((idioma: Idioma) => (
        <button
          key={idioma.code}
          onClick={() => onChange(idioma.code)}
          style={{
            padding: "10px 8px",
            border: "none",
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s",
            background:
              value === idioma.code
                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                : "#e9ecef",
            color: value === idioma.code ? "white" : "#666"
          }}
        >
          {idioma.flag} {idioma.name}
        </button>
      ))}
    </div>
  )
}
