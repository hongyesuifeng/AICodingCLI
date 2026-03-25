# 8.3 测试和调试

## 学习目标

掌握单元测试、集成测试、Mock API 和测试覆盖率的实现。

## 1. 测试框架设置

### 1.1 Jest 配置

```typescript
// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/bin.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
};

export default config;
```

### 1.2 测试设置

```typescript
// tests/setup.ts
import { beforeAll, afterAll, afterEach } from '@jest/globals';

// 增加超时时间
jest.setTimeout(30000);

// 全局设置
beforeAll(async () => {
  // 设置测试环境变量
  process.env.NODE_ENV = 'test';
  process.env.OPENAI_API_KEY = 'test-api-key';
});

// 清理
afterEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  // 清理测试数据
});
```

## 2. 单元测试

### 2.1 工具测试

```typescript
// tests/unit/tools/registry.test.ts
import { ToolRegistry } from '@/services/tools/registry';
import { Tool } from '@/base/types';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register', () => {
    it('should register a tool', () => {
      const tool: Tool = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: { type: 'object', properties: {} },
        execute: jest.fn(),
      };

      registry.register(tool);

      expect(registry.get('test_tool')).toBe(tool);
    });

    it('should throw error for duplicate tool name', () => {
      const tool: Tool = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: { type: 'object', properties: {} },
        execute: jest.fn(),
      };

      registry.register(tool);

      expect(() => registry.register(tool)).toThrow('already registered');
    });
  });

  describe('get', () => {
    it('should return undefined for unknown tool', () => {
      expect(registry.get('unknown')).toBeUndefined();
    });

    it('should return registered tool', () => {
      const tool: Tool = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: { type: 'object', properties: {} },
        execute: jest.fn(),
      };

      registry.register(tool);

      expect(registry.get('test_tool')).toBe(tool);
    });
  });

  describe('list', () => {
    it('should return empty array when no tools registered', () => {
      expect(registry.list()).toEqual([]);
    });

    it('should return all registered tools', () => {
      const tool1: Tool = {
        name: 'tool1',
        description: 'Tool 1',
        parameters: { type: 'object', properties: {} },
        execute: jest.fn(),
      };
      const tool2: Tool = {
        name: 'tool2',
        description: 'Tool 2',
        parameters: { type: 'object', properties: {} },
        execute: jest.fn(),
      };

      registry.register(tool1);
      registry.register(tool2);

      expect(registry.list()).toHaveLength(2);
      expect(registry.list()).toContainEqual(tool1);
      expect(registry.list()).toContainEqual(tool2);
    });
  });
});
```

### 2.2 消息解析测试

```typescript
// tests/unit/utils/message-parser.test.ts
import { MessageBuilder } from '@/utils/message-builder';
import { extractText } from '@/utils/content-utils';

describe('MessageBuilder', () => {
  let builder: MessageBuilder;

  beforeEach(() => {
    builder = new MessageBuilder();
  });

  describe('system', () => {
    it('should add system message', () => {
      builder.system('You are a helpful assistant.');

      const messages = builder.build();

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant.',
        timestamp: expect.any(Number),
      });
    });
  });

  describe('user', () => {
    it('should add user message with string content', () => {
      builder.user('Hello!');

      const messages = builder.build();

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Hello!');
    });

    it('should add user message with content parts', () => {
      builder.user([
        { type: 'text', text: 'What is this?' },
        { type: 'image', source: { type: 'url', url: 'http://example.com/image.png' } },
      ]);

      const messages = builder.build();

      expect(messages[0].content).toHaveLength(2);
    });
  });

  describe('assistant', () => {
    it('should add assistant message', () => {
      builder.assistant('Hello! How can I help?');

      const messages = builder.build();

      expect(messages[0].role).toBe('assistant');
      expect(messages[0].content).toBe('Hello! How can I help?');
    });

    it('should add assistant message with tool calls', () => {
      builder.assistant('', [
        { id: 'call_1', name: 'read_file', arguments: { path: '/test.txt' } },
      ]);

      const messages = builder.build();

      expect(messages[0].toolCalls).toHaveLength(1);
      expect(messages[0].toolCalls![0].name).toBe('read_file');
    });
  });

  describe('toolResult', () => {
    it('should add tool result message', () => {
      builder.toolResult('call_1', 'File content');

      const messages = builder.build();

      expect(messages[0]).toEqual({
        role: 'tool',
        toolCallId: 'call_1',
        content: 'File content',
      });
    });
  });

  describe('build', () => {
    it('should return copy of messages', () => {
      builder.user('Hello');
      const messages1 = builder.build();
      const messages2 = builder.build();

      expect(messages1).not.toBe(messages2);
      expect(messages1).toEqual(messages2);
    });
  });

  describe('clear', () => {
    it('should clear all messages', () => {
      builder.user('Hello');
      builder.clear();

      expect(builder.build()).toHaveLength(0);
    });
  });
});

describe('content-utils', () => {
  describe('extractText', () => {
    it('should return string content as is', () => {
      expect(extractText('Hello')).toBe('Hello');
    });

    it('should extract text from content parts', () => {
      const content = [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'World' },
      ];

      expect(extractText(content as any)).toBe('Hello \nWorld');
    });
  });
});
```

