# 5.1 消息数据结构

## 学习目标

理解消息类型设计，掌握多模态消息、工具调用消息的处理，以及消息序列化。

## 1. 消息类型设计

### 1.1 消息角色

在 AI 对话系统中，消息通常分为三种角色：

| 角色 | 说明 | 使用场景 |
|------|------|----------|
| `system` | 系统消息 | 设定 AI 行为、提供上下文 |
| `user` | 用户消息 | 用户的提问或指令 |
| `assistant` | AI 消息 | AI 的回复 |

### 1.2 基础消息类型

```typescript
// src/types/message.ts

// 消息角色类型
export type MessageRole = 'system' | 'user' | 'assistant';

// 基础消息接口
export interface BaseMessage {
  role: MessageRole;
  content: string;
  timestamp?: number;
  id?: string;
}

// 系统消息
export interface SystemMessage extends BaseMessage {
  role: 'system';
}

// 用户消息
export interface UserMessage extends BaseMessage {
  role: 'user';
  // 支持多模态内容
  content: string | ContentPart[];
}

// 助手消息
export interface AssistantMessage extends BaseMessage {
  role: 'assistant';
  // 可选的工具调用
  toolCalls?: ToolCall[];
  // 结束原因
  finishReason?: 'stop' | 'tool_call' | 'length' | 'content_filter';
}

// 联合消息类型
export type Message = SystemMessage | UserMessage | AssistantMessage;
```

**消息字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `role` | string | ✓ | 消息角色 |
| `content` | string/ContentPart[] | ✓ | 消息内容 |
| `timestamp` | number | - | 时间戳（毫秒） |
| `id` | string | - | 消息唯一 ID |
| `toolCalls` | ToolCall[] | - | 工具调用列表 |
| `finishReason` | string | - | 结束原因 |

## 2. 多模态消息

### 2.1 内容部分类型

```typescript
// src/types/content.ts

// 内容类型
export type ContentType = 'text' | 'image' | 'audio' | 'video';

// 文本内容
export interface TextContent {
  type: 'text';
  text: string;
}

// 图片内容
export interface ImageContent {
  type: 'image';
  // 图片来源
  source: {
    type: 'url' | 'base64';
    // URL 或 base64 数据
    url?: string;
    data?: string;
    // 媒体类型
    mediaType?: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  };
}

// 联合内容类型
export type ContentPart = TextContent | ImageContent;

// 类型守卫
export function isTextContent(content: ContentPart): content is TextContent {
  return content.type === 'text';
}

export function isImageContent(content: ContentPart): content is ImageContent {
  return content.type === 'image';
}
```

### 2.2 多模态消息示例

```typescript
// src/examples/multimodal-message.ts
import { UserMessage, ContentPart } from '../types/message.js';

// 纯文本消息
const textMessage: UserMessage = {
  role: 'user',
  content: '请解释这张图片',
  timestamp: Date.now(),
};

// 带图片的消息（URL 方式）
const imageMessageUrl: UserMessage = {
  role: 'user',
  content: [
    { type: 'text', text: '这是什么？' },
    {
      type: 'image',
      source: {
        type: 'url',
        url: 'https://example.com/image.png',
      },
    },
  ],
  timestamp: Date.now(),
};

// 带图片的消息（Base64 方式）
const imageMessageBase64: UserMessage = {
  role: 'user',
  content: [
    { type: 'text', text: '分析这张截图' },
    {
      type: 'image',
      source: {
        type: 'base64',
        data: 'iVBORw0KGgoAAAANSUhEUgAA...',  // base64 数据
        mediaType: 'image/png',
      },
    },
  ],
  timestamp: Date.now(),
};

// 多张图片的消息
const multiImageMessage: UserMessage = {
  role: 'user',
  content: [
    { type: 'text', text: '比较这两张图片的差异' },
    {
      type: 'image',
      source: { type: 'url', url: 'https://example.com/before.png' },
    },
    {
      type: 'image',
      source: { type: 'url', url: 'https://example.com/after.png' },
    },
  ],
  timestamp: Date.now(),
};
```

