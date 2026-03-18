# 4.2 工具注册和管理

## 学习目标

掌握工具注册模式、动态加载机制、工具发现和命名空间管理。

## 1. 工具注册模式

### 1.1 基础注册表

```typescript
// src/tools/registry.ts
import { Tool } from '../types/tool.js';

// 工具注册表
export class ToolRegistry {
  // 存储所有注册的工具
  private tools = new Map<string, Tool>();

  /**
   * 注册单个工具
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * 批量注册工具
   */
  registerAll(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * 获取工具
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * 检查工具是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 获取所有工具名称
   */
  list(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 获取所有工具定义
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 移除工具
   */
  remove(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * 清空所有工具
   */
  clear(): void {
    this.tools.clear();
  }
}

// 全局注册表实例
export const globalRegistry = new ToolRegistry();
```

**注册表方法说明：**

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `register` | Tool | void | 注册单个工具 |
| `registerAll` | Tool[] | void | 批量注册工具 |
| `get` | string | Tool \| undefined | 获取工具定义 |
| `has` | string | boolean | 检查工具是否存在 |
| `list` | - | string[] | 获取所有工具名称 |
| `getAll` | - | Tool[] | 获取所有工具 |
| `remove` | string | boolean | 移除工具 |
| `clear` | - | void | 清空注册表 |

### 1.2 带元数据的注册表

```typescript
// src/tools/advanced-registry.ts
import { Tool } from '../types/tool.js';

// 工具元数据
export interface ToolMetadata {
  version: string;           // 工具版本
  author?: string;           // 作者
  tags?: string[];           // 标签
  deprecated?: boolean;      // 是否废弃
  deprecatedMessage?: string; // 废弃说明
  aliases?: string[];        // 别名
  priority?: number;         // 优先级（用于搜索排序）
}

// 带元数据的工具条目
export interface ToolEntry {
  tool: Tool;
  metadata: ToolMetadata;
  registeredAt: Date;
}

// 高级工具注册表
export class AdvancedToolRegistry {
  private tools = new Map<string, ToolEntry>();
  private aliases = new Map<string, string>(); // 别名映射

  /**
   * 注册工具（带元数据）
   */
  register(tool: Tool, metadata: Partial<ToolMetadata> = {}): void {
    const entry: ToolEntry = {
      tool,
      metadata: {
        version: metadata.version || '1.0.0',
        author: metadata.author,
        tags: metadata.tags || [],
        deprecated: metadata.deprecated || false,
        aliases: metadata.aliases || [],
        priority: metadata.priority || 0,
      },
      registeredAt: new Date(),
    };

    // 注册主工具
    this.tools.set(tool.name, entry);

    // 注册别名
    for (const alias of entry.metadata.aliases || []) {
      this.aliases.set(alias, tool.name);
    }
  }

  /**
   * 通过名称或别名获取工具
   */
  get(name: string): Tool | undefined {
    // 先尝试直接获取
    const entry = this.tools.get(name);
    if (entry) {
      return entry.tool;
    }

    // 尝试通过别名获取
    const realName = this.aliases.get(name);
    if (realName) {
      return this.tools.get(realName)?.tool;
    }

    return undefined;
  }

  /**
   * 获取工具条目（包含元数据）
   */
  getEntry(name: string): ToolEntry | undefined {
    const entry = this.tools.get(name);
    if (entry) return entry;

    const realName = this.aliases.get(name);
    if (realName) {
      return this.tools.get(realName);
    }

    return undefined;
  }

  /**
   * 按标签搜索工具
   */
  searchByTag(tag: string): Tool[] {
    return Array.from(this.tools.values())
      .filter(entry => entry.metadata.tags?.includes(tag))
      .map(entry => entry.tool);
  }

  /**
   * 按名称模糊搜索
   */
  search(query: string): Tool[] {
    const lowerQuery = query.toLowerCase();

    return Array.from(this.tools.values())
      .filter(entry => {
        const name = entry.tool.name.toLowerCase();
        const desc = entry.tool.description.toLowerCase();
        const tags = entry.metadata.tags?.join(' ').toLowerCase() || '';

        return name.includes(lowerQuery) ||
               desc.includes(lowerQuery) ||
               tags.includes(lowerQuery);
      })
      .sort((a, b) => (b.metadata.priority || 0) - (a.metadata.priority || 0))
      .map(entry => entry.tool);
  }

  /**
   * 获取所有工具的 AI 可用格式
   */
  getToolsForAI(): Array<{
    name: string;
    description: string;
    parameters: any;
  }> {
    return Array.from(this.tools.values())
      .filter(entry => !entry.metadata.deprecated)
      .map(entry => ({
        name: entry.tool.name,
        description: entry.tool.description,
        parameters: entry.tool.parameters,
      }));
  }

  /**
   * 标记工具为废弃
   */
  deprecate(name: string, message: string): void {
    const entry = this.tools.get(name);
    if (entry) {
      entry.metadata.deprecated = true;
      entry.metadata.deprecatedMessage = message;
    }
  }
}
```

