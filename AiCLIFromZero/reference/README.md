# 快速参考

本目录包含 AI CLI 开发的快速参考指南。

## 目录

- [API 参考](./api-reference.md) - 核心 API 速查
- [TypeScript 类型](./types-reference.md) - 常用类型定义
- [错误处理](./error-handling.md) - 错误处理模式
- [最佳实践](./best-practices.md) - 开发最佳实践

## 常用命令速查

### 项目初始化

```bash
# 创建项目
mkdir mini-ai-cli && cd mini-ai-cli
pnpm init

# 安装核心依赖
pnpm add typescript tsx commander chalk openai @anthropic-ai/sdk

# 安装开发依赖
pnpm add -D @types/node vitest
```

### 开发命令

```bash
# 运行开发模式
tsx src/index.ts chat

# 运行测试
pnpm vitest

# 构建生产版本
pnpm tsc
```

### CLI 命令

```bash
# 启动交互式聊天
mini-cli chat

# 快速提问
mini-cli "解释 TypeScript 泛型"

# 指定模型
mini-cli chat --model claude

# 显示帮助
mini-cli --help
```

## 架构图速览

### Provider 模式

```
┌─────────────────┐
│  Provider 接口  │
│  • chat()       │
│  • stream()     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌───▼───┐
│OpenAI │ │Anthropic│
└───────┘ └────────┘
```

### 工具调用流程

```
用户输入 → AI 处理 → 工具调用 → 执行 → 结果 → AI 处理 → 输出
```

### 会话管理

```
Session
├── messages: Message[]
├── metadata: Metadata
└── storage: Storage
```

## 常见问题

### Q: 如何处理 API 超时？

```typescript
const result = await withTimeout(
  provider.chat(messages),
  30000  // 30 秒超时
);
```

### Q: 如何实现流式输出？

```typescript
for await (const chunk of provider.stream(messages)) {
  process.stdout.write(chunk.delta);
}
```

### Q: 如何添加自定义工具？

```typescript
toolRegistry.register({
  name: 'my_tool',
  description: 'My custom tool',
  parameters: { ... },
  execute: async (params) => { ... }
});
```

### Q: 如何管理上下文窗口？

```typescript
// 检查 token 数量
const tokens = tokenizer.count(messages);

// 如果超出限制，压缩或截断
if (tokens > maxTokens) {
  messages = await compressMessages(messages);
}
```
