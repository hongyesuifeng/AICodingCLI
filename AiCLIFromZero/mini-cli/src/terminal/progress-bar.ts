import { clear, cursor } from './ansi.js';

export interface ProgressBarOptions {
  width?: number;
  complete?: string;
  incomplete?: string;
  showPercent?: boolean;
  now?: () => number;
  output?: Pick<NodeJS.WriteStream, 'write'>;
}

export class ProgressBar {
  private current = 0;
  private startTime?: number;
  private readonly options: Required<Omit<ProgressBarOptions, 'output'>> & {
    output: Pick<NodeJS.WriteStream, 'write'>;
  };

  constructor(
    private readonly total: number,
    options: ProgressBarOptions = {}
  ) {
    this.options = {
      width: options.width ?? 30,
      complete: options.complete ?? '#',
      incomplete: options.incomplete ?? '-',
      showPercent: options.showPercent ?? true,
      now: options.now ?? (() => Date.now()),
      output: options.output ?? process.stdout,
    };
  }

  update(current: number, message?: string): void {
    this.current = current;

    if (this.startTime === undefined) {
      this.startTime = this.options.now();
    }

    const safeTotal = this.total <= 0 ? 1 : this.total;
    const percent = Math.min(100, Math.max(0, (this.current / safeTotal) * 100));
    const completeWidth = Math.round((percent / 100) * this.options.width);
    const incompleteWidth = this.options.width - completeWidth;
    const elapsedSeconds = ((this.options.now() - this.startTime) / 1000).toFixed(1);

    let output = `[${this.options.complete.repeat(completeWidth)}${this.options.incomplete.repeat(incompleteWidth)}]`;

    if (this.options.showPercent) {
      output += ` ${percent.toFixed(1)}%`;
    }

    if (message) {
      output += ` ${message}`;
    }

    output += ` (${elapsedSeconds}s)`;
    this.options.output.write(`${cursor.lineStart}${clear.line}${output}`);
  }

  complete(message = 'Done'): void {
    this.update(this.total, message);
    this.options.output.write('\n');
  }
}
