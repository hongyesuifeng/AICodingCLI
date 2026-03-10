# Aider 技术文档

## 概述

Aider 是一个开源的终端 AI 结对编程工具，采用纯 Python 实现，支持多种 LLM 和 100+ 编程语言。

| 属性 | 描述 |
|------|------|
| **开发者** | Aider-AI (Paul Gauthier) |
| **核心定位** | 终端 AI 结对编程 |
| **主要语言** | Python |
| **运行时** | Python 3.10-3.12 |
| **包管理** | pip / uv |

### 关键指标

- **GitHub Stars**: 30k+
- **PyPI 安装量**: 530万+
- **每周 Token 处理量**: 150亿+
- **自动化代码占比**: 88% (最新版本由 aider 自身编写)

---

## 系统架构

```
┌────────────────────────────────────────────────────────────────────┐
│                        Aider 系统架构                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                      CLI 层 (main.py)                        │  │
│  │  参数解析 │ 配置加载 │ Git 设置 │ 模型选择                   │  │
│  └──────────────────────────┬──────────────────────────────────┘  │
│                              │                                     │
│  ┌──────────────────────────▼──────────────────────────────────┐  │
│  │                    Coder 核心层                              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│  │  │ BaseCoder   │  │ EditBlock   │  │ UDiffCoder          │  │  │
│  │  │ (基类)      │  │ Coder       │  │ (Unified Diff)      │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│  │  │ WholeFile   │  │ PatchCoder  │  │ ArchitectCoder      │  │  │
│  │  │ Coder       │  │ (git patch) │  │ (架构设计)          │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │
│  └──────────────────────────┬──────────────────────────────────┘  │
│                              │                                     │
│  ┌──────────────────────────▼──────────────────────────────────┐  │
│  │                    服务层                                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│  │  │  RepoMap    │  │   GitRepo   │  │     Linter          │  │  │
│  │  │ (代码地图)  │  │  (版本控制) │  │   (代码检查)        │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│  │  │  Commands   │  │  FileWatcher│  │    Voice            │  │  │
│  │  │  (命令系统) │  │  (文件监控) │  │   (语音输入)        │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │
│  └──────────────────────────┬──────────────────────────────────┘  │
│                              │                                     │
│  ┌──────────────────────────▼──────────────────────────────────┐  │
│  │                    AI 模型层 (LiteLLM)                       │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │  │
│  │  │ Claude  │  │ OpenAI  │  │DeepSeek │  │   Local LLMs    │ │  │
│  │  │ (推荐)  │  │  GPT-4  │  │   R1    │  │  Ollama/LMStudio│ │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
aider/
├── aider/                       # 核心源码
│   ├── __init__.py
│   ├── __main__.py              # python -m aider 入口
│   ├── main.py                  # CLI 主入口 (44k)
│   ├── args.py                  # 参数解析 (30k)
│   ├── io.py                    # 输入输出处理 (43k)
│   ├── models.py                # 模型配置 (46k)
│   ├── commands.py              # 命令系统 (62k)
│   ├── repomap.py               # 代码地图生成 (27k)
│   ├── repo.py                  # Git 仓库管理 (23k)
│   ├── linter.py                # 代码检查 (8k)
│   ├── voice.py                 # 语音输入 (6k)
│   ├── watch.py                 # 文件监控 (10k)
│   ├── scrape.py                # 网页抓取 (8k)
│   ├── coders/                  # 编辑器实现
│   │   ├── __init__.py
│   │   ├── base_coder.py        # 基础 Coder (86k)
│   │   ├── editblock_coder.py   # 块编辑模式 (20k)
│   │   ├── editblock_prompts.py
│   │   ├── udiff_coder.py       # Unified Diff (11k)
│   │   ├── udiff_prompts.py
│   │   ├── patch_coder.py       # Git Patch (30k)
│   │   ├── wholefile_coder.py   # 整文件模式 (5k)
│   │   ├── architect_coder.py   # 架构设计
│   │   ├── search_replace.py    # 搜索替换 (20k)
│   │   └── shell.py             # Shell 命令
│   ├── queries/                 # Tree-sitter 查询
│   └── resources/               # 资源文件
│       └── model-settings.yml   # 模型配置
├── tests/                       # 测试套件
├── benchmark/                   # 性能基准
├── scripts/                     # 构建脚本
├── docker/                      # Docker 配置
├── pyproject.toml               # 项目配置
├── requirements.txt             # 依赖 (12k)
└── README.md                    # 说明文档
```

---

## 核心技术原理

### 1. 多种编辑格式 (Edit Formats)

Aider 支持多种代码编辑格式，根据模型能力自动选择：