### 2.3 内容提取工具

```typescript
// src/utils/content-utils.ts
import { ContentPart, isTextContent, isImageContent } from '../types/content.js';

// 从内容数组提取文本
export function extractText(content: string | ContentPart[]): string {
  if (typeof content === 'string') {
    return content;
  }

  return content
    .filter(isTextContent)
    .map(c => c.text)
    .join('\n');
}

// 从内容数组提取图片
export function extractImages(content: string | ContentPart[]): ImageContent[] {
  if (typeof content === 'string') {
    return [];
  }

  return content.filter(isImageContent);
}

// 统计内容信息
export function analyzeContent(content: string | ContentPart[]): {
  textLength: number;
  imageCount: number;
  hasImages: boolean;
} {
  return {
    textLength: extractText(content).length,
    imageCount: extractImages(content).length,
    hasImages: extractImages(content).length > 0,
  };
}

// 内容转换为简单文本（用于日志等）
export function contentToString(content: string | ContentPart[]): string {
  if (typeof content === 'string') {
    return content;
  }

  return content.map(part => {
    if (part.type === 'text') {
      return part.text;
    } else if (part.type === 'image') {
      return `[Image: ${part.source.url || 'base64 data'}]`;
    }
    return '[Unknown content]';
  }).join('\n');
}
```

## 3. 工具调用消息

### 3.1 工具调用类型

```typescript
// src/types/tool-call.ts

// 工具调用
export interface ToolCall {
  // 调用 ID
  id: string;
  // 工具名称
  name: string;
  // 调用参数
  arguments: Record<string, any>;
}

// 工具结果消息
export interface ToolResultMessage {
  role: 'tool';
  // 对应的工具调用 ID
  toolCallId: string;
  // 执行结果
  content: string;
  // 是否错误
  isError?: boolean;
}

// 完整的对话消息（包含工具结果）
export type ConversationMessage =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolResultMessage;
```

### 3.2 工具调用流程示例

```typescript
// src/examples/tool-call-flow.ts
import { Message, ToolCall, ToolResultMessage } from '../types/message.js';

// 完整的工具调用对话流程
const conversationWithTools: Message[] | ToolResultMessage[] = [
  // 1. 系统消息
  {
    role: 'system',
    content: '你是一个有帮助的助手，可以使用工具来完成任务。',
  },

  // 2. 用户请求
  {
    role: 'user',
    content: '读取 package.json 文件的内容',
  },

  // 3. AI 决定调用工具
  {
    role: 'assistant',
    content: '',
    toolCalls: [
      {
        id: 'call_abc123',
        name: 'read_file',
        arguments: { path: 'package.json' },
      },
    ],
    finishReason: 'tool_call',
  },

  // 4. 工具执行结果
  {
    role: 'tool',
    toolCallId: 'call_abc123',
    content: '{"name": "my-app", "version": "1.0.0", ...}',
  },

  // 5. AI 基于结果回复
  {
    role: 'assistant',
    content: '根据 package.json 文件，这是一个名为 "my-app" 的项目，版本是 1.0.0。',
    finishReason: 'stop',
  },
];
```

### 3.3 多工具调用

```typescript
// src/examples/multi-tool-call.ts

// AI 并行调用多个工具
const multiToolCallMessage: AssistantMessage = {
  role: 'assistant',
  content: '',
  toolCalls: [
    {
      id: 'call_001',
      name: 'read_file',
      arguments: { path: 'package.json' },
    },
    {
      id: 'call_002',
      name: 'read_file',
      arguments: { path: 'tsconfig.json' },
    },
    {
      id: 'call_003',
      name: 'list_directory',
      arguments: { path: 'src' },
    },
  ],
  finishReason: 'tool_call',
};

// 对应的工具结果
const toolResults: ToolResultMessage[] = [
  {
    role: 'tool',
    toolCallId: 'call_001',
    content: '{"name": "my-app", ...}',
  },
  {
    role: 'tool',
    toolCallId: 'call_002',
    content: '{"compilerOptions": {...}}',
  },
  {
    role: 'tool',
    toolCallId: 'call_003',
    content: 'index.ts\nutils.ts\ntypes.ts',
  },
];
```

