# 6.4 配置界面 (TUI)

## 学习目标

掌握 TUI（文本用户界面）配置界面的设计，学习 inquirer 库的高级用法、配置向导和实时预览的实现。

## 1. TUI 概述

### 1.1 什么是 TUI？

TUI（Text User Interface）是基于文本的交互式界面，在终端中提供类似 GUI 的体验：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI CLI 配置                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ◉ 模型设置                                                                 │
│  ○ API 配置                                                                 │
│  ○ 工具管理                                                                 │
│  ○ 外观设置                                                                 │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  模型: [gpt-4-turbo    ▼]                                                  │
│  温度: [0.7           ───]                                                  │
│  最大Token: [4096      ▼]                                                  │
│                                                                             │
│  [保存]  [取消]  [重置]                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. 使用 inquirer

### 2.1 安装和基础用法

```bash
npm install inquirer
```

```typescript
// src/cli/prompts/basic.ts
import inquirer from 'inquirer';

// 基础问题类型
async function basicPrompts() {
  const answers = await inquirer.prompt([
    // 文本输入
    {
      type: 'input',
      name: 'name',
      message: '你的名字是什么？',
      default: '用户',
    },

    // 密码输入
    {
      type: 'password',
      name: 'apiKey',
      message: '请输入 API Key：',
      mask: '*',
    },

    // 数字输入
    {
      type: 'number',
      name: 'age',
      message: '你的年龄？',
      default: 18,
    },

    // 确认
    {
      type: 'confirm',
      name: 'continue',
      message: '是否继续？',
      default: true,
    },

    // 单选列表
    {
      type: 'list',
      name: 'model',
      message: '选择模型：',
      choices: ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus'],
      default: 'gpt-4',
    },

    // 多选
    {
      type: 'checkbox',
      name: 'features',
      message: '选择功能：',
      choices: [
        { name: '流式输出', value: 'streaming', checked: true },
        { name: '工具调用', value: 'tools' },
        { name: '多模态', value: 'vision' },
      ],
    },

    // 展开式选择
    {
      type: 'expand',
      name: 'action',
      message: '操作：',
      choices: [
        { key: 's', name: '保存', value: 'save' },
        { key: 'd', name: '删除', value: 'delete' },
        { key: 'c', name: '取消', value: 'cancel' },
      ],
    },
  ]);

  console.log(answers);
}
```

### 2.2 inquirer 问题类型

| 类型 | 说明 | 使用场景 |
|------|------|----------|
| `input` | 文本输入 | 名称、路径等 |
| `password` | 密码输入 | API Key、密码 |
| `number` | 数字输入 | 数值配置 |
| `confirm` | 确认框 | 是/否选择 |
| `list` | 单选列表 | 选择一个选项 |
| `rawList` | 编号列表 | 带编号的选择 |
| `checkbox` | 多选框 | 选择多个选项 |
| `expand` | 展开选择 | 快捷键选择 |
| `editor` | 编辑器 | 长文本输入 |

### 2.3 高级用法

```typescript
// src/cli/prompts/advanced.ts
import inquirer from 'inquirer';

// 条件问题
async function conditionalPrompts() {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: '选择 AI 提供商：',
      choices: ['openai', 'anthropic', 'local'],
    },
    {
      type: 'input',
      name: 'apiKey',
      message: '输入 API Key：',
      // 只在非本地模式时显示
      when: (answers) => answers.provider !== 'local',
      // 验证
      validate: (input) => {
        if (!input || input.length < 10) {
          return '请输入有效的 API Key';
        }
        return true;
      },
    },
    {
      type: 'list',
      name: 'model',
      message: '选择模型：',
      // 动态选项
      choices: (answers) => {
        if (answers.provider === 'openai') {
          return ['gpt-4', 'gpt-3.5-turbo'];
        } else if (answers.provider === 'anthropic') {
          return ['claude-3-opus', 'claude-3-sonnet'];
        }
        return ['llama-2', 'mistral'];
      },
    },
    {
      type: 'number',
      name: 'temperature',
      message: 'Temperature：',
      default: 0.7,
      // 验证范围
      validate: (input) => {
        if (input < 0 || input > 2) {
          return 'Temperature 必须在 0-2 之间';
        }
        return true;
      },
      // 过滤/转换
      filter: (input) => parseFloat(input.toFixed(2)),
    },
  ]);

  return answers;
}

// 使用 Separator
async function withSeparator() {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'model',
      message: '选择模型：',
      choices: [
        'gpt-4-turbo',
        'gpt-4',
        new inquirer.Separator('--- GPT-3.5 ---'),
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k',
        new inquirer.Separator('--- Claude ---'),
        'claude-3-opus',
        'claude-3-sonnet',
      ],
    },
  ]);

  return answers;
}

// 递归问题
async function recursivePrompts() {
  const questions = [
    {
      type: 'confirm',
      name: 'addMore',
      message: '是否添加另一个文件？',
      default: false,
    },
    {
      type: 'input',
      name: 'fileName',
      message: '文件名：',
      when: (answers) => answers.addMore,
    },
  ];

  const files: string[] = [];
  let addMore = true;

  while (addMore) {
    const answers = await inquirer.prompt(questions);
    if (answers.fileName) {
      files.push(answers.fileName);
    }
    addMore = answers.addMore;
  }

  return files;
}
```

