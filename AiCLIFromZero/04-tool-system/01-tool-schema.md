# 4.1 工具定义和 Schema

## 学习目标

掌握 JSON Schema 基础，理解工具定义结构，能够为 AI 设计合理的工具参数规范。

## 1. JSON Schema 基础

### 1.1 什么是 JSON Schema？

JSON Schema 是一种用于描述和验证 JSON 数据结构的规范。在 AI 工具系统中，它用于：

1. **定义工具参数** - 告诉 AI 工具需要什么参数
2. **验证参数** - 确保传入的参数符合预期
3. **生成文档** - 自动生成参数说明

### 1.2 基本类型

```typescript
// src/types/schema.ts

// JSON Schema 基础类型
export type JSONSchemaType =
  | 'string'   // 字符串
  | 'number'   // 数字
  | 'integer'  // 整数
  | 'boolean'  // 布尔值
  | 'object'   // 对象
  | 'array'    // 数组
  | 'null';    // 空值

// 完整的 JSON Schema 定义
export interface JSONSchema {
  type: JSONSchemaType | JSONSchemaType[];
  description?: string;                      // 字段描述
  properties?: Record<string, JSONSchema>;   // 对象属性
  required?: string[];                       // 必填字段
  items?: JSONSchema;                        // 数组元素类型
  enum?: (string | number)[];                // 枚举值
  default?: any;                             // 默认值
  minLength?: number;                        // 字符串最小长度
  maxLength?: number;                        // 字符串最大长度
  minimum?: number;                          // 数字最小值
  maximum?: number;                          // 数字最大值
  pattern?: string;                          // 正则表达式
  format?: string;                           // 格式（如 date, email）
  oneOf?: JSONSchema[];                      // 多选一
  anyOf?: JSONSchema[];                      // 多选任意
  allOf?: JSONSchema[];                      // 全部满足
}
```

**JSON Schema 属性详解：**

| 属性 | 适用类型 | 作用 | 示例 |
|------|----------|------|------|
| `type` | 所有 | 指定数据类型 | `"string"`, `"number"` |
| `description` | 所有 | 字段说明 | `"文件路径"` |
| `properties` | object | 定义对象属性 | `{ "name": {...} }` |
| `required` | object | 必填字段列表 | `["name", "path"]` |
| `items` | array | 数组元素类型 | `{ "type": "string" }` |
| `enum` | string/number | 允许的值列表 | `["read", "write"]` |
| `minLength` | string | 最小长度 | `1` |
| `maxLength` | string | 最大长度 | `1000` |
| `minimum` | number | 最小值 | `0` |
| `maximum` | number | 最大值 | `100` |
| `pattern` | string | 正则匹配 | `"^[a-z]+$"` |
| `format` | string | 预定义格式 | `"date"`, `"email"` |

### 1.3 Schema 示例

```typescript
// src/examples/schema-examples.ts

// 字符串参数
const stringSchema: JSONSchema = {
  type: 'string',
  description: '文件路径',
  minLength: 1,
  maxLength: 500,
  pattern: '^(/[a-zA-Z0-9_-]+)+$'  // Unix 风格路径
};

// 数字参数
const numberSchema: JSONSchema = {
  type: 'integer',
  description: '行号',
  minimum: 1,
  maximum: 10000
};

// 枚举参数
const enumSchema: JSONSchema = {
  type: 'string',
  description: '文件操作类型',
  enum: ['read', 'write', 'delete', 'append']
};

// 对象参数
const objectSchema: JSONSchema = {
  type: 'object',
  description: '搜索选项',
  properties: {
    pattern: {
      type: 'string',
      description: '搜索模式（正则表达式）'
    },
    caseSensitive: {
      type: 'boolean',
      description: '是否区分大小写',
      default: false
    },
    maxResults: {
      type: 'integer',
      description: '最大结果数',
      minimum: 1,
      maximum: 1000,
      default: 100
    }
  },
  required: ['pattern']
};

// 数组参数
const arraySchema: JSONSchema = {
  type: 'array',
  description: '文件路径列表',
  items: {
    type: 'string',
    description: '文件路径'
  },
  minItems: 1,
  maxItems: 50
};

// 复杂嵌套对象
const complexSchema: JSONSchema = {
  type: 'object',
  description: '批量操作配置',
  properties: {
    files: {
      type: 'array',
      description: '要处理的文件',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
          action: { type: 'string', enum: ['read', 'write'] },
          content: { type: 'string', description: '写入内容（可选）' }
        },
        required: ['path', 'action']
      }
    },
    options: {
      type: 'object',
      properties: {
        backup: { type: 'boolean', default: true },
        encoding: { type: 'string', enum: ['utf-8', 'gbk'], default: 'utf-8' }
      }
    }
  },
  required: ['files']
};
```

