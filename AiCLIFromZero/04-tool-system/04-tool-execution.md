# 4.4 工具执行和安全

## 学习目标

理解工具执行的安全风险，掌握权限控制、超时处理、错误处理和沙箱机制的实现。

## 1. 安全风险概述

### 1.1 潜在风险

AI 工具调用存在多种安全风险：

| 风险类型 | 描述 | 示例 |
|----------|------|------|
| **文件泄露** | 读取敏感文件 | `read_file("/etc/passwd")` |
| **代码注入** | 执行恶意命令 | `execute_command("rm -rf /")` |
| **路径遍历** | 访问预期外的路径 | `read_file("../../secret")` |
| **资源耗尽** | 消耗系统资源 | 无限循环、大文件读取 |
| **权限提升** | 获取更高权限 | 利用系统漏洞 |

### 1.2 安全架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          工具执行安全架构                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   AI 请求 ──▶ [权限检查] ──▶ [参数验证] ──▶ [沙箱执行] ──▶ [结果过滤]        │
│                    │              │              │              │           │
│                    ▼              ▼              ▼              ▼           │
│              ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐        │
│              │ 工具白名单 │   │ Schema  │   │ 资源限制 │   │ 敏感信息 │        │
│              │ 路径限制   │   │ 验证     │   │ 超时控制 │   │ 脱敏     │        │
│              │ 权限级别   │   │ 类型检查 │   │ 隔离环境 │   │ 日志审计 │        │
│              └─────────┘   └─────────┘   └─────────┘   └─────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. 权限控制

### 2.1 权限模型

```typescript
// src/security/permissions.ts

// 权限类型
export type PermissionLevel =
  | 'none'      // 无权限
  | 'read'      // 只读
  | 'write'     // 读写
  | 'execute'   // 执行
  | 'admin';    // 完全控制

// 权限规则
export interface PermissionRule {
  resource: string;        // 资源模式（支持通配符）
  level: PermissionLevel;  // 允许的权限级别
}

// 工具权限配置
export interface ToolPermission {
  toolName: string;
  requiredLevel: PermissionLevel;
  resourcePattern?: string;  // 资源匹配模式
}

// 权限管理器
export class PermissionManager {
  private rules: PermissionRule[] = [];

  /**
   * 添加权限规则
   */
  addRule(rule: PermissionRule): void {
    this.rules.push(rule);
  }

  /**
   * 检查权限
   */
  check(resource: string, requiredLevel: PermissionLevel): boolean {
    const allowedLevel = this.getPermissionLevel(resource);

    // 权限级别比较
    const levels: PermissionLevel[] = ['none', 'read', 'write', 'execute', 'admin'];
    return levels.indexOf(allowedLevel) >= levels.indexOf(requiredLevel);
  }

  /**
   * 获取资源的权限级别
   */
  private getPermissionLevel(resource: string): PermissionLevel {
    let maxLevel: PermissionLevel = 'none';

    for (const rule of this.rules) {
      if (this.matchPattern(resource, rule.resource)) {
        const levels: PermissionLevel[] = ['none', 'read', 'write', 'execute', 'admin'];
        if (levels.indexOf(rule.level) > levels.indexOf(maxLevel)) {
          maxLevel = rule.level;
        }
      }
    }

    return maxLevel;
  }

  /**
   * 简单的模式匹配
   */
  private matchPattern(resource: string, pattern: string): boolean {
    // 支持 * 通配符
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(resource);
  }
}
```

### 2.2 路径限制

