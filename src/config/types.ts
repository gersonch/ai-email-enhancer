export type Estilo = "formal" | "casual" | "friendly"

export interface Configuracion {
  estilo: Estilo
  humanizado: number
  incluirFirma: boolean
  emojis: boolean
  maxLongitud: number
  idioma: string
}

export interface Idioma {
  code: string
  name: string
  flag: string
}

export interface EstiloTextos {
  inicio: string
  fin: string
  emoji: string
}
