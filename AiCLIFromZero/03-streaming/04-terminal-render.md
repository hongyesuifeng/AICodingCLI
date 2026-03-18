# 3.4 终端实时渲染

## 学习目标

掌握终端实时输出技术，包括进度显示、格式化输出和 ANSI 转义序列。

## 核心概念

### 终端渲染的关键技术

| 技术 | 作用 | 示例 |
|------|------|------|
| ANSI 转义序列 | 控制光标、颜色、样式 | `\x1b[32m` 绿色 |
| process.stdout | 直接写入标准输出 | 无缓冲，实时显示 |
| 单行更新 | 覆盖当前行显示进度 | `\r` 回到行首 |
| 多行渲染 | 构建复杂 TUI 界面 | 保存/恢复光标位置 |

## 1. 基础输出控制

### process.stdout vs console.log

```typescript
// src/terminal/output-basics.ts

// console.log - 自动添加换行
console.log('Hello');  // Hello\n

// process.stdout.write - 不添加换行
process.stdout.write('Hello');  // Hello

// 对比流式输出效果
function demoOutput() {
  console.log('--- console.log ---');
  console.log('Loading');
  console.log('Loading');
  console.log('Loading');

  console.log('\n--- process.stdout.write ---');
  process.stdout.write('Loading');
  process.stdout.write('Loading');
  process.stdout.write('Loading');
  console.log(); // 换行
}
```

**关键区别：**

| 特性 | console.log | process.stdout.write |
|------|-------------|---------------------|
| 自动换行 | 是 | 否 |
| 格式化 | 支持 %s, %d 等 | 仅字符串 |
| 性能 | 较慢 | 较快 |
| 适用场景 | 调试、日志 | 流式输出、实时渲染 |

### 流式文本输出

```typescript
// src/terminal/stream-output.ts

/**
 * 模拟打字效果
 */
async function typeWriter(text: string, delay: number = 30): Promise<void> {
  for (const char of text) {
    process.stdout.write(char);
    await sleep(delay);
  }
  console.log(); // 结束换行
}

/**
 * 流式显示 AI 响应
 */
async function displayAIStream(
  stream: AsyncGenerator<string>
): Promise<string> {
  let fullText = '';

  // 显示 AI 前缀
  process.stdout.write('\x1b[36mAI:\x1b[0m '); // 青色的 "AI:"

  for await (const chunk of stream) {
    process.stdout.write(chunk);
    fullText += chunk;
  }

  console.log(); // 结束换行
  return fullText;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## 2. ANSI 转义序列

### 颜色和样式

```typescript
// src/terminal/ansi-colors.ts

// ANSI 转义序列格式：\x1b[<参数>m

export const colors = {
  // 前景色
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // 重置
  reset: '\x1b[0m',
};

export const styles = {
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
};

