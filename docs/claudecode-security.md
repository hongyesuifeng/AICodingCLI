# ClaudeCode 安全机制

本文档详细介绍 ClaudeCode 的安全机制设计。

## 1. Bash 命令安全

### 安全检查层次

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Bash 安全检查流程                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. 命令解析                                                              │
│     ├── Shell 语法解析                                 │
│     ├── 环境变量提取                                │
│     └── 参数分解                                 │
│                                                                     │
│  2. 危险模式检测                              │
│     ├── 命令注入检测                                 │
│     ├── 危险命令列表                                │
│     ├── Zsh 特殊命令                                 │
│     └── 进程替换检测                                 │
│                                                                     │
│  3. 权限验证                               │
│     ├── 文件路径检查                                 │
│     ├── 读写权限验证                                 │
│     └── 用户确认（可选）                              │
│                                                                     │
│  4. 沙盒执行                               │
│     ├── 环境隔离                                 │
│     ├── 文件系统限制                                 │
│     └── 网络访问控制                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 卣险模式列表

```typescript
// 命令替换模式
const COMMAND_SUBSTITUTION_PATTERNS = [
  { pattern: /<\(/, message: 'process substitution <()' },
  { pattern: />\(/, message: 'process substitution >()' },
  { pattern: /\$\(/, message: '$() command substitution' },
  { pattern: /\$\{/, message: '${} parameter substitution' },
  { pattern: /~\[/, message: 'Zsh-style parameter expansion' },
]

// Zsh 危险命令
const ZSH_DANGEROUS_COMMANDS = new Set([
  'zmodload',    // 模块加载
  'emulate',     // 模拟执行
  'sysopen',     // 系统调用
  'sysread',
  'syswrite',
  'zpty',        // 伪终端
  'ztcp',        // TCP 连接
  'zsocket',     // Socket
  'zf_rm',        // 文件操作
  'zf_mv',
  'zf_ln',
  'zf_chmod',
])
```

### 安全检查示例
```typescript
// bashSecurity.ts
export function validateDangerousPatterns(
  command: string
): ValidationResult {
  // 检查命令替换
  if (COMMAND_SUBSTITUTION_PATTERNS.some(p => p.pattern.test(command))) {
    return {
      valid: false,
      reason: `Contains ${p.message}`
    }
  }

  // 检查 Zsh 危险命令
  const baseCommand = extractBaseCommand(command)
  if (ZSH_DANGEROUS_COMMANDS.has(baseCommand)) {
    return {
      valid: false,
      reason: 'Zsh dangerous command detected'
    }
  }

  return { valid: true }
}
```

## 2. 文件操作安全

### 路径安全
```typescript
// 路径规范化
export function normalizePath(path: string): string {
  // NFC/NFD 标准化
  const normalized = path.normalize('NFC')

  // 解析符号链接
  const resolved = realpath(normalized)
  // 验证在工作目录内
  if (!isWithinWorkingDirectory(resolved)) {
    throw new Error('Path outside working directory')
  }
  return resolved
}

// 二进制检测
export function isBinaryFile(filePath: string): boolean {
  const buffer = readFileSync(filePath, { start: 0, length: 8000 })

  // 检查二进制魔数
  const binaryMagic = [
    0x00, 0x00, 0x00, 0x00, // PNG
    0xFF, 0xD8, 0xFF, 0xE0, // JPEG
    0x25, 0x50, 0x44, 0x46, // PDF
    // ...
  ]

  for (const magic of binaryMagic) {
    if (buffer.compare(magic, 0, magic.length) === 0) {
      return true
    }
  }

  // 检查二进制扩展名
  const ext = extname(filePath).toLowerCase()
  return BINARY_EXTENSIONS.has(ext)
}
```

### 内容安全
```typescript
// Team memory secrets 检测
export function containsTeamMemorySecrets(content: string): boolean {
  const patterns = [
    /api[_key[_i].+/i,
    /secret[_s].+/i,
    /token[_s].+/i,
    /password[_s].+/i,
  ]

  for (const pattern of patterns) {
    if (pattern.test(content)) {
      return true
    }
  }

  return false
}
```

## 3. 权限系统

### 权限模式
```typescript
type PermissionMode =
  | 'default'        // 默认模式，需要确认
  | 'acceptEdits'     // 自动接受编辑
  | 'bypassPermissions' // 绕过所有权限检查
  | 'plan'            // 计划模式
  | 'auto'            // 自动模式
```