```typescript
// src/security/path-validator.ts
import * as path from 'path';

// 路径限制配置
export interface PathRestriction {
  allowedPaths: string[];      // 允许的路径
  deniedPaths: string[];       // 禁止的路径
  allowRelative: boolean;      // 是否允许相对路径
  allowSymlinks: boolean;      // 是否允许符号链接
  maxPathLength: number;       // 最大路径长度
}

const DEFAULT_RESTRICTION: PathRestriction = {
  allowedPaths: [],
  deniedPaths: ['/etc', '/root', '~/.ssh'],
  allowRelative: true,
  allowSymlinks: false,
  maxPathLength: 4096,
};

// 路径验证器
export class PathValidator {
  constructor(private restriction: PathRestriction = DEFAULT_RESTRICTION) {}

  /**
   * 验证并规范化路径
   */
  validate(inputPath: string, cwd: string = process.cwd()): {
    valid: boolean;
    normalizedPath?: string;
    error?: string;
  } {
    // 长度检查
    if (inputPath.length > this.restriction.maxPathLength) {
      return { valid: false, error: 'Path too long' };
    }

    // 解析路径
    let resolvedPath: string;
    try {
      if (path.isAbsolute(inputPath)) {
        resolvedPath = path.resolve(inputPath);
      } else if (this.restriction.allowRelative) {
        resolvedPath = path.resolve(cwd, inputPath);
      } else {
        return { valid: false, error: 'Relative paths not allowed' };
      }
    } catch (error) {
      return { valid: false, error: 'Invalid path format' };
    }

    // 路径遍历检查
    if (resolvedPath.includes('..')) {
      return { valid: false, error: 'Path traversal detected' };
    }

    // 检查禁止的路径
    for (const denied of this.restriction.deniedPaths) {
      const expandedDenied = this.expandPath(denied);
      if (resolvedPath.startsWith(expandedDenied)) {
        return { valid: false, error: `Access denied: ${denied}` };
      }
    }

    // 检查允许的路径（如果配置了）
    if (this.restriction.allowedPaths.length > 0) {
      const isAllowed = this.restriction.allowedPaths.some(allowed => {
        const expandedAllowed = this.expandPath(allowed);
        return resolvedPath.startsWith(expandedAllowed);
      });

      if (!isAllowed) {
        return { valid: false, error: 'Path not in allowed list' };
      }
    }

    return { valid: true, normalizedPath: resolvedPath };
  }

  /**
   * 展开路径中的 ~ 等
   */
  private expandPath(p: string): string {
    if (p.startsWith('~/')) {
      return path.join(process.env.HOME || '', p.slice(2));
    }
    return p;
  }
}
```

### 2.3 命令过滤

```typescript
// src/security/command-filter.ts

// 命令限制配置
export interface CommandRestriction {
  allowedCommands: string[];     // 允许的命令
  deniedCommands: string[];      // 禁止的命令
  deniedPatterns: RegExp[];      // 禁止的模式
  allowPipe: boolean;            // 是否允许管道
  allowRedirect: boolean;        // 是否允许重定向
  allowBackground: boolean;      // 是否允许后台执行
}

const DEFAULT_RESTRICTION: CommandRestriction = {
  allowedCommands: [],
  deniedCommands: [
    'rm', 'rmdir', 'del',
    'format', 'mkfs',
    'dd',
    'shutdown', 'reboot', 'init',
    'chmod', 'chown',
    'sudo', 'su', 'doas',
    'passwd',
    'crontab',
    'systemctl',
  ],
  deniedPatterns: [
    /rm\s+-rf\s+\//,           // rm -rf /
    />\s*\/dev\//,              // 重定向到设备
    /\|\s*sh/,                  // 管道到 shell
    /\|\s*bash/,                // 管道到 bash
    /;\s*rm/,                   // 命令链中的 rm
    /\$\(/,                     // 命令替换
    /`/,                        // 反引号命令替换
  ],
  allowPipe: false,
  allowRedirect: false,
  allowBackground: false,
};

// 命令过滤器
export class CommandFilter {
  constructor(private restriction: CommandRestriction = DEFAULT_RESTRICTION) {}

  /**
   * 验证命令
   */
  validate(command: string): { valid: boolean; error?: string } {
    // 检查禁止的模式
    for (const pattern of this.restriction.deniedPatterns) {
      if (pattern.test(command)) {
        return { valid: false, error: `Command matches denied pattern: ${pattern}` };
      }
    }

    // 提取主命令
    const mainCommand = this.extractMainCommand(command);

    // 检查禁止的命令
    if (this.restriction.deniedCommands.includes(mainCommand)) {
      return { valid: false, error: `Command not allowed: ${mainCommand}` };
    }

    // 检查允许的命令（如果配置了）
    if (this.restriction.allowedPaths.length > 0) {
      if (!this.restriction.allowedCommands.includes(mainCommand)) {
        return { valid: false, error: `Command not in allowed list: ${mainCommand}` };
      }
    }

    // 检查管道
    if (!this.restriction.allowPipe && command.includes('|')) {
      return { valid: false, error: 'Pipes not allowed' };
    }

    // 检查重定向
    if (!this.restriction.allowRedirect && (command.includes('>') || command.includes('<'))) {
      return { valid: false, error: 'Redirects not allowed' };
    }

    // 检查后台执行
    if (!this.restriction.allowBackground && command.includes('&')) {
      return { valid: false, error: 'Background execution not allowed' };
    }

    return { valid: true };
  }

