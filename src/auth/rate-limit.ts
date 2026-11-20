// Rate limit de login em memória (aceitável no MVP com uma instância; Redis em produção).
// Conta tentativas que FALHARAM dentro de uma janela fixa.

interface Bucket {
  count: number;
  resetAt: number;
}

export class FailureLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
  ) {}

  /** Segundos até liberar, se a chave já estourou o limite; senão 0. */
  retryAfter(key: string, now = Date.now()): number {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) return 0;
    return bucket.count >= this.limit ? Math.ceil((bucket.resetAt - now) / 1000) : 0;
  }

  fail(key: string, now = Date.now()): void {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
    else bucket.count++;
  }

  clear(key: string): void {
    this.buckets.delete(key);
  }

  reset(): void {
    this.buckets.clear();
  }

  prune(now = Date.now()): void {
    for (const [key, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(key);
  }
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** 5 tentativas erradas a cada 15 min por matrícula e 20 por IP (handoff 9.2). */
export const loginLimiters = {
  byMatricula: new FailureLimiter(5, FIFTEEN_MINUTES),
  byIp: new FailureLimiter(20, FIFTEEN_MINUTES),
};

setInterval(() => {
  loginLimiters.byMatricula.prune();
  loginLimiters.byIp.prune();
}, 60_000).unref();