### 权限规则
```typescript
interface ToolPermissionRules {
  Bash?: RuleSet<string>    // Bash 嗅觉匹配模式
  Read?: RuleSet<string>      // 文件读取匹配模式
  Write?: RuleSet<string>     // 文件写入匹配模式
  Edit?: RuleSet<string>     // 文件编辑匹配模式
}

interface Rule {
  pattern: string          // glob 匹配模式
  behavior: 'allow' | 'deny' | 'ask'
  reason?: string
}
```

### 权限决策流程
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      权限决策流程                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. 检查绕过模式                              │
│     if (mode === 'bypassPermissions') return 'allow'                  │
│                                                                     │
│  2. 检查自动允许规则                          │
│     匌 alwaysAllowRules 查找匹配的允许规则                         │
│                                                                     │
│  3. 检查自动拒绝规则                          │
│     查 alwaysDenyRules 查找匹配的拒绝规则                         │
│                                                                     │
│  4. 检查分类器结果                             │
│     if (BASH_CLASSIFIER) 检查命令分类结果                        │
│                                                                     │
│  5. 默认行为                                  │
│     根据权限模式返回默认行为                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4. 沙盒执行

### 沙盒配置
```typescript
interface SandboxConfig {
  enabled: boolean
  readOnlyPaths?: string[]      // 只读路径
  writePaths?: string[]         // 写入路径
  denyCommands?: string[]       // 禁止的命令
  allowNetwork?: boolean       // 允许网络访问
  envVars?: Record<string, string>  // 环境变量
}
```

### 沙盒边界
```typescript
// 文件系统隔离
- 仅允许访问工作目录及其子目录
- 阻止访问系统敏感目录
- 阻止访问其他用户的文件

// 网络隔离
- 默认禁止网络访问
- 可通过 allowNetwork 配置开启

// 进程隔离
- 独立的环境变量空间
- 阻止危险的环境变量修改
```

## 5. 敏感信息保护

### 敏感信息类型
```typescript
const SENSITIVE_PATTERNS = [
  // API 密钥
  /api[_key]/i,
  /secret[_s].+/i,
  /token[_s].+/i,
  /password[_s].+/i,

  // 私钥
  /private[_-]?key/i,
  /-----BEGIN.*PRIVATE KEY-----/,

  // 数据库连接
  /mongodb(\+srv\|:\/\/.*\+)/i,
  /postgres(ql)?:\/\/.*\+)/i,
]
```

### 信息脱敏
```typescript
// debugUtils.ts
export function redactSecrets(text: string): string {
  let result = text

  // 脱敏 API 密钥
  result = result.replace(
    /sk-[a-zA-Z0-9]{20,}/g,
    'sk-REDACTED'
  )

  // 脱敏令牌
  result = result.replace(
    /eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
    'REDACTED_JWT'
  )

  return result
}
```

## 6. Git 安全协议

### 强制规则
```typescript
const GIT_SAFETY_RULES = {
  // 禁止强制推送
  noForcePush: true,

  // 禁止修改已发布的提交
  noAmendPublished: true,

  // 保留钩子验证
  preserveHooks: true,

  // 创建新提交（不修改现有）
  createNewCommit: true,
}
```

### 安全检查
```typescript
export function validateGitCommand(
  command: string
): ValidationResult {
  // 检查强制推送
  if (/\b--force\b/.test(command)) {
    return {
      valid: false,
      reason: 'Force push is not allowed'
    }
  }

  // 检查 amend
  if (/\b--amend\b/.test(command)) {
    // 检查是否是已发布的提交
    const isPublished = await isCommitPublished()
    if (isPublished) {
      return {
        valid: false,
        reason: 'Amending published commits is not allowed'
      }
    }
  }

  return { valid: true }
}
```

## 7. 插件安全

### 名称保护
```typescript
// 保留的官方名称
const RESERVED_NAMES = [
  'claude-code',
  'claude-code-marketplace',
  'anthropics',
  // ...
]

export function validatePluginName(name: string, repository: string): boolean {
  // 检查是否使用保留名称
  if (RESERVED_NAMES.includes(name.toLowerCase())) {
    // 必须来自官方组织
    const isOfficial = repository.startsWith('https://github.com/anthropics/')
    if (!isOfficial) {
      return false
    }
  }

  // 检查 homograph 攻击
  if (containsHomograph(name, RESERVED_NAMES)) {
    return false
  }

  return true
}
```

### 来源验证
```typescript
export function validatePluginSource(repository: string): boolean {
  // 必须是有效的 Git URL
  const validPatterns = [
    /^https:\/\/github\.com\//,
    /^git@github\.com:/,
    /^https:\/\/gitlab\.com\//,
    // ...
  ]

  return validPatterns.some(p => p.test(repository))
}
```

---

> 本文档基于 ClaudeCode 源代码分析生成， 详细描述了系统的安全机制设计。
