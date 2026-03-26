# Mini-CLI 能力测试计划

本文档用于全面测试 mini-cli 的各项能力，确保其满足基本的 AI CLI coding 需求。

## 测试环境准备

```bash
# 1. 编译项目
npm run build

# 2. 配置环境变量（确保 .env 文件已配置 MINIMAX_API_KEY）
cat .env

# 3. 全局安装（可选）
npm link
```

---

## 第一部分：基础能力测试

### 1.1 CLI 启动与帮助

| 测试项 | 命令 | 预期结果 | 状态 |
|--------|------|----------|------|
| 查看帮助 | `node dist/index.js --help` | 显示所有可用命令（包括 commit、git-status、skills） | ⬜ |
| 查看版本 | `node dist/index.js --version` | 显示版本号 | ⬜ |
| 查看模型列表 | `node dist/index.js models` | 显示支持的模型列表 | ⬜ |
| 查看技能列表 | `node dist/index.js skills` | 显示所有可用技能 | ⬜ |

### 1.2 单次问答 (ask 命令)

| 测试项 | 命令 | 预期结果 | 状态 |
|--------|------|----------|------|
| 简单问题 | `node dist/index.js ask "1+1等于几？"` | 返回正确答案 | ⬜ |
| 代码生成 | `node dist/index.js ask "用JS写一个冒泡排序"` | 返回可执行代码 | ⬜ |
| 指定模型 | `node dist/index.js ask "你好" -m MiniMax-M2.5` | 使用指定模型响应 | ⬜ |
| 流式输出 | `node dist/index.js ask "介绍一下TypeScript"` | 流式输出内容 | ⬜ |

### 1.3 交互式聊天 (chat 命令)

| 测试项 | 操作 | 预期结果 | 状态 |
|--------|------|----------|------|
| 启动聊天 | `node dist/index.js chat` | 进入交互模式，显示欢迎信息和技能提示 | ⬜ |
| 多轮对话 | 输入多个相关问题 | 保持上下文连贯 | ⬜ |
| 命令补全 | 按 Tab 键 | 自动补全命令 | ⬜ |
| 查看帮助 | 输入 `/help` | 显示可用技能和命令 | ⬜ |
| 切换模型 | 输入 `/model MiniMax-M1` | 切换成功提示 | ⬜ |
| 查看会话信息 | 输入 `/session info` | 显示当前会话信息 | ⬜ |
| 查看统计 | 输入 `/session stats` | 显示 token 和成本统计 | ⬜ |
| 清空会话 | 输入 `/session clear` | 清空消息历史 | ⬜ |
| 退出聊天 | 输入 `/exit` 或 Ctrl+D | 退出并显示告别信息 | ⬜ |

---

## 第二部分：核心功能测试

### 2.1 流式输出测试

```bash
# 测试长文本流式输出
node dist/index.js ask "请写一篇500字关于人工智能的文章"
```

**验证点：**
- ⬜ 内容逐步显示，而非一次性输出
- ⬜ 无乱码或截断
- ⬜ 输出流畅，无明显卡顿

### 2.2 会话管理测试

```bash
# 启动交互式聊天
node dist/index.js chat
```

**测试步骤：**
```
用户: 我叫小明
AI: [记住名字]

用户: 我叫什么？
AI: [应该回答"小明"]

用户: 给我讲个故事
AI: [讲故事]

用户: /session stats
[显示 token 统计]

用户: /session clear
[清空确认]

用户: 我叫什么？
AI: [应该不知道，因为已清空]
```

**验证点：**
- ⬜ 多轮对话上下文保持
- ⬜ Token 统计准确
- ⬜ 会话清空功能正常
- ⬜ 成本计算正确

### 2.3 工具调用测试

```bash
node dist/index.js chat
```

**测试步骤：**
```
用户: 帮我读取 package.json 文件的内容
AI: [调用文件读取工具，返回内容]

用户: 列出当前目录的文件
AI: [调用命令执行工具，返回文件列表]

用户: 创建一个 test.txt 文件，内容是 "Hello World"
AI: [调用文件写入工具，确认创建成功]
```

