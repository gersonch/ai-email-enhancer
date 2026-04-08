// ============================================
// AI EMAIL ENHANCER - Content Script
// Uses Supabase backend with OpenAI
// ============================================

import { CONFIG_DEFAULT } from "./config/constants"
import type { Configuracion } from "./config/types"
import {
  canMakeRequest,
  consumeToken,
  getCachedResponse,
  invalidateCache,
  setCachedResponse
} from "./services/cache"

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEY_CONFIG = "aiEmailConfig"
// Key que usa Supabase para guardar la sesión
const SUPABASE_AUTH_KEY = "sb-ibpsesbmnosfrblwzzhn-auth-token"

const SUPABASE_URL = "https://ibpsesbmnosfrblwzzhn.supabase.co"
// Current anon key from Supabase Dashboard
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlicHNlc2Jtbm9zZnJibHd6emhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTk4MTMsImV4cCI6MjA5MDk3NTgxM30.SdH-NlXp-c9MWSGAn0sMKK5_GfbEuNc7NIsyA8fHQpM"

const DOMINIOS_PERMITIDOS = [
  "mail.google.com",
  "outlook.live.com",
  "outlook.office.com",
  "yahoo.com",
  "protonmail.com",
  "zoho.com"
]

// ============================================
// TYPES
// ============================================

interface AuthSession {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: {
    id: string
    email: string
  }
}

interface ImproveResponse {
  success: true
  text: string
  html?: string
  apiKeySource: "developer" | "user"
}

interface ErrorResponse {
  success: false
  error: string
  code?: string
}

type APIResponse = ImproveResponse | ErrorResponse

// ============================================
// ESTADO GLOBAL
// ============================================

let configGlobal: Configuracion = CONFIG_DEFAULT
let authSession: AuthSession | null = null

// ============================================
// HELPERS
// ============================================

async function getAuthSession(): Promise<AuthSession | null> {
  // Check memory cache first (expires_at is in seconds, Date.now() is in ms)
  if (
    authSession &&
    authSession.expires_at &&
    authSession.expires_at * 1000 > Date.now()
  ) {
    return authSession
  }

  const result = await chrome.storage.local.get(SUPABASE_AUTH_KEY)
  const storedSession = result[SUPABASE_AUTH_KEY]

  if (!storedSession) {
    return null
  }

  // Supabase stores as JSON string, parse if needed
  let session: AuthSession
  if (typeof storedSession === "string") {
    try {
      session = JSON.parse(storedSession)
    } catch {
      return null
    }
  } else {
    session = storedSession as AuthSession
  }

  // Check if token is valid (expires_at is in seconds, Date.now() is in milliseconds)
  if (session && session.expires_at && session.expires_at * 1000 > Date.now()) {
    authSession = session
    return session
  }

  return null
}

function getSupabaseHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    apikey: SUPABASE_ANON_KEY
  }
}

