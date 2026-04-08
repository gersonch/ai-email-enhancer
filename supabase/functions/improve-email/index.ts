// =============================================
// AI Email Enhancer - Edge Function
// improve-email
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type"
}

// =============================================
// CONFIG (from Supabase Secrets)
// =============================================

const DEV_OPENAI_API_KEY = Deno.env.get("DEV_OPENAI_API_KEY")!
const ENCRYPTION_KEY = Deno.env.get("ENCRYPTION_KEY")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!

// Rate limiter using in-memory (simple fallback)
const requestTimestamps: Map<string, number[]> = new Map()

function checkRateLimit(
  userId: string,
  maxRequests: number = 20,
  windowMs: number = 60000
): boolean {
  const now = Date.now()
  const timestamps = requestTimestamps.get(userId) || []

  // Filter to last window
  const recentTimestamps = timestamps.filter((ts) => now - ts < windowMs)

  if (recentTimestamps.length >= maxRequests) {
    return false
  }

  recentTimestamps.push(now)
  requestTimestamps.set(userId, recentTimestamps)
  return true
}

// =============================================
// TYPES
// =============================================

interface ImproveRequest {
  text: string
  config: {
    estilo: "formal" | "casual" | "friendly"
    humanizado: number
    incluirFirma: boolean
    emojis: boolean
    maxLongitud: number
    idioma: string
  }
}

function sanitizeConfig(config: any): ImproveRequest["config"] {
  const validEstilos = ["formal", "casual", "friendly"]
  const validIdiomas = ["es", "en", "pt", "fr", "de", "it"]

  return {
    estilo: validEstilos.includes(config?.estilo) ? config.estilo : "formal",
    humanizado: Math.min(100, Math.max(0, parseInt(config?.humanizado) || 50)),
    incluirFirma: Boolean(config?.incluirFirma),
    emojis: Boolean(config?.emojis),
    maxLongitud: Math.min(
      5000,
      Math.max(100, parseInt(config?.maxLongitud) || 1000)
    ),
    idioma: validIdiomas.includes(config?.idioma) ? config.idioma : "es"
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

// =============================================
// HELPERS
// =============================================

const SYSTEM_PROMPT = `Eres un asistente especializado en redacción y mejora de emails.

REGLAS:
1. Si el usuario escribió texto: MEJORA ese texto manteniendo la intención original
   - Corrige gramática y ortografía
   - Mejora claridad y fluidez
2. Si el usuario NO escribió nada: GENERA un email de ejemplo apropiado
3. Detecta el idioma del texto INPUT y TRADÚCELO al idioma configurado
4. Estilo: [FORMAL/CASUAL/FRIENDLY]
5. Nivel de humanización [0-100]:
   - 0%: texto perfecto pero genérico, sin opiniones ni emociones
   - 100%: muy natural, contracciones (can't, I'm), expresiones casuales
6. Solo usa emojis en estilo FRIENDLY
7. Resumir si excede [MAX] caracteres

OUTPUT - IMPORTANTE: Devuelve HTML formateado con estos separadores:
- Usa "---SALUDO---" para indicar el inicio del saludo
- Usa "---CUERPO---" para indicar el inicio del cuerpo
- Usa "---DESPEDIDA---" para indicar el inicio de la despedida

Ejemplo de formato de salida:
---SALUDO---
<p>Estimado/a Juan,</p>
---CUERPO---
<p>Gracias por su mensaje. He revisado la documentación y...</p>
<p>正文内容...</p>
---DESPEDIDA---
<p>Saludos cordiales,</p>
<p>MiNombre</p>

Usa etiquetas <p> para párrafos.`

const ESTILOS: Record<string, { inicio: string; fin: string }> = {
  formal: { inicio: "Estimado/a", fin: "Atentamente" },
  casual: { inicio: "Hola", fin: "Saludos" },
  friendly: { inicio: "¡Hola!", fin: "¡Saludos!" }
}

const NOMBRES_IDIOMA: Record<string, string> = {
  es: "Español",
  en: "Inglés",
  pt: "Portugués",
  fr: "Francés",
  de: "Alemán",
  it: "Italiano"
}

function buildUserPrompt(
  text: string,
  config: ImproveRequest["config"]
): string {
  const idioma = NOMBRES_IDIOMA[config.idioma] || config.idioma
  const estiloInfo = ESTILOS[config.estilo]
  const humanizadoNivel =
    config.humanizado < 33
      ? "bajo (0-33%)"
      : config.humanizado < 66
        ? "medio (34-65%)"
        : "alto (66-100%)"

  // Sanitize user input to prevent prompt injection
  // Escape any attempt to break out of the context
  const sanitizedText = text
    .trim()
    .replace(/---SALUDO---/gi, "")
    .replace(/---CUERPO---/gi, "")
    .replace(/---DESPEDIDA---/gi, "")
    .replace(/\n---/g, "\n") // Remove separator patterns

  const prompt = sanitizedText || "(Campo vacío - generar email de ejemplo)"

  const fullPrompt =
    prompt +
    `\n---\n` +
    `Mejorar según:\n` +
    `- Idioma: ${idioma}\n` +
    `- Estilo: ${config.estilo} (saludo: "${estiloInfo.inicio}", despedida: "${estiloInfo.fin}")\n` +
    `- Humanización: ${humanizadoNivel} (valor: ${config.humanizado}%)\n` +
    `- Emojis: ${config.emojis && config.estilo === "friendly" ? "Sí" : "No"}\n` +
    `- Máx. caracteres: ${config.maxLongitud}\n` +
    `- Incluir firma: ${config.incluirFirma ? "Sí" : "No"}`

  return fullPrompt
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text

  const truncated = text.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(" ")

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + "..."
  }

  return truncated + "..."
}

// =============================================
// JWT DECODE (Manual validation since Supabase JWT verification is disabled)
// =============================================

function decodeJWT(
  token: string
): { sub: string; email: string; exp: number } | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null

    // Decode payload
    const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const payloadBytes = Uint8Array.from(atob(payloadBase64), (c) =>
      c.charCodeAt(0)
    )
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes))

    return {
      sub: payload.sub || "",
      email: payload.email || "",
      exp: payload.exp || 0
    }
  } catch {
    return null
  }
}