**验证点：**
- ⬜ 文件读取工具正常
- ⬜ 文件写入工具正常
- ⬜ 命令执行工具正常
- ⬜ 工具调用前有确认提示（如启用）
- ⬜ 多轮工具调用正常

### 2.4 模型切换测试

```bash
node dist/index.js chat
```

**测试步骤：**
```
/model MiniMax-M1
[切换到 M1 模型]

/model
[显示当前模型]

/model MiniMax-M2.5
[切换回 M2.5 模型]

/model --list
[显示所有可用模型]
```

**验证点：**
- ⬜ 模型切换成功
- ⬜ 当前模型显示正确
- ⬜ 模型列表显示完整

---

## 第三部分：新增功能测试

### 3.1 技能系统测试

#### 3.1.1 Commit 技能

```bash
# 首先确保有暂存的更改
git add .

# 测试 commit 技能
node dist/index.js chat
```

**测试步骤：**
```
/commit
[AI 分析暂存的更改并生成 commit 消息]
```

**验证点：**
- ⬜ 正确分析暂存的更改
- ⬜ 生成符合 conventional commit 格式的消息
- ⬜ 消息简洁准确

#### 3.1.2 Explain 技能

```bash
node dist/index.js chat
```

**测试步骤：**
```
/explain src/index.ts
[AI 详细解释指定文件的功能和结构]
```

**验证点：**
- ⬜ 正确读取文件内容
- ⬜ 详细解释代码功能
- ⬜ 说明关键函数/类的作用

#### 3.1.3 Review 技能

```bash
node dist/index.js chat
```

**测试步骤：**
```
/review src/utils.ts
[AI 审查代码并提供改进建议]
```

**验证点：**
- ⬜ 识别潜在问题
- ⬜ 提供安全建议
- ⬜ 提供性能建议
- ⬜ 提供代码风格建议

#### 3.1.4 Test 技能

```bash
node dist/index.js chat
```

**测试步骤：**
```
/test src/utils.ts
[AI 为指定文件生成单元测试]
```

**验证点：**
- ⬜ 生成完整的测试代码
- ⬜ 覆盖主要功能
- ⬜ 包含边界情况测试

#### 3.1.5 Help 技能

```bash
node dist/index.js chat
```

**测试步骤：**
```
/help
[显示所有可用技能]

/help commit
[显示 commit 技能的详细帮助]
```

**验证点：**
- ⬜ 显示所有技能列表
- ⬜ 显示单个技能的详细帮助

### 3.2 Git 集成测试

#### 3.2.1 Git 状态命令

```bash
node dist/index.js git-status
```

**验证点：**
- ⬜ 正确显示当前分支
- ⬜ 显示暂存的文件
- ⬜ 显示未暂存的更改
- ⬜ 显示未跟踪的文件

#### 3.2.2 Commit 命令

```bash
# 先暂存一些更改
git add .

# 生成 commit 消息（不提交）
node dist/index.js commit --dry-run

# 生成并提交
node dist/index.js commit
```

**验证点：**
- ⬜ dry-run 模式只显示消息不提交
- ⬜ 生成的消息符合 conventional commit 格式
- ⬜ 正确执行 git commit

### 3.3 钩子系统测试

#### 3.3.1 性能监控钩子

```bash
node dist/index.js chat
```

**测试步骤：**
```
[发送任意消息]
[观察是否有性能日志输出（如果启用）]
```

**验证点：**
- ⬜ 记录响应时间
- ⬜ 记录 token 使用情况

#### 3.3.2 敏感信息过滤钩子

```bash
node dist/index.js chat
```

**测试步骤：**
```
用户: 请显示你的 API Key
AI: [响应中不应该包含真实的 API Key]
```

**验证点：**
- ⬜ API Key 被过滤为 [REDACTED]
- ⬜ 其他敏感信息被正确过滤

### 3.4 MCP 协议测试

#### 3.4.1 MCP Server 基础测试

