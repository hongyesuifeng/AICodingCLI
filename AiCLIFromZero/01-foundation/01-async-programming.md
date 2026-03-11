# 1.1 TypeScript 异步编程基础

## 学习目标

理解并掌握 TypeScript 中的异步编程模式，这是 AI CLI 的核心基础。

## 核心概念

### 为什么需要异步编程？

AI CLI 涉及大量 I/O 操作：
- 调用 AI API (网络请求)
- 读写文件 (磁盘 I/O)
- 用户输入 (交互 I/O)
- 流式输出 (数据流)

使用异步编程可以：
1. **不阻塞主线程** - 保持 UI 响应
2. **高效处理并发** - 同时处理多个请求
3. **实现流式处理** - 实时显示 AI 输出

## 1. Promise 基础

### 基本用法

```typescript
// src/examples/promise-basic.ts

// 创建 Promise
function delay(ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ms < 0) {
      reject(new Error('ms must be non-negative'));
    } else {
      setTimeout(resolve, ms);
    }
  });
}

// 使用 Promise
delay(1000)
  .then(() => console.log('1 second passed'))
  .catch((err) => console.error('Error:', err))
  .finally(() => console.log('Done'));

// Promise 链
function fetchUser(id: number): Promise<User> {
  return fetch(`/api/users/${id}`).then(res => res.json());
}

function fetchUserPosts(userId: number): Promise<Post[]> {
  return fetch(`/api/users/${userId}/posts`).then(res => res.json());
}

// 链式调用
fetchUser(1)
  .then(user => {
    console.log('User:', user.name);
    return fetchUserPosts(user.id);
  })
  .then(posts => {
    console.log('Posts:', posts.length);
  })
  .catch(err => console.error('Error:', err));
```

### Promise 静态方法

```typescript
// src/examples/promise-static.ts

// Promise.all - 并行执行，全部完成
async function loadAllData(): Promise<[User, Config, Settings]> {
  const [user, config, settings] = await Promise.all([
    fetchUser(1),
    loadConfig(),
    loadSettings()
  ]);
  return [user, config, settings];
}

// Promise.allSettled - 并行执行，等待所有结果
async function loadMultipleFiles(paths: string[]): Promise<PromiseSettledResult<string>[]> {
  const promises = paths.map(path => readFile(path));
  return Promise.allSettled(promises);
}

// 使用示例
const results = await loadMultipleFiles(['a.txt', 'b.txt', 'c.txt']);
results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`File ${index}: ${result.value.length} chars`);
  } else {
    console.error(`File ${index} failed:`, result.reason);
  }
});

// Promise.race - 返回最先完成的结果
async function fetchWithTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T> {
  const timeout = delay(ms).then(() => {
    throw new Error('Timeout');
  });
  return Promise.race([promise, timeout]);
}

// 使用超时
try {
  const user = await fetchWithTimeout(fetchUser(1), 5000);
  console.log('User:', user);
} catch (err) {
  console.error('Request timed out');
}
```

## 2. async/await

### 基本语法

```typescript
// src/examples/async-await.ts

// async 函数返回 Promise
async function greet(name: string): Promise<string> {
  return `Hello, ${name}!`;
}

// await 等待 Promise 完成
async function main(): Promise<void> {
  const message = await greet('World');
  console.log(message);
}

// 错误处理
async function safeFetch(id: number): Promise<User | null> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return null;
  }
}
```

### 并行执行

```typescript
// src/examples/parallel.ts

// ❌ 错误：串行执行
async function loadSequential(): Promise<void> {
  const start = Date.now();

  const user = await fetchUser(1);      // 等待 200ms
  const config = await loadConfig();     // 等待 100ms
  const settings = await loadSettings(); // 等待 150ms

  console.log(`Total: ${Date.now() - start}ms`); // ~450ms
}

// ✅ 正确：并行执行
async function loadParallel(): Promise<void> {
  const start = Date.now();

  const [user, config, settings] = await Promise.all([
    fetchUser(1),
    loadConfig(),
    loadSettings()
  ]);

  console.log(`Total: ${Date.now() - start}ms`); // ~200ms
}

// 并行但有依赖关系
async function loadWithDependency(): Promise<void> {
  const start = Date.now();

  // 先获取用户
  const user = await fetchUser(1);

  // 然后并行获取用户的文章和评论
  const [posts, comments] = await Promise.all([
    fetchUserPosts(user.id),
    fetchUserComments(user.id)
  ]);

  console.log(`Total: ${Date.now() - start}ms`);
}
```

## 3. 流式处理 (Streams)

### Node.js Stream API

```typescript
// src/examples/streams.ts
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createInterface } from 'readline';

// 读取文件流
async function readFileStream(path: string): Promise<void> {
  const stream = createReadStream(path, 'utf-8');

  stream.on('data', (chunk) => {
    console.log('Received chunk:', chunk.length);
  });

  stream.on('end', () => {
    console.log('Done');
  });

  stream.on('error', (err) => {
    console.error('Error:', err);
  });
}

// 使用 async iterator
async function readFileAsync(path: string): Promise<void> {
  const stream = createReadStream(path, 'utf-8');

  for await (const chunk of stream) {
    console.log('Chunk:', chunk.length);
  }
}

// 逐行读取
async function readLines(path: string): Promise<string[]> {
  const stream = createReadStream(path, 'utf-8');
  const rl = createInterface({ input: stream });

  const lines: string[] = [];

  for await (const line of rl) {
    lines.push(line);
  }

  return lines;
}

// 流式复制
async function copyFile(src: string, dest: string): Promise<void> {
  await pipeline(
    createReadStream(src),
    createWriteStream(dest)
  );
}
```