// =============================================
// ENCRYPTION (Simple obfuscation - base64)
// Note: This is NOT real encryption, just encoding.
// For production, implement proper AES encryption with key management.
// =============================================

async function decryptApiKey(ciphertext: string): Promise<string> {
  // Database stores as base64, so decode it
  try {
    const decoded = atob(ciphertext)
    return decoded
  } catch {
    throw new Error("Invalid encoded key")
  }
}

// =============================================
// MAIN HANDLER
// =============================================
// OPENAI CALL
// =============================================

interface ImproveResponse {
  success: true
  text: string
  apiKeySource: "developer" | "user"
}

async function callOpenAI(
  apiKey: string,
  text: string,
  config: ImproveRequest["config"]
): Promise<{ text: string; html: string }> {
  const truncatedInput = truncateText(text, 4000)

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(truncatedInput, config) }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      error.error?.message || `OpenAI API error: ${response.status}`
    )
  }

  const data = await response.json()
  const rawText = data.choices[0]?.message?.content?.trim()

  if (!rawText) {
    throw new Error("No se recibió respuesta de la API")
  }

  // Parse the formatted response
  const greetingMatch = rawText.match(
    /---SALUDO---\s*([\s\S]*?)(?=---CUERPO---|$)/
  )
  const bodyMatch = rawText.match(
    /---CUERPO---\s*([\s\S]*?)(?=---DESPEDIDA---|$)/
  )
  const closingMatch = rawText.match(/---DESPEDIDA---\s*([\s\S]*?)$/)

  const greeting = greetingMatch ? greetingMatch[1].trim() : ""
  const body = bodyMatch ? bodyMatch[1].trim() : rawText
  const closing = closingMatch ? closingMatch[1].trim() : ""

  // Clean up extra whitespace and newlines in each part
  const cleanPart = (part: string) =>
    part.replace(/\n+/g, " ").replace(/\s+/g, " ").trim()

  // Build HTML with proper formatting
  let htmlParts: string[] = []
  if (greeting) htmlParts.push(cleanPart(greeting))
  if (body) htmlParts.push(cleanPart(body))
  if (closing) htmlParts.push(cleanPart(closing))

  // Join with single <br> between parts
  const html = htmlParts.join("\n")

  // Plain text version - single newlines
  const textVersion = htmlParts.join("\n")

  return {
    text: truncateText(textVersion, config.maxLongitud),
    html: truncateText(html, config.maxLongitud * 2)
  }
}

