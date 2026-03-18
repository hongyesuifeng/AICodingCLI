# 6.2 进度条和加载动画

## 学习目标

掌握加载动画、进度条、ora 库使用和状态指示器的实现。

## 1. 加载动画

### 1.1 基础旋转动画

```typescript
// src/cli/spinner.ts

// 旋转动画帧
const SPINNER_FRAMES = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['-', '\\', '|', '/'],
  circle: ['◜', '◠', '◝', '◞', '◡', '◟'],
  arrow: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
  bounce: ['⠁', '⠂', '⠄', '⠂'],
};

// 简单旋转器
export class SimpleSpinner {
  private frames: string[];
  private frameIndex = 0;
  private interval: NodeJS.Timeout | null = null;
  private message: string;
  private stream: NodeJS.WriteStream;

  constructor(
    message: string = 'Loading...',
    type: keyof typeof SPINNER_FRAMES = 'dots',
    stream: NodeJS.WriteStream = process.stdout
  ) {
    this.frames = SPINNER_FRAMES[type];
    this.message = message;
    this.stream = stream;
  }

  /**
   * 开始动画
   */
  start(): this {
    // 隐藏光标
    this.stream.write('\x1B[?25l');

    this.interval = setInterval(() => {
      const frame = this.frames[this.frameIndex];
      this.stream.write(`\r${frame} ${this.message}`);
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, 80);

    return this;
  }

  /**
   * 停止动画
   */
  stop(finalMessage?: string): this {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    // 清除当前行
    this.stream.write('\r' + ' '.repeat(this.message.length + 10) + '\r');

    // 显示最终消息
    if (finalMessage) {
      this.stream.write(`${finalMessage}\n`);
    }

    // 显示光标
    this.stream.write('\x1B[?25h');

    return this;
  }

  /**
   * 更新消息
   */
  update(message: string): this {
    this.message = message;
    return this;
  }

  /**
   * 成功状态
   */
  succeed(message?: string): this {
    return this.stop(`✓ ${message || this.message}`);
  }

  /**
   * 失败状态
   */
  fail(message?: string): this {
    return this.stop(`✗ ${message || this.message}`);
  }

  /**
   * 警告状态
   */
  warn(message?: string): this {
    return this.stop(`⚠ ${message || this.message}`);
  }

  /**
   * 信息状态
   */
  info(message?: string): this {
    return this.stop(`ℹ ${message || this.message}`);
  }
}
```

**ANSI 转义码说明：**

| 转义码 | 说明 |
|--------|------|
| `\x1B[?25l` | 隐藏光标 |
| `\x1B[?25h` | 显示光标 |
| `\r` | 回到行首 |
| `\x1B[K` | 清除到行尾 |
| `\x1B[2K` | 清除整行 |

### 1.2 使用 ora 库

```bash
# 安装 ora
npm install ora
```

```typescript
// src/cli/ora-usage.ts
import ora from 'ora';

// 基础用法
async function basicOra() {
  // 创建并启动
  const spinner = ora('Loading...').start();

  // 模拟工作
  await sleep(2000);

  // 成功
  spinner.succeed('Done!');

  // 其他状态
  // spinner.fail('Failed!');
  // spinner.warn('Warning!');
  // spinner.info('Info!');
}

// 动态更新消息
async function dynamicMessage() {
  const spinner = ora('Processing step 1...').start();

  await sleep(1000);
  spinner.text = 'Processing step 2...';

  await sleep(1000);
  spinner.text = 'Processing step 3...';

  await sleep(1000);
  spinner.succeed('All steps completed!');
}

// 带进度的 spinner
async function withProgress() {
  const total = 10;
  const spinner = ora(`Processing 0/${total}`).start();

  for (let i = 1; i <= total; i++) {
    await sleep(300);
    spinner.text = `Processing ${i}/${total}`;
  }

  spinner.succeed('All items processed!');
}

// Promise 包装
async function promiseWrapper() {
  const result = await ora(
    fetchData()
  ).start();
  // 自动根据 Promise 结果显示成功/失败
}

// 自定义样式
async function customStyle() {
  const spinner = ora({
    text: 'Loading...',
    spinner: 'dots',        // 内置样式
    color: 'cyan',          // 颜色
    indent: 2,              // 缩进
    interval: 100,          // 帧间隔
  }).start();
}

// 辅助函数
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchData(): Promise<string> {
  await sleep(2000);
  return 'data';
}
```