```python
# 编辑格式类型
EDIT_FORMATS = {
    'whole': 'WholeFileCoder',        # 整文件替换
    'diff': 'DiffCoder',              # 标准差异
    'diff-fenced': 'DiffFencedCoder', # 围栏差异
    'udiff': 'UDiffCoder',            # Unified Diff
    'udiff-simple': 'UDiffSimple',    # 简化 Unified Diff
    'editblock': 'EditBlockCoder',    # 搜索替换块
    'editblock-fenced': 'EditBlockFencedCoder',
    'patch': 'PatchCoder',            # Git Patch 格式
    'architect': 'ArchitectCoder',    # 架构设计模式
}
```

**EditBlock 格式示例：**

```
Here's the change to fix the bug:

foo.py
<<<<<<< SEARCH
def hello():
    print("Hello")
=======
def hello(name="World"):
    print(f"Hello, {name}!")
>>>>>>> REPLACE
```

**UDiff 格式示例：**

```diff
--- a/foo.py
+++ b/foo.py
@@ -1,3 +1,3 @@
 def hello():
-    print("Hello")
+    print("Hello, World!")
```

### 2. RepoMap (代码地图)

RepoMap 使用 Tree-sitter 解析代码库，生成代码结构概览：

```python
# aider/repomap.py
class RepoMap:
    """
    使用 Tree-sitter 解析代码，提取符号定义和引用，
    生成代码库地图，帮助 LLM 理解大型项目结构。
    """

    def __init__(
        self,
        map_tokens=1024,        # 地图 token 限制
        root=None,
        main_model=None,
        refresh="auto",
    ):
        self.max_map_tokens = map_tokens
        self.load_tags_cache()  # 加载缓存

    def get_repo_map(
        self,
        chat_files,             # 当前会话中的文件
        other_files,            # 其他文件
        mentioned_fnames=None,
        mentioned_idents=None,
    ):
        """
        生成代码地图，包含:
        - 类、函数、变量定义
        - 符号引用关系
        - 文件层级结构
        """
        # 使用 Tree-sitter 提取标签
        tags = self.get_tags(other_files)

        # 按重要性排序
        ranked_tags = self.rank_tags(tags, mentioned_fnames)

        # 生成地图字符串
        return self.render_map(ranked_tags)
```

**RepoMap 输出示例：**

```
src/
├── main.py
│   ├── class Application
│   │   ├── def __init__(self)
│   │   ├── def run(self)
│   │   └── def shutdown(self)
│   └── def create_app()
├── utils.py
│   ├── def format_output(data)
│   └── def parse_input(text)
```

### 3. 多模型支持 (LiteLLM)

```python
# aider/models.py
MODEL_ALIASES = {
    # Claude 模型 (推荐)
    "sonnet": "claude-sonnet-4-5",
    "haiku": "claude-haiku-4-5",
    "opus": "claude-opus-4-6",

    # OpenAI 模型
    "4": "gpt-4-0613",
    "4o": "gpt-4o",
    "o1": "o1",
    "o3-mini": "o3-mini",

    # DeepSeek 模型
    "deepseek": "deepseek/deepseek-chat",
    "r1": "deepseek/deepseek-reasoner",

    # Google 模型
    "gemini": "gemini/gemini-3-pro-preview",
    "flash": "gemini/gemini-flash-latest",

    # 其他
    "grok3": "xai/grok-3-beta",
}

@dataclass
class ModelSettings:
    name: str
    edit_format: str = "whole"        # 编辑格式
    use_repo_map: bool = False        # 是否使用 RepoMap
    cache_control: bool = False       # Prompt Caching
    streaming: bool = True            # 流式输出
    reasoning_tag: Optional[str] = None  # 推理标签 (如 DeepSeek R1)
```

### 4. Git 集成

```python
# aider/repo.py
class GitRepo:
    """Git 仓库管理"""

    def __init__(self, io, fnames, git_dname):
        self.repo = git.Repo(git_dname)

    def commit(self, message=None):
        """自动提交更改"""
        if not message:
            # 使用 AI 生成提交消息
            message = self.generate_commit_message()

        self.repo.git.add('-A')
        self.repo.git.commit('-m', message)

    def get_diff(self, fname=None):
        """获取差异"""
        if fname:
            return self.repo.git.diff('HEAD', fname)
        return self.repo.git.diff('HEAD')

    def undo_last_commit(self):
        """撤销上次提交"""
        self.repo.git.reset('--hard', 'HEAD~1')
```

### 5. 命令系统

```python
# aider/commands.py - 部分命令列表
COMMANDS = {
    # 文件操作
    '/add': '添加文件到会话',
    '/drop': '从会话移除文件',
    '/read-only': '添加只读文件',
    '/ls': '列出会话中的文件',

    # Git 操作
    '/git': '执行 git 命令',
    '/diff': '显示差异',
    '/undo': '撤销上次更改',

    # 模型控制
    '/model': '切换模型',
    '/weak-model': '设置弱模型',

    # 代码地图
    '/map': '显示代码地图',
    '/map-refresh': '刷新代码地图',

    # 其他
    '/voice': '语音输入',
    '/help': '帮助信息',
    '/clear': '清空历史',
    '/copy': '复制到剪贴板',
    '/paste': '从剪贴板粘贴',
}
```