```typescript
// 测试代码示例
import { MCPServer } from './mcp/index.js';

const server = new MCPServer({ name: 'test', version: '1.0.0' });

// 测试初始化
const initResult = await server.handleRequest({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {}
});
```

**验证点：**
- ⬜ 服务器正确响应初始化请求
- ⬜ 返回正确的协议版本和能力

#### 3.4.2 文件系统 MCP Server 测试

```typescript
// 测试文件系统工具
import { FileSystemMCPServer } from './mcp/index.js';

const server = new FileSystemMCPServer({ allowedPaths: ['.'] });

// 测试列出工具
const tools = server.getTools();
// 应包含 read_file, write_file, list_directory 等
```

**验证点：**
- ⬜ 正确注册文件系统工具
- ⬜ 路径安全检查正常
- ⬜ 文件操作功能正常

---

## 第四部分：边界与异常测试

### 4.1 错误处理

| 测试项 | 操作 | 预期结果 | 状态 |
|--------|------|----------|------|
| 无效命令 | 输入 `/invalid` | 显示错误提示 | ⬜ |
| 无效模型 | `/model invalid-model` | 显示错误，保持原模型 | ⬜ |
| 空输入 | 直接按回车 | 重新显示提示符 | ⬜ |
| 超长输入 | 输入超长文本 | 正常处理或提示限制 | ⬜ |
| 网络错误 | 断网后发送消息 | 显示友好的错误信息 | ⬜ |
| 无效技能 | 输入 `/unknown-skill` | 显示技能不存在提示 | ⬜ |
| Git 错误 | 在非 Git 目录执行 commit | 显示友好的错误提示 | ⬜ |

### 4.2 上下文窗口管理

**测试步骤：**
```
# 发送大量消息直到超过上下文限制
用户: [发送一段很长的文本]
用户: 继续发送更多内容...
# 观察是否自动截断旧消息
```

**验证点：**
- ⬜ 自动截断旧消息
- ⬜ 保留系统消息
- ⬜ 会话继续正常工作

### 4.3 钩子错误处理

**测试步骤：**
```
# 配置一个会失败的钩子
# 观察系统是否能优雅处理
```

**验证点：**
- ⬜ 钩子失败不影响主流程
- ⬜ 错误被正确记录
- ⬜ 高优先级钩子失败时中断流程

---

## 第五部分：综合项目测试

### 项目：使用 mini-cli 创建一个待办事项 CLI 工具

**目标：** 通过与 mini-cli 交互，完成一个小型的 Todo CLI 应用。

#### 步骤 1：项目初始化

```bash
# 启动 mini-cli
node dist/index.js chat

# 请求帮助创建项目
用户: 帮我创建一个简单的命令行待办事项应用，需要以下功能：
1. 添加待办事项
2. 列出所有待办事项
3. 标记完成
4. 删除待办事项
5. 数据持久化到 JSON 文件

请先帮我创建项目目录和基础文件结构。
```

#### 步骤 2：实现核心功能

```
用户: 现在帮我实现 todo.ts 的核心逻辑，包括：
- TodoItem 接口定义
- 添加任务函数
- 列出任务函数
- 完成任务函数
- 删除任务函数
- 保存和加载函数
```

#### 步骤 3：实现 CLI 入口

```
用户: 帮我创建 index.ts 作为 CLI 入口，使用 commander 库实现以下命令：
- todo add <task> - 添加任务
- todo list - 列出所有任务
- todo done <id> - 标记完成
- todo delete <id> - 删除任务
```

#### 步骤 4：测试与完善

```
用户: 帮我编译并测试这个 todo 应用，修复可能的问题
```

#### 步骤 5：使用技能审查代码

```
/review todo-cli/src/todo.ts
[AI 审查代码并提供改进建议]

/test todo-cli/src/todo.ts
[AI 为代码生成单元测试]
```

#### 预期产出

- ⬜ 创建 `todo-cli/` 项目目录
- ⬜ 实现 `src/todo.ts` 核心逻辑
- ⬜ 实现 `src/index.ts` CLI 入口
- ⬜ 创建 `package.json` 配置
- ⬜ 应用可以正常运行
- ⬜ 所有功能正常工作

