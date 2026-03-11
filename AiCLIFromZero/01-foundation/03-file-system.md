# 1.3 文件系统操作

## 学习目标

掌握安全、高效的文件系统操作，这是 AI CLI 的核心功能之一。

## 1. 基础文件操作

### 读取文件

```typescript
// src/utils/file.ts
import { readFile, writeFile, access, stat, mkdir, readdir } from 'fs/promises';
import { createReadStream } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { createInterface } from 'readline';

// 读取文本文件
export async function readTextFile(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`File not found: ${path}`);
    }
    throw error;
  }
}

// 读取 JSON 文件
export async function readJsonFile<T>(path: string): Promise<T> {
  const content = await readTextFile(path);
  return JSON.parse(content);
}

// 检查文件是否存在
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// 获取文件信息
export async function getFileInfo(path: string): Promise<{
  size: number;
  created: Date;
  modified: Date;
  isDirectory: boolean;
  isFile: boolean;
}> {
  const stats = await stat(path);
  return {
    size: stats.size,
    created: stats.birthtime,
    modified: stats.mtime,
    isDirectory: stats.isDirectory(),
    isFile: stats.isFile(),
  };
}
```

### 写入文件

```typescript
// src/utils/file.ts (续)

// 写入文本文件
export async function writeTextFile(
  path: string,
  content: string
): Promise<void> {
  // 确保目录存在
  await ensureDir(dirname(path));
  await writeFile(path, content, 'utf-8');
}

// 写入 JSON 文件
export async function writeJsonFile<T>(
  path: string,
  data: T,
  pretty: boolean = true
): Promise<void> {
  const content = pretty
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);
  await writeTextFile(path, content);
}

// 确保目录存在
export async function ensureDir(path: string): Promise<void> {
  try {
    await mkdir(path, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}
```

## 2. 流式文件处理

### 逐行读取

```typescript
// src/utils/stream.ts

// 逐行读取文件
export async function* readLines(
  path: string
): AsyncGenerator<string, void, unknown> {
  const stream = createReadStream(path, 'utf-8');
  const rl = createInterface({ input: stream });

  for await (const line of rl) {
    yield line;
  }
}

// 处理大文件
export async function processLargeFile(
  path: string,
  processor: (line: string, lineNumber: number) => Promise<void> | void
): Promise<number> {
  let lineNumber = 0;

  for await (const line of readLines(path)) {
    lineNumber++;
    await processor(line, lineNumber);
  }

  return lineNumber;
}

// 使用示例
async function countLines(path: string): Promise<number> {
  let count = 0;
  for await (const _ of readLines(path)) {
    count++;
  }
  return count;
}
```

### 流式复制

```typescript
// src/utils/stream.ts (续)
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

// 流式复制文件
export async function copyFileStream(
  srcPath: string,
  destPath: string,
  onProgress?: (copied: number) => void
): Promise<void> {
  await ensureDir(dirname(destPath));

  let copied = 0;

  const transform = new (require('stream').Transform)({
    transform(chunk: Buffer, encoding: string, callback: Function) {
      copied += chunk.length;
      onProgress?.(copied);
      callback(null, chunk);
    }
  });

  await pipeline(
    createReadStream(srcPath),
    transform,
    createWriteStream(destPath)
  );
}
```

## 3. 目录遍历

### 递归遍历

```typescript
// src/utils/traverse.ts
import { Dirent } from 'fs';

// 遍历选项
interface TraverseOptions {
  includeFiles?: boolean;
  includeDirs?: boolean;
  maxDepth?: number;
  followSymlinks?: boolean;
  filter?: (path: string) => boolean;
}

// 递归遍历目录
export async function* walkDir(
  dir: string,
  options: TraverseOptions = {}
): AsyncGenerator<string> {
  const {
    includeFiles = true,
    includeDirs = true,
    maxDepth = Infinity,
    filter = () => true,
  } = options;

  async function* walk(
    currentDir: string,
    depth: number
  ): AsyncGenerator<string> {
    if (depth > maxDepth) return;

    const entries: Dirent[] = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (!filter(fullPath)) continue;

      if (entry.isDirectory()) {
        if (includeDirs) yield fullPath;
        yield* walk(fullPath, depth + 1);
      } else if (entry.isFile() && includeFiles) {
        yield fullPath;
      }
    }
  }

  yield* walk(dir, 0);
}

// 使用示例
async function findTypeScriptFiles(rootDir: string): Promise<string[]> {
  const files: string[] = [];

  for await (const file of walkDir(rootDir, {
    filter: (path) => path.endsWith('.ts') || path.endsWith('.tsx'),
  })) {
    files.push(file);
  }

  return files;
}
```

