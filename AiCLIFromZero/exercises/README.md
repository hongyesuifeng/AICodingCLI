# 练习题

本目录包含各章节的练习题，用于巩固学习内容。

## 练习列表

### 第01章：基础入门

| 练习 | 文件 | 难度 | 知识点 |
|------|------|------|--------|
| 1.1 实现带超时的请求 | `01-foundation/timeout.ts` | ⭐ | Promise, async/await |
| 1.2 实现并发控制 | `01-foundation/concurrency.ts` | ⭐⭐ | Promise, 异步控制 |
| 1.3 实现流式处理 | `01-foundation/stream.ts` | ⭐⭐ | Stream, Generator |

### 第02章：AI 模型集成

| 练习 | 文件 | 难度 | 知识点 |
|------|------|------|--------|
| 2.1 实现 Provider 缓存 | `02-ai-integration/cache.ts` | ⭐⭐ | Provider 模式 |
| 2.2 实现请求日志 | `02-ai-integration/logger.ts` | ⭐ | 中间件 |
| 2.3 实现超时处理 | `02-ai-integration/timeout.ts` | ⭐ | 错误处理 |

### 第03章：流式输出

| 练习 | 文件 | 难度 | 知识点 |
|------|------|------|--------|
| 3.1 实现 SSE 解析 | `03-streaming/sse-parser.ts` | ⭐⭐ | SSE, 解析 |
| 3.2 实现平滑输出 | `03-streaming/smooth-output.ts` | ⭐ | 动画 |
| 3.3 实现代码块检测 | `03-streaming/code-block.ts` | ⭐⭐ | Buffer, 解析 |

### 第04章：工具系统

| 练习 | 文件 | 难度 | 知识点 |
|------|------|------|--------|
| 4.1 实现文件搜索工具 | `04-tool-system/search.ts` | ⭐⭐ | 文件操作 |
| 4.2 实现工具验证 | `04-tool-system/validation.ts` | ⭐ | Schema 验证 |
| 4.3 实现工具链 | `04-tool-system/chain.ts` | ⭐⭐⭐ | 工具编排 |

### 第05章：会话管理

| 练习 | 文件 | 难度 | 知识点 |
|------|------|------|--------|
| 5.1 实现会话导出 | `05-session/export.ts` | ⭐ | 序列化 |
| 5.2 实现上下文压缩 | `05-session/compress.ts` | ⭐⭐⭐ | Token 优化 |
| 5.3 实现会话分支 | `05-session/branch.ts` | ⭐⭐ | 数据结构 |

### 第06章：CLI 界面

| 练习 | 文件 | 难度 | 知识点 |
|------|------|------|--------|
| 6.1 实现自动补全 | `06-cli-interface/autocomplete.ts` | ⭐⭐ | readline |
| 6.2 实现 Markdown 渲染 | `06-cli-interface/markdown.ts` | ⭐⭐ | 解析, 高亮 |
| 6.3 实现命令历史 | `06-cli-interface/history.ts` | ⭐ | 文件操作 |

### 第07章：高级功能

| 练习 | 文件 | 难度 | 知识点 |
|------|------|------|--------|
| 7.1 实现 MCP 客户端 | `07-advanced/mcp-client.ts` | ⭐⭐⭐ | JSON-RPC |
| 7.2 实现自定义技能 | `07-advanced/custom-skill.ts` | ⭐⭐ | 技能系统 |
| 7.3 实现文件监控钩子 | `07-advanced/file-watch-hook.ts` | ⭐⭐ | 钩子系统 |

## 练习模板

每个练习都包含：

1. **问题描述**: 明确需要实现什么
2. **接口定义**: 给出类型签名
3. **测试用例**: 验证实现正确性
4. **提示**: 解决思路

## 运行练习

```bash
# 进入练习目录
cd exercises/01-foundation

# 运行测试
npx vitest timeout.test.ts

# 查看答案
cat solutions/timeout.ts
```

## 贡献练习

欢迎提交新的练习题！

1. 在对应章节目录创建练习文件
2. 包含问题描述和测试用例
3. 提供参考解决方案
