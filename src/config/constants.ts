import type { Configuracion, Estilo, EstiloTextos, Idioma } from "./types"

export const CONFIG_DEFAULT: Configuracion = {
  estilo: "friendly",
  humanizado: 50,
  incluirFirma: true,
  emojis: true,
  maxLongitud: 200,
  idioma: "es"
}

export const IDIOMAS: Idioma[] = [
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "pt", name: "Português", flag: "🇧🇷" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italiano", flag: "🇮🇹" }
]

export const TEXTOS_POR_ESTILO: Record<Estilo, EstiloTextos> = {
  formal: {
    inicio: "Estimado/a",
    fin: "Atentamente",
    emoji: "📄"
  },
  casual: {
    inicio: "Hola",
    fin: "Saludos",
    emoji: "💬"
  },
  friendly: {
    inicio: "¡Hey!",
    fin: "¡Abrazo!",
    emoji: "👋"
  }
}

export const NOMBRES_IDIOMA: Record<string, string> = {
  es: "Español",
  en: "English",
  pt: "Português",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano"
}

export const HUMANIZADO_LABELS = {
  bajo: "😐 Neutro",
  medio: "😊 Amigable",
  alto: "🤗 Muy Natural"
} as const