async function callImproveEmailAPI(
  text: string,
  config: Configuracion
): Promise<APIResponse> {
  const session = await getAuthSession()

  if (!session) {
    return {
      success: false,
      error: "No has iniciado sesion",
      code: "NOT_AUTHENTICATED"
    }
  }

  console.log(
    "[AI Enhancer] API call - token starts with:",
    session.access_token?.substring(0, 50)
  )
  console.log("[AI Enhancer] API call - expires_at:", session.expires_at)
  console.log(
    "[AI Enhancer] API call - current time (s):",
    Math.floor(Date.now() / 1000)
  )

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/improve-email`, {
      method: "POST",
      headers: getSupabaseHeaders(session.access_token),
      body: JSON.stringify({ text, config })
    })

    console.log("[AI Enhancer] API response status:", response.status)

    if (response.status === 401) {
      const errorText = await response.text()
      console.log("[AI Enhancer] 401 error:", errorText)
      return {
        success: false,
        error: "Sesion expirada. Inicia sesion nuevamente.",
        code: "SESSION_EXPIRED"
      }
    }

    if (response.status === 429) {
      const data = await response.json()
      return {
        success: false,
        error: data.error || "Has alcanzado el límite de requests diarios.",
        code: "LIMIT_EXCEEDED"
      }
    }

    if (!response.ok) {
      const data = await response.json()
      return {
        success: false,
        error: data.error || "Error en el servidor",
        code: "SERVER_ERROR"
      }
    }

    return await response.json()
  } catch (error) {
    console.error("API Error:", error)
    return {
      success: false,
      error: "Error de conexion. Verifica tu internet.",
      code: "NETWORK_ERROR"
    }
  }
}

// ============================================
// CARGAR CONFIGURACIÓN
// ============================================

async function cargarConfiguracion(): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEY_CONFIG)
  if (result[STORAGE_KEY_CONFIG]) {
    configGlobal = { ...CONFIG_DEFAULT, ...result[STORAGE_KEY_CONFIG] }
  }

  // Also load auth session
  await getAuthSession()
}

// ============================================
// DETECTAR INPUTS DE CORREO
// ============================================

function esCampoDeCorreo(elemento: Element): boolean {
  const dominiosPermitidos = DOMINIOS_PERMITIDOS
  if (
    !dominiosPermitidos.some((dominio) =>
      window.location.hostname.includes(dominio)
    )
  ) {
    return false
  }

  if (
    !(
      elemento instanceof HTMLTextAreaElement ||
      elemento instanceof HTMLInputElement ||
      (elemento instanceof HTMLElement &&
        (elemento.getAttribute("contenteditable") === "true" ||
          elemento.getAttribute("role") === "textbox"))
    )
  ) {
    return false
  }

  const style = window.getComputedStyle(elemento)
  if (style.display === "none" || style.visibility === "hidden") {
    return false
  }

  const rect = elemento.getBoundingClientRect()
  // Allow smaller sizes for Outlook
  if (rect.width < 100 || rect.height < 30) {
    return false
  }

  const contenedorPadre = elemento.closest(
    '[class*="compose"], [class*="editor"], [class*="message"], [class*="mail"], [class*="inbox"], [class*="conversation"], [class*="reply"], [class*="forward"], [class*="body"], [class*="content"], [class*="rich"], [class*="plain"], [class*="scroll"], [class*="zone"], [class*="container"], [class*="item"], [role="dialog"], [role="textbox"], [aria-label*="body"], [aria-label*="message"], [aria-label*="compose"]'
  )
  if (contenedorPadre) {
    return true
  }

  const placeholder = elemento.getAttribute("placeholder")?.toLowerCase() || ""
  const ariaLabel = elemento.getAttribute("aria-label")?.toLowerCase() || ""
  const name = elemento.getAttribute("name")?.toLowerCase() || ""
  const id = elemento.getAttribute("id")?.toLowerCase() || ""
  const clases = elemento.getAttribute("class")?.toLowerCase() || ""
  const dataTestId = elemento.getAttribute("data-testid") || ""
  const role = elemento.getAttribute("role")?.toLowerCase() || ""

  const textoCompleto = `${placeholder} ${ariaLabel} ${name} ${id} ${clases} ${dataTestId} ${role}`

  const palabrasCampoMensaje = [
    "compose",
    "message",
    "body",
    "content",
    "editor",
    "redact",
    "reply",
    "forward",
    "textbox",
    "textarea",
    "mail",
    "email",
    "inbox",
    "richedit",
    "messagebody",
    "subject",
    "bodycontent",
    "messageBody",
    "readArea",
    " editing",
    "msgBody",
    "canvas",
    "skype"
  ]

  return palabrasCampoMensaje.some((palabra) => textoCompleto.includes(palabra))
}

// ============================================
// OBTENER TEXTO DEL INPUT
// ============================================

function obtenerTextoInput(input: HTMLElement): string {
  if (
    input instanceof HTMLTextAreaElement ||
    input instanceof HTMLInputElement
  ) {
    return input.value
  }
  if (input.getAttribute("contenteditable") === "true") {
    return input.textContent || ""
  }
  return ""
}

// ============================================
// ESTABLECER TEXTO EN INPUT
// ============================================

function establecerTextoInput(input: HTMLElement, texto: string): void {
  if (
    input instanceof HTMLTextAreaElement ||
    input instanceof HTMLInputElement
  ) {
    input.value = texto
    input.dispatchEvent(new Event("input", { bubbles: true }))
  } else if (input.getAttribute("contenteditable") === "true") {
    input.textContent = texto
    input.dispatchEvent(new Event("input", { bubbles: true }))
  }
}

// ============================================
// CREAR/MANEJAR BOTÓN
// ============================================

function crearBotonImproveAI(inputContainer: HTMLElement, input: HTMLElement) {
  if (inputContainer.querySelector(".improve-ai-btn")) return

  const button = document.createElement("button")
  button.className = "improve-ai-btn"
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
    Improve with AI
  `
  button.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 14px;
    margin-left: 8px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
  `

  button.onmouseover = () => {
    if (!button.disabled) {
      button.style.transform = "translateY(-1px)"
      button.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.5)"
    }
  }

  button.onmouseout = () => {
    if (!button.disabled) {
      button.style.transform = "translateY(0)"
      button.style.boxShadow = "0 2px 8px rgba(102, 126, 234, 0.4)"
    }
  }

  button.onclick = () => {
    mejorarConAI(input, button)
  }

  inputContainer.appendChild(button)
}

type BotonEstado =
  | "default"
  | "loading"
  | "checking"
  | "error"
  | "rate-limit"
  | "no-auth"
  | "limit-exceeded"

function actualizarBotonEstado(
  button: HTMLButtonElement,
  estado: BotonEstado,
  mensaje?: string
) {
  const baseStyle = `
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 14px;
    margin-left: 8px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  `

  switch (estado) {
    case "loading":
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; animation: spin 1s linear infinite;">
          <path d="M21 12a9 9 0 11-6.219-8.56"/>
        </svg>
        Mejorando...
      `
      button.disabled = true
      button.style.cssText =
        baseStyle +
        `
        background: #e9ecef;
        color: #999;
        cursor: not-allowed;
        box-shadow: none;
      `
      break

    case "checking":
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; animation: spin 1s linear infinite;">
          <path d="M21 12a9 9 0 11-6.219-8.56"/>
        </svg>
        ...
      `
      button.disabled = true
      button.style.cssText =
        baseStyle +
        `
        background: #e9ecef;
        color: #999;
        cursor: not-allowed;
        box-shadow: none;
      `
      break

    case "error":
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Error
      `
      button.disabled = false
      button.style.cssText =
        baseStyle +
        `
        background: #dc3545;
        color: white;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(220, 53, 69, 0.4);
      `
      // Reset to default after 3 seconds
      setTimeout(() => {
        if (button.dataset.errorReset === "true") {
          getAuthSession().then((session) => {
            actualizarBotonEstado(button, session ? "default" : "no-auth")
          })
          button.dataset.errorReset = ""
        }
      }, 3000)
      button.dataset.errorReset = "true"
      break

    case "rate-limit":
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12,6 12,12 16,14"/>
        </svg>
        Espera ${mensaje || "..."}
      `
      button.disabled = true
      button.style.cssText =
        baseStyle +
        `
        background: #ffc107;
        color: #333;
        cursor: not-allowed;
        box-shadow: none;
      `
      break

    case "no-auth":
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        Iniciar sesión
      `
      button.disabled = false
      button.style.cssText =
        baseStyle +
        `
        background: #6c757d;
        color: white;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(108, 117, 125, 0.4);
      `
      break

    case "limit-exceeded":
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
          <circle cx="12" cy="12" r="10"/>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
        Límite diario
      `
      button.disabled = true
      button.style.cssText =
        baseStyle +
        `
        background: #6c757d;
        color: white;
        cursor: not-allowed;
        box-shadow: none;
      `
      break

    case "default":
    default:
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        Improve with AI
      `
      button.disabled = false
      button.style.cssText =
        baseStyle +
        `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
      `
      break
  }
}

