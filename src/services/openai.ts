import OpenAI from "openai"
import type { Configuracion } from "../config"
import { TEXTOS_POR_ESTILO, NOMBRES_IDIOMA } from "../config"

// ============================================
// TYPES
// ============================================

export interface ImproveResult {
  success: true
  text: string
}

export interface ImproveError {
  success: false
  error: string
}

export type ImproveResponse = ImproveResult | ImproveError

// ============================================
// SYSTEM PROMPT
// ============================================

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
8. Incluir saludo y despedida según estilo si "incluirFirma" es true

OUTPUT:
- Devuelve ÚNICAMENTE el texto mejorado/generado
- Sin explicaciones ni comentarios adicionales
- Texto coherente y natural`

// ============================================
// HELPERS
// ============================================

function buildUserPrompt(text: string, config: Configuracion): string {
  const idioma = NOMBRES_IDIOMA[config.idioma] || config.idioma
  const estiloInfo = TEXTOS_POR_ESTILO[config.estilo]
  const humanizadoNivel =
    config.humanizado < 33 ? "bajo (0-33%)" :
    config.humanizado < 66 ? "medio (34-65%)" :
    "alto (66-100%)"

  let prompt = text.trim() || "(Campo vacío - generar email de ejemplo)"

  prompt += `\n---\n`
  prompt += `Mejorar según:\n`
  prompt += `- Idioma: ${idioma}\n`
  prompt += `- Estilo: ${config.estilo} (saludo: "${estiloInfo.inicio}", despedida: "${estiloInfo.fin}")\n`
  prompt += `- Humanización: ${humanizadoNivel} (valor: ${config.humanizado}%)\n`
  prompt += `- Emojis: ${config.emojis && config.estilo === "friendly" ? "Sí" : "No"}\n`
  prompt += `- Máx. caracteres: ${config.maxLongitud}\n`
  prompt += `- Incluir firma: ${config.incluirFirma ? "Sí" : "No"}`

  return prompt
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text

  // Try to truncate at word boundary
  const truncated = text.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(" ")

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + "..."
  }

  return truncated + "..."
}

// ============================================
// OPENAI CLIENT
// ============================================

let openaiClient: OpenAI | null = null

export function initOpenAIClient(apiKey: string): void {
  openaiClient = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true // Required for Chrome extension
  })
}

export function isOpenAIInitialized(): boolean {
  return openaiClient !== null
}

// ============================================
// MAIN FUNCTION
// ============================================

export async function improveText(
  text: string,
  config: Configuracion
): Promise<ImproveResponse> {
  if (!openaiClient) {
    return {
      success: false,
      error: "API Key no configurada"
    }
  }

  // Truncate input if too long (GPT-4 has 128k, but 3.5-turbo has 16k)
  const maxInputLength = 4000
  const truncatedInput = truncateText(text, maxInputLength)

  try {
    const completion = await openaiClient.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(truncatedInput, config) }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })

    const improvedText = completion.choices[0]?.message?.content?.trim()

    if (!improvedText) {
      return {
        success: false,
        error: "No se recibió respuesta de la API"
      }
    }

    // Apply max length constraint
    const finalText = truncateText(improvedText, config.maxLongitud)

    return {
      success: true,
      text: finalText
    }
  } catch (error) {
    // Handle specific OpenAI errors
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        return {
          success: false,
          error: "API Key inválida"
        }
      }
      if (error.status === 429) {
        return {
          success: false,
          error: "Límite de requests excedido"
        }
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido"
    }
  }
}
