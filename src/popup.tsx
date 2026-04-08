import { useEffect, useState } from "react"

import {
  AuthSection,
  ConfigSection,
  Header,
  HumanizationSlider,
  LanguageSelector,
  LengthSlider,
  SaveButton,
  StyleSelector,
  ToggleOption,
  UserApiKeySection
} from "./components"
import { cargarConfig, CONFIG_DEFAULT, guardarConfig } from "./config"
import type { Configuracion } from "./config"
import { getSession, verifySession } from "./services/supabase"

// ============================================
// TYPES
// =============================================

interface AuthState {
  isAuthenticated: boolean
  user: {
    id: string
    email: string
  } | null
}

// ============================================
// COMPONENT
// ============================================

function IndexPopup() {
  const [config, setConfig] = useState<Configuracion>(CONFIG_DEFAULT)
  const [guardado, setGuardado] = useState(false)
  const [loading, setLoading] = useState(true)
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null
  })

  // ============================================
  // CHECK AUTH AND LOAD CONFIG ON MOUNT
  // ============================================

  useEffect(() => {
    const init = async () => {
      // Load config
      const configResult = await cargarConfig()
      setConfig(configResult)

      // Verify session with server (secure)
      const { valid, user } = await verifySession()
      setAuthState({
        isAuthenticated: valid,
        user: user
      })

      setLoading(false)
    }

    init()
  }, [])

  // ============================================
  // HANDLERS
  // ============================================

  const handleGuardarConfig = () => {
    guardarConfig(config).then(() => {
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2000)
    })
  }

  const handleAuthChange = async () => {
    // Re-check auth when AuthSection emits change
    const { valid, user } = await verifySession()
    setAuthState({
      isAuthenticated: valid,
      user: user
    })
  }

  // Listen for auth changes from other parts of the extension
  useEffect(() => {
    const handleMessage = (message: {
      type: string
      isAuthenticated?: boolean
    }) => {
      if (message.type === "AUTH_CHANGED") {
        setAuthState({
          isAuthenticated: message.isAuthenticated ?? false,
          user: null
        })
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [])

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: 20,
        minWidth: 320,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: "#f8f9fa"
      }}>
      <Header />

      {/* Auth Section - Always shown */}
      <AuthSection onAuthenticated={handleAuthChange} />

      {/* API Key Section - Only if authenticated */}
      <UserApiKeySection isAuthenticated={authState.isAuthenticated} />

      {/* Only show config if authenticated */}
      {authState.isAuthenticated && (
        <>
          <ConfigSection title="🌐 Idioma">
            <LanguageSelector
              value={config.idioma}
              onChange={(idioma) => setConfig({ ...config, idioma })}
            />
          </ConfigSection>

          <ConfigSection title="📝 Estilo de escritura">
            <StyleSelector
              value={config.estilo}
              onChange={(estilo) => setConfig({ ...config, estilo })}
            />
          </ConfigSection>

          <ConfigSection title="🧠 Nivel de humanizacion">
            <HumanizationSlider
              value={config.humanizado}
              onChange={(humanizado) => setConfig({ ...config, humanizado })}
            />
          </ConfigSection>

          <ConfigSection title="⚙️ Opciones">
            <ToggleOption
              label="Incluir firma"
              description="Agrega saludo y despedida"
              checked={config.incluirFirma}
              onChange={(incluirFirma) =>
                setConfig({ ...config, incluirFirma })
              }
            />
            <ToggleOption
              label="Emojis"
              description="Agrega emojis al texto"
              checked={config.emojis}
              onChange={(emojis) => setConfig({ ...config, emojis })}
            />
          </ConfigSection>

          <ConfigSection title="📏 Longitud maxima">
            <LengthSlider
              value={config.maxLongitud}
              onChange={(maxLongitud) => setConfig({ ...config, maxLongitud })}
            />
          </ConfigSection>

          <SaveButton saved={guardado} onClick={handleGuardarConfig} />
        </>
      )}

      {/* Message when not authenticated */}
      {!authState.isAuthenticated && (
        <div
          style={{
            textAlign: "center",
            padding: "16px",
            color: "#666",
            fontSize: 13
          }}>
          Inicia sesion para usar la extension
        </div>
      )}
    </div>
  )
}

export default IndexPopup