## 2. 工具定义结构

### 2.1 基础工具接口

```typescript
// src/types/tool.ts

// 工具定义接口
export interface Tool {
  // 工具名称（唯一标识）
  name: string;

  // 工具描述（告诉 AI 这个工具做什么）
  description: string;

  // 参数 Schema
  parameters: JSONSchema;

  // 执行函数
  execute: (params: Record<string, any>) => Promise<string>;
}

// 工具调用请求
export interface ToolCallRequest {
  id: string;                          // 调用 ID
  name: string;                        // 工具名称
  arguments: Record<string, any>;      // 参数
}

// 工具调用结果
export interface ToolCallResult {
  toolCallId: string;                  // 对应的调用 ID
  result: string;                      // 执行结果
  isError?: boolean;                   // 是否错误
}
```

**工具定义字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✓ | 工具名称，使用 snake_case 命名 |
| `description` | string | ✓ | 工具功能描述，AI 会根据此决定何时调用 |
| `parameters` | JSONSchema | ✓ | 参数的 JSON Schema 定义 |
| `execute` | function | ✓ | 实际执行的异步函数 |

### 2.2 工具命名规范

```typescript
// src/utils/tool-naming.ts

// ✅ 推荐的命名方式
const goodNames = {
  // 动词_名词格式
  'read_file': '读取文件',
  'write_file': '写入文件',
  'search_code': '搜索代码',
  'execute_command': '执行命令',

  // 多个单词用下划线连接
  'list_directory': '列出目录',
  'delete_file': '删除文件',
  'rename_file': '重命名文件',

  // 获取信息用 get_
  'get_current_time': '获取当前时间',
  'get_system_info': '获取系统信息',
};

// ❌ 不推荐的命名方式
const badNames = {
  'readFile': '驼峰命名不推荐',
  'ReadFile': '帕斯卡命名不推荐',
  'read-file': '连字符命名不推荐',
  'rf': '缩写不清晰',
  'do_something': '描述不明确',
};

// 命名验证函数
export function validateToolName(name: string): { valid: boolean; error?: string } {
  // 必须是 snake_case
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    return { valid: false, error: 'Tool name must be snake_case (lowercase letters, numbers, underscores)' };
  }

  // 长度限制
  if (name.length > 64) {
    return { valid: false, error: 'Tool name must be 64 characters or less' };
  }

  // 必须以字母开头
  if (/^[0-9_]/.test(name)) {
    return { valid: false, error: 'Tool name must start with a letter' };
  }

  return { valid: true };
}
```

### 2.3 工具描述编写指南

```typescript
// src/utils/tool-description.ts

// ✅ 好的描述示例
const goodDescriptions = {
  read_file:
    'Read the contents of a file from the local filesystem. ' +
    'Use this when you need to examine what a file contains. ' +
    'Returns the file content as a string.',

  write_file:
    'Write content to a file on the local filesystem. ' +
    'Creates the file if it does not exist, overwrites if it does. ' +
    'Use this when you need to create or update files.',

  search_files:
    'Search for files matching a pattern in a directory. ' +
    'Supports glob patterns like "**/*.ts" for recursive search. ' +
    'Returns a list of matching file paths.',
};

// ❌ 不好的描述示例
const badDescriptions = {
  read_file: 'Read a file',           // 太简短，AI 不知道何时使用
  write_file: 'Writes stuff',         // 描述不清晰
  search_files: 'Uses regex',         // 没有说明用途
};

// 描述编写模板
export function createToolDescription(
  action: string,      // 工具做什么
  purpose: string,     // 何时使用
  returns: string      // 返回什么
): string {
  return `${action}. ${purpose}. ${returns}`;
}

// 使用示例
const toolDescription = createToolDescription(
  'Read the contents of a file',
  'Use this when you need to examine file contents',
  'Returns the file content as a string'
);
```

## 3. 完整工具定义示例

### 3.1 文件操作工具