**ora 配置选项：**

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `text` | string | - | 显示文本 |
| `spinner` | string/object | 'dots' | 动画样式 |
| `color` | string | 'cyan' | 颜色 |
| `indent` | number | 0 | 缩进空格 |
| `interval` | number | - | 帧间隔(ms) |
| `stream` | Stream | stdout | 输出流 |
| `isEnabled` | boolean | - | 是否启用 |

## 2. 进度条

### 2.1 简单进度条

```typescript
// src/cli/progress-bar.ts

// 进度条配置
export interface ProgressBarConfig {
  width: number;          // 进度条宽度（字符）
  complete: string;       // 完成字符
  incomplete: string;     // 未完成字符
  showPercent: boolean;   // 显示百分比
  showCount: boolean;     // 显示计数
}

const DEFAULT_CONFIG: ProgressBarConfig = {
  width: 30,
  complete: '█',
  incomplete: '░',
  showPercent: true,
  showCount: true,
};

// 简单进度条
export class ProgressBar {
  private config: ProgressBarConfig;
  private current = 0;
  private total: number;
  private stream: NodeJS.WriteStream;

  constructor(
    total: number,
    config: Partial<ProgressBarConfig> = {},
    stream: NodeJS.WriteStream = process.stdout
  ) {
    this.total = total;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stream = stream;
  }

  /**
   * 更新进度
   */
  update(current: number, message?: string): void {
    this.current = Math.min(current, this.total);
    this.render(message);
  }

  /**
   * 增加进度
   */
  increment(message?: string): void {
    this.update(this.current + 1, message);
  }

  /**
   * 渲染进度条
   */
  private render(message?: string): void {
    const percent = this.current / this.total;
    const completeWidth = Math.floor(percent * this.config.width);
    const incompleteWidth = this.config.width - completeWidth;

    const complete = this.config.complete.repeat(completeWidth);
    const incomplete = this.config.incomplete.repeat(incompleteWidth);

    let output = `[${complete}${incomplete}]`;

    if (this.config.showPercent) {
      output += ` ${Math.floor(percent * 100)}%`;
    }

    if (this.config.showCount) {
      output += ` (${this.current}/${this.total})`;
    }

    if (message) {
      output += ` ${message}`;
    }

    // 回到行首并输出
    this.stream.write(`\r${output}`);

    // 完成时换行
    if (this.current >= this.total) {
      this.stream.write('\n');
    }
  }

  /**
   * 完成
   */
  complete(message?: string): void {
    this.update(this.total, message);
  }
}

// 使用示例
async function example() {
  const bar = new ProgressBar(100);

  for (let i = 0; i <= 100; i++) {
    await sleep(50);
    bar.update(i, 'Processing...');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 2.2 多任务进度

```typescript
// src/cli/multi-progress.ts
import chalk from 'chalk';

// 单个任务状态
interface TaskStatus {
  id: string;
  name: string;
  current: number;
  total: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
}

// 多任务进度条
export class MultiProgressBar {
  private tasks = new Map<string, TaskStatus>();
  private stream: NodeJS.WriteStream;
  private barWidth: number;

  constructor(
    barWidth: number = 20,
    stream: NodeJS.WriteStream = process.stdout
  ) {
    this.barWidth = barWidth;
    this.stream = stream;
  }

  /**
   * 添加任务
   */
  addTask(id: string, name: string, total: number): void {
    this.tasks.set(id, {
      id,
      name,
      current: 0,
      total,
      status: 'pending',
    });
  }

