/**
 * 练习 1.1: 实现带超时的请求
 *
 * 目标: 实现一个函数，可以给任何 Promise 添加超时限制
 *
 * 要求:
 * 1. 如果 Promise 在超时时间内完成，返回其结果
 * 2. 如果超时，抛出 TimeoutError
 * 3. 超时后应该取消原 Promise 的执行（如果可能）
 */

// 类型定义
export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * 实现带超时的 Promise 包装器
 *
 * @param promise - 要包装的 Promise
 * @param timeoutMs - 超时时间（毫秒）
 * @param message - 超时错误消息（可选）
 * @returns 带超时限制的 Promise
 *
 * @example
 * const result = await withTimeout(
 *   fetch('https://api.example.com/data'),
 *   5000,
 *   'API request timed out'
 * );
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message?: string
): Promise<T> {
  // TODO: 实现这个函数
  // 提示: 使用 Promise.race
  throw new Error('Not implemented');
}

// ============ 测试用例 ============

import { describe, it, expect, vi } from 'vitest';

describe('withTimeout', () => {
  it('should return result if promise resolves before timeout', async () => {
    const quickPromise = Promise.resolve('success');
    const result = await withTimeout(quickPromise, 1000);
    expect(result).toBe('success');
  });

  it('should throw TimeoutError if promise takes too long', async () => {
    const slowPromise = new Promise((resolve) => {
      setTimeout(() => resolve('too late'), 2000);
    });

    await expect(withTimeout(slowPromise, 100)).rejects.toThrow(TimeoutError);
  });

  it('should use custom timeout message', async () => {
    const slowPromise = new Promise((resolve) => {
      setTimeout(() => resolve('too late'), 2000);
    });

    try {
      await withTimeout(slowPromise, 100, 'Custom timeout message');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TimeoutError);
      expect((error as TimeoutError).message).toContain('Custom timeout message');
    }
  });

  it('should propagate original promise rejection', async () => {
    const failingPromise = Promise.reject(new Error('Original error'));

    await expect(withTimeout(failingPromise, 1000)).rejects.toThrow('Original error');
  });
});

// ============ 参考答案 ============
// 取消注释下面的代码查看答案

/*
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message?: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    clearTimeout(timeoutId!);
  }
}
*/