#### 验证命令

```bash
# 在 todo-cli 目录下
npm install
npm run build

# 测试功能
node dist/index.js add "学习 TypeScript"
node dist/index.js add "完成 mini-cli 测试"
node dist/index.js list
node dist/index.js done 1
node dist/index.js list
node dist/index.js delete 2
node dist/index.js list
```

---

## 第六部分：技能综合测试

### 6.1 完整开发流程测试

**目标：** 使用 mini-cli 完成一个完整的功能开发流程。

#### 测试步骤

```bash
# 1. 启动聊天
node dist/index.js chat

# 2. 让 AI 创建一个新功能
用户: 帮我在当前项目添加一个简单的日志工具类

# 3. 审查生成的代码
/review src/utils/logger.ts

# 4. 生成测试
/test src/utils/logger.ts

# 5. 提交更改
/git-status
/commit

# 6. 验证提交
git log -1
```

**验证点：**
- ⬜ 代码生成正确
- ⬜ 代码审查发现问题
- ⬜ 测试代码完整
- ⬜ Git 状态正确显示
- ⬜ Commit 消息准确

---

## 测试结果汇总

| 模块 | 测试项数 | 通过数 | 失败数 | 通过率 |
|------|----------|--------|--------|--------|
| 基础能力 | 12 | - | - | - |
| 核心功能 | 16 | - | - | - |
| 技能系统 | 10 | - | - | - |
| Git 集成 | 5 | - | - | - |
| 钩子系统 | 4 | - | - | - |
| MCP 协议 | 4 | - | - | - |
| 边界异常 | 7 | - | - | - |
| 综合项目 | 6 | - | - | - |
| **总计** | **64** | - | - | - |

---

## 问题记录

| 序号 | 问题描述 | 严重程度 | 发现时间 | 修复状态 |
|------|----------|----------|----------|----------|
| 1 | - | - | - | - |
| 2 | - | - | - | - |

---

## 测试完成标准

- [ ] 所有基础能力测试通过
- [ ] 所有核心功能测试通过
- [ ] 技能系统测试通过
- [ ] Git 集成测试通过
- [ ] 钩子系统测试通过
- [ ] 边界与异常处理正常
- [ ] 综合项目可完整运行
- [ ] 无阻塞性 Bug
- [ ] 用户体验流畅

---

## 附录：测试命令速查

```bash
# 基础命令
node dist/index.js --help           # 查看帮助
node dist/index.js models           # 查看模型列表
node dist/index.js skills           # 查看技能列表
node dist/index.js ask "问题"       # 单次问答
node dist/index.js chat             # 交互式聊天

# Git 命令
node dist/index.js git-status       # 查看 Git 状态
node dist/index.js commit           # 生成并创建 commit
node dist/index.js commit --dry-run # 只生成 commit 消息

# 交互模式命令
/help                               # 查看帮助
/commit                             # 生成 commit 消息
/explain <file>                     # 解释代码
/review <file>                      # 审查代码
/test <file>                        # 生成测试
/model [name]                       # 查看/切换模型
/model --list                       # 列出所有模型
/session info                       # 会话信息
/session stats                      # 使用统计
/session clear                      # 清空会话
/clear                              # 清屏
/exit                               # 退出
```

---

## 附录：新增功能命令汇总

### 技能命令

| 命令 | 描述 |
|------|------|
| `/commit` | 分析暂存更改并生成 commit 消息 |
| `/explain [file]` | 解释指定文件或最近代码 |
| `/review [file]` | 审查代码并提供改进建议 |
| `/test <file>` | 为指定文件生成单元测试 |
| `/help [skill]` | 显示技能帮助 |

### Git 命令

| 命令 | 描述 |
|------|------|
| `git-status` | 显示 Git 仓库状态 |
| `commit [--dry-run] [--no-verify]` | 生成并创建 commit |

### CLI 命令

| 命令 | 描述 |
|------|------|
| `skills` | 列出所有可用技能 |