### 6. 文件监控 (Watch Mode)

```python
# aider/watch.py
class FileWatcher:
    """
    监控文件变化，自动响应代码注释中的指令。
    支持在 IDE 中通过注释触发 aider 操作。
    """

    def __init__(self, coder):
        self.coder = coder
        self.watchfiles = watchfiles

    async def watch(self):
        async for changes in self.watchfiles.awatch(self.root):
            for change_type, path in changes:
                if change_type == Change.modified:
                    await self.handle_file_change(path)

    async def handle_file_change(self, path):
        """处理文件变化，检测 AI 指令注释"""
        content = await read_file(path)

        # 检测特殊注释标记
        # 例如: # aider: implement this function
        if self.has_aider_comment(content):
            await self.coder.send_to_ai(content)
```

### 7. 语音输入

```python
# aider/voice.py
class Voice:
    """
    语音输入支持，使用 OpenAI Whisper API。
    允许通过语音与 aider 交互。
    """

    def __init__(self):
        self.audio_format = "wav"
        self.sample_rate = 16000

    def record_and_transcribe(self):
        """录音并转写"""
        # 录制音频
        audio_data = self.record_audio()

        # 使用 Whisper API 转写
        transcript = openai.Audio.transcribe(
            model="whisper-1",
            file=audio_data
        )

        return transcript.text
```

---

## 关键依赖

```txt
# 核心依赖
litellm>=1.81.0            # 多模型统一接口
tiktoken>=0.12.0           # Token 计数
tokenizers>=0.22.0         # HuggingFace Tokenizer

# 代码解析
tree-sitter>=0.25.0        # 语法解析
tree-sitter-language-pack  # 多语言支持
grep-ast>=0.9.0            # AST 搜索

# Git 集成
gitpython>=3.1.46          # Git 操作
diff-match-patch           # 差异匹配

# UI 框架
prompt-toolkit>=3.0.52     # 交互式 CLI
rich>=14.3.0               # 终端美化
pygments>=2.19.0           # 语法高亮

# 缓存和存储
diskcache>=5.6.3           # 磁盘缓存

# 网络和 API
httpx>=0.28.0              # HTTP 客户端
aiohttp>=3.13.0            # 异步 HTTP

# 可选功能
pillow>=12.1.0             # 图片处理
beautifulsoup4>=4.14.0     # 网页解析
sounddevice>=0.5.0         # 音频录制
pydub>=0.25.1              # 音频处理
watchfiles>=1.1.0          # 文件监控
```

---

## 命令参考

### 基础命令

```bash
# 启动 aider
aider                          # 交互模式
aider file1.py file2.py        # 指定文件

# 模型选择
aider --model sonnet           # Claude Sonnet (推荐)
aider --model deepseek         # DeepSeek
aider --model 4o               # GPT-4o
aider --model o3-mini          # o3-mini

# API Key 设置
aider --api-key anthropic=sk-xxx
aider --api-key openai=sk-xxx
aider --api-key deepseek=sk-xxx

# 编辑格式
aider --edit-format diff       # 使用 diff 格式
aider --edit-format udiff      # 使用 unified diff
aider --architect              # 架构师模式
```

### 高级选项

```bash
# 代码地图
aider --map-tokens 2048        # 设置地图 token 数
aider --no-map                 # 禁用代码地图

# Git 集成
aider --auto-commits           # 自动提交 (默认)
aider --no-auto-commits        # 禁用自动提交
aider --commit-prompt "..."    # 自定义提交提示

# 文件监控
aider --watch-files            # 启用文件监控

# 测试和 Lint
aider --auto-test              # 自动运行测试
aider --test-cmd "pytest"      # 测试命令
aider --lint-cmd "flake8"      # Lint 命令

# 输出控制
aider --stream                 # 流式输出 (默认)
aider --no-stream              # 禁用流式
aider --pretty                 # 美化输出 (默认)
```

### 会话内命令

```
/add file.py              # 添加文件
/drop file.py             # 移除文件
/read-only file.py        # 添加只读文件
/clear                    # 清空历史
/undo                     # 撤销更改
/diff                     # 显示差异
/map                      # 显示代码地图
/model sonnet             # 切换模型
/voice                    # 语音输入
/help                     # 帮助
/quit                     # 退出
```

---

## 配置文件

### .aider.conf.yml