  /**
   * 更新任务进度
   */
  updateTask(id: string, current: number, message?: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.current = Math.min(current, task.total);
      task.status = 'running';
      task.message = message;
      this.render();
    }
  }

  /**
   * 完成任务
   */
  completeTask(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.current = task.total;
      task.status = 'completed';
      this.render();
    }
  }

  /**
   * 失败任务
   */
  failTask(id: string, message?: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.status = 'failed';
      task.message = message;
      this.render();
    }
  }

  /**
   * 渲染所有进度条
   */
  private render(): void {
    // 清除之前的输出
    const lines = this.tasks.size;
    this.stream.write(`\x1B[${lines}F\x1B[0J`);

    for (const task of this.tasks.values()) {
      this.renderTask(task);
    }
  }

  /**
   * 渲染单个任务
   */
  private renderTask(task: TaskStatus): void {
    const percent = task.current / task.total;
    const completeWidth = Math.floor(percent * this.barWidth);
    const incompleteWidth = this.barWidth - completeWidth;

    let bar = '█'.repeat(completeWidth) + '░'.repeat(incompleteWidth);
    let statusIcon: string;

    switch (task.status) {
      case 'pending':
        bar = chalk.gray(bar);
        statusIcon = chalk.gray('○');
        break;
      case 'running':
        bar = chalk.cyan(bar);
        statusIcon = chalk.cyan('◐');
        break;
      case 'completed':
        bar = chalk.green(bar);
        statusIcon = chalk.green('●');
        break;
      case 'failed':
        bar = chalk.red(bar);
        statusIcon = chalk.red('✗');
        break;
    }

    const line = `${statusIcon} ${task.name.padEnd(15)} [${bar}] ${Math.floor(percent * 100)}%`;

    this.stream.write(line + '\n');
  }
}
```

## 3. 状态指示器

### 3.1 任务列表

```typescript
// src/cli/task-list.ts
import chalk from 'chalk';

// 任务状态
type TaskState = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

// 任务项
interface TaskItem {
  id: string;
  label: string;
  state: TaskState;
  detail?: string;
  subtasks?: TaskItem[];
}

// 任务列表渲染器
export class TaskList {
  private tasks: TaskItem[] = [];
  private stream: NodeJS.WriteStream;

  constructor(stream: NodeJS.WriteStream = process.stdout) {
    this.stream = stream;
  }

  /**
   * 添加任务
   */
  addTask(id: string, label: string): this {
    this.tasks.push({ id, label, state: 'pending' });
    return this;
  }

  /**
   * 更新任务状态
   */
  updateTask(id: string, state: TaskState, detail?: string): this {
    const task = this.findTask(this.tasks, id);
    if (task) {
      task.state = state;
      task.detail = detail;
      this.render();
    }
    return this;
  }

  /**
   * 开始任务
   */
  startTask(id: string): this {
    return this.updateTask(id, 'running');
  }

  /**
   * 完成任务
   */
  completeTask(id: string, detail?: string): this {
    return this.updateTask(id, 'done', detail);
  }

  /**
   * 失败任务
   */
  failTask(id: string, detail?: string): this {
    return this.updateTask(id, 'failed', detail);
  }

  /**
   * 跳过任务
   */
  skipTask(id: string, detail?: string): this {
    return this.updateTask(id, 'skipped', detail);
  }

  /**
   * 查找任务
   */
  private findTask(tasks: TaskItem[], id: string): TaskItem | undefined {
    for (const task of tasks) {
      if (task.id === id) return task;
      if (task.subtasks) {
        const found = this.findTask(task.subtasks, id);
        if (found) return found;
      }
    }
    return undefined;
  }

  /**
   * 渲染任务列表
   */
  private render(): void {
    // 清除之前的输出
    const lines = this.countLines(this.tasks);
    this.stream.write(`\x1B[${lines}F\x1B[0J`);

    // 渲染每个任务
    for (const task of this.tasks) {
      this.renderTask(task, 0);
    }
  }