  /**
   * 提取主命令
   */
  private extractMainCommand(command: string): string {
    // 移除前导空格
    const trimmed = command.trim();

    // 获取第一个单词
    const match = trimmed.match(/^(\S+)/);
    return match ? match[1] : '';
  }
}
```

## 3. 超时处理

### 3.1 超时控制

```typescript
// src/utils/timeout.ts

// 超时选项
export interface TimeoutOptions {
  ms: number;              // 超时毫秒数
  message?: string;        // 超时消息
  onTimeout?: () => void;  // 超时回调
}

/**
 * 带超时的 Promise 包装
 */
export function withTimeout<T>(
  promise: Promise<T>,
  options: number | TimeoutOptions
): Promise<T> {
  const opts: TimeoutOptions = typeof options === 'number'
    ? { ms: options }
    : options;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      opts.onTimeout?.();
      reject(new TimeoutError(opts.message || `Timeout after ${opts.ms}ms`, opts.ms));
    }, opts.ms);

    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// 超时错误
export class TimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}
```

### 3.2 工具执行器带超时

```typescript
// src/tools/timed-executor.ts
import { Tool, ToolCallRequest } from '../types/tool.js';
import { withTimeout, TimeoutError } from '../utils/timeout.js';

// 执行配置
export interface ExecutionConfig {
  defaultTimeout: number;      // 默认超时（毫秒）
  maxTimeout: number;          // 最大超时
  timeouts: Record<string, number>;  // 按工具配置超时
}

const DEFAULT_CONFIG: ExecutionConfig = {
  defaultTimeout: 30000,   // 30秒
  maxTimeout: 300000,      // 5分钟
  timeouts: {
    'read_file': 10000,
    'write_file': 30000,
    'execute_command': 60000,
    'search_files': 30000,
  },
};

// 带超时的工具执行器
export class TimedToolExecutor {
  constructor(private config: ExecutionConfig = DEFAULT_CONFIG) {}

  /**
   * 执行工具（带超时）
   */
  async execute(
    tool: Tool,
    params: Record<string, any>,
    timeoutOverride?: number
  ): Promise<string> {
    // 获取超时设置
    const timeout = Math.min(
      timeoutOverride || this.config.timeouts[tool.name] || this.config.defaultTimeout,
      this.config.maxTimeout
    );

    try {
      return await withTimeout(tool.execute(params), {
        ms: timeout,
        message: `Tool '${tool.name}' execution timed out after ${timeout}ms`,
      });
    } catch (error) {
      if (error instanceof TimeoutError) {
        return `Error: ${error.message}`;
      }
      throw error;
    }
  }
}
```

## 4. 错误处理

### 4.1 错误类型

```typescript
// src/errors/tool-errors.ts

// 基础工具错误
export class ToolError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

// 权限错误
export class PermissionDeniedError extends ToolError {
  constructor(toolName: string, resource: string) {
    super(
      `Permission denied for ${toolName} on ${resource}`,
      toolName,
      'PERMISSION_DENIED'
    );
    this.name = 'PermissionDeniedError';
  }
}

// 验证错误
export class ValidationError extends ToolError {
  constructor(toolName: string, public readonly errors: string[]) {
    super(
      `Validation failed for ${toolName}: ${errors.join(', ')}`,
      toolName,
      'VALIDATION_ERROR'
    );
    this.name = 'ValidationError';
  }
}

// 资源不存在错误
export class ResourceNotFoundError extends ToolError {
  constructor(toolName: string, resource: string) {
    super(
      `Resource not found: ${resource}`,
      toolName,
      'NOT_FOUND'
    );
    this.name = 'ResourceNotFoundError';
  }
}

