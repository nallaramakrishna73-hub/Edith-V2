import { config } from './config.ts';

interface RateRecord {
  timestamps: number[];
}

const clientHistory = new Map<string, RateRecord>();

// Clean up stale client entries every 5 minutes
setInterval(() => {
  const oneMinuteAgo = Date.now() - 60000;
  for (const [key, record] of clientHistory.entries()) {
    record.timestamps = record.timestamps.filter(ts => ts > oneMinuteAgo);
    if (record.timestamps.length === 0) {
      clientHistory.delete(key);
    }
  }
}, 300000);

export function checkRateLimit(clientKey: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  let record = clientHistory.get(clientKey);
  if (!record) {
    record = { timestamps: [] };
    clientHistory.set(clientKey, record);
  }

  // Filter timestamps within the last 60 seconds
  record.timestamps = record.timestamps.filter(ts => ts > oneMinuteAgo);

  if (record.timestamps.length >= config.RATE_LIMIT_PER_MINUTE) {
    return {
      allowed: false,
      remaining: 0,
    };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    remaining: config.RATE_LIMIT_PER_MINUTE - record.timestamps.length,
  };
}
