import { useState } from "react"

interface ApiKeySectionProps {
  apiKey: string | null
  onSave: (apiKey: string) => void
  error: string | null
  onClearError: () => void
}

export function ApiKeySection({ apiKey, onSave, error, onClearError }: ApiKeySectionProps) {
  const [inputValue, setInputValue] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [showInput, setShowInput] = useState(!apiKey)

  const handleSave = async () => {
    const trimmedKey = inputValue.trim()

    if (!trimmedKey) {
      return
    }

    setIsSaving(true)
    onClearError()

    // Small delay for UX
    await new Promise((resolve) => setTimeout(resolve, 300))

    onSave(trimmedKey)
    setInputValue("")
    setIsSaving(false)
    setShowInput(false)
  }

  const handleChange = () => {
    setShowInput(true)
    onClearError()
  }

  const maskApiKey = (key: string): string => {
    if (key.length <= 8) return "●●●●●●●●"
    return key.substring(0, 4) + "●●●●●●" + key.substring(key.length - 2)
  }

  // Error state - show red border
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: `1px solid ${error ? "#dc3545" : "#e9ecef"}`,
    borderRadius: 8,
    fontSize: 12,
    fontFamily: "monospace",
    outline: "none",
    transition: "border-color 0.2s"
  }

  if (!showInput && apiKey) {
    // Display mode - key is saved
    return (
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: 14,
          marginBottom: 12,
          border: "1px solid #e9ecef"
        }}
      >
        <h3 style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "#333", marginTop: 0 }}>
          🔑 OpenAI API Key
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              flex: 1,
              padding: "10px 12px",
              background: "#f8f9fa",
              borderRadius: 8,
              fontSize: 12,
              fontFamily: "monospace",
              color: "#666"
            }}
          >
            {maskApiKey(apiKey)}
          </div>
          <button
            onClick={handleChange}
            style={{
              padding: "10px 14px",
              background: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            Cambiar
          </button>
        </div>
      </div>
    )
  }

  // Input mode
  return (
    <div
      style={{
        background: "white",
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        border: "1px solid #e9ecef"
      }}
    >
      <h3 style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "#333", marginTop: 0 }}>
        🔑 OpenAI API Key
      </h3>

      <input
        type="password"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value)
          if (error) onClearError()
        }}
        placeholder="sk-..."
        style={inputStyle}
        onKeyDown={(e) => {
          if (e.key === "Enter" && inputValue.trim()) {
            handleSave()
          }
        }}
        autoFocus={!apiKey}
      />

      {error && (
        <p style={{ color: "#dc3545", fontSize: 11, marginTop: 6, marginBottom: 0 }}>
          {error}
        </p>
      )}

      <p style={{ color: "#888", fontSize: 10, marginTop: 8, marginBottom: 10 }}>
        Obtén tu key en{" "}
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#667eea" }}
        >
          platform.openai.com
        </a>
      </p>

      <button
        onClick={handleSave}
        disabled={!inputValue.trim() || isSaving}
        style={{
          width: "100%",
          padding: "10px",
          background: inputValue.trim() && !isSaving
            ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            : "#e9ecef",
          color: inputValue.trim() && !isSaving ? "white" : "#999",
          border: "none",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          cursor: inputValue.trim() && !isSaving ? "pointer" : "not-allowed",
          transition: "all 0.2s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6
        }}
      >
        {isSaving ? (
          <>
            <span style={{ animation: "spin 1s linear infinite" }}>⟳</span>
            Guardando...
          </>
        ) : (
          "💾 Guardar API Key"
        )}
      </button>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