## 2. 动态加载

### 2.1 模块加载器

```typescript
// src/tools/loader.ts
import { Tool } from '../types/tool.js';
import { ToolRegistry } from './registry.js';

// 工具模块定义
export interface ToolModule {
  // 模块名称
  name: string;

  // 模块版本
  version: string;

  // 导出的工具
  tools: Tool[];

  // 初始化函数（可选）
  initialize?: () => Promise<void>;

  // 清理函数（可选）
  cleanup?: () => Promise<void>;
}

// 工具加载器
export class ToolLoader {
  private loadedModules = new Map<string, ToolModule>();

  constructor(private registry: ToolRegistry) {}

  /**
   * 加载工具模块
   */
  async loadModule(module: ToolModule): Promise<void> {
    // 检查是否已加载
    if (this.loadedModules.has(module.name)) {
      throw new Error(`Module already loaded: ${module.name}`);
    }

    // 执行初始化
    if (module.initialize) {
      await module.initialize();
    }

    // 注册工具
    this.registry.registerAll(module.tools);

    // 记录已加载的模块
    this.loadedModules.set(module.name, module);

    console.log(`Loaded module: ${module.name} v${module.version} (${module.tools.length} tools)`);
  }

  /**
   * 卸载工具模块
   */
  async unloadModule(moduleName: string): Promise<void> {
    const module = this.loadedModules.get(moduleName);
    if (!module) {
      throw new Error(`Module not loaded: ${moduleName}`);
    }

    // 执行清理
    if (module.cleanup) {
      await module.cleanup();
    }

    // 移除工具
    for (const tool of module.tools) {
      this.registry.remove(tool.name);
    }

    // 从记录中移除
    this.loadedModules.delete(moduleName);

    console.log(`Unloaded module: ${moduleName}`);
  }

  /**
   * 获取所有已加载的模块
   */
  getLoadedModules(): string[] {
    return Array.from(this.loadedModules.keys());
  }

  /**
   * 从文件动态加载模块
   */
  async loadFromFile(modulePath: string): Promise<void> {
    try {
      // 动态导入模块
      const module = await import(modulePath);

      if (!module.default || !module.default.name || !module.default.tools) {
        throw new Error(`Invalid tool module: ${modulePath}`);
      }

      await this.loadModule(module.default as ToolModule);
    } catch (error: any) {
      throw new Error(`Failed to load module from ${modulePath}: ${error.message}`);
    }
  }
}
```

### 2.2 内置工具模块

```typescript
// src/tools/modules/file-system.ts
import { promises as fs } from 'fs';
import { Tool, ToolModule } from '../../types/tool.js';

// 文件系统工具集
const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read the contents of a file',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path' },
    },
    required: ['path'],
  },
  execute: async ({ path }) => {
    return await fs.readFile(path, 'utf-8');
  },
};

const writeFileTool: Tool = {
  name: 'write_file',
  description: 'Write content to a file',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path' },
      content: { type: 'string', description: 'Content to write' },
    },
    required: ['path', 'content'],
  },
  execute: async ({ path, content }) => {
    await fs.writeFile(path, content, 'utf-8');
    return `File written: ${path}`;
  },
};

const listDirTool: Tool = {
  name: 'list_directory',
  description: 'List directory contents',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path', default: '.' },
    },
    required: [],
  },
  execute: async ({ path = '.' }) => {
    const entries = await fs.readdir(path, { withFileTypes: true });
    return entries.map(e => `${e.name}${e.isDirectory() ? '/' : ''}`).join('\n');
  },
};

// 导出模块
export const fileSystemModule: ToolModule = {
  name: 'file-system',
  version: '1.0.0',
  tools: [readFileTool, writeFileTool, listDirTool],

  initialize: async () => {
    console.log('Initializing file system module...');
  },

  cleanup: async () => {
    console.log('Cleaning up file system module...');
  },
};

export default fileSystemModule;
```

