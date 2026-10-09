/**
 * In-memory rate limiter for development/self-hosted environments
 * For production on Vercel, consider using Upstash
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (user ID or IP address)
 * @param limit - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60 * 60 * 1000 // 1 hour default
): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // Clean up expired entries
  if (entry && now > entry.resetTime) {
    rateLimitStore.delete(identifier);
    const newEntry: RateLimitEntry = { count: 1, resetTime: now + windowMs };
    rateLimitStore.set(identifier, newEntry);
    return true;
  }

  // Entry doesn't exist, create new one
  if (!entry) {
    const newEntry: RateLimitEntry = { count: 1, resetTime: now + windowMs };
    rateLimitStore.set(identifier, newEntry);
    return true;
  }

  // Increment count
  entry.count++;

  // Check if limit exceeded
  if (entry.count > limit) {
    return false;
  }

  return true;
}

/**
 * Get remaining quota for a rate limited identifier
 */
export function getRateLimitStatus(
  identifier: string,
  limit: number = 10
): { remaining: number; resetTime: number } {
  const entry = rateLimitStore.get(identifier);

  if (!entry) {
    return { remaining: limit, resetTime: Date.now() + 60 * 60 * 1000 };
  }

  return {
    remaining: Math.max(0, limit - entry.count),
    resetTime: entry.resetTime
  };
}

/**
 * Reset rate limit for a specific identifier
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}