## 4. 消息序列化

### 4.1 JSON 序列化

```typescript
// src/utils/message-serializer.ts
import { Message, ToolResultMessage } from '../types/message.js';

// 序列化选项
export interface SerializeOptions {
  pretty?: boolean;           // 美化输出
  includeTimestamp?: boolean; // 包含时间戳
  includeId?: boolean;        // 包含 ID
}

// 序列化消息
export function serializeMessage(
  message: Message | ToolResultMessage,
  options: SerializeOptions = {}
): string {
  const obj = { ...message };

  // 根据选项过滤字段
  if (!options.includeTimestamp) {
    delete (obj as any).timestamp;
  }
  if (!options.includeId) {
    delete (obj as any).id;
  }

  return JSON.stringify(obj, null, options.pretty ? 2 : 0);
}

// 序列化消息数组
export function serializeMessages(
  messages: (Message | ToolResultMessage)[],
  options: SerializeOptions = {}
): string {
  return JSON.stringify(messages, null, options.pretty ? 2 : 0);
}

// 反序列化消息
export function deserializeMessage(json: string): Message | ToolResultMessage {
  const obj = JSON.parse(json);
  return validateMessage(obj);
}

// 反序列化消息数组
export function deserializeMessages(json: string): (Message | ToolResultMessage)[] {
  const arr = JSON.parse(json);
  return arr.map(validateMessage);
}

// 验证消息格式
function validateMessage(obj: any): Message | ToolResultMessage {
  if (!obj.role) {
    throw new Error('Message must have a role');
  }

  // 工具结果消息
  if (obj.role === 'tool') {
    if (!obj.toolCallId) {
      throw new Error('Tool message must have toolCallId');
    }
    return obj as ToolResultMessage;
  }

  // 其他消息类型
  if (!obj.content) {
    throw new Error('Message must have content');
  }

  return obj as Message;
}
```

### 4.2 Markdown 格式导出

```typescript
// src/utils/markdown-exporter.ts
import { Message, ToolResultMessage } from '../types/message.js';
import { contentToString } from './content-utils.js';

// 导出对话为 Markdown
export function exportToMarkdown(
  messages: (Message | ToolResultMessage)[],
  options: { title?: string } = {}
): string {
  const lines: string[] = [];

  // 标题
  if (options.title) {
    lines.push(`# ${options.title}`);
    lines.push('');
  }

  // 导出时间
  lines.push(`> Exported at: ${new Date().toISOString()}`);
  lines.push('');

  // 消息
  for (const message of messages) {
    lines.push(formatMessageInMarkdown(message));
    lines.push('');
  }

  return lines.join('\n');
}

// 格式化单条消息
function formatMessageInMarkdown(message: Message | ToolResultMessage): string {
  switch (message.role) {
    case 'system':
      return `### System\n\n> ${message.content}`;

    case 'user':
      const userContent = contentToString(message.content);
      return `### User\n\n${userContent}`;

    case 'assistant':
      let assistantText = `### Assistant\n\n${message.content || ''}`;

      // 添加工具调用信息
      if (message.toolCalls && message.toolCalls.length > 0) {
        assistantText += '\n\n**Tool Calls:**\n';
        for (const call of message.toolCalls) {
          assistantText += `- \`${call.name}(${JSON.stringify(call.arguments)})\`\n`;
        }
      }

      return assistantText;

    case 'tool':
      return `### Tool Result (${message.toolCallId})\n\n\`\`\`\n${message.content}\n\`\`\``;
  }
}
```

### 4.3 消息压缩

```typescript
// src/utils/message-compressor.ts
import { Message, AssistantMessage } from '../types/message.js';

