// src/cli/spinner.ts

// 旋转动画帧
const SPINNER_FRAMES: Record<string, string[]> = {
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
  private interval: ReturnType<typeof setInterval> | null = null;
  private message: string;
  private stream: NodeJS.WriteStream;
  private isSpinning = false;

  constructor(
    message: string = 'Loading...',
    type: keyof typeof SPINNER_FRAMES = 'dots',
    stream: NodeJS.WriteStream = process.stdout
  ) {
    this.frames = SPINNER_FRAMES[type];
    this.message = message;
    this.stream = stream;
  }

  // 开始动画
  start(): this {
    if (this.isSpinning) return this;

    this.isSpinning = true;
    // 隐藏光标
    this.stream.write('\x1B[?25l');

    this.interval = setInterval(() => {
      const frame = this.frames[this.frameIndex];
      this.stream.write(`\r${frame} ${this.message}`);
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, 80);

    return this;
  }

  // 停止动画
  stop(finalMessage?: string): this {
    if (!this.isSpinning) return this;

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
    this.isSpinning = false;

    return this;
  }

  // 更新消息
  update(message: string): this {
    this.message = message;
    return this;
  }

  // 成功状态
  succeed(message?: string): this {
    return this.stop(`✓ ${message || this.message}`);
  }

  // 失败状态
  fail(message?: string): this {
    return this.stop(`✗ ${message || this.message}`);
  }

  // 警告状态
  warn(message?: string): this {
    return this.stop(`⚠ ${message || this.message}`);
  }

  // 信息状态
  info(message?: string): this {
    return this.stop(`ℹ ${message || this.message}`);
  }
}

// 进度条配置
export interface ProgressBarConfig {
  width: number;
  complete: string;
  incomplete: string;
  showPercent: boolean;
  showCount: boolean;
}

const DEFAULT_PROGRESS_CONFIG: ProgressBarConfig = {
  width: 30,
  complete: '█',
  incomplete: '░',
  showPercent: true,
  showCount: true,
};

// 进度条
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
    this.config = { ...DEFAULT_PROGRESS_CONFIG, ...config };
    this.stream = stream;
  }

  // 更新进度
  update(current: number, message?: string): void {
    this.current = Math.min(current, this.total);
    this.render(message);
  }

  // 增加进度
  increment(message?: string): void {
    this.update(this.current + 1, message);
  }

  // 渲染进度条
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

  // 完成
  complete(message?: string): void {
    this.update(this.total, message);
  }
}