async function mejorarConAI(input: HTMLElement, button: HTMLButtonElement) {
  // Check if user is authenticated
  const session = await getAuthSession()
  if (!session) {
    actualizarBotonEstado(button, "no-auth")
    return
  }

  // Check rate limit (local, before API call)
  const { allowed, waitTime } = canMakeRequest()
  if (!allowed) {
    const seconds = Math.ceil(waitTime / 1000)
    actualizarBotonEstado(button, "rate-limit", `${seconds}s`)
    setTimeout(() => {
      actualizarBotonEstado(button, "default")
    }, waitTime)
    return
  }

  // Get input text
  const textoOriginal = obtenerTextoInput(input)

  // Show loading state
  actualizarBotonEstado(button, "loading")

  // Check cache first
  const cachedResponse = getCachedResponse(textoOriginal, configGlobal)
  if (cachedResponse) {
    establecerTextoInput(input, cachedResponse)
    actualizarBotonEstado(button, "default")
    return
  }

  // Consume a token
  consumeToken()

  // Call Supabase Edge Function
  const result = await callImproveEmailAPI(textoOriginal, configGlobal)

  if (result.success) {
    // Cache the response
    setCachedResponse(textoOriginal, configGlobal, result.text)
    // Set the improved text (use HTML if available for contenteditable)
    if (result.html && input.getAttribute("contenteditable") === "true") {
      input.innerHTML = result.html
      input.dispatchEvent(new Event("input", { bubbles: true }))
    } else {
      establecerTextoInput(input, result.text)
    }
    actualizarBotonEstado(button, "default")
  } else {
    // Handle error - result is ErrorResponse
    const errorResult = result as ErrorResponse
    console.error("AI Error:", errorResult.error)

    if (errorResult.code === "LIMIT_EXCEEDED") {
      actualizarBotonEstado(button, "limit-exceeded")
    } else if (errorResult.code === "SESSION_EXPIRED") {
      actualizarBotonEstado(button, "no-auth")
    } else {
      actualizarBotonEstado(button, "error")
    }
  }
}

// ============================================
// ENVOLVER INPUT
// ============================================