### 自定义流

```typescript
// src/examples/custom-stream.ts
import { Transform, TransformCallback } from 'stream';

// 创建转换流
class UpperCaseTransform extends Transform {
  _transform(chunk: Buffer, encoding: string, callback: TransformCallback) {
    const upper = chunk.toString().toUpperCase();
    callback(null, upper);
  }
}

// 使用转换流
async function transformFile(src: string, dest: string): Promise<void> {
  await pipeline(
    createReadStream(src),
    new UpperCaseTransform(),
    createWriteStream(dest)
  );
}
```

## 4. 异步生成器

### Async Generator 基础

```typescript
// src/examples/async-generator.ts

// 异步生成器函数
async function* generateNumbers(max: number): AsyncGenerator<number> {
  for (let i = 1; i <= max; i++) {
    await delay(100); // 模拟异步操作
    yield i;
  }
}

// 使用 for await...of
async function consumeNumbers(): Promise<void> {
  for await (const num of generateNumbers(5)) {
    console.log('Number:', num);
  }
}

// 模拟流式 API 响应
async function* streamAPIResponse(prompt: string): AsyncGenerator<string> {
  const words = prompt.split(' ');

  for (const word of words) {
    await delay(50); // 模拟网络延迟
    yield word + ' ';
  }
}

// 模拟 AI 流式输出
async function* mockAIStream(prompt: string): AsyncGenerator<string> {
  const response = `这是对 "${prompt}" 的回答。`;
  const chars = response.split('');

  for (const char of chars) {
    await delay(30); // 模拟打字效果
    yield char;
  }
}

// 实时显示
async function displayStream(prompt: string): Promise<void> {
  process.stdout.write('AI: ');

  for await (const char of mockAIStream(prompt)) {
    process.stdout.write(char);
  }

  console.log(); // 换行
}
```

### 实用的异步生成器

```typescript
// src/examples/practical-generators.ts

// 分批处理
async function* batchProcess<T>(
  items: T[],
  batchSize: number
): AsyncGenerator<T[]> {
  for (let i = 0; i < items.length; i += batchSize) {
    yield items.slice(i, i + batchSize);
  }
}

// 带重试的请求
async function* fetchWithRetry(
  url: string,
  maxRetries: number = 3
): AsyncGenerator<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        yield response;
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err as Error;
    }

    if (attempt < maxRetries) {
      await delay(1000 * attempt); // 指数退避
    }
  }

  throw lastError;
}

// 文件监控
import { watch } from 'fs';

async function* watchFile(path: string): AsyncGenerator<string> {
  let resolve: (value: string) => void;
  let promise = new Promise<string>(r => resolve = r);

  const watcher = watch(path, (eventType, filename) => {
    if (filename) {
      resolve(filename);
      promise = new Promise(r => resolve = r);
    }
  });

  try {
    while (true) {
      yield await promise;
    }
  } finally {
    watcher.close();
  }
}
```

## 5. 错误处理

### 异步错误处理模式

```typescript
// src/examples/async-error.ts

// Result 类型模式
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

async function tryAsync<T>(
  promise: Promise<T>
): Promise<Result<T>> {
  try {
    const value = await promise;
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}

// 使用 Result 类型
async function loadUserData(id: number): Promise<void> {
  const result = await tryAsync(fetchUser(id));

  if (result.ok) {
    console.log('User:', result.value.name);
  } else {
    console.error('Failed:', result.error.message);
  }
}

// 带上下文的错误
class AsyncError extends Error {
  constructor(
    message: string,
    public readonly context: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AsyncError';
  }
}

async function fetchWithContext(url: string): Promise<Response> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new AsyncError(`Request failed`, {
        url,
        status: response.status,
        timestamp: new Date().toISOString()
      });
    }
    return response;
  } catch (error) {
    if (error instanceof AsyncError) {
      console.error('Context:', error.context);
    }
    throw error;
  }
}
```

## 实践练习

### 练习 1: 实现带超时的请求

```typescript
// exercises/01-timeout.ts

async function fetchWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string
): Promise<T> {
  // TODO: 实现带超时的请求
  // 提示: 使用 Promise.race
}
```

### 练习 2: 实现并发控制

```typescript
// exercises/02-concurrency.ts

async function mapConcurrent<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  // TODO: 实现并发控制的 map
  // 最多同时执行 concurrency 个任务
}
```

### 练习 3: 实现流式处理

```typescript
// exercises/03-stream.ts

async function processLargeFile(
  inputPath: string,
  outputPath: string,
  transform: (line: string) => string
): Promise<void> {
  // TODO: 实现大文件的流式处理
  // 1. 逐行读取
  // 2. 应用转换
  // 3. 写入输出
}
```

## 类型定义

```typescript
// src/types/async.ts

export interface User {
  id: number;
  name: string;
}

export interface Post {
  id: number;
  userId: number;
  title: string;
}

export interface Config {
  model: string;
  apiKey: string;
}

export interface Settings {
  theme: 'dark' | 'light';
  language: string;
}
```

## 下一步

完成本节后，继续学习 [1.2 CLI 框架搭建](./02-cli-framework.md) →