### 2.3 配置加载测试

```typescript
// tests/unit/config/loader.test.ts
import { loadConfig, saveConfig } from '@/services/config/loader';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');

describe('ConfigLoader', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadConfig', () => {
    it('should return default config when no file exists', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const config = await loadConfig();

      expect(config.provider.type).toBe('openai');
      expect(config.agent.maxIterations).toBe(10);
    });

    it('should merge file config with defaults', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        provider: { model: 'gpt-4' },
      }));

      const config = await loadConfig();

      expect(config.provider.model).toBe('gpt-4');
      expect(config.agent.maxIterations).toBe(10); // default preserved
    });

    it('should apply environment variable overrides', async () => {
      process.env.OPENAI_API_KEY = 'env-api-key';
      process.env.MINICODE_MODEL = 'env-model';

      mockFs.existsSync.mockReturnValue(false);

      const config = await loadConfig();

      expect(config.provider.apiKey).toBe('env-api-key');
      expect(config.provider.model).toBe('env-model');

      delete process.env.OPENAI_API_KEY;
      delete process.env.MINICODE_MODEL;
    });

    it('should handle invalid JSON gracefully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');

      const config = await loadConfig();

      // Should return default config
      expect(config.provider.type).toBe('openai');
    });
  });

  describe('saveConfig', () => {
    it('should save config to file', async () => {
      const config = {
        provider: { type: 'openai', model: 'gpt-4' },
        tools: { enabled: [], disabled: [], permissions: {} },
        agent: { maxIterations: 10 },
        storage: { type: 'file' as const },
        ui: { theme: 'default' as const, streaming: true, showTokens: true },
        hooks: [],
      };

      await saveConfig(config, '.test-config.json');

      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        '.test-config.json',
        expect.any(String),
        'utf-8'
      );
    });
  });
});
```

## 3. 集成测试

### 3.1 Agent 集成测试

```typescript
// tests/integration/agent.test.ts
import { AgentRunner } from '@/core/agent';
import { ToolRegistry } from '@/services/tools/registry';
import { createMockProvider } from '../mocks/provider';

describe('AgentRunner Integration', () => {
  let agent: AgentRunner;
  let mockProvider: any;
  let toolRegistry: ToolRegistry;

  beforeEach(() => {
    mockProvider = createMockProvider();
    toolRegistry = new ToolRegistry();

    agent = new AgentRunner(mockProvider, toolRegistry, {
      maxIterations: 5,
      systemPrompt: 'You are a helpful assistant.',
    });
  });

  describe('run', () => {
    it('should return response without tool calls', async () => {
      mockProvider.chatWithTools.mockResolvedValue({
        content: 'Hello! How can I help?',
        toolCalls: [],
      });

      const response = await agent.run('Hello');

      expect(response).toBe('Hello! How can I help?');
      expect(mockProvider.chatWithTools).toHaveBeenCalledTimes(1);
    });

    it('should execute tool calls and continue', async () => {
      // 注册工具
      toolRegistry.register({
        name: 'get_time',
        description: 'Get current time',
        parameters: { type: 'object', properties: {} },
        execute: jest.fn().mockResolvedValue('2024-01-01 12:00:00'),
      });

      // 模拟响应序列
      mockProvider.chatWithTools
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: '1', name: 'get_time', arguments: {} }],
        })
        .mockResolvedValueOnce({
          content: 'The current time is 2024-01-01 12:00:00',
          toolCalls: [],
        });

      const response = await agent.run('What time is it?');

      expect(response).toBe('The current time is 2024-01-01 12:00:00');
      expect(mockProvider.chatWithTools).toHaveBeenCalledTimes(2);
    });

    it('should stop after max iterations', async () => {
      mockProvider.chatWithTools.mockResolvedValue({
        content: '',
        toolCalls: [{ id: '1', name: 'tool', arguments: {} }],
      });

      await expect(agent.run('test')).rejects.toThrow('Max iterations reached');
    });
  });

  describe('runStream', () => {
    it('should yield chunks', async () => {
      mockProvider.stream.mockImplementation(async function* () {
        yield { delta: 'Hello', done: false };
        yield { delta: ' ', done: false };
        yield { delta: 'World', done: false };
        yield { delta: '', done: true };
      });

      const chunks: string[] = [];
      for await (const chunk of agent.runStream('test')) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello', ' ', 'World']);
    });
  });
});
```

