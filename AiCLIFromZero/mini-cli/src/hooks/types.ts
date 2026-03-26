// src/hooks/types.ts
// 钩子系统类型定义

/**
 * 钩子事件类型
 */
export type HookEvent =
  | 'preInput' // 用户输入前
  | 'postInput' // 用户输入后（处理后）
  | 'preToolCall' // 工具调用前
  | 'postToolCall' // 工具调用后
  | 'preResponse' // AI 响应返回前
  | 'postResponse' // AI 响应返回后
  | 'onError' // 发生错误时
  | 'onSessionStart' // 会话开始
  | 'onSessionEnd' // 会话结束
  | 'onFileRead' // 文件读取时
  | 'onFileWrite' // 文件写入时
  | 'onCommandExec'; // 命令执行时

/**
 * 钩子上下文
 */
export interface HookContext {
  // 事件名称
  event: HookEvent;

  // 时间戳
  timestamp: number;

  // 会话 ID
  sessionId?: string;

  // 输入数据
  input?: any;

  // 输出数据
  output?: any;

  // 错误信息
  error?: Error;

  // 元数据
  metadata?: Record<string, any>;
}

/**
 * 钩子结果
 */
export interface HookResult {
  // 是否继续执行
  proceed: boolean;

  // 修改后的数据
  modifiedInput?: any;
  modifiedOutput?: any;

  // 错误信息（用于中断）
  error?: string;
}

/**
 * 钩子函数类型
 */
export type HookFunction = (context: HookContext) => Promise<HookResult> | HookResult;

/**
 * 钩子定义
 */
export interface HookDefinition {
  // 钩子名称
  name: string;

  // 监听的事件
  event: HookEvent;

  // 钩子函数
  handler: HookFunction;

  // 优先级（数字越大越先执行）
  priority?: number;

  // 是否异步（不阻塞主流程）
  async?: boolean;

  // 是否启用
  enabled?: boolean;
}

/**
 * 预定义上下文结构
 */

// 用户输入上下文
export interface PreInputContext extends HookContext {
  event: 'preInput';
  input: {
    rawInput: string;
    cwd: string;
  };
}

// 工具调用上下文
export interface ToolCallContext extends HookContext {
  event: 'preToolCall' | 'postToolCall';
  input: {
    toolName: string;
    arguments: Record<string, any>;
  };
  output?: {
    result: string;
    isError: boolean;
  };
}

// AI 响应上下文
export interface ResponseContext extends HookContext {
  event: 'preResponse' | 'postResponse';
  input: {
    messages: any[];
    model: string;
  };
  output?: {
    content: string;
    toolCalls?: any[];
    usage?: {
      promptTokens: number;
      completionTokens: number;
    };
  };
}

// 文件操作上下文
export interface FileContext extends HookContext {
  event: 'onFileRead' | 'onFileWrite';
  input: {
    path: string;
    content?: string;
  };
  output?: {
    content?: string;
    success: boolean;
  };
}

// 命令执行上下文
export interface CommandContext extends HookContext {
  event: 'onCommandExec';
  input: {
    command: string;
    args?: string[];
  };
  output?: {
    stdout: string;
    stderr: string;
    exitCode: number;
  };
}

// 错误上下文
export interface ErrorContext extends HookContext {
  event: 'onError';
  error: Error;
  input?: any;
}
