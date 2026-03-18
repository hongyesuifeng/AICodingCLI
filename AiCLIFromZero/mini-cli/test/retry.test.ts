import test from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from '../src/utils/retry.ts';

test('withRetry retries retryable errors and eventually resolves', async () => {
  let attempts = 0;

  const result = await withRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error('try again') as Error & { code?: string };
        error.code = 'RATE_LIMIT';
        throw error;
      }

      return 'done';
    },
    {
      maxRetries: 3,
      initialDelay: 1,
      maxDelay: 2,
    }
  );

  assert.equal(result, 'done');
  assert.equal(attempts, 3);
});

test('withRetry does not retry non-retryable errors', async () => {
  let attempts = 0;

  await assert.rejects(
    () =>
      withRetry(
        async () => {
          attempts += 1;
          const error = new Error('bad request') as Error & { code?: string };
          error.code = 'VALIDATION';
          throw error;
        },
        {
          maxRetries: 3,
          initialDelay: 1,
        }
      ),
    /bad request/
  );

  assert.equal(attempts, 1);
});