### 查找文件

```typescript
// src/utils/search.ts

// 按模式查找文件
export async function findFiles(
  rootDir: string,
  pattern: RegExp
): Promise<string[]> {
  const matches: string[] = [];

  for await (const file of walkDir(rootDir, { includeDirs: false })) {
    if (pattern.test(file)) {
      matches.push(file);
    }
  }

  return matches;
}

// 查找特定扩展名
export async function findByExtension(
  rootDir: string,
  extensions: string[]
): Promise<string[]> {
  const extSet = new Set(extensions.map(e => e.startsWith('.') ? e : `.${e}`));
  const files: string[] = [];

  for await (const file of walkDir(rootDir, { includeDirs: false })) {
    if (extSet.has(extname(file))) {
      files.push(file);
    }
  }

  return files;
}
```

## 4. 安全操作

### 路径验证

```typescript
// src/utils/security.ts
import { resolve, normalize, relative } from 'path';

// 检查路径是否在允许的根目录内
export function isPathAllowed(
  path: string,
  allowedRoots: string[]
): boolean {
  const resolvedPath = resolve(path);

  return allowedRoots.some(root => {
    const resolvedRoot = resolve(root);
    const relativePath = relative(resolvedRoot, resolvedPath);
    return !relativePath.startsWith('..') && !relativePath.startsWith('/');
  });
}

// 规范化路径
export function normalizePath(path: string): string {
  return normalize(path);
}

// 安全读取（带路径检查）
export async function safeReadFile(
  path: string,
  allowedRoots: string[]
): Promise<string> {
  if (!isPathAllowed(path, allowedRoots)) {
    throw new Error(`Access denied: ${path}`);
  }
  return readTextFile(path);
}
```

### 文件变更检测

```typescript
// src/utils/watch.ts
import { watch, FSWatcher } from 'fs';

// 监控文件变化
export function watchFile(
  path: string,
  onChange: (event: string, filename: string) => void
): FSWatcher {
  return watch(path, (event, filename) => {
    if (filename) {
      onChange(event, filename);
    }
  });
}

// 防抖的文件监控
export function watchWithDebounce(
  path: string,
  onChange: () => void,
  delayMs: number = 300
): FSWatcher {
  let timeout: NodeJS.Timeout | null = null;

  return watch(path, () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(onChange, delayMs);
  });
}
```

## 5. 实用工具函数

```typescript
// src/utils/file-utils.ts

// 安全删除（不删除根目录）
export async function safeDelete(
  path: string,
  allowedRoots: string[]
): Promise<void> {
  if (!isPathAllowed(path, allowedRoots)) {
    throw new Error(`Access denied: ${path}`);
  }

  const { rm } = await import('fs/promises');
  await rm(path, { recursive: true, force: true });
}

// 获取文件扩展名
export function getExtension(path: string): string {
  return extname(path).toLowerCase();
}

// 获取文件名（不带扩展名）
export function getBaseName(path: string): string {
  return basename(path, extname(path));
}

// 生成唯一文件名
export function generateUniquePath(basePath: string): string {
  let counter = 1;
  let path = basePath;

  while (true) {
    // 同步检查，用于生成路径
    try {
      require('fs').accessSync(path);
      const ext = extname(basePath);
      const base = basename(basePath, ext);
      const dir = dirname(basePath);
      path = join(dir, `${base} (${counter})${ext}`);
      counter++;
    } catch {
      return path;
    }
  }
}
```

## 练习

1. **实现文件搜索**: 在目录中搜索包含特定文本的文件
2. **实现文件比较**: 比较两个文件的差异
3. **实现备份功能**: 创建文件的备份副本

## 下一步

完成本节后，继续学习 [1.4 配置管理](./04-config-management.md) →
