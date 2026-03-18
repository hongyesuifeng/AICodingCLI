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
  if (error.response?.status === 401) {
    return new InvalidAPIKeyError(provider);
  }

  if (error.response?.status === 429) {
    const retryAfter = error.response.headers?.['retry-after'];
    return new RateLimitError(
      provider,
      retryAfter ? parseInt(retryAfter) : undefined
    );
  }

  if (error.response?.status === 404) {
    return new ModelNotFoundError(provider, error.config?.data?.model || 'unknown');
  }

  if (error.response?.status === 400) {
    const message = error.response?.data?.error?.message || 'Bad request';
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