```typescript
// src/tools/file-tools.ts
import { promises as fs } from 'fs';
import { Tool, JSONSchema } from '../types/tool.js';

// 读取文件工具
export const readFileTool: Tool = {
  name: 'read_file',
  description:
    'Read the contents of a file from the local filesystem. ' +
    'Use this to examine the contents of existing files. ' +
    'Returns the file content as a string.',

  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the file to read (relative or absolute)',
      },
      encoding: {
        type: 'string',
        description: 'Character encoding to use',
        enum: ['utf-8', 'binary', 'base64'],
        default: 'utf-8',
      },
    },
    required: ['path'],
  },

  execute: async ({ path, encoding = 'utf-8' }) => {
    try {
      const content = await fs.readFile(path, encoding);
      return content.toString();
    } catch (error: any) {
      return `Error reading file: ${error.message}`;
    }
  },
};

// 写入文件工具
export const writeFileTool: Tool = {
  name: 'write_file',
  description:
    'Write content to a file on the local filesystem. ' +
    'Creates the file if it does not exist, overwrites if it does. ' +
    'Use this to create new files or update existing ones.',

  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path where the file should be written',
      },
      content: {
        type: 'string',
        description: 'The content to write to the file',
      },
      mode: {
        type: 'string',
        description: 'Write mode',
        enum: ['write', 'append'],
        default: 'write',
      },
    },
    required: ['path', 'content'],
  },

  execute: async ({ path, content, mode = 'write' }) => {
    try {
      if (mode === 'append') {
        await fs.appendFile(path, content, 'utf-8');
      } else {
        await fs.writeFile(path, content, 'utf-8');
      }
      return `Successfully wrote to ${path}`;
    } catch (error: any) {
      return `Error writing file: ${error.message}`;
    }
  },
};

// 列出目录工具
export const listDirectoryTool: Tool = {
  name: 'list_directory',
  description:
    'List the contents of a directory. ' +
    'Returns a list of files and subdirectories. ' +
    'Use this to explore the filesystem structure.',

  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The directory path to list',
        default: '.',
      },
      recursive: {
        type: 'boolean',
        description: 'Whether to list subdirectories recursively',
        default: false,
      },
    },
    required: [],
  },

  execute: async ({ path = '.', recursive = false }) => {
    try {
      if (recursive) {
        const results: string[] = [];
        const walk = async (dir: string, prefix: string = '') => {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = `${dir}/${entry.name}`;
            results.push(`${prefix}${entry.name}${entry.isDirectory() ? '/' : ''}`);
            if (entry.isDirectory()) {
              await walk(fullPath, `${prefix}  `);
            }
          }
        };
        await walk(path);
        return results.join('\n');
      } else {
        const entries = await fs.readdir(path, { withFileTypes: true });
        return entries
          .map(e => `${e.name}${e.isDirectory() ? '/' : ''}`)
          .join('\n');
      }
    } catch (error: any) {
      return `Error listing directory: ${error.message}`;
    }
  },
};
```

### 3.2 搜索工具

```typescript
// src/tools/search-tools.ts
import { promises as fs } from 'fs';
import * as path from 'path';
import { Tool } from '../types/tool.js';

// 搜索文件内容
export const searchInFilesTool: Tool = {
  name: 'search_in_files',
  description:
    'Search for a pattern in files. ' +
    'Supports regular expressions. ' +
    'Returns matching lines with file paths and line numbers.',

  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The search pattern (regular expression)',
      },
      path: {
        type: 'string',
        description: 'Directory to search in',
        default: '.',
      },
      filePattern: {
        type: 'string',
        description: 'Glob pattern to filter files (e.g., "*.ts")',
        default: '*',
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Whether the search is case sensitive',
        default: false,
      },
    },
    required: ['pattern'],
  },

  execute: async ({ pattern, path: searchPath = '.', filePattern = '*', caseSensitive = false }) => {
    try {
      const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
      const results: string[] = [];

      const searchFile = async (filePath: string) => {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (regex.test(line)) {
            results.push(`${filePath}:${index + 1}: ${line.trim()}`);
          }
        });
      };

      // 简化实现：递归搜索目录
      const walk = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await walk(fullPath);
          } else if (entry.isFile()) {
            // 简单的文件模式匹配
            if (filePattern === '*' || entry.name.endsWith(filePattern.replace('*', ''))) {
              await searchFile(fullPath);
            }
          }
        }
      };

      await walk(searchPath);

      return results.length > 0
        ? results.slice(0, 100).join('\n')
        : 'No matches found';
    } catch (error: any) {
      return `Error searching: ${error.message}`;
    }
  },
};
```

### 3.3 命令执行工具

