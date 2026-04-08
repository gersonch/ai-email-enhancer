import type { Configuracion } from "./types"
import { CONFIG_DEFAULT } from "./constants"

const STORAGE_KEY_CONFIG = "aiEmailConfig"
const STORAGE_KEY_API_KEY = "openai_api_key"

export function guardarConfig(config: Configuracion): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY_CONFIG]: config }, () => {
      resolve()
    })
  })
}

export function cargarConfig(): Promise<Configuracion> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_CONFIG], (result) => {
      const config = result[STORAGE_KEY_CONFIG]
        ? { ...CONFIG_DEFAULT, ...result[STORAGE_KEY_CONFIG] }
        : CONFIG_DEFAULT
      resolve(config)
    })
  })
}

export function subscribeToChanges(
  callback: (config: Configuracion) => void
): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
    if (changes[STORAGE_KEY_CONFIG]) {
      callback({ ...CONFIG_DEFAULT, ...changes[STORAGE_KEY_CONFIG].newValue })
    }
  }

  chrome.storage.onChanged.addListener(listener)

  return () => {
    chrome.storage.onChanged.removeListener(listener)
  }
}

// ============================================
// API KEY STORAGE
// ============================================

export function guardarApiKey(apiKey: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY_API_KEY]: apiKey }, () => {
      resolve()
    })
  })
}

export function cargarApiKey(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_API_KEY], (result) => {
      resolve(result[STORAGE_KEY_API_KEY] || null)
    })
  })
}

export function eliminarApiKey(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove([STORAGE_KEY_API_KEY], () => {
      resolve()
    })
  })
}