### 3.2 会话管理测试

```typescript
// tests/integration/session.test.ts
import { SessionManager } from '@/core/session';
import { MemoryStorage } from '@/services/storage/memory';

describe('SessionManager Integration', () => {
  let manager: SessionManager;
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    manager = new SessionManager(storage);
  });

  describe('createSession', () => {
    it('should create and store session', async () => {
      const session = await manager.createSession();

      expect(session.id).toBeDefined();
      expect(session.messages).toEqual([]);
      expect(session.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it('should set as current session', async () => {
      const session = await manager.createSession();

      expect(manager.getCurrentSession()?.id).toBe(session.id);
    });
  });

  describe('loadSession', () => {
    it('should load existing session', async () => {
      const created = await manager.createSession();
      await manager.addMessage({ role: 'user', content: 'Hello' });

      // 创建新管理器
      const newManager = new SessionManager(storage);
      const loaded = await newManager.loadSession(created.id);

      expect(loaded).toBeDefined();
      expect(loaded?.messages).toHaveLength(1);
    });

    it('should return null for unknown session', async () => {
      const loaded = await manager.loadSession('unknown');
      expect(loaded).toBeNull();
    });
  });

  describe('addMessage', () => {
    it('should add message to current session', async () => {
      await manager.createSession();
      await manager.addMessage({ role: 'user', content: 'Hello' });

      const session = manager.getCurrentSession();
      expect(session?.messages).toHaveLength(1);
      expect(session?.messages[0].content).toBe('Hello');
    });

    it('should create session if none exists', async () => {
      await manager.addMessage({ role: 'user', content: 'Hello' });

      expect(manager.getCurrentSession()).toBeDefined();
    });

    it('should update updatedAt timestamp', async () => {
      const session = await manager.createSession();
      const originalTime = session.updatedAt;

      // 等待一小段时间
      await new Promise(r => setTimeout(r, 10));

      await manager.addMessage({ role: 'user', content: 'Hello' });

      const updated = manager.getCurrentSession();
      expect(updated?.updatedAt).toBeGreaterThan(originalTime);
    });
  });

  describe('listSessions', () => {
    it('should list all sessions sorted by updatedAt', async () => {
      const session1 = await manager.createSession();
      await new Promise(r => setTimeout(r, 10));
      const session2 = await manager.createSession();

      // 更新 session1
      await manager.loadSession(session1.id);
      await manager.addMessage({ role: 'user', content: 'Test' });

      const sessions = await manager.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe(session1.id); // 最近更新
    });
  });
});
```

## 4. Mock API

### 4.1 Provider Mock

```typescript
// tests/mocks/provider.ts
import { IAIProvider } from '@/services/providers/interface';

// 创建 Mock Provider
export function createMockProvider(): jest.Mocked<IAIProvider> {
  return {
    name: 'mock',
    model: 'mock-model',

    chat: jest.fn().mockResolvedValue({
      content: 'Mock response',
      finishReason: 'stop',
    }),

    stream: jest.fn().mockImplementation(async function* () {
      yield { delta: 'Mock ', done: false };
      yield { delta: 'response', done: false };
      yield { delta: '', done: true };
    }),

    chatWithTools: jest.fn().mockResolvedValue({
      content: 'Mock response',
      toolCalls: [],
      finishReason: 'stop',
    }),

    capabilities: jest.fn().mockReturnValue({
      streaming: true,
      tools: true,
      vision: false,
      maxContextTokens: 4096,
      supportedModels: ['mock-model'],
    }),
  };
}
```