// 执行错误
export class ExecutionError extends ToolError {
  constructor(toolName: string, cause: Error) {
    super(
      `Execution failed for ${toolName}: ${cause.message}`,
      toolName,
      'EXECUTION_ERROR',
      cause
    );
    this.name = 'ExecutionError';
  }
}

// 速率限制错误
export class RateLimitError extends ToolError {
  constructor(toolName: string, public readonly retryAfter?: number) {
    super(
      `Rate limit exceeded for ${toolName}`,
      toolName,
      'RATE_LIMIT'
    );
    this.name = 'RateLimitError';
  }
}
```

### 4.2 统一错误处理

```typescript
// src/tools/safe-executor.ts
import { Tool } from '../types/tool.js';
import { ToolError, PermissionDeniedError, ExecutionError } from '../errors/tool-errors.js';
import { PermissionManager } from '../security/permissions.js';
import { PathValidator } from '../security/path-validator.js';
import { TimedToolExecutor } from './timed-executor.js';

// 安全执行选项
export interface SafeExecutionOptions {
  validatePaths?: boolean;
  checkPermissions?: boolean;
  timeout?: number;
  cwd?: string;
}

// 安全工具执行器
export class SafeToolExecutor {
  constructor(
    private permissionManager: PermissionManager,
    private pathValidator: PathValidator,
    private timedExecutor: TimedToolExecutor
  ) {}

  /**
   * 安全执行工具
   */
  async execute(
    tool: Tool,
    params: Record<string, any>,
    options: SafeExecutionOptions = {}
  ): Promise<{ success: boolean; result?: string; error?: ToolError }> {
    try {
      // 1. 权限检查
      if (options.checkPermissions) {
        const permissionCheck = this.checkPermissions(tool, params);
        if (!permissionCheck.allowed) {
          throw new PermissionDeniedError(tool.name, permissionCheck.resource || 'unknown');
        }
      }

      // 2. 路径验证
      if (options.validatePaths && params.path) {
        const pathCheck = this.pathValidator.validate(params.path, options.cwd);
        if (!pathCheck.valid) {
          throw new ToolError(
            `Invalid path: ${pathCheck.error}`,
            tool.name,
            'INVALID_PATH'
          );
        }
        params = { ...params, path: pathCheck.normalizedPath };
      }

      // 3. 执行（带超时）
      const result = await this.timedExecutor.execute(tool, params, options.timeout);

      return { success: true, result };

    } catch (error) {
      // 统一错误处理
      const toolError = this.normalizeError(error, tool.name);
      return { success: false, error: toolError };
    }
  }

  /**
   * 权限检查
   */
  private checkPermissions(
    tool: Tool,
    params: Record<string, any>
  ): { allowed: boolean; resource?: string } {
    // 简化实现：检查路径参数
    if (params.path) {
      const requiredLevel = this.getRequiredLevel(tool.name);
      if (!this.permissionManager.check(params.path, requiredLevel)) {
        return { allowed: false, resource: params.path };
      }
    }

    return { allowed: true };
  }

  /**
   * 获取工具所需的权限级别
   */
  private getRequiredLevel(toolName: string): 'read' | 'write' | 'execute' {
    if (toolName.includes('read') || toolName.includes('list') || toolName.includes('search')) {
      return 'read';
    }
    if (toolName.includes('execute') || toolName.includes('run')) {
      return 'execute';
    }
    return 'write';
  }

  /**
   * 标准化错误
   */
  private normalizeError(error: any, toolName: string): ToolError {
    if (error instanceof ToolError) {
      return error;
    }

    return new ExecutionError(toolName, error);
  }
}
```

## 5. 沙箱机制

### 5.1 资源限制

```typescript
// src/security/resource-limits.ts

// 资源限制配置
export interface ResourceLimits {
  maxFileSize: number;        // 最大文件大小（字节）
  maxOutputSize: number;      // 最大输出大小（字节）
  maxExecutionTime: number;   // 最大执行时间（毫秒）
  maxMemoryMB: number;        // 最大内存（MB）
  maxFileDescriptors: number; // 最大文件描述符数
}

const DEFAULT_LIMITS: ResourceLimits = {
  maxFileSize: 10 * 1024 * 1024,      // 10MB
  maxOutputSize: 1 * 1024 * 1024,     // 1MB
  maxExecutionTime: 30000,            // 30秒
  maxMemoryMB: 512,                   // 512MB
  maxFileDescriptors: 100,
};