// 压缩选项
export interface CompressionOptions {
  maxContentLength?: number;    // 最大内容长度
  keepToolCalls?: boolean;      // 保留工具调用
  keepSystemMessages?: boolean; // 保留系统消息
}

// 压缩消息内容
export function compressMessage(
  message: Message,
  options: CompressionOptions = {}
): Message {
  const maxLen = options.maxContentLength || 1000;

  // 克隆消息
  const compressed = { ...message };

  // 压缩内容
  if (typeof compressed.content === 'string' && compressed.content.length > maxLen) {
    compressed.content = compressed.content.slice(0, maxLen) +
      `\n... [truncated ${compressed.content.length - maxLen} chars]`;
  }

  // 可选：移除工具调用
  if (!options.keepToolCalls && (compressed as AssistantMessage).toolCalls) {
    delete (compressed as AssistantMessage).toolCalls;
  }

  return compressed;
}

// 压缩消息数组
export function compressMessages(
  messages: Message[],
  options: CompressionOptions = {}
): Message[] {
  return messages.map(msg => {
    // 系统消息可选保留
    if (msg.role === 'system' && options.keepSystemMessages) {
      return msg;
    }
    return compressMessage(msg, options);
  });
}

// 智能压缩：保留关键信息
export function smartCompress(
  messages: Message[],
  targetTokens: number
): Message[] {
  // 简化实现：从头开始移除旧消息
  if (estimateTokens(messages) <= targetTokens) {
    return messages;
  }

  const result = [...messages];

  // 保留最后一条系统消息
  const systemIndex = result.findIndex(m => m.role === 'system');
  const systemMessage = systemIndex >= 0 ? result.splice(systemIndex, 1)[0] : null;

  // 移除旧的用户/助手消息
  while (estimateTokens(result) > targetTokens && result.length > 2) {
    // 移除最早的非系统消息
    const firstNonSystem = result.findIndex(m => m.role !== 'system');
    if (firstNonSystem >= 0) {
      result.splice(firstNonSystem, 1);
    } else {
      break;
    }
  }

  // 重新添加系统消息
  if (systemMessage) {
    result.unshift(systemMessage);
  }

  return result;
}

// 估算 token 数（简化版）
function estimateTokens(messages: Message[]): number {
  let total = 0;
  for (const msg of messages) {
    const content = typeof msg.content === 'string' ? msg.content : '';
    // 粗略估计：4 字符 ≈ 1 token
    total += Math.ceil(content.length / 4);
  }
  return total;
}
```

## 5. 消息构建器

### 5.1 流畅的消息构建

```typescript
// src/utils/message-builder.ts
import {
  Message,
  UserMessage,
  AssistantMessage,
  SystemMessage,
  ToolResultMessage,
  ToolCall,
  ContentPart,
} from '../types/message.js';

export class MessageBuilder {
  private messages: (Message | ToolResultMessage)[] = [];

  /**
   * 添加系统消息
   */
  system(content: string): this {
    this.messages.push({
      role: 'system',
      content,
      timestamp: Date.now(),
    });
    return this;
  }

  /**
   * 添加用户文本消息
   */
  user(content: string | ContentPart[]): this {
    this.messages.push({
      role: 'user',
      content,
      timestamp: Date.now(),
    });
    return this;
  }

  /**
   * 添加带图片的用户消息
   */
  userWithImage(text: string, imageUrl: string): this {
    this.messages.push({
      role: 'user',
      content: [
        { type: 'text', text },
        {
          type: 'image',
          source: { type: 'url', url: imageUrl },
        },
      ],
      timestamp: Date.now(),
    });
    return this;
  }

  /**
   * 添加助手消息
   */
  assistant(content: string, toolCalls?: ToolCall[]): this {
    this.messages.push({
      role: 'assistant',
      content,
      toolCalls,
      timestamp: Date.now(),
    });
    return this;
  }

