// src/utils/retry.ts

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors: string[];
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  retryableErrors: ['RATE_LIMIT', 'TIMEOUT', 'SERVER_ERROR'],
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // 检查是否可重试
      const errorCode = error.code || 'UNKNOWN';
      if (!opts.retryableErrors.includes(errorCode)) {
        throw error;
      }

      // 最后一次尝试不等待
      if (attempt === opts.maxRetries) {
        break;
      }

      // 等待后重试
      await sleep(delay);
      delay = Math.min(delay * opts.backoffFactor, opts.maxDelay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
