interface RateLimitRecord {
  timestamps: number[];
  expiresAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanupExpired(now: number = Date.now()) {
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.expiresAt <= now || record.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}

// Background cleanup timer that does not keep Node process alive
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    cleanupExpired(Date.now());
  }, CLEANUP_INTERVAL_MS);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

export function checkRateLimit(
  key: string,
  maxAttempts: number = 10,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number } {
  const now = Date.now();

  // On-demand periodic sweep to guarantee cleanup even without background timers
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    cleanupExpired(now);
    lastCleanup = now;
  }

  const windowStart = now - windowMs;
  let record = rateLimitStore.get(key);

  if (!record) {
    record = { timestamps: [], expiresAt: now + windowMs };
    rateLimitStore.set(key, record);
  } else {
    // Sliding window: filter out timestamps outside current window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
  }

  if (record.timestamps.length >= maxAttempts) {
    record.expiresAt = Math.max(record.expiresAt, now + windowMs);
    return {
      allowed: false,
      remaining: 0,
    };
  }

  record.timestamps.push(now);
  record.expiresAt = Math.max(record.expiresAt, now + windowMs);

  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - record.timestamps.length),
  };
}