```typescript
// src/tools/modules/shell.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import { Tool, ToolModule } from '../../types/tool.js';

const execAsync = promisify(exec);

const executeTool: Tool = {
  name: 'execute_command',
  description: 'Execute a shell command',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Command to execute' },
      cwd: { type: 'string', description: 'Working directory' },
    },
    required: ['command'],
  },
  execute: async ({ command, cwd }) => {
    const { stdout, stderr } = await execAsync(command, { cwd });
    return stdout || stderr;
  },
};

export const shellModule: ToolModule = {
  name: 'shell',
  version: '1.0.0',
  tools: [executeTool],
};

export default shellModule;
```

## 3. 工具发现

### 3.1 自动发现机制

```typescript
// src/tools/discovery.ts
import * as path from 'path';
import * as fs from 'fs/promises';
import { ToolLoader } from './loader.js';

// 发现配置
export interface DiscoveryOptions {
  // 搜索目录
  directories: string[];

  // 文件模式
  patterns: string[];

  // 排除模式
  exclude: string[];
}

const DEFAULT_OPTIONS: DiscoveryOptions = {
  directories: ['./tools', './node_modules'],
  patterns: ['**/tool-*.js', '**/*.tool.js'],
  exclude: ['node_modules/**/node_modules'],
};

// 工具发现器
export class ToolDiscovery {
  constructor(
    private loader: ToolLoader,
    private options: DiscoveryOptions = DEFAULT_OPTIONS
  ) {}

  /**
   * 自动发现并加载工具
   */
  async discover(): Promise<string[]> {
    const discoveredModules: string[] = [];

    for (const dir of this.options.directories) {
      try {
        const modules = await this.scanDirectory(dir);
        discoveredModules.push(...modules);
      } catch (error) {
        // 目录不存在，跳过
        continue;
      }
    }

    // 加载发现的所有模块
    for (const modulePath of discoveredModules) {
      try {
        await this.loader.loadFromFile(modulePath);
      } catch (error: any) {
        console.warn(`Failed to load module ${modulePath}: ${error.message}`);
      }
    }

    return discoveredModules;
  }

  /**
   * 扫描目录
   */
  private async scanDirectory(dir: string): Promise<string[]> {
    const results: string[] = [];

    const scan = async (currentDir: string) => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          // 跳过排除的目录
          if (this.shouldExclude(fullPath)) continue;
          await scan(fullPath);
        } else if (entry.isFile()) {
          // 检查是否匹配模式
          if (this.matchesPattern(entry.name)) {
            results.push(fullPath);
          }
        }
      }
    };

    await scan(dir);
    return results;
  }

  /**
   * 检查是否匹配模式
   */
  private matchesPattern(filename: string): boolean {
    return this.options.patterns.some(pattern => {
      // 简化的模式匹配
      if (pattern.includes('tool-*.js')) {
        return filename.startsWith('tool-') && filename.endsWith('.js');
      }
      if (pattern.includes('*.tool.js')) {
        return filename.endsWith('.tool.js');
      }
      return false;
    });
  }

  /**
   * 检查是否应该排除
   */
  private shouldExclude(path: string): boolean {
    return this.options.exclude.some(pattern => {
      return path.includes(pattern.replace('/**', ''));
    });
  }
}
```

### 3.2 配置驱动的发现