## 3. 配置向导

### 3.1 分步配置

```typescript
// src/cli/wizard/config-wizard.ts
import inquirer from 'inquirer';
import chalk from 'chalk';

// 配置步骤
interface ConfigStep {
  name: string;
  title: string;
  questions: inquirer.QuestionCollection;
}

// 配置向导
export class ConfigWizard {
  private steps: ConfigStep[] = [];
  private config: Record<string, any> = {};

  /**
   * 添加配置步骤
   */
  addStep(step: ConfigStep): this {
    this.steps.push(step);
    return this;
  }

  /**
   * 运行向导
   */
  async run(): Promise<Record<string, any>> {
    console.log(chalk.cyan.bold('\n🚀 AI CLI 配置向导\n'));
    console.log('按 Ctrl+C 可随时退出\n');

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];

      // 显示进度
      console.log(chalk.gray(`[${i + 1}/${this.steps.length}] ${step.title}`));

      // 执行问题
      const answers = await inquirer.prompt(step.questions);

      // 合并配置
      this.config = { ...this.config, ...answers };

      console.log(); // 空行
    }

    // 显示配置摘要
    await this.showSummary();

    return this.config;
  }

  /**
   * 显示配置摘要
   */
  private async showSummary(): Promise<void> {
    console.log(chalk.cyan.bold('\n📋 配置摘要\n'));

    for (const [key, value] of Object.entries(this.config)) {
      const displayValue = typeof value === 'string' && value.length > 30
        ? value.slice(0, 30) + '...'
        : value;
      console.log(`  ${key}: ${chalk.green(displayValue)}`);
    }

    console.log();

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '确认保存配置？',
        default: true,
      },
    ]);

    if (!confirm) {
      console.log(chalk.yellow('配置已取消'));
      this.config = {};
    }
  }
}

// 创建默认配置向导
export function createDefaultWizard(): ConfigWizard {
  return new ConfigWizard()
    .addStep({
      name: 'provider',
      title: 'AI 提供商设置',
      questions: [
        {
          type: 'list',
          name: 'provider',
          message: '选择 AI 提供商：',
          choices: [
            { name: 'OpenAI', value: 'openai' },
            { name: 'Anthropic', value: 'anthropic' },
            { name: '本地模型', value: 'local' },
          ],
        },
        {
          type: 'password',
          name: 'apiKey',
          message: '输入 API Key：',
          when: (ans) => ans.provider !== 'local',
          validate: (input) => input?.length >= 10 || '请输入有效的 API Key',
        },
      ],
    })
    .addStep({
      name: 'model',
      title: '模型设置',
      questions: [
        {
          type: 'list',
          name: 'model',
          message: '选择默认模型：',
          choices: (ans) => {
            if (ans.provider === 'openai') {
              return ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
            } else if (ans.provider === 'anthropic') {
              return ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'];
            }
            return ['llama-2', 'mistral'];
          },
        },
        {
          type: 'number',
          name: 'temperature',
          message: 'Temperature (0-2)：',
          default: 0.7,
          validate: (v) => (v >= 0 && v <= 2) || '必须在 0-2 之间',
        },
        {
          type: 'number',
          name: 'maxTokens',
          message: '最大 Token 数：',
          default: 4096,
        },
      ],
    })
    .addStep({
      name: 'tools',
      title: '工具设置',
      questions: [
        {
          type: 'checkbox',
          name: 'enabledTools',
          message: '启用的工具：',
          choices: [
            { name: '文件操作', value: 'file', checked: true },
            { name: '命令执行', value: 'shell' },
            { name: '网络请求', value: 'http' },
            { name: '代码执行', value: 'code' },
          ],
        },
        {
          type: 'confirm',
          name: 'requireConfirmation',
          message: '执行命令前需要确认？',
          default: true,
        },
      ],
    })
    .addStep({
      name: 'appearance',
      title: '外观设置',
      questions: [
        {
          type: 'list',
          name: 'theme',
          message: '选择主题：',
          choices: ['default', 'dark', 'light', 'colorful'],
        },
        {
          type: 'confirm',
          name: 'streaming',
          message: '启用流式输出？',
          default: true,
        },
      ],
    });
}
```

## 4. 实时预览

### 4.1 配置预览组件