// 资源限制器
export class ResourceLimiter {
  constructor(private limits: ResourceLimits = DEFAULT_LIMITS) {}

  /**
   * 检查文件大小
   */
  checkFileSize(size: number): { ok: boolean; error?: string } {
    if (size > this.limits.maxFileSize) {
      return {
        ok: false,
        error: `File size ${size} exceeds limit ${this.limits.maxFileSize}`,
      };
    }
    return { ok: true };
  }

  /**
   * 截断输出
   */
  truncateOutput(output: string): string {
    if (output.length > this.limits.maxOutputSize) {
      return output.slice(0, this.limits.maxOutputSize) +
        `\n... (truncated, ${output.length - this.limits.maxOutputSize} more bytes)`;
    }
    return output;
  }

  /**
   * 获取限制配置
   */
  getLimits(): ResourceLimits {
    return { ...this.limits };
  }
}
```

### 5.2 隔离执行环境

```typescript
// src/tools/sandbox-executor.ts
import { spawn, ChildProcess } from 'child_process';
import { ResourceLimiter, ResourceLimits } from '../security/resource-limits.js';
import { CommandFilter } from '../security/command-filter.js';

// 沙箱配置
export interface SandboxConfig {
  cwd?: string;                  // 工作目录
  env?: Record<string, string>;  // 环境变量
  uid?: number;                  // 用户 ID
  gid?: number;                  // 组 ID
  limits: ResourceLimits;        // 资源限制
}

// 沙箱执行器
export class SandboxExecutor {
  private commandFilter: CommandFilter;
  private resourceLimiter: ResourceLimiter;

  constructor(private config: SandboxConfig) {
    this.commandFilter = new CommandFilter();
    this.resourceLimiter = new ResourceLimiter(config.limits);
  }

  /**
   * 在沙箱中执行命令
   */
  async execute(command: string, args: string[] = []): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    // 1. 命令过滤
    const filterResult = this.commandFilter.validate(command);
    if (!filterResult.valid) {
      throw new Error(`Command rejected: ${filterResult.error}`);
    }

    // 2. 创建进程
    const childProcess = this.createProcess(command, args);

    // 3. 收集输出
    let stdout = '';
    let stderr = '';

    childProcess.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    // 4. 等待完成（带超时）
    const result = await this.waitForCompletion(childProcess);

    // 5. 截断输出
    stdout = this.resourceLimiter.truncateOutput(stdout);
    stderr = this.resourceLimiter.truncateOutput(stderr);

    return {
      stdout,
      stderr,
      exitCode: result.exitCode,
    };
  }

  /**
   * 创建子进程
   */
  private createProcess(command: string, args: string[]): ChildProcess {
    return spawn(command, args, {
      cwd: this.config.cwd,
      env: {
        ...process.env,
        ...this.config.env,
        // 限制环境变量
        NODE_OPTIONS: '--max-old-space-size=512',
      },
      // 用户/组隔离（需要 root 权限）
      // uid: this.config.uid,
      // gid: this.config.gid,
      detached: false,  // 不创建新的进程组
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }

  /**
   * 等待进程完成
   */
  private waitForCompletion(childProcess: ChildProcess): Promise<{ exitCode: number }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        childProcess.kill('SIGKILL');
        reject(new Error('Process timeout'));
      }, this.config.limits.maxExecutionTime);

      childProcess.on('close', (exitCode) => {
        clearTimeout(timeout);
        resolve({ exitCode: exitCode ?? -1 });
      });

      childProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
}
```

### 5.3 日志审计

```typescript
// src/security/audit-logger.ts

// 审计日志条目
export interface AuditLogEntry {
  timestamp: string;
  toolName: string;
  action: 'call' | 'success' | 'error';
  params?: Record<string, any>;
  result?: string;
  error?: string;
  duration?: number;
  user?: string;
  sessionId?: string;
}

// 审计日志器
export class AuditLogger {
  private entries: AuditLogEntry[] = [];
  private maxEntries: number = 10000;