  /**
   * 渲染单个任务
   */
  private renderTask(task: TaskItem, indent: number): void {
    const prefix = '  '.repeat(indent);
    const icon = this.getStatusIcon(task.state);
    const label = this.formatLabel(task.label, task.state);

    let line = `${prefix}${icon} ${label}`;

    if (task.detail) {
      line += chalk.gray(` (${task.detail})`);
    }

    this.stream.write(line + '\n');

    // 渲染子任务
    if (task.subtasks) {
      for (const subtask of task.subtasks) {
        this.renderTask(subtask, indent + 1);
      }
    }
  }

  /**
   * 获取状态图标
   */
  private getStatusIcon(state: TaskState): string {
    switch (state) {
      case 'pending': return chalk.gray('○');
      case 'running': return chalk.cyan('◐');
      case 'done': return chalk.green('●');
      case 'failed': return chalk.red('✗');
      case 'skipped': return chalk.yellow('⊘');
    }
  }

  /**
   * 格式化标签
   */
  private formatLabel(label: string, state: TaskState): string {
    switch (state) {
      case 'pending': return chalk.gray(label);
      case 'running': return chalk.cyan(label);
      case 'done': return chalk.green(label);
      case 'failed': return chalk.red(label);
      case 'skipped': return chalk.yellow(label);
    }
  }

  /**
   * 计算行数
   */
  private countLines(tasks: TaskItem[]): number {
    let count = 0;
    for (const task of tasks) {
      count += 1;
      if (task.subtasks) {
        count += this.countLines(task.subtasks);
      }
    }
    return count;
  }
}
```

### 3.2 状态面板

```typescript
// src/cli/status-panel.ts
import chalk from 'chalk';

// 状态面板
export class StatusPanel {
  private stats = new Map<string, { label: string; value: string; color?: string }>();
  private stream: NodeJS.WriteStream;
  private title: string;

  constructor(title: string, stream: NodeJS.WriteStream = process.stdout) {
    this.title = title;
    this.stream = stream;
  }

  /**
   * 设置统计项
   */
  set(key: string, label: string, value: string, color?: string): this {
    this.stats.set(key, { label, value, color });
    this.render();
    return this;
  }

  /**
   * 更新统计项
   */
  update(key: string, value: string): this {
    const stat = this.stats.get(key);
    if (stat) {
      stat.value = value;
      this.render();
    }
    return this;
  }

  /**
   * 渲染面板
   */
  private render(): void {
    // 清除之前的内容
    const lines = this.stats.size + 2;
    this.stream.write(`\x1B[${lines}F\x1B[0J`);

    // 标题
    this.stream.write(chalk.bold(this.title) + '\n');
    this.stream.write('─'.repeat(30) + '\n');

    // 统计项
    for (const stat of this.stats.values()) {
      const label = stat.label.padEnd(15);
      let value = stat.value;

      if (stat.color) {
        value = chalk[stat.color as any](value);
      }

      this.stream.write(`${label}: ${value}\n`);
    }
  }
}
```

## 4. 实际应用示例

### 4.1 AI 响应加载

```typescript
// src/cli/ai-loading.ts
import ora from 'ora';
import chalk from 'chalk';

// AI 加载动画
export class AILoadingIndicator {
  private spinner: ora.Ora | null = null;

  // 加载消息轮换
  private messages = [
    'Thinking...',
    'Processing...',
    'Analyzing...',
    'Generating response...',
  ];

  private messageIndex = 0;
  private interval: NodeJS.Timeout | null = null;

  /**
   * 开始加载
   */
  start(): void {
    this.spinner = ora({
      text: this.messages[0],
      spinner: 'dots',
      color: 'cyan',
    }).start();

    // 轮换消息
    this.interval = setInterval(() => {
      this.messageIndex = (this.messageIndex + 1) % this.messages.length;
      this.spinner!.text = this.messages[this.messageIndex];
    }, 2000);
  }

