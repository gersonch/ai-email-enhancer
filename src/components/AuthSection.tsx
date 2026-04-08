import { useEffect, useState } from "react"

import {
  getSession,
  signIn,
  signOut,
  signUp,
  verifySession
} from "../services/supabase"

interface AuthSectionProps {
  onAuthenticated?: () => void
}

type AuthView = "login" | "register" | "authenticated"

export function AuthSection({ onAuthenticated }: AuthSectionProps) {
  const [view, setView] = useState<AuthView>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      setCheckingAuth(true)
      const { valid, user } = await verifySession()
      if (valid && user) {
        setView("authenticated")
        setUserEmail(user.email)
      }
      setCheckingAuth(false)
    }
    checkAuth()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await signIn(email, password)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      const session = await getSession()
      if (session) {
        setUserEmail(session.user.email)
      }
      setView("authenticated")
      chrome.runtime
        .sendMessage({ type: "AUTH_CHANGED", isAuthenticated: true })
        .catch(() => {})
      onAuthenticated?.()
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await signUp(email, password)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setMessage("Revisa tu email para confirmar tu cuenta")
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    await signOut()
    chrome.runtime
      .sendMessage({ type: "AUTH_CHANGED", isAuthenticated: false })
      .catch(() => {})
    if (onAuthenticated) onAuthenticated()
    setView("login")
    setEmail("")
    setPassword("")
    setUserEmail(null)
    setLoading(false)
  }

  if (checkingAuth) {
    return (
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: 14,
          marginBottom: 12,
          border: "1px solid #e9ecef",
          textAlign: "center"
        }}>
        <span style={{ fontSize: 13, color: "#666" }}>
          Verificando sesión...
        </span>
      </div>
    )
  }

  if (view === "authenticated") {
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
            alignItems: "center"
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#28a745"
              }}></span>
            <span style={{ fontSize: 13, color: "#333" }}>{userEmail}</span>
          </div>
          <button
            onClick={handleLogout}
            disabled={loading}
            style={{
              padding: "6px 12px",
              background: "white",
              color: "#dc3545",
              border: "1px solid #dc3545",
              borderRadius: 8,
              fontSize: 11,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1
            }}>
            {loading ? "Cerrando..." : "Cerrar sesión"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        background: "white",
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        border: "1px solid #e9ecef"
      }}>
      {message ? (
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              color: "#28a745",
              fontSize: 13,
              marginBottom: 10,
              padding: 10,
              background: "#f0fff0",
              borderRadius: 8
            }}>
            {message}
          </div>
          <button
            onClick={() => {
              setMessage(null)
              setView("login")
            }}
            style={{
              padding: "8px 16px",
              background: "#0066cc",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 12,
              cursor: "pointer"
            }}>
            Volver al inicio de sesión
          </button>
        </div>
      ) : (
        <>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 12,
              color: "#333",
              marginTop: 0
            }}>
            {view === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </h3>
          <form onSubmit={view === "login" ? handleLogin : handleRegister}>
            <div style={{ marginBottom: 10 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  color: "#666",
                  marginBottom: 4
                }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: "1px solid #e9ecef",
                  borderRadius: 8,
                  fontSize: 13,
                  boxSizing: "border-box"
                }}
              />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  color: "#666",
                  marginBottom: 4
                }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                required
                minLength={6}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: "1px solid #e9ecef",
                  borderRadius: 8,
                  fontSize: 13,
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
                fontSize: 13,
                fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
                marginTop: 4
              }}>
              {loading
                ? "Cargando..."
                : view === "login"
                  ? "Entrar"
                  : "Registrarse"}
            </button>
          </form>
          <div style={{ textAlign: "center", marginTop: 10 }}>
            {view === "login" ? (
              <p style={{ fontSize: 11, color: "#666" }}>
                ¿No tienes cuenta?{" "}
                <button
                  onClick={() => setView("register")}
                  style={{
                    color: "#0066cc",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11
                  }}>
                  Regístrate
                </button>
              </p>
            ) : (
              <p style={{ fontSize: 11, color: "#666" }}>
                ¿Ya tienes cuenta?{" "}
                <button
                  onClick={() => setView("login")}
                  style={{
                    color: "#0066cc",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11
                  }}>
                  Inicia sesión
                </button>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