// =============================================
// MAIN HANDLER
// =============================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // =============================================
    // 1. VALIDATE JWT
    // =============================================
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No authorization token provided",
          code: "NO_AUTH"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    const token = authHeader.replace("Bearer ", "")

    // Decode JWT manually (to get userId)
    const payload = decodeJWT(token)
    if (!payload || !payload.sub) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid JWT token",
          code: "INVALID_TOKEN"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Token expired",
          code: "TOKEN_EXPIRED"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    // Verify token with Supabase API
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY
      }
    })

    if (!userResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Token verification failed",
          code: "INVALID_TOKEN"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    const userData = await userResponse.json()
    const userId = userData.id

    // =============================================
    // 2. CHECK RATE LIMIT (in-memory)
    // =============================================
    if (!checkRateLimit(userId, 20, 60000)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Too many requests. Please wait a moment.",
          code: "RATE_LIMITED",
          retryAfter: 60
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": "60"
          }
        }
      )
    }

    // =============================================
    // 3. CREATE SUPABASE CLIENT
    // =============================================
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // =============================================
    // 4. CHECK USER LIMITS
    // =============================================
    const { data: limitCheck, error: limitErr } = await supabase.rpc(
      "check_user_limit",
      { p_user_id: userId }
    )

    if (limitErr) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Error checking limits",
          code: "LIMIT_ERROR"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    if (!limitCheck.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            limitCheck.reason === "limit_exceeded"
              ? `Has alcanzado el límite diario de ${limitCheck.limit} requests. Prueba mañana o añade tu propia API key.`
              : "No tienes acceso a este servicio",
          code: "LIMIT_EXCEEDED"
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    // =============================================
    // 5. PARSE REQUEST
    // =============================================
    const rawBody = await req.json()

    // Sanitize inputs
    const text =
      typeof rawBody.text === "string"
        ? rawBody.text.substring(0, 10000) // Limit text length
        : ""

    const config = sanitizeConfig(rawBody.config)

    if (!text.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Text is required",
          code: "INVALID_REQUEST"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    // =============================================
    // 5. DETERMINE API KEY SOURCE
    // =============================================
    let apiKey: string
    let apiKeySource: "developer" | "user" = "developer"

    if (limitCheck.reason === "own_key") {
      const { data: encryptedKey } = await supabase.rpc(
        "get_user_encrypted_key",
        { p_user_id: userId }
      )
      if (!encryptedKey) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "API key no encontrada",
            code: "KEY_NOT_FOUND"
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        )
      }
      try {
        apiKey = await decryptApiKey(encryptedKey)
        apiKeySource = "user"
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Error al desencriptar API key",
            code: "DECRYPT_ERROR"
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        )
      }
    } else {
      if (!DEV_OPENAI_API_KEY) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "API key del desarrollador no configurada",
            code: "DEV_KEY_MISSING"
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        )
      }
      apiKey = DEV_OPENAI_API_KEY
    }

    // =============================================
    // 6. CALL OPENAI
    // =============================================
    let result: { text: string; html: string }
    try {
      result = await callOpenAI(apiKey, text, config)
    } catch (openaiErr) {
      await supabase.from("usage_logs").insert({
        user_id: userId,
        success: false,
        error_message:
          openaiErr instanceof Error ? openaiErr.message : "Unknown error"
      })
      return new Response(
        JSON.stringify({
          success: false,
          error:
            openaiErr instanceof Error
              ? openaiErr.message
              : "Error al llamar OpenAI",
          code: "OPENAI_ERROR"
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    // =============================================
    // 7. UPDATE COUNTERS & LOG
    // =============================================
    await supabase.rpc("increment_request_count", { p_user_id: userId })
    await supabase.from("usage_logs").insert({
      user_id: userId,
      success: true,
      model_used: "gpt-3.5-turbo"
    })

    // =============================================
    // 8. RETURN RESPONSE
    // =============================================
    return new Response(
      JSON.stringify({
        success: true,
        text: result.text,
        html: result.html,
        apiKeySource
      } as ImproveResponse),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  } catch (err) {
    console.error("Unexpected error:", err)
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
        code: "INTERNAL_ERROR"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})