```typescript
// src/cli/preview/config-preview.ts
import chalk from 'chalk';

// 配置预览
export class ConfigPreview {
  /**
   * 渲染配置预览
   */
  static render(config: Record<string, any>): string {
    const lines: string[] = [];

    lines.push(chalk.cyan('┌─────────────────────────────────────────┐'));
    lines.push(chalk.cyan('│') + chalk.bold('         当前配置预览                      ') + chalk.cyan('│'));
    lines.push(chalk.cyan('├─────────────────────────────────────────┤'));

    // 提供商
    lines.push(this.renderLine('提供商', config.provider || '未设置'));
    lines.push(this.renderLine('模型', config.model || '未设置'));
    lines.push(this.renderLine('Temperature', config.temperature?.toString() || '0.7'));
    lines.push(this.renderLine('最大Token', config.maxTokens?.toString() || '4096'));

    lines.push(chalk.cyan('├─────────────────────────────────────────┤'));

    // 工具
    const tools = config.enabledTools?.join(', ') || '无';
    lines.push(this.renderLine('启用工具', tools));

    lines.push(chalk.cyan('└─────────────────────────────────────────┘'));

    return lines.join('\n');
  }

  /**
   * 渲染单行
   */
  private static renderLine(label: string, value: string): string {
    const labelStr = label.padEnd(10);
    const valueStr = value.length > 25 ? value.slice(0, 25) + '...' : value;
    return chalk.cyan('│') + ` ${labelStr}: ${chalk.green(valueStr.padEnd(27))}` + chalk.cyan('│');
  }

  /**
   * 清除预览
   */
  static clear(): void {
    // 移动光标到预览区域并清除
    process.stdout.write('\x1B[8F\x1B[0J');
  }
}
```

### 4.2 带预览的交互

```typescript
// src/cli/preview/interactive-config.ts
import inquirer from 'inquirer';
import chalk from 'chalk';
import { ConfigPreview } from './config-preview.js';

// 带实时预览的配置
export class InteractiveConfig {
  private config: Record<string, any> = {};

  async configure(): Promise<Record<string, any>> {
    console.log(chalk.cyan.bold('\n⚙️ 交互式配置\n'));
    console.log('使用方向键选择，Enter 确认\n');

    // 初始预览
    this.updatePreview();

    // 模型选择
    this.config.model = await this.selectWithPreview(
      '选择模型：',
      ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet'],
      (value) => ({ model: value })
    );

    // Temperature
    this.config.temperature = await this.sliderWithPreview(
      'Temperature：',
      0,
      2,
      0.1,
      0.7,
      (value) => ({ temperature: value.toFixed(2) })
    );

    // 最大 Token
    const tokenOptions = [1024, 2048, 4096, 8192, 16384];
    this.config.maxTokens = await this.selectWithPreview(
      '最大 Token：',
      tokenOptions.map(String),
      (value) => ({ maxTokens: parseInt(value) })
    );

    // 流式输出
    this.config.streaming = await this.confirmWithPreview(
      '启用流式输出？',
      true,
      (value) => ({ streaming: value })
    );

    ConfigPreview.clear();
    console.log(chalk.green('\n✓ 配置完成！\n'));

    return this.config;
  }

  /**
   * 带预览的选择
   */
  private async selectWithPreview(
    message: string,
    choices: string[],
    updateFn: (value: string) => Partial<any>
  ): Promise<string> {
    const { value } = await inquirer.prompt([
      {
        type: 'list',
        name: 'value',
        message,
        choices,
      },
    ]);

    this.config = { ...this.config, ...updateFn(value) };
    this.updatePreview();

    return value;
  }

  /**
   * 带预览的滑块（模拟）
   */
  private async sliderWithPreview(
    message: string,
    min: number,
    max: number,
    step: number,
    defaultValue: number,
    updateFn: (value: number) => Partial<any>
  ): Promise<number> {
    const choices: string[] = [];
    for (let v = min; v <= max; v += step) {
      choices.push(v.toFixed(1));
    }

    const { value } = await inquirer.prompt([
      {
        type: 'list',
        name: 'value',
        message,
        choices,
        default: defaultValue.toFixed(1),
      },
    ]);

    const numValue = parseFloat(value);
    this.config = { ...this.config, ...updateFn(numValue) };
    this.updatePreview();

    return numValue;
  }

  /**
   * 带预览的确认
   */
  private async confirmWithPreview(
    message: string,
    defaultValue: boolean,
    updateFn: (value: boolean) => Partial<any>
  ): Promise<boolean> {
    const { value } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'value',
        message,
        default: defaultValue,
      },
    ]);

    this.config = { ...this.config, ...updateFn(value) };
    this.updatePreview();

    return value;
  }

  /**
   * 更新预览
   */
  private updatePreview(): void {
    console.log('\n' + ConfigPreview.render(this.config));
  }
}
```

## 5. 设置菜单