  /**
   * 记录工具调用
   */
  logCall(toolName: string, params: Record<string, any>, metadata?: { user?: string; sessionId?: string }): void {
    this.addEntry({
      timestamp: new Date().toISOString(),
      toolName,
      action: 'call',
      params: this.sanitizeParams(params),
      ...metadata,
    });
  }

  /**
   * 记录成功结果
   */
  logSuccess(toolName: string, result: string, duration: number): void {
    this.addEntry({
      timestamp: new Date().toISOString(),
      toolName,
      action: 'success',
      result: this.sanitizeResult(result),
      duration,
    });
  }

  /**
   * 记录错误
   */
  logError(toolName: string, error: string): void {
    this.addEntry({
      timestamp: new Date().toISOString(),
      toolName,
      action: 'error',
      error,
    });
  }

  /**
   * 添加条目
   */
  private addEntry(entry: AuditLogEntry): void {
    this.entries.push(entry);

    // 限制日志大小
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  /**
   * 脱敏参数
   */
  private sanitizeParams(params: Record<string, any>): Record<string, any> {
    const sanitized = { ...params };

    // 脱敏敏感字段
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential'];
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * 脱敏结果
   */
  private sanitizeResult(result: string): string {
    // 截断过长的结果
    if (result.length > 1000) {
      return result.slice(0, 1000) + '...[truncated]';
    }
    return result;
  }

  /**
   * 获取所有日志
   */
  getLogs(): AuditLogEntry[] {
    return [...this.entries];
  }

  /**
   * 导出日志
   */
  exportToJson(): string {
    return JSON.stringify(this.entries, null, 2);
  }
}
```

## 6. 完整的安全工具执行器

```typescript
// src/tools/secure-tool-executor.ts
import { Tool, ToolCallRequest, ToolCallResult } from '../types/tool.js';
import { PermissionManager } from '../security/permissions.js';
import { PathValidator } from '../security/path-validator.js';
import { ResourceLimiter, ResourceLimits } from '../security/resource-limits.js';
import { AuditLogger } from '../security/audit-logger.js';
import { withTimeout } from '../utils/timeout.js';

// 安全执行配置
export interface SecureExecutionConfig {
  permissions: PermissionManager;
  pathValidator: PathValidator;
  resourceLimits: ResourceLimits;
  auditEnabled: boolean;
  defaultTimeout: number;
}

// 安全工具执行器
export class SecureToolExecutor {
  private resourceLimiter: ResourceLimiter;
  private auditLogger: AuditLogger;

  constructor(private config: SecureExecutionConfig) {
    this.resourceLimiter = new ResourceLimiter(config.resourceLimits);
    this.auditLogger = new AuditLogger();
  }

  /**
   * 安全执行工具调用
   */
  async execute(
    tool: Tool,
    request: ToolCallRequest,
    context?: { cwd?: string; user?: string; sessionId?: string }
  ): Promise<ToolCallResult> {
    const startTime = Date.now();

    // 1. 审计：记录调用
    if (this.config.auditEnabled) {
      this.auditLogger.logCall(tool.name, request.arguments, {
        user: context?.user,
        sessionId: context?.sessionId,
      });
    }

    try {
      // 2. 路径验证
      const validatedArgs = this.validatePaths(request.arguments, context?.cwd);

      // 3. 执行工具（带超时和资源限制）
      const result = await withTimeout(
        this.executeWithLimits(tool, validatedArgs),
        this.config.defaultTimeout
      );

      // 4. 审计：记录成功
      if (this.config.auditEnabled) {
        this.auditLogger.logSuccess(tool.name, result, Date.now() - startTime);
      }

      return {
        toolCallId: request.id,
        result,
        isError: false,
      };

    } catch (error: any) {
      // 5. 审计：记录错误
      if (this.config.auditEnabled) {
        this.auditLogger.logError(tool.name, error.message);
      }

      return {
        toolCallId: request.id,
        result: `Error: ${error.message}`,
        isError: true,
      };
    }
  }

  /**
   * 验证路径参数
   */
  private validatePaths(
    args: Record<string, any>,
    cwd?: string
  ): Record<string, any> {
    const result = { ...args };

    // 检查常见的路径参数
    const pathKeys = ['path', 'filePath', 'dir', 'directory', 'cwd'];
    for (const key of pathKeys) {
      if (result[key]) {
        const validation = this.config.pathValidator.validate(result[key], cwd);
        if (!validation.valid) {
          throw new Error(`Invalid path for '${key}': ${validation.error}`);
        }
        result[key] = validation.normalizedPath;
      }
    }

    return result;
  }

  /**
   * 带资源限制的执行
   */
  private async executeWithLimits(
    tool: Tool,
    args: Record<string, any>
  ): Promise<string> {
    const result = await tool.execute(args);

    // 截断输出
    return this.resourceLimiter.truncateOutput(result);
  }

  /**
   * 获取审计日志
   */
  getAuditLogs() {
    return this.auditLogger.getLogs();
  }
}
```

## 参数说明

### ResourceLimits 配置

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxFileSize` | number | 10MB | 最大文件大小 |
| `maxOutputSize` | number | 1MB | 最大输出大小 |
| `maxExecutionTime` | number | 30s | 最大执行时间 |
| `maxMemoryMB` | number | 512MB | 最大内存 |
| `maxFileDescriptors` | number | 100 | 最大文件描述符 |

### PathRestriction 配置

| 参数 | 类型 | 说明 |
|------|------|------|
| `allowedPaths` | string[] | 允许的路径列表 |
| `deniedPaths` | string[] | 禁止的路径列表 |
| `allowRelative` | boolean | 允许相对路径 |
| `allowSymlinks` | boolean | 允许符号链接 |
| `maxPathLength` | number | 最大路径长度 |

### CommandRestriction 配置

| 参数 | 类型 | 说明 |
|------|------|------|
| `allowedCommands` | string[] | 允许的命令 |
| `deniedCommands` | string[] | 禁止的命令 |
| `deniedPatterns` | RegExp[] | 禁止的模式 |
| `allowPipe` | boolean | 允许管道 |
| `allowRedirect` | boolean | 允许重定向 |

## 练习题

### 练习 1: 实现白名单模式

```typescript
// exercises/01-whitelist.ts
// TODO: 实现严格的白名单安全模式
// 要求：
// 1. 只允许预定义的工具调用
// 2. 只允许预定义的文件路径
// 3. 只允许预定义的命令

export class WhitelistSecurityPolicy {
  // TODO: 实现
  isToolAllowed(toolName: string): boolean { return false; }
  isPathAllowed(path: string): boolean { return false; }
  isCommandAllowed(command: string): boolean { return false; }
}
```

### 练习 2: 实现速率限制

```typescript
// exercises/02-rate-limiting.ts
// TODO: 实现工具调用速率限制
// 要求：
// 1. 支持按工具名限制调用频率
// 2. 支持全局调用频率限制
// 3. 超过限制时返回友好错误

export class RateLimiter {
  // TODO: 实现
  constructor(
    private maxCallsPerMinute: number,
    private perToolLimits: Record<string, number> = {}
  ) {}

  checkAllowed(toolName: string): { allowed: boolean; retryAfter?: number } {
    return { allowed: false };
  }
}
```

### 练习 3: 实现敏感信息检测

```typescript
// exercises/03-sensitive-detection.ts
// TODO: 实现敏感信息自动检测和脱敏
// 要求：
// 1. 检测 API Key、密码等敏感信息
// 2. 自动脱敏日志中的敏感信息
// 3. 阻止敏感信息输出给 AI

export class SensitiveDataFilter {
  // TODO: 实现
  detect(input: string): { hasSensitive: boolean; types: string[] } {
    return { hasSensitive: false, types: [] };
  }

  sanitize(input: string): string {
    return input;
  }
}
```

### 练习 4: 实现 Docker 沙箱

```typescript
// exercises/04-docker-sandbox.ts
// TODO: 使用 Docker 容器实现工具执行沙箱
// 要求：
// 1. 在隔离的 Docker 容器中执行命令
// 2. 限制容器资源（CPU、内存）
// 3. 自动清理容器

export class DockerSandbox {
  // TODO: 实现
  async execute(command: string, options: {
    image: string;
    timeout: number;
    memory: string;
  }): Promise<{ stdout: string; stderr: string }> {
    return { stdout: '', stderr: '' };
  }
}
```

## 下一步

恭喜完成第04章！继续学习 [第05章：会话管理](../05-session/README.md) →
