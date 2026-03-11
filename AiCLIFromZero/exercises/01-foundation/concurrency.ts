/**
 * 练习 1.2: 实现并发控制
 *
 * 目标: 实现一个函数，限制同时执行的异步任务数量
 *
 * 要求:
 * 1. 最多同时执行 concurrency 个任务
 * 2. 某个任务完成后，立即开始下一个等待的任务
 * 3. 返回所有任务的结果（保持顺序）
 */

/**
 * 并发执行多个任务
 *
 * @param items - 要处理的元素数组
 * @param fn - 处理每个元素的异步函数
 * @param concurrency - 最大并发数
 * @returns 所有任务的结果数组
 *
 * @example
 * const urls = ['url1', 'url2', 'url3', 'url4', 'url5'];
 * const results = await mapConcurrent(
 *   urls,
 *   (url) => fetch(url).then(r => r.json()),
 *   2  // 最多同时 2 个请求
 * );
 */
export async function mapConcurrent<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  // TODO: 实现这个函数
  // 提示:
  // 1. 使用一个队列来管理待执行的任务
  // 2. 使用 Promise 来协调并发
  // 3. 保持结果的顺序
  throw new Error('Not implemented');
}

// ============ 测试用例 ============

import { describe, it, expect, vi } from 'vitest';

describe('mapConcurrent', () => {
  it('should process all items', async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await mapConcurrent(items, async (n) => n * 2, 2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('should respect concurrency limit', async () => {
    const items = [1, 2, 3, 4, 5, 6];
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const trackConcurrency = async (n: number) => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);

      await new Promise((resolve) => setTimeout(resolve, 50));

      currentConcurrent--;
      return n;
    };

    await mapConcurrent(items, trackConcurrency, 3);

    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it('should preserve order', async () => {
    const items = [100, 50, 200, 10]; // 不同的延迟
    const results = await mapConcurrent(
      items,
      async (ms) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        return ms;
      },
      2
    );
    expect(results).toEqual([100, 50, 200, 10]);
  });

  it('should handle empty array', async () => {
    const results = await mapConcurrent([], async (n) => n, 2);
    expect(results).toEqual([]);
  });
});

// ============ 参考答案 ============
// 取消注释下面的代码查看答案

/*
export async function mapConcurrent<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function processNext(): Promise<void> {
    if (currentIndex >= items.length) {
      return;
    }

    const index = currentIndex++;
    const item = items[index];

    results[index] = await fn(item, index);

    // 继续处理下一个
    await processNext();
  }

  // 启动 concurrency 个工作器
  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => processNext());

  await Promise.all(workers);

  return results;
}
*/