### 5.1 主菜单实现

```typescript
// src/cli/menu/settings-menu.ts
import inquirer from 'inquirer';
import chalk from 'chalk';

// 菜单项
interface MenuItem {
  name: string;
  value: string;
  description?: string;
  action?: () => Promise<void>;
}

// 设置菜单
export class SettingsMenu {
  private items: MenuItem[] = [];

  /**
   * 添加菜单项
   */
  addItem(item: MenuItem): this {
    this.items.push(item);
    return this;
  }

  /**
   * 显示菜单
   */
  async show(): Promise<void> {
    while (true) {
      console.clear();
      this.renderHeader();

      const { choice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'choice',
          message: '选择设置项：',
          choices: [
            ...this.items.map(item => ({
              name: `${item.name} ${item.description ? chalk.gray(`- ${item.description}`) : ''}`,
              value: item.value,
            })),
            new inquirer.Separator(),
            { name: '← 返回', value: 'back' },
          ],
        },
      ]);

      if (choice === 'back') {
        break;
      }

      const item = this.items.find(i => i.value === choice);
      if (item?.action) {
        await item.action();
      }
    }
  }

  /**
   * 渲染头部
   */
  private renderHeader(): void {
    console.log(chalk.cyan.bold('\n╔════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║           ⚙️ 设置菜单                   ║'));
    console.log(chalk.cyan.bold('╚════════════════════════════════════════╝\n'));
  }
}

// 创建默认设置菜单
export function createSettingsMenu(): SettingsMenu {
  return new SettingsMenu()
    .addItem({
      name: '模型设置',
      value: 'model',
      description: '配置 AI 模型参数',
      action: async () => {
        // 模型配置逻辑
        await inquirer.prompt([
          {
            type: 'list',
            name: 'model',
            message: '选择模型：',
            choices: ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
          },
        ]);
      },
    })
    .addItem({
      name: 'API 配置',
      value: 'api',
      description: '配置 API Key 和端点',
      action: async () => {
        await inquirer.prompt([
          {
            type: 'password',
            name: 'apiKey',
            message: '输入 API Key：',
          },
        ]);
      },
    })
    .addItem({
      name: '工具管理',
      value: 'tools',
      description: '启用/禁用工具',
      action: async () => {
        await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'tools',
            message: '选择启用的工具：',
            choices: [
              { name: '文件操作', value: 'file', checked: true },
              { name: '命令执行', value: 'shell' },
              { name: '网络请求', value: 'http' },
            ],
          },
        ]);
      },
    })
    .addItem({
      name: '外观设置',
      value: 'appearance',
      description: '主题和显示设置',
      action: async () => {
        await inquirer.prompt([
          {
            type: 'list',
            name: 'theme',
            message: '选择主题：',
            choices: ['default', 'dark', 'light'],
          },
        ]);
      },
    });
}
```

## 参数说明

### inquirer.Question 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `type` | string | 问题类型 |
| `name` | string | 答案键名 |
| `message` | string | 问题文本 |
| `default` | any | 默认值 |
| `choices` | array | 选项列表 |
| `validate` | function | 验证函数 |
| `filter` | function | 过滤/转换函数 |
| `when` | function/boolean | 条件显示 |
| `pageSize` | number | 列表显示数量 |

### ConfigWizard 步骤

| 属性 | 类型 | 说明 |
|------|------|------|
| `name` | string | 步骤标识 |
| `title` | string | 步骤标题 |
| `questions` | Question[] | 问题列表 |

## 练习题

### 练习 1: 实现表单验证

```typescript
// exercises/01-form-validation.ts
// TODO: 实现复杂的表单验证
// 要求：
// 1. 验证邮箱格式
// 2. 验证 URL 格式
// 3. 验证密码强度

export class FormValidator {
  // TODO: 实现
}
```

### 练习 2: 实现动态表单

```typescript
// exercises/02-dynamic-form.ts
// TODO: 实现动态添加/删除字段
// 要求：
// 1. 添加字段按钮
// 2. 删除字段按钮
// 3. 字段排序

export class DynamicForm {
  // TODO: 实现
}
```

### 练习 3: 实现颜色选择器

```typescript
// exercises/03-color-picker.ts
// TODO: 实现终端颜色选择器
// 要求：
// 1. 显示颜色预览
// 2. 支持自定义颜色
// 3. 输出颜色代码

export class ColorPicker {
  // TODO: 实现
}
```

### 练习 4: 实现文件选择器

```typescript
// exercises/04-file-picker.ts
// TODO: 实现交互式文件选择
// 要求：
// 1. 浏览目录
// 2. 文件过滤
// 3. 多选支持

export class FilePicker {
  // TODO: 实现
}
```

## 下一步

恭喜完成第06章！继续学习 [第07章：高级功能](../07-advanced-features/README.md) →