```yaml
# ~/.aider.conf.yml 或项目根目录

# 模型配置
model: claude-sonnet-4-5
weak-model: claude-haiku-4-5

# 编辑设置
edit-format: diff
map-tokens: 2048

# Git 设置
auto-commits: true
commit-prompt: "Generate a concise commit message"

# 文件模式
watch-files: false

# 测试设置
auto-test: false
test-cmd: "pytest -x"

# Lint 设置
lint-cmd: "flake8 --select=E9,F63,F7,F82"

# 输出设置
pretty: true
stream: true
```

### 环境变量

```bash
# API Keys
ANTHROPIC_API_KEY=sk-xxx
OPENAI_API_KEY=sk-xxx
DEEPSEEK_API_KEY=sk-xxx

# Aider 配置
AIDER_MODEL=sonnet
AIDER_EDIT_FORMAT=diff
AIDER_MAP_TOKENS=2048
```

---

## 最佳实践

### 1. 模型选择

```bash
# ✅ 推荐：Claude Sonnet (最佳性能)
aider --model sonnet

# ✅ 推荐：DeepSeek (性价比高)
aider --model deepseek

# ✅ 复杂任务：使用架构师模式
aider --architect --model sonnet

# ❌ 不推荐：弱模型处理复杂任务
aider --model haiku  # 仅适合简单任务
```

### 2. 文件管理

```bash
# ✅ 推荐：只添加需要的文件
aider src/main.py src/utils.py

# ✅ 使用只读模式引用参考文件
> /read-only docs/api.md

# ✅ 使用代码地图处理大型项目
aider --map-tokens 4096
```

### 3. Git 工作流

```bash
# ✅ 让 aider 管理提交
aider --auto-commits

# ✅ 定期检查更改
> /diff

# ✅ 需要时撤销
> /undo
```

### 4. 提示工程

```
# ✅ 清晰描述需求
"在 utils.py 中添加一个函数，接受文件路径，
返回文件内容的行数，处理异常情况"

# ✅ 提供上下文
"参考 api.py 中的 get_user() 函数风格，
在 auth.py 中添加 login() 函数"

# ✅ 指定约束
"修改配置加载逻辑，保持向后兼容性"
```

---

## 学习路线

### 阶段一：基础使用 (1-2 周)

1. 安装和配置 aider
2. 掌握基本命令 (add, drop, clear)
3. 理解不同编辑格式
4. Git 集成使用

### 阶段二：进阶功能 (2-4 周)

1. 代码地图 (RepoMap) 使用
2. 文件监控模式
3. 语音输入
4. 多模型切换

### 阶段三：高级应用 (4-6 周)

1. 架构师模式
2. 自动测试和 Lint 集成
3. 自定义配置和工作流
4. 性能调优

### 阶段四：源码研读 (持续)

```
推荐阅读顺序：
1. aider/main.py           → 入口点，参数解析
2. aider/coders/base_coder.py   → 核心 Coder 类
3. aider/repomap.py        → 代码地图实现
4. aider/models.py         → 模型配置
5. aider/commands.py       → 命令系统
6. aider/coders/editblock_coder.py → 编辑块解析
```

---

## 与其他工具对比

| 特性 | Aider | Codex CLI | Gemini CLI | OpenCode |
|------|:-----:|:---------:|:----------:|:--------:|
| **语言** | Python | Rust+TS | TypeScript | TypeScript |
| **安全沙箱** | ❌ | ✅ 原生 | ⚠️ 有限 | ⚠️ 系统 |
| **Git 集成** | ✅ 深度 | ✅ | ✅ | ✅ |
| **多模型** | ✅ LiteLLM | ❌ | ✅ | ✅ |
| **代码地图** | ✅ | ❌ | ❌ | ❌ |
| **语音输入** | ✅ | ❌ | ❌ | ❌ |
| **文件监控** | ✅ | ✅ Hooks | ❌ | ❌ |
| **Web 界面** | ❌ | ❌ | ✅ | ✅ |
| **桌面应用** | ❌ | ❌ | ❌ | ✅ |
| **自动测试** | ✅ | ❌ | ❌ | ❌ |

---

## 参考资源

### 官方资源
- [Aider 官网](https://aider.chat/)
- [GitHub 仓库](https://github.com/Aider-AI/aider)
- [安装指南](https://aider.chat/docs/install.html)
- [使用文档](https://aider.chat/docs/usage.html)
- [配置选项](https://aider.chat/docs/config.html)

### 社区资源
- [Discord 社区](https://discord.gg/Y7X7bhMQFV)
- [LLM 排行榜](https://aider.chat/docs/leaderboards/)
- [教程视频](https://aider.chat/docs/usage/tutorials.html)

### 相关技术
- [LiteLLM](https://github.com/BerriAI/litellm)
- [Tree-sitter](https://tree-sitter.github.io/)
- [Prompt Toolkit](https://python-prompt-toolkit.readthedocs.io/)
- [Rich](https://rich.readthedocs.io/)
