import { AppError } from '../../shared/errors.js';

type HitRecord = { count: number; resetAt: number };

export class InMemoryRateLimitService {
  private readonly hits = new Map<string, HitRecord>();

  constructor(
    private readonly options: { windowMs: number; max: number } = {
      windowMs: 15 * 60 * 1000,
      max: 10,
    },
  ) {}

  assertAllowed(key: string): void {
    const now = Date.now();
    const current = this.hits.get(key);

    if (!current || current.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.options.windowMs });
      return;
    }

    if (current.count >= this.options.max) {
      throw new AppError({
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please try again later.',
      });
    }

    current.count += 1;
  }

  clear(): void {
    this.hits.clear();
  }
}