```typescript
// src/tools/command-tools.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import { Tool } from '../types/tool.js';

const execAsync = promisify(exec);

export const executeCommandTool: Tool = {
  name: 'execute_command',
  description:
    'Execute a shell command and return the output. ' +
    'Use this for running system commands, build tools, or scripts. ' +
    'Returns stdout and stderr combined.',

  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The command to execute',
      },
      cwd: {
        type: 'string',
        description: 'Working directory for the command (optional)',
      },
      timeout: {
        type: 'integer',
        description: 'Timeout in milliseconds',
        minimum: 1000,
        maximum: 300000,
        default: 30000,
      },
    },
    required: ['command'],
  },

  execute: async ({ command, cwd, timeout = 30000 }) => {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout,
        maxBuffer: 1024 * 1024, // 1MB
      });
      return stdout || stderr || 'Command executed successfully (no output)';
    } catch (error: any) {
      if (error.killed) {
        return `Command timed out after ${timeout}ms`;
      }
      return `Error: ${error.message}\n${error.stderr || ''}`;
    }
  },
};
```

## 4. 参数验证

### 4.1 Schema 验证器

```typescript
// src/utils/schema-validator.ts
import { JSONSchema } from '../types/tool.js';

export class SchemaValidator {
  /**
   * 验证参数是否符合 Schema
   */
  static validate(params: any, schema: JSONSchema): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    this.validateValue(params, schema, '', errors);

    return { valid: errors.length === 0, errors };
  }

  private static validateValue(
    value: any,
    schema: JSONSchema,
    path: string,
    errors: string[]
  ): void {
    // 检查类型
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];

    if (!types.some(t => this.checkType(value, t))) {
      errors.push(`${path || 'root'}: expected ${types.join('|')}, got ${typeof value}`);
      return;
    }

    // 对象类型验证
    if (schema.type === 'object' && schema.properties) {
      // 检查必填字段
      if (schema.required) {
        for (const field of schema.required) {
          if (value[field] === undefined) {
            errors.push(`${path}.${field}: required field is missing`);
          }
        }
      }

      // 验证每个属性
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (value[key] !== undefined) {
          this.validateValue(value[key], propSchema, `${path}.${key}`, errors);
        }
      }
    }

    // 数组类型验证
    if (schema.type === 'array' && schema.items && Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        this.validateValue(value[i], schema.items, `${path}[${i}]`, errors);
      }
    }

    // 字符串验证
    if (schema.type === 'string' && typeof value === 'string') {
      if (schema.minLength && value.length < schema.minLength) {
        errors.push(`${path}: string length ${value.length} < minimum ${schema.minLength}`);
      }
      if (schema.maxLength && value.length > schema.maxLength) {
        errors.push(`${path}: string length ${value.length} > maximum ${schema.maxLength}`);
      }
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        errors.push(`${path}: string does not match pattern ${schema.pattern}`);
      }
      if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path}: value "${value}" not in enum [${schema.enum.join(', ')}]`);
      }
    }

    // 数字验证
    if ((schema.type === 'number' || schema.type === 'integer') && typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${path}: value ${value} < minimum ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${path}: value ${value} > maximum ${schema.maximum}`);
      }
      if (schema.type === 'integer' && !Number.isInteger(value)) {
        errors.push(`${path}: value ${value} is not an integer`);
      }
    }
  }

  private static checkType(value: any, type: string): boolean {
    switch (type) {
      case 'string': return typeof value === 'string';
      case 'number': return typeof value === 'number' && !isNaN(value);
      case 'integer': return typeof value === 'number' && Number.isInteger(value);
      case 'boolean': return typeof value === 'boolean';
      case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array': return Array.isArray(value);
      case 'null': return value === null;
      default: return true;
    }
  }
}
```

### 4.2 验证工具参数

```typescript
// src/utils/validate-tool-call.ts
import { Tool, ToolCallRequest } from '../types/tool.js';
import { SchemaValidator } from './schema-validator.js';

export function validateToolCall(
  tool: Tool,
  request: ToolCallRequest
): { valid: boolean; errors: string[] } {
  // 检查工具名称匹配
  if (tool.name !== request.name) {
    return { valid: false, errors: [`Tool name mismatch: ${tool.name} vs ${request.name}`] };
  }

  // 验证参数
  return SchemaValidator.validate(request.arguments, tool.parameters);
}

// 使用示例
export function example() {
  const tool: Tool = {
    name: 'read_file',
    description: 'Read a file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', minLength: 1 },
        encoding: { type: 'string', enum: ['utf-8', 'binary'] },
      },
      required: ['path'],
    },
    execute: async () => '',
  };

  // 有效调用
  const validCall: ToolCallRequest = {
    id: '1',
    name: 'read_file',
    arguments: { path: '/test.txt' },
  };
  console.log(validateToolCall(tool, validCall));
  // { valid: true, errors: [] }

  // 无效调用 - 缺少必填参数
  const invalidCall1: ToolCallRequest = {
    id: '2',
    name: 'read_file',
    arguments: {},
  };
  console.log(validateToolCall(tool, invalidCall1));
  // { valid: false, errors: [".path: required field is missing"] }

  // 无效调用 - 错误的枚举值
  const invalidCall2: ToolCallRequest = {
    id: '3',
    name: 'read_file',
    arguments: { path: '/test.txt', encoding: 'gbk' },
  };
  console.log(validateToolCall(tool, invalidCall2));
  // { valid: false, errors: [".encoding: value "gbk" not in enum [utf-8, binary]"] }
}
```

## 参数说明

### JSONSchema 属性完整列表

| 属性 | 类型 | 适用类型 | 说明 |
|------|------|----------|------|
| `type` | string/string[] | 所有 | 数据类型 |
| `description` | string | 所有 | 字段描述 |
| `properties` | object | object | 对象属性定义 |
| `required` | string[] | object | 必填字段列表 |
| `items` | JSONSchema | array | 数组元素类型 |
| `enum` | array | string/number | 枚举值 |
| `default` | any | 所有 | 默认值 |
| `minLength` | number | string | 最小长度 |
| `maxLength` | number | string | 最大长度 |
| `minimum` | number | number | 最小值 |
| `maximum` | number | number | 最大值 |
| `exclusiveMinimum` | number | number | 排除性最小值 |
| `exclusiveMaximum` | number | number | 排除性最大值 |
| `pattern` | string | string | 正则表达式 |
| `format` | string | string | 预定义格式 |
| `minItems` | number | array | 数组最小元素数 |
| `maxItems` | number | array | 数组最大元素数 |
| `uniqueItems` | boolean | array | 数组元素是否唯一 |

### Tool 接口字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✓ | 工具名称，snake_case 格式 |
| `description` | string | ✓ | 工具描述，清晰说明用途 |
| `parameters` | JSONSchema | ✓ | 参数的 JSON Schema |
| `execute` | function | ✓ | 执行函数，返回 Promise<string> |

## 练习题

### 练习 1: 创建文件搜索工具

```typescript
// exercises/01-search-tool.ts
// TODO: 创建一个支持 glob 模式的文件搜索工具
// 要求：
// 1. 支持递归搜索
// 2. 支持 glob 模式匹配（如 "*.ts", "**/*.js"）
// 3. 支持排除模式（如 "!node_modules/**"）

export const searchFilesTool: Tool = {
  name: 'search_files',
  description: 'TODO: 填写描述',
  parameters: {
    type: 'object',
    properties: {
      // TODO: 定义参数
    },
    required: [],
  },
  execute: async (params) => {
    // TODO: 实现搜索逻辑
    return '';
  },
};
```

### 练习 2: 创建 JSON 解析工具

```typescript
// exercises/02-json-tool.ts
// TODO: 创建一个 JSON 解析和查询工具
// 要求：
// 1. 支持 JSONPath 查询语法
// 2. 支持格式化输出
// 3. 处理 JSON 解析错误

export const queryJsonTool: Tool = {
  name: 'query_json',
  description: 'TODO: 填写描述',
  parameters: {
    type: 'object',
    properties: {
      // TODO: 定义参数（json 字符串, jsonPath 查询, format 选项）
    },
    required: [],
  },
  execute: async (params) => {
    // TODO: 实现查询逻辑
    return '';
  },
};
```

### 练习 3: 实现 Schema 合并

```typescript
// exercises/03-schema-merge.ts
// TODO: 实现一个函数，合并多个 JSON Schema
// 要求：
// 1. 合并 properties
// 2. 合并 required 数组
// 3. 处理冲突（后面的覆盖前面的）

export function mergeSchemas(
  base: JSONSchema,
  ...schemas: JSONSchema[]
): JSONSchema {
  // TODO: 实现合并逻辑
  throw new Error('Not implemented');
}
```

### 练习 4: 实现 Schema 生成器

```typescript
// exercises/04-schema-generator.ts
// TODO: 从 TypeScript 类型自动生成 JSON Schema
// 提示：可以使用 ts-morph 或 typescript 库

export function generateSchemaFromType(
  typeDefinition: string
): JSONSchema {
  // TODO: 解析 TypeScript 类型定义，生成对应的 JSON Schema
  throw new Error('Not implemented');
}

// 示例输入：
// "type UserConfig = { name: string; age: number; active?: boolean }"
// 期望输出：
// {
//   type: 'object',
//   properties: {
//     name: { type: 'string' },
//     age: { type: 'number' },
//     active: { type: 'boolean' }
//   },
//   required: ['name', 'age']
// }
```

## 下一步

完成本节后，继续学习 [4.2 工具注册和管理](./02-tool-registry.md) →