```typescript
// src/tools/config-discovery.ts
import { ToolLoader } from './loader.js';

// 工具配置
export interface ToolConfig {
  modules: ModuleConfig[];
}

export interface ModuleConfig {
  name: string;
  enabled: boolean;
  path?: string;
  config?: Record<string, any>;
}

// 从配置加载工具
export class ConfigBasedDiscovery {
  constructor(
    private loader: ToolLoader,
    private config: ToolConfig
  ) {}

  /**
   * 根据配置加载工具
   */
  async load(): Promise<void> {
    for (const moduleConfig of this.config.modules) {
      if (!moduleConfig.enabled) {
        console.log(`Skipping disabled module: ${moduleConfig.name}`);
        continue;
      }

      try {
        if (moduleConfig.path) {
          await this.loader.loadFromFile(moduleConfig.path);
        }
      } catch (error: any) {
        console.error(`Failed to load module ${moduleConfig.name}: ${error.message}`);
      }
    }
  }
}

// 配置示例
export const toolConfig: ToolConfig = {
  modules: [
    {
      name: 'file-system',
      enabled: true,
      path: './tools/modules/file-system.js',
    },
    {
      name: 'shell',
      enabled: true,
      path: './tools/modules/shell.js',
    },
    {
      name: 'git',
      enabled: true,
      path: './tools/modules/git.js',
    },
    {
      name: 'deprecated-tool',
      enabled: false,
      path: './tools/modules/old.js',
    },
  ],
};
```

## 4. 命名空间管理

### 4.1 命名空间注册表

```typescript
// src/tools/namespaced-registry.ts
import { Tool } from '../types/tool.js';

// 命名空间工具注册表
export class NamespacedRegistry {
  // 命名空间 -> 工具映射
  private namespaces = new Map<string, Map<string, Tool>>();

  // 默认命名空间
  private defaultNamespace = 'default';

  /**
   * 设置默认命名空间
   */
  setDefaultNamespace(namespace: string): void {
    this.defaultNamespace = namespace;
  }

  /**
   * 在指定命名空间注册工具
   */
  register(tool: Tool, namespace?: string): void {
    const ns = namespace || this.defaultNamespace;

    if (!this.namespaces.has(ns)) {
      this.namespaces.set(ns, new Map());
    }

    this.namespaces.get(ns)!.set(tool.name, tool);
  }

  /**
   * 获取工具（支持命名空间前缀）
   * 格式: "namespace:tool_name" 或 "tool_name"
   */
  get(fullName: string): Tool | undefined {
    const [namespace, toolName] = this.parseName(fullName);
    return this.namespaces.get(namespace)?.get(toolName);
  }

  /**
   * 解析工具名称
   */
  private parseName(fullName: string): [string, string] {
    const parts = fullName.split(':');

    if (parts.length === 2) {
      return [parts[0], parts[1]];
    }

    return [this.defaultNamespace, fullName];
  }

  /**
   * 列出命名空间中的所有工具
   */
  listNamespace(namespace: string): Tool[] {
    const ns = this.namespaces.get(namespace);
    return ns ? Array.from(ns.values()) : [];
  }

  /**
   * 列出所有命名空间
   */
  listNamespaces(): string[] {
    return Array.from(this.namespaces.keys());
  }

  /**
   * 获取所有工具（带命名空间前缀）
   */
  getAll(): Array<{ name: string; tool: Tool }> {
    const result: Array<{ name: string; tool: Tool }> = [];

    for (const [namespace, tools] of this.namespaces) {
      for (const [name, tool] of tools) {
        result.push({
          name: namespace === this.defaultNamespace ? name : `${namespace}:${name}`,
          tool,
        });
      }
    }

    return result;
  }

  /**
   * 清空命名空间
   */
  clearNamespace(namespace: string): void {
    this.namespaces.delete(namespace);
  }
}
```

### 4.2 使用示例

