import { createClient, SupabaseClient } from "@supabase/supabase-js"

import type { Configuracion } from "../config"

// =============================================
// TYPES
// =============================================

export interface ImproveResult {
  success: true
  text: string
  apiKeySource: "developer" | "user"
}

export interface ImproveError {
  success: false
  error: string
  code?: string
}

export type ImproveResponse = ImproveResult | ImproveError

export interface AuthUser {
  id: string
  email: string
  plan?: "free" | "paid"
  hasOwnApiKey?: boolean
}

export interface AuthSession {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: AuthUser
}

// Storage adapter type for Supabase v2
interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

// =============================================
// CONSTANTS
// =============================================

const SUPABASE_URL = "https://ibpsesbmnosfrblwzzhn.supabase.co"
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlicHNlc2Jtbm9zZnJibHd6emhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTk4MTMsImV4cCI6MjA5MDk3NTgxM30.SdH-NlXp-c9MWSGAn0sMKK5_GfbEuNc7NIsyA8fHQpM"

// Key used by Supabase to store session
const SUPABASE_AUTH_KEY = "sb-ibpsesbmnosfrblwzzhn-auth-token"

// =============================================
// CHROME STORAGE ADAPTER
// =============================================

const chromeStorageAdapter: StorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key] ?? null)
      })
    })
  },

  setItem: async (key: string, value: string): Promise<void> => {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve()
      })
    })
  },

  removeItem: async (key: string): Promise<void> => {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, () => {
        resolve()
      })
    })
  }
}

// =============================================
// SUPABASE CLIENT
// =============================================

let supabaseClient: SupabaseClient | null = null

function createSupabaseClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      storage: chromeStorageAdapter,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  })
}

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient()
  }
  return supabaseClient
}

// =============================================
// AUTH FUNCTIONS
// =============================================

export async function signUp(
  email: string,
  password: string
): Promise<{ error?: string }> {
  const supabase = getSupabaseClient()

  const { error } = await supabase.auth.signUp({
    email,
    password
  })

  if (error) {
    return { error: error.message }
  }

  return {}
}

export async function signIn(
  email: string,
  password: string
): Promise<{ error?: string }> {
  const supabase = getSupabaseClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    return { error: error.message }
  }

  return {}
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient()
  await supabase.auth.signOut()
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = getSupabaseClient()
  const { data } = await supabase.auth.getUser()

  if (!data.user) return null

  return {
    id: data.user.id,
    email: data.user.email || ""
  }
}

export async function getSession(): Promise<AuthSession | null> {
  const supabase = getSupabaseClient()

  // getSession() will use the persisted session from chrome.storage
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    console.error("Session error:", error)
    return null
  }

  if (!data.session) return null

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    user: {
      id: data.session.user.id,
      email: data.session.user.email || ""
    }
  }
}

// =============================================
// VERIFY SESSION WITH SERVER
// =============================================

export async function verifySession(): Promise<{
  valid: boolean
  user: AuthUser | null
}> {
  const supabase = getSupabaseClient()

  // getUser() makes a request to verify the JWT is still valid
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    return { valid: false, user: null }
  }

  return {
    valid: true,
    user: {
      id: data.user.id,
      email: data.user.email || ""
    }
  }
}

// =============================================
// USER API KEY (BYOK)
// =============================================

export async function saveUserApiKey(
  apiKey: string
): Promise<{ error?: string }> {
  const supabase = getSupabaseClient()
  const session = await getSession()

  if (!session) {
    return { error: "No hay sesion activa" }
  }

  // Send plain API key to server - server will encrypt it
  const { error } = await supabase.rpc("save_user_encrypted_api_key", {
    p_api_key: apiKey
  })

  if (error) {
    return { error: error.message }
  }

  return {}
}

export async function removeUserApiKey(): Promise<{ error?: string }> {
  const supabase = getSupabaseClient()
  const session = await getSession()

  if (!session) {
    return { error: "No hay sesion activa" }
  }

  // Use the RPC function that removes the API key AND updates has_own_api_key
  const { error } = await supabase.rpc("remove_user_api_key", {
    p_user_id: session.user.id
  })

  if (error) {
    return { error: error.message }
  }

  return {}
}

export async function hasUserApiKey(): Promise<boolean> {
  const supabase = getSupabaseClient()
  const session = await getSession()

  if (!session) {
    return false
  }

  const { data, error } = await supabase
    .from("user_api_keys")
    .select("id")
    .eq("user_id", session.user.id)
    .single()

  if (error || !data) {
    return false
  }

  return true
}

// =============================================
// MAIN API FUNCTION
// =============================================

export async function improveText(
  text: string,
  config: Configuracion
): Promise<ImproveResponse> {
  const supabase = getSupabaseClient()
  const session = await getSession()

  if (!session) {
    return {
      success: false,
      error: "Debes iniciar sesion para usar esta funcion",
      code: "NOT_AUTHENTICATED"
    }
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/improve-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ text, config })
  })

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: "Unknown error" }))

    if (response.status === 401) {
      return {
        success: false,
        error: "Sesion expirada. Por favor, inicia sesion nuevamente.",
        code: "SESSION_EXPIRED"
      }
    }

    if (response.status === 429) {
      return {
        success: false,
        error:
          errorData.error || "Has alcanzado el limite de requests diarios.",
        code: "LIMIT_EXCEEDED"
      }
    }

    return {
      success: false,
      error: errorData.error || "Error en el servidor",
      code: "SERVER_ERROR"
    }
  }

  const data = await response.json()
  return data
}

// =============================================
// HELPERS
// =============================================

export function isAuthenticated(): Promise<boolean> {
  return getCurrentUser().then((user) => user !== null)
}
