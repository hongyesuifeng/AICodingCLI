import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ContextLengthError,
  InvalidAPIKeyError,
  ModelNotFoundError,
  ProviderError,
  RateLimitError,
  parseAPIError,
} from '../src/utils/errors.ts';

test('parseAPIError maps 401 responses to InvalidAPIKeyError', () => {
  const error = parseAPIError('openai', { status: 401, message: 'Unauthorized' });

  assert.ok(error instanceof InvalidAPIKeyError);
  assert.equal(error.provider, 'openai');
});

test('parseAPIError maps 429 responses to RateLimitError', () => {
  const error = parseAPIError('minimax', {
    status: 429,
    headers: { 'retry-after': '12' },
    message: 'Too many requests',
  });

  assert.ok(error instanceof RateLimitError);
  assert.equal(error.retryAfter, 12);
});

test('parseAPIError maps 404 responses to ModelNotFoundError', () => {
  const error = parseAPIError('openai', {
    status: 404,
    body: { model: 'gpt-missing' },
    message: 'Not found',
  });

  assert.ok(error instanceof ModelNotFoundError);
  assert.match(error.message, /gpt-missing/);
});

test('parseAPIError maps context length failures to ContextLengthError', () => {
  const error = parseAPIError('openai', {
    status: 400,
    error: { message: 'maximum context length exceeded' },
    message: 'Bad request',
  });

  assert.ok(error instanceof ContextLengthError);
});

test('parseAPIError falls back to ProviderError for unknown failures', () => {
  const cause = new Error('Socket closed');
  const error = parseAPIError('openai', cause);

  assert.ok(error instanceof ProviderError);
  assert.equal(error.code, 'UNKNOWN');
  assert.equal(error.cause, cause);
});