### 4.2 Storage Mock

```typescript
// tests/mocks/storage.ts
import { IStorage } from '@/services/storage/interface';

// 创建 Mock Storage
export function createMockStorage(): jest.Mocked<IStorage> {
  const store = new Map<string, any>();

  return {
    get: jest.fn((key: string) => Promise.resolve(store.get(key))),
    set: jest.fn((key: string, value: any) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    delete: jest.fn((key: string) => {
      const existed = store.has(key);
      store.delete(key);
      return Promise.resolve(existed);
    }),
    list: jest.fn(() => Promise.resolve(Array.from(store.keys()))),
  };
}
```

### 4.3 工具 Mock

```typescript
// tests/mocks/tools.ts
import { Tool } from '@/base/types';

// 创建 Mock 工具
export function createMockTool(overrides: Partial<Tool> = {}): Tool {
  return {
    name: 'mock_tool',
    description: 'A mock tool for testing',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: jest.fn().mockResolvedValue('Mock result'),
    ...overrides,
  };
}

// 创建文件工具集合
export function createMockFileTools(): Record<string, Tool> {
  return {
    read_file: createMockTool({
      name: 'read_file',
      execute: jest.fn().mockResolvedValue('Mock file content'),
    }),
    write_file: createMockTool({
      name: 'write_file',
      execute: jest.fn().mockResolvedValue('File written successfully'),
    }),
    list_directory: createMockTool({
      name: 'list_directory',
      execute: jest.fn().mockResolvedValue('file1.txt\nfile2.txt'),
    }),
  };
}
```

## 5. 测试覆盖率

### 5.1 覆盖率报告

```bash
# 运行测试并生成覆盖率报告
npm test -- --coverage

# 输出示例
# --------------------------------|---------|----------|---------|---------|
# File                            | % Stmts | % Branch | % Funcs | % Lines |
# --------------------------------|---------|----------|---------|---------|
# All files                       |   85.23 |    78.45 |   82.14 |   84.89 |
#  src/base/errors.ts             |     100 |      100 |     100 |     100 |
#  src/core/agent/index.ts        |   92.31 |    85.71 |   88.89 |   91.67 |
#  src/core/session/index.ts      |   87.50 |    75.00 |   83.33 |   86.67 |
#  src/services/tools/registry.ts |   95.24 |    90.00 |     100 |   94.74 |
# --------------------------------|---------|----------|---------|---------|
```

### 5.2 覆盖率配置

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --reporters=default --reporters=jest-junit"
  },
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 70,
        "functions": 70,
        "lines": 70,
        "statements": 70
      }
    }
  }
}
```

## 练习题

### 练习 1: 实现端到端测试

```typescript
// exercises/01-e2e-test.ts
// TODO: 实现端到端测试
// 要求：
// 1. 启动完整应用
// 2. 模拟用户输入
// 3. 验证输出结果

describe('E2E Tests', () => {
  // TODO: 实现
});
```

### 练习 2: 实现性能测试

```typescript
// exercises/02-performance-test.ts
// TODO: 实现性能基准测试
// 要求：
// 1. 测量关键操作耗时
// 2. 设置性能阈值
// 3. 生成性能报告

describe('Performance Tests', () => {
  // TODO: 实现
});
```

### 练习 3: 实现测试工具

```typescript
// exercises/03-test-utils.ts
// TODO: 实现测试辅助工具
// 要求：
// 1. 测试数据生成器
// 2. 断言辅助函数
// 3. Mock 工厂函数

export class TestUtils {
  // TODO: 实现
}
```

### 练习 4: 实现快照测试

```typescript
// exercises/04-snapshot-test.ts
// TODO: 实现快照测试
// 要求：
// 1. 捕获输出快照
// 2. 比较快照变化
// 3. 更新快照机制

describe('Snapshot Tests', () => {
  // TODO: 实现
});
```

## 下一步

完成本节后，继续学习 [8.4 打包发布](./04-publishing.md) →