  /**
   * 停止加载
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * 完成
   */
  complete(): void {
    this.stop();
  }

  /**
   * 错误
   */
  error(message: string): void {
    if (this.spinner) {
      this.spinner.fail(chalk.red(message));
    }
    this.stop();
  }
}
```

### 4.2 工具执行指示

```typescript
// src/cli/tool-indicator.ts
import chalk from 'chalk';

// 工具执行指示器
export class ToolExecutionIndicator {
  private currentTool: string | null = null;
  private startTime: number = 0;

  /**
   * 开始工具执行
   */
  start(toolName: string, args: Record<string, any>): void {
    this.currentTool = toolName;
    this.startTime = Date.now();

    const argsStr = Object.keys(args).length > 0
      ? chalk.gray(`(${JSON.stringify(args)})`)
      : '';

    process.stdout.write(chalk.cyan(`⚙ Running ${toolName}${argsStr}...\n`));
  }

  /**
   * 工具执行完成
   */
  complete(result: string): void {
    if (!this.currentTool) return;

    const duration = Date.now() - this.startTime;
    const truncatedResult = result.length > 100
      ? result.slice(0, 100) + '...'
      : result;

    process.stdout.write(chalk.green(`✓ ${this.currentTool} completed (${duration}ms)\n`));
    process.stdout.write(chalk.gray(`  Result: ${truncatedResult}\n`));

    this.currentTool = null;
  }

  /**
   * 工具执行失败
   */
  fail(error: string): void {
    if (!this.currentTool) return;

    const duration = Date.now() - this.startTime;

    process.stdout.write(chalk.red(`✗ ${this.currentTool} failed (${duration}ms)\n`));
    process.stdout.write(chalk.red(`  Error: ${error}\n`));

    this.currentTool = null;
  }
}
```

## 参数说明

### ProgressBarConfig 字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `width` | number | 30 | 进度条宽度 |
| `complete` | string | '█' | 完成字符 |
| `incomplete` | string | '░' | 未完成字符 |
| `showPercent` | boolean | true | 显示百分比 |
| `showCount` | boolean | true | 显示计数 |

### ora 配置选项

| 选项 | 类型 | 说明 |
|------|------|------|
| `text` | string | 显示文本 |
| `spinner` | string | 动画类型 |
| `color` | string | 颜色 |
| `interval` | number | 帧间隔 |

## 练习题

### 练习 1: 实现自适应进度条

```typescript
// exercises/01-adaptive-progress.ts
// TODO: 根据终端宽度自适应进度条
// 要求：
// 1. 检测终端宽度变化
// 2. 自动调整进度条宽度
// 3. 保持显示美观

export class AdaptiveProgressBar {
  // TODO: 实现
}
```

### 练习 2: 实现倒计时

```typescript
// exercises/02-countdown.ts
// TODO: 实现倒计时显示
// 要求：
// 1. 显示剩余时间
// 2. 支持暂停/恢复
// 3. 完成时回调

export class CountdownTimer {
  // TODO: 实现
  start(seconds: number): void {}
  pause(): void {}
  resume(): void {}
}
```

### 练习 3: 实现速率显示

```typescript
// exercises/03-speed-indicator.ts
// TODO: 实现下载/上传速率显示
// 要求：
// 1. 计算实时速率
// 2. 显示进度和预估剩余时间
// 3. 支持不同单位（KB/s, MB/s）

export class SpeedIndicator {
  // TODO: 实现
  update(bytesTransferred: number): void {}
}
```

### 练习 4: 实现树形进度

```typescript
// exercises/04-tree-progress.ts
// TODO: 实现树形结构的进度显示
// 要求：
// 1. 支持嵌套任务
// 2. 可折叠/展开
// 3. 实时更新

export class TreeProgress {
  // TODO: 实现
  addNode(id: string, parentId?: string): void {}
  updateNode(id: string, progress: number): void {}
}
```

## 下一步

完成本节后，继续学习 [6.3 命令解析和路由](./03-command-routing.md) →
