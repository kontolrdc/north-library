type RateLimitState = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitState>();

export function checkRateLimit(
  key: string,
  config: {
    windowMs: number;
    maxRequests: number;
  }
): {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
} {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    const resetAt = now + config.windowMs;
    rateLimitBuckets.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - 1),
      retryAfterMs: config.windowMs,
    };
  }

  if (bucket.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, bucket.resetAt - now),
    };
  }

  bucket.count += 1;

  return {
    allowed: true,
    remaining: Math.max(0, config.maxRequests - bucket.count),
    retryAfterMs: Math.max(0, bucket.resetAt - now),
  };
}

export function getClientIdentifier(request: Request, suffix: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = (forwarded?.split(',')[0] ?? realIp ?? 'unknown-ip').trim() || 'unknown-ip';
  return `${ip}:${suffix}`;
}