// 使用示例
function demoColors() {
  console.log(`${colors.red}红色文字${colors.reset}`);
  console.log(`${colors.green}${styles.bold}绿色加粗${colors.reset}`);
  console.log(`${styles.underline}下划线文字${colors.reset}`);
}
```

**ANSI 颜色代码表：**

| 代码 | 颜色 | 示例 |
|------|------|------|
| 30 | 黑色 | `\x1b[30m` |
| 31 | 红色 | `\x1b[31m` |
| 32 | 绿色 | `\x1b[32m` |
| 33 | 黄色 | `\x1b[33m` |
| 34 | 蓝色 | `\x1b[34m` |
| 35 | 品红 | `\x1b[35m` |
| 36 | 青色 | `\x1b[36m` |
| 37 | 白色 | `\x1b[37m` |

**样式代码表：**

| 代码 | 样式 |
|------|------|
| 0 | 重置 |
| 1 | 加粗 |
| 2 | 变暗 |
| 3 | 斜体 |
| 4 | 下划线 |
| 7 | 反色 |

### 光标控制

```typescript
// src/terminal/cursor-control.ts

export const cursor = {
  // 移动光标
  up: (n: number = 1) => `\x1b[${n}A`,
  down: (n: number = 1) => `\x1b[${n}B`,
  forward: (n: number = 1) => `\x1b[${n}C`,
  back: (n: number = 1) => `\x1b[${n}D`,

  // 移动到绝对位置
  moveTo: (row: number, col: number) => `\x1b[${row};${col}H`,

  // 移动到行首/行尾
  lineStart: '\r',
  lineEnd: '\x1b[999C',

  // 保存/恢复光标位置
  save: '\x1b[s',
  restore: '\x1b[u',

  // 隐藏/显示光标
  hide: '\x1b[?25l',
  show: '\x1b[?25h',
};

// 使用示例
function demoCursor() {
  console.log('Line 1');
  console.log('Line 2');
  console.log('Line 3');

  // 回到第二行开头并修改
  process.stdout.write(cursor.up(2));
  process.stdout.write(cursor.lineStart);
  process.stdout.write('Modified Line 2');

  // 恢复光标到末尾
  process.stdout.write(cursor.down(2));
  process.stdout.write(cursor.show);
}
```

**光标控制序列：**

| 序列 | 作用 | 示例 |
|------|------|------|
| `\x1b[nA` | 上移 n 行 | `\x1b[2A` |
| `\x1b[nB` | 下移 n 行 | `\x1b[1B` |
| `\x1b[nC` | 右移 n 列 | `\x1b[5C` |
| `\x1b[nD` | 左移 n 列 | `\x1b[3D` |
| `\x1b[row;colH` | 移动到指定位置 | `\x1b[10;20H` |
| `\r` | 移动到行首 | - |

### 清除屏幕

```typescript
// src/terminal/clear.ts

export const clear = {
  // 清除整行
  line: '\x1b[2K',

  // 清除光标到行尾
  lineToEnd: '\x1b[0K',

  // 清除行首到光标
  lineToStart: '\x1b[1K',

  // 清除屏幕
  screen: '\x1b[2J',

  // 清除光标到屏幕末尾
  screenBelow: '\x1b[0J',

  // 清除屏幕开头到光标
  screenAbove: '\x1b[1J',
};

// 更新当前行
function updateLine(text: string): void {
  process.stdout.write(`\r${clear.line}${text}`);
}
```

## 3. 进度显示

### 文本进度条

```typescript
// src/terminal/progress-bar.ts

export interface ProgressBarOptions {
  width?: number;       // 进度条宽度
  complete?: string;    // 完成字符
  incomplete?: string;  // 未完成字符
  showPercent?: boolean; // 显示百分比
}

export class ProgressBar {
  private current = 0;
  private startTime?: number;

  constructor(
    private total: number,
    private options: ProgressBarOptions = {}
  ) {
    this.options = {
      width: 30,
      complete: '█',
      incomplete: '░',
      showPercent: true,
      ...options,
    };
  }

  /**
   * 更新进度
   */
  update(current: number, message?: string): void {
    this.current = current;

    if (!this.startTime) {
      this.startTime = Date.now();
    }

    const percent = Math.min(100, Math.max(0, (current / this.total) * 100));
    const completeWidth = Math.floor((percent / 100) * this.options.width!);
    const incompleteWidth = this.options.width! - completeWidth;

    const bar =
      this.options.complete!.repeat(completeWidth) +
      this.options.incomplete!.repeat(incompleteWidth);

    let output = `[${bar}]`;

    if (this.options.showPercent) {
      output += ` ${percent.toFixed(1)}%`;
    }

    if (message) {
      output += ` ${message}`;
    }

    // 计算耗时
    const elapsed = ((Date.now() - this.startTime!) / 1000).toFixed(1);
    output += ` (${elapsed}s)`;

    // 清除当前行并重写
    process.stdout.write(`\r${clear.line}${output}`);
  }

  /**
   * 完成进度条
   */
  complete(message?: string): void {
    this.update(this.total, message || 'Done');
    console.log(); // 换行
  }
}

// 使用示例
async function demoProgressBar() {
  const bar = new ProgressBar(100);

  for (let i = 0; i <= 100; i++) {
    bar.update(i, `Processing item ${i}`);
    await sleep(50);
  }

  bar.complete('All items processed');
}
```

### 旋转加载动画

```typescript
// src/terminal/spinner.ts

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class Spinner {
  private frame = 0;
  private interval?: NodeJS.Timeout;
  private text = '';

  constructor(private frames: string[] = spinnerFrames) {}

  /**
   * 开始动画
   */
  start(text: string = ''): this {
    this.text = text;
    this.frame = 0;

    process.stdout.write(cursor.hide);

    this.interval = setInterval(() => {
      this.render();
      this.frame = (this.frame + 1) % this.frames.length;
    }, 80);

    return this;
  }

  /**
   * 更新文本
   */
  update(text: string): this {
    this.text = text;
    return this;
  }

  /**
   * 渲染当前帧
   */
  private render(): void {
    const frame = this.frames[this.frame];
    const output = `\r${clear.line}${colors.cyan}${frame}${colors.reset} ${this.text}`;
    process.stdout.write(output);
  }

  /**
   * 停止动画并显示成功
   */
  succeed(text?: string): void {
    this.stop();
    process.stdout.write(`\r${clear.line}${colors.green}✓${colors.reset} ${text || this.text}\n`);
  }

  /**
   * 停止动画并显示失败
   */
  fail(text?: string): void {
    this.stop();
    process.stdout.write(`\r${clear.line}${colors.red}✗${colors.reset} ${text || this.text}\n`);
  }

  /**
   * 停止动画
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    process.stdout.write(cursor.show);
  }
}

// 使用示例
async function demoSpinner() {
  const spinner = new Spinner();

  spinner.start('Loading data...');
  await sleep(2000);

  spinner.update('Processing data...');
  await sleep(2000);

  spinner.succeed('Data processed successfully');
}
```

## 4. 流式输出渲染器

### 实时流式输出组件

```typescript
// src/terminal/stream-renderer.ts

export interface StreamRendererOptions {
  prefix?: string;
  prefixColor?: string;
  showCursor?: boolean;
  onLineComplete?: (line: string) => void;
}

export class StreamRenderer {
  private buffer = '';
  private lineCount = 0;

  constructor(private options: StreamRendererOptions = {}) {
    this.options = {
      prefix: 'AI:',
      prefixColor: colors.cyan,
      showCursor: true,
      ...options,
    };
  }

  /**
   * 开始新的流式输出
   */
  start(): void {
    this.buffer = '';
    this.lineCount = 0;

    // 显示前缀
    process.stdout.write(`${this.options.prefixColor}${this.options.prefix}${colors.reset} `);
  }

  /**
   * 写入增量内容
   */
  write(delta: string): void {
    this.buffer += delta;

    // 处理换行
    if (delta.includes('\n')) {
      const lines = delta.split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        process.stdout.write(lines[i] + '\n');
        this.lineCount++;

        // 新行添加缩进
        process.stdout.write('   '); // 与前缀对齐的缩进
      }
      process.stdout.write(lines[lines.length - 1]);
    } else {
      process.stdout.write(delta);
    }
  }

  /**
   * 结束流式输出
   */
  end(): string {
    console.log(); // 换行
    return this.buffer;
  }

  /**
   * 获取已接收的内容
   */
  getContent(): string {
    return this.buffer;
  }
}
```

### 带状态的流式渲染

```typescript
// src/terminal/status-renderer.ts

export class StatusStreamRenderer {
  private lines: string[] = [];
  private statusLine = 0;
  private contentLine = 0;
  private started = false;

  /**
   * 初始化渲染区域
   */
  init(): void {
    // 预留状态行
    console.log(); // 空行作为状态区
    this.statusLine = 1;
    this.contentLine = 2;
    this.started = true;
  }

  /**
   * 更新状态行
   */
  updateStatus(status: string): void {
    if (!this.started) this.init();

    // 保存当前光标位置
    process.stdout.write(cursor.save);

    // 移动到状态行
    process.stdout.write(`\x1b[${this.statusLine};1H`);
    process.stdout.write(clear.line);
    process.stdout.write(`${colors.yellow}⏳ ${status}${colors.reset}`);

    // 恢复光标位置
    process.stdout.write(cursor.restore);
  }

  /**
   * 写入内容
   */
  write(delta: string): void {
    if (!this.started) this.init();
    process.stdout.write(delta);
  }

  /**
   * 完成状态
   */
  complete(status: string = 'Done'): void {
    // 保存当前光标位置
    process.stdout.write(cursor.save);

    // 移动到状态行
    process.stdout.write(`\x1b[${this.statusLine};1H`);
    process.stdout.write(clear.line);
    process.stdout.write(`${colors.green}✓ ${status}${colors.reset}`);

    // 恢复光标位置
    process.stdout.write(cursor.restore);
    console.log();
  }

  /**
   * 错误状态
   */
  error(error: string): void {
    // 保存当前光标位置
    process.stdout.write(cursor.save);

    // 移动到状态行
    process.stdout.write(`\x1b[${this.statusLine};1H`);
    process.stdout.write(clear.line);
    process.stdout.write(`${colors.red}✗ Error: ${error}${colors.reset}`);

    // 恢复光标位置
    process.stdout.write(cursor.restore);
    console.log();
  }
}
```

## 5. 完整示例：流式聊天界面

```typescript
// src/terminal/chat-interface.ts
import * as readline from 'readline';

export class ChatInterface {
  private rl: readline.Interface;
  private renderer: StreamRenderer;
  private spinner: Spinner;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.renderer = new StreamRenderer();
    this.spinner = new Spinner();
  }

  /**
   * 开始聊天
   */
  async start(
    sendMessage: (message: string) => Promise<AsyncGenerator<string>>
  ): Promise<void> {
    console.log(`${colors.cyan}Chat started. Type "exit" to quit.${colors.reset}\n`);

    const promptLoop = async () => {
      this.rl.question(`${colors.green}You:${colors.reset} `, async (input) => {
        if (input.toLowerCase() === 'exit') {
          console.log('Goodbye!');
          this.rl.close();
          return;
        }

        try {
          // 显示加载动画
          this.spinner.start('Thinking...');

          // 获取流式响应
          const stream = await sendMessage(input);

          // 停止加载动画
          this.spinner.stop();

          // 显示 AI 响应
          this.renderer.start();

          for await (const chunk of stream) {
            this.renderer.write(chunk);
          }

          this.renderer.end();
          console.log();

        } catch (error) {
          this.spinner.fail(`Error: ${(error as Error).message}`);
        }

        // 继续下一轮
        promptLoop();
      });
    };

    promptLoop();
  }

  /**
   * 关闭界面
   */
  close(): void {
    this.rl.close();
  }
}

// 使用示例
async function main() {
  const chat = new ChatInterface();

  // 模拟 AI 响应函数
  async function* mockStream(message: string): AsyncGenerator<string> {
    const response = `你说的是: "${message}"。这是一个模拟的 AI 响应。`;
    for (const char of response) {
      await new Promise(r => setTimeout(r, 30));
      yield char;
    }
  }

  await chat.start(mockStream);
}
```

## 参数说明

### ProgressBarOptions

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `width` | number | 30 | 进度条宽度（字符数） |
| `complete` | string | '█' | 完成部分的字符 |
| `incomplete` | string | '░' | 未完成部分的字符 |
| `showPercent` | boolean | true | 是否显示百分比 |

### StreamRendererOptions

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `prefix` | string | 'AI:' | 输出前缀 |
| `prefixColor` | string | cyan | 前缀颜色 |
| `showCursor` | boolean | true | 是否显示光标 |
| `onLineComplete` | function | - | 行完成回调 |

## 练习题

### 练习 1: 实现多进度条显示

```typescript
// exercises/01-multi-progress.ts

export class MultiProgressBar {
  /**
   * 实现：同时显示多个进度条
   * 要求：
   * 1. 每个进度条单独更新
   * 2. 进度条按行排列
   * 3. 支持添加/移除进度条
   */
  add(id: string, total: number): void {
    // TODO: 实现代码
  }

  update(id: string, current: number): void {
    // TODO: 实现代码
  }

  remove(id: string): void {
    // TODO: 实现代码
  }
}
```

### 练习 2: 实现自适应文本换行

```typescript
// exercises/02-word-wrap.ts

export class TerminalWordWrap {
  /**
   * 实现：自动检测终端宽度并换行
   * 要求：
   * 1. 检测终端宽度
   * 2. 按词换行（不在单词中间断开）
   * 3. 支持带颜色的文本
   */
  wrap(text: string): string[] {
    // TODO: 实现代码
  }
}
```

### 练习 3: 实现实时统计显示

```typescript
// exercises/03-live-stats.ts

export class LiveStatsDisplay {
  /**
   * 实现：实时更新的统计面板
   * 要求：
   * 1. 固定位置显示
   * 2. 支持多项统计数据
   * 3. 平滑更新动画
   */
  update(stats: Record<string, number | string>): void {
    // TODO: 实现代码
  }
}
```

## 下一步

完成第03章后，继续学习 [第04章：工具系统](../04-tool-system/README.md) →
