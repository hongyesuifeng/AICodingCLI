// src/utils/errors.ts

// 自定义错误类型
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class RateLimitError extends ProviderError {
  constructor(provider: string, public readonly retryAfter?: number) {
    super('Rate limit exceeded', provider, 'RATE_LIMIT');
    this.name = 'RateLimitError';
  }
}

export class InvalidAPIKeyError extends ProviderError {
  constructor(provider: string) {
    super('Invalid API key', provider, 'INVALID_API_KEY');
    this.name = 'InvalidAPIKeyError';
  }
}

export class ModelNotFoundError extends ProviderError {
  constructor(provider: string, model: string) {
    super(`Model not found: ${model}`, provider, 'MODEL_NOT_FOUND');
    this.name = 'ModelNotFoundError';
  }
}

export class ContextLengthError extends ProviderError {
  constructor(
    provider: string,
    public readonly maxTokens: number,
    public readonly requestedTokens: number
  ) {
    super(
      `Context length exceeded: ${requestedTokens} > ${maxTokens}`,
      provider,
      'CONTEXT_LENGTH'
    );
    this.name = 'ContextLengthError';
  }
}

// 错误处理工具
export function parseAPIError(
  provider: string,
  error: any
): ProviderError {
  const status = error.status ?? error.response?.status;
  const headers = error.headers ?? error.response?.headers;
  const responseError = error.error ?? error.response?.data?.error;

  if (status === 401) {
    return new InvalidAPIKeyError(provider);
  }

  if (status === 429) {
    const retryAfter = headers?.['retry-after'];
    return new RateLimitError(
      provider,
      retryAfter ? parseInt(retryAfter) : undefined
    );
  }

  if (status === 404) {
    return new ModelNotFoundError(provider, error.config?.data?.model || error.body?.model || 'unknown');
  }

  if (status === 400) {
    const message = responseError?.message || error.message || 'Bad request';
    if (message.includes('context length')) {
      return new ContextLengthError(provider, 0, 0);
    }
  }

  return new ProviderError(
    error.message || 'Unknown error',
    provider,
    'UNKNOWN',
    error
  );
}