```typescript
// src/examples/namespaced-tools.ts
import { NamespacedRegistry } from '../tools/namespaced-registry.js';
import { Tool } from '../types/tool.js';

const registry = new NamespacedRegistry();

// 文件系统工具
const fileTools: Tool[] = [
  {
    name: 'read',
    description: 'Read file',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    execute: async () => 'content',
  },
  {
    name: 'write',
    description: 'Write file',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    execute: async () => 'done',
  },
];

// Git 工具
const gitTools: Tool[] = [
  {
    name: 'status',
    description: 'Git status',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: async () => 'status',
  },
  {
    name: 'commit',
    description: 'Git commit',
    parameters: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] },
    execute: async () => 'committed',
  },
];

// 注册到不同命名空间
fileTools.forEach(t => registry.register(t, 'fs'));
gitTools.forEach(t => registry.register(t, 'git'));

// 获取工具
console.log(registry.get('fs:read'));     // 文件读取工具
console.log(registry.get('git:status'));  // Git 状态工具

// 列出命名空间
console.log(registry.listNamespaces());   // ['fs', 'git']

// 列出命名空间中的工具
console.log(registry.listNamespace('fs')); // [read, write]
```

## 参数说明

### ToolRegistry 方法

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `register` | Tool | void | 注册工具，重复会报错 |
| `registerAll` | Tool[] | void | 批量注册 |
| `get` | string | Tool \| undefined | 按名称获取 |
| `has` | string | boolean | 检查是否存在 |
| `list` | - | string[] | 所有工具名 |
| `getAll` | - | Tool[] | 所有工具 |
| `remove` | string | boolean | 删除工具 |
| `clear` | - | void | 清空注册表 |

### ToolModule 接口

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✓ | 模块名称 |
| `version` | string | ✓ | 模块版本 |
| `tools` | Tool[] | ✓ | 包含的工具 |
| `initialize` | function | - | 初始化钩子 |
| `cleanup` | function | - | 清理钩子 |

### ToolMetadata 接口

| 字段 | 类型 | 说明 |
|------|------|------|
| `version` | string | 工具版本 |
| `author` | string | 作者 |
| `tags` | string[] | 标签 |
| `deprecated` | boolean | 是否废弃 |
| `aliases` | string[] | 别名列表 |
| `priority` | number | 搜索优先级 |

## 练习题

### 练习 1: 实现工具版本管理

```typescript
// exercises/01-version-control.ts
// TODO: 实现支持多版本共存的注册表
// 要求：
// 1. 同一工具可以有多个版本
// 2. 可以指定使用特定版本
// 3. 可以设置默认版本

export class VersionedRegistry {
  // TODO: 实现
  register(tool: Tool, version: string): void {}
  get(name: string, version?: string): Tool | undefined { return undefined; }
  getVersions(name: string): string[] { return []; }
  setDefaultVersion(name: string, version: string): void {}
}
```

### 练习 2: 实现工具依赖管理

```typescript
// exercises/02-dependencies.ts
// TODO: 实现工具依赖检查和自动加载
// 要求：
// 1. 工具可以声明依赖其他工具
// 2. 注册时检查依赖是否满足
// 3. 按依赖顺序加载工具

export interface ToolWithDeps extends Tool {
  dependencies?: string[]; // 依赖的工具名称
}

export class DependencyAwareRegistry {
  // TODO: 实现
  register(tool: ToolWithDeps): void {}
  getLoadOrder(): string[] { return []; }
}
```

### 练习 3: 实现工具权限控制

```typescript
// exercises/03-permissions.ts
// TODO: 实现基于权限的工具访问控制
// 要求：
// 1. 工具可以声明所需权限
// 2. 用户/会话有不同的权限级别
// 3. 无权限时拒绝调用

export interface Permission {
  name: string;
  level: 'read' | 'write' | 'execute';
}

export interface SecuredTool extends Tool {
  permissions: Permission[];
}

export class PermissionAwareRegistry {
  // TODO: 实现
  register(tool: SecuredTool): void {}
  getAccessibleTools(userPermissions: Permission[]): Tool[] { return []; }
}
```

### 练习 4: 实现工具缓存

```typescript
// exercises/04-caching.ts
// TODO: 实现工具执行结果缓存
// 要求：
// 1. 相同参数的调用返回缓存结果
// 2. 支持设置缓存过期时间
// 3. 支持手动清除缓存

export class CachedToolExecutor {
  // TODO: 实现
  execute(tool: Tool, params: any): Promise<string> { return Promise.resolve(''); }
  clearCache(toolName?: string): void {}
  setCacheTTL(toolName: string, ttlMs: number): void {}
}
```

## 下一步

完成本节后，继续学习 [4.3 Tool Calling 协议](./03-tool-calling.md) →
