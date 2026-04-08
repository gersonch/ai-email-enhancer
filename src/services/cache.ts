import type { Configuracion } from "../config"

// ============================================
// CONSTANTS
// ============================================

const RATE_LIMIT_MAX = 10 // requests
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute in ms
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes in ms

// ============================================
// TYPES
// ============================================

interface CacheEntry {
  response: string
  timestamp: number
}

interface RateLimitState {
  tokens: number
  lastRefill: number
}

// ============================================
// CACHE
// ============================================

const responseCache = new Map<string, CacheEntry>()

function generateCacheKey(text: string, config: Configuracion): string {
  const configString = JSON.stringify({
    idioma: config.idioma,
    estilo: config.estilo,
    humanizado: config.humanizado,
    emojis: config.emojis,
    maxLongitud: config.maxLongitud,
    incluirFirma: config.incluirFirma
  })

  // Simple hash function
  let hash = 0
  const combined = text + configString
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }

  return hash.toString(36)
}

export function getCachedResponse(text: string, config: Configuracion): string | null {
  const key = generateCacheKey(text, config)
  const entry = responseCache.get(key)

  if (!entry) return null

  // Check if expired
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    responseCache.delete(key)
    return null
  }

  return entry.response
}

export function setCachedResponse(text: string, config: Configuracion, response: string): void {
  const key = generateCacheKey(text, config)
  responseCache.set(key, {
    response,
    timestamp: Date.now()
  })
}

export function invalidateCache(): void {
  responseCache.clear()
}

// ============================================
// RATE LIMITER (Token Bucket)
// ============================================

let rateLimitState: RateLimitState = {
  tokens: RATE_LIMIT_MAX,
  lastRefill: Date.now()
}

function refillTokens(): void {
  const now = Date.now()
  const timePassed = now - rateLimitState.lastRefill

  // Calculate tokens to add (1 token per window/RATE_LIMIT_MAX)
  const tokensToAdd = Math.floor((timePassed / RATE_LIMIT_WINDOW) * RATE_LIMIT_MAX)

  if (tokensToAdd > 0) {
    rateLimitState.tokens = Math.min(RATE_LIMIT_MAX, rateLimitState.tokens + tokensToAdd)
    rateLimitState.lastRefill = now
  }
}

export function canMakeRequest(): { allowed: boolean; waitTime: number } {
  refillTokens()

  if (rateLimitState.tokens > 0) {
    return { allowed: true, waitTime: 0 }
  }

  // Calculate wait time until next token
  const timeSinceLastRefill = Date.now() - rateLimitState.lastRefill
  const waitTime = RATE_LIMIT_WINDOW - timeSinceLastRefill

  return { allowed: false, waitTime: Math.max(0, waitTime) }
}

export function consumeToken(): boolean {
  refillTokens()

  if (rateLimitState.tokens > 0) {
    rateLimitState.tokens -= 1
    return true
  }

  return false
}

export function getRemainingRequests(): number {
  refillTokens()
  return rateLimitState.tokens
}

export function getRateLimitInfo(): { remaining: number; max: number; resetIn: number } {
  refillTokens()
  const timeSinceLastRefill = Date.now() - rateLimitState.lastRefill

  return {
    remaining: rateLimitState.tokens,
    max: RATE_LIMIT_MAX,
    resetIn: Math.max(0, RATE_LIMIT_WINDOW - timeSinceLastRefill)
  }
}

// ============================================
// RESET (for testing)
// ============================================

export function resetRateLimiter(): void {
  rateLimitState = {
    tokens: RATE_LIMIT_MAX,
    lastRefill: Date.now()
  }
}
