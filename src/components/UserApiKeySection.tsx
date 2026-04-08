import { useEffect, useState } from "react"

import {
  hasUserApiKey,
  removeUserApiKey,
  saveUserApiKey
} from "../services/supabase"

// =============================================
// TYPES
// =============================================

interface UserApiKeySectionProps {
  isAuthenticated: boolean
}

// =============================================
// COMPONENT
// =============================================

export function UserApiKeySection({ isAuthenticated }: UserApiKeySectionProps) {
  const [showInput, setShowInput] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [hasKey, setHasKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // =============================================
  // CHECK IF USER HAS API KEY
  // =============================================

  useEffect(() => {
    if (isAuthenticated) {
      checkUserApiKey()
    } else {
      setHasKey(false)
      setShowInput(false)
    }
  }, [isAuthenticated])

  const checkUserApiKey = async () => {
    const result = await hasUserApiKey()
    setHasKey(result)
  }

  // =============================================
  // HANDLERS
  // =============================================

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!apiKey.trim()) {
      setError("La API key no puede estar vacía")
      return
    }

    if (!apiKey.startsWith("sk-")) {
      setError("La API key debe comenzar con 'sk-'")
      return
    }

    setLoading(true)

    const result = await saveUserApiKey(apiKey.trim())

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setSuccess(true)
      setHasKey(true)
      setApiKey("")
      setShowInput(false)
      setLoading(false)

      // Reset success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  const handleRemove = async () => {
    if (!confirm("¿Estas seguro de eliminar tu API key?")) return

    setLoading(true)
    const result = await removeUserApiKey()

    if (result.error) {
      setError(result.error)
    } else {
      setHasKey(false)
    }
    setLoading(false)
  }

  // =============================================
  // RENDER: NOT AUTHENTICATED
  // =============================================

  if (!isAuthenticated) {
    return null
  }

  // =============================================
  // RENDER: ADD API KEY FORM
  // =============================================

  if (showInput) {
    return (
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: 14,
          marginBottom: 12,
          border: "1px solid #e9ecef"
        }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10
          }}>
          <h3
            style={{ fontSize: 12, fontWeight: 600, margin: 0, color: "#333" }}>
            🔑 Tu API Key de OpenAI
          </h3>
          <button
            onClick={() => {
              setShowInput(false)
              setApiKey("")
              setError(null)
            }}
            style={{
              background: "none",
              border: "none",
              fontSize: 14,
              color: "#999",
              cursor: "pointer",
              padding: 2
            }}>
            ✕
          </button>
        </div>

        <div
          style={{
            background: "#e8f5e9",
            border: "1px solid #a5d6a7",
            borderRadius: 8,
            padding: 10,
            marginBottom: 12,
            fontSize: 11,
            color: "#2e7d32"
          }}>
          <strong style={{ display: "block", marginBottom: 4 }}>
            Ventajas de tu propia API key:
          </strong>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            <li>Sin límite de requests diarios</li>
            <li>Usas tus propios créditos de OpenAI</li>
            <li>Sin costo adicional para ti</li>
          </ul>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 10 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                color: "#666",
                marginBottom: 4
              }}>
              OpenAI API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              required
              disabled={loading}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid #e9ecef",
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "monospace",
                boxSizing: "border-box"
              }}
            />
          </div>

          {error && (
            <div
              style={{
                color: "#dc3545",
                fontSize: 11,
                margin: "6px 0",
                padding: 6,
                background: "#fff5f5",
                borderRadius: 6
              }}>
              {error}
            </div>
          )}
          {success && (
            <div
              style={{
                color: "#28a745",
                fontSize: 11,
                margin: "6px 0",
                padding: 6,
                background: "#f0fff0",
                borderRadius: 6
              }}>
              API key guardada correctamente
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px",
              background: "#0066cc",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1
            }}>
            {loading ? "Guardando..." : "Guardar API Key"}
          </button>
        </form>

        <p
          style={{
            marginTop: 10,
            fontSize: 10,
            color: "#999",
            textAlign: "center"
          }}>
          Obtén tu API key en{" "}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#0066cc" }}>
            platform.openai.com
          </a>
        </p>
      </div>
    )
  }

  // =============================================
  // RENDER: SHOW STATUS
  // =============================================

  return (
    <div
      style={{
        background: "white",
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        border: "1px solid #e9ecef"
      }}>
      <h3
        style={{
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 10,
          color: "#333",
          marginTop: 0
        }}>
        🔑 Modo de API
      </h3>

      <div style={{ marginBottom: 10 }}>
        {hasKey ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                padding: "3px 6px",
                borderRadius: 4,
                fontSize: 9,
                fontWeight: 600,
                background: "#28a745",
                color: "white"
              }}>
              TU API KEY
            </span>
            <span style={{ fontSize: 11, color: "#666" }}>
              Usando tu propia API key (sin límites)
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                padding: "3px 6px",
                borderRadius: 4,
                fontSize: 9,
                fontWeight: 600,
                background: "#667eea",
                color: "white"
              }}>
              KEY DEL DEV
            </span>
            <span style={{ fontSize: 11, color: "#666" }}>
              Usando la API key del desarrollador (5 requests/día)
            </span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        {hasKey ? (
          <>
            <button
              onClick={() => setShowInput(true)}
              style={{
                flex: 1,
                padding: "8px",
                background: "white",
                color: "#666",
                border: "1px solid #e9ecef",
                borderRadius: 8,
                fontSize: 11,
                cursor: "pointer"
              }}>
              Cambiar
            </button>
            <button
              onClick={handleRemove}
              disabled={loading}
              style={{
                padding: "8px 12px",
                background: "white",
                color: "#dc3545",
                border: "1px solid #dc3545",
                borderRadius: 8,
                fontSize: 11,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.5 : 1
              }}>
              Eliminar
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowInput(true)}
            style={{
              width: "100%",
              padding: "10px",
              background: "#0066cc",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer"
            }}>
            Usar mi propia API Key
          </button>
        )}
      </div>

      {success && (
        <div
          style={{
            color: "#28a745",
            fontSize: 11,
            marginTop: 8,
            padding: 6,
            background: "#f0fff0",
            borderRadius: 6,
            textAlign: "center"
          }}>
          ¡Cambios guardados!
        </div>
      )}
    </div>
  )
}