  /**
   * 添加工具结果
   */
  toolResult(toolCallId: string, content: string, isError?: boolean): this {
    this.messages.push({
      role: 'tool',
      toolCallId,
      content,
      isError,
    });
    return this;
  }

  /**
   * 批量添加工具结果
   */
  toolResults(results: ToolResultMessage[]): this {
    this.messages.push(...results);
    return this;
  }

  /**
   * 获取所有消息
   */
  build(): (Message | ToolResultMessage)[] {
    return [...this.messages];
  }

  /**
   * 获取消息数量
   */
  count(): number {
    return this.messages.length;
  }

  /**
   * 获取最后一条消息
   */
  last(): Message | ToolResultMessage | undefined {
    return this.messages[this.messages.length - 1];
  }

  /**
   * 清空消息
   */
  clear(): this {
    this.messages = [];
    return this;
  }

  /**
   * 移除最后一条消息
   */
  pop(): Message | ToolResultMessage | undefined {
    return this.messages.pop();
  }
}

// 使用示例
const conversation = new MessageBuilder()
  .system('你是一个有帮助的助手。')
  .user('读取 package.json')
  .assistant('', [{ id: '1', name: 'read_file', arguments: { path: 'package.json' } }])
  .toolResult('1', '{"name": "my-app"}')
  .assistant('项目名称是 my-app')
  .build();
```

## 参数说明

### Message 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `role` | 'system' \| 'user' \| 'assistant' \| 'tool' | ✓ | 消息角色 |
| `content` | string \| ContentPart[] | ✓ | 消息内容 |
| `timestamp` | number | - | 创建时间戳 |
| `id` | string | - | 唯一标识 |
| `toolCalls` | ToolCall[] | - | 工具调用列表 |
| `finishReason` | string | - | 结束原因 |

### ToolCall 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 调用唯一 ID |
| `name` | string | 工具名称 |
| `arguments` | object | 调用参数 |

### ContentPart 类型

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | 'text' \| 'image' | 内容类型 |
| `text` | string | 文本内容（type='text'） |
| `source` | object | 图片来源（type='image'） |

## 练习题

### 练习 1: 实现消息去重

```typescript
// exercises/01-deduplication.ts
// TODO: 实现消息去重功能
// 要求：
// 1. 检测并移除重复的消息
// 2. 考虑内容相同的消息
// 3. 保留最新的消息

export function deduplicateMessages(
  messages: Message[]
): Message[] {
  // TODO: 实现
  return messages;
}
```

### 练习 2: 实现消息搜索

```typescript
// exercises/02-search.ts
// TODO: 实现消息搜索功能
// 要求：
// 1. 支持按关键词搜索
// 2. 支持按角色过滤
// 3. 支持按时间范围过滤

export function searchMessages(
  messages: Message[],
  options: {
    keyword?: string;
    role?: MessageRole;
    startTime?: number;
    endTime?: number;
  }
): Message[] {
  // TODO: 实现
  return messages;
}
```

### 练习 3: 实现消息摘要

```typescript
// exercises/03-summary.ts
// TODO: 实现对话摘要功能
// 要求：
// 1. 提取关键信息
// 2. 压缩冗余内容
// 3. 保留上下文完整性

export function summarizeConversation(
  messages: Message[]
): string {
  // TODO: 实现
  return '';
}
```

### 练习 4: 实现消息差异比较

```typescript
// exercises/04-diff.ts
// TODO: 实现两个对话的差异比较
// 要求：
// 1. 找出新增的消息
// 2. 找出删除的消息
// 3. 找出修改的消息

export function diffConversations(
  oldMessages: Message[],
  newMessages: Message[]
): {
  added: Message[];
  removed: Message[];
  modified: Message[];
} {
  // TODO: 实现
  return { added: [], removed: [], modified: [] };
}
```

## 下一步

完成本节后，继续学习 [5.2 会话存储](./02-session-storage.md) →