async function envolverInput(input: HTMLElement) {
  if (input.dataset.aiEnhancerActive) return

  if (!esCampoDeCorreo(input)) return

  input.dataset.aiEnhancerActive = "true"

  const wrapper = document.createElement("div")
  wrapper.className = "ai-enhancer-wrapper"
  wrapper.style.cssText = `
    display: flex;
    align-items: flex-start;
    gap: 0;
  `

  const parent = input.parentElement
  if (!parent) return

  const parentStyle = window.getComputedStyle(parent)
  if (parentStyle.display === "flex" || parentStyle.display === "inline-flex") {
    crearBotonImproveAI(parent, input)
    return
  }

  parent.insertBefore(wrapper, input)
  wrapper.appendChild(input)

  // Create button immediately in "checking" state
  crearBotonImproveAI(wrapper, input)
  const button = wrapper.querySelector(".improve-ai-btn") as HTMLButtonElement

  // Check auth asynchronously and update button
  const session = await getAuthSession()
  if (button && button.isConnected) {
    if (session) {
      actualizarBotonEstado(button, "default")
    } else {
      actualizarBotonEstado(button, "no-auth")
    }
  }
}

// ============================================
// INICIALIZACIÓN
// ============================================

async function inicializar() {
  // Cargar configuración y auth
  await cargarConfiguracion()

  // Listener para cambios en storage
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[STORAGE_KEY_CONFIG]) {
      configGlobal = {
        ...CONFIG_DEFAULT,
        ...changes[STORAGE_KEY_CONFIG].newValue
      }
      invalidateCache()
    }

    if (changes[SUPABASE_AUTH_KEY]) {
      const rawAuth = changes[SUPABASE_AUTH_KEY].newValue

      // Solo procesar si hay un valor real
      if (rawAuth && typeof rawAuth !== "string") {
        authSession = rawAuth
        document.querySelectorAll(".improve-ai-btn").forEach((btn) => {
          actualizarBotonEstado(btn as HTMLButtonElement, "default")
        })
      } else if (typeof rawAuth === "string" && rawAuth.trim() !== "") {
        try {
          authSession = JSON.parse(rawAuth)
          document.querySelectorAll(".improve-ai-btn").forEach((btn) => {
            actualizarBotonEstado(btn as HTMLButtonElement, "default")
          })
        } catch {
          // JSON invalido, ignorar
        }
      }
    }
  })

  // Message listener for direct communication from popup
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "AUTH_CHANGED") {
      if (message.isAuthenticated) {
        // Fetch fresh session and update buttons
        getAuthSession().then((session) => {
          if (session) {
            document.querySelectorAll(".improve-ai-btn").forEach((btn) => {
              actualizarBotonEstado(btn as HTMLButtonElement, "default")
            })
          }
        })
      } else {
        // User logged out - clear session and update buttons
        authSession = null
        document.querySelectorAll(".improve-ai-btn").forEach((btn) => {
          actualizarBotonEstado(btn as HTMLButtonElement, "no-auth")
        })
      }
    }
  })

  // Buscar textareas y elementos contenteditable
  const elementos = document.querySelectorAll(
    "textarea, div[contenteditable='true']"
  )

  elementos.forEach((el) => {
    if (esCampoDeCorreo(el)) {
      envolverInput(el as HTMLElement)
    }
  })

  // Observer para nuevos elementos y cambios
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // Ver nodos agregados
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLTextAreaElement) {
          if (esCampoDeCorreo(node)) {
            envolverInput(node)
          }
        } else if (node instanceof HTMLElement) {
          if (
            node.getAttribute("contenteditable") === "true" &&
            esCampoDeCorreo(node)
          ) {
            envolverInput(node)
          }
          // Buscar dentro del nodo
          node
            .querySelectorAll("textarea, [contenteditable='true']")
            .forEach((el) => {
              if (esCampoDeCorreo(el)) {
                envolverInput(el as HTMLElement)
              }
            })
        }
      })

      // También verificar nodos modificados (cuando Gmail re-renderiza)
      if (mutation.target) {
        const target = mutation.target as HTMLElement
        if (
          target.tagName === "TEXTAREA" ||
          target.getAttribute("contenteditable") === "true"
        ) {
          if (esCampoDeCorreo(target) && !target.dataset.aiEnhancerActive) {
            envolverInput(target)
          }
        }
      }
    })
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["contenteditable"]
  })

  // Verificación periódica cada 2 segundos (para cuando Gmail re-renderiza)
  setInterval(() => {
    const elementos = document.querySelectorAll(
      "textarea:not([data-ai-enhancer-active]), div[contenteditable='true']:not([data-ai-enhancer-active])"
    )
    elementos.forEach((el) => {
      if (esCampoDeCorreo(el)) {
        envolverInput(el as HTMLElement)
      }
    })
  }, 2000)
}

// Iniciar
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializar)
} else {
  inicializar()
}
