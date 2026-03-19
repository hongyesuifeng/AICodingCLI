import chalk from 'chalk';
import type { StreamChunk } from '../types/message.js';
import { StreamHandler } from '../streaming/stream-handler.js';

export interface StreamRendererOptions {
  output?: Pick<NodeJS.WriteStream, 'write'>;
  colorize?: boolean;
}

export class StreamRenderer {
  private readonly output: Pick<NodeJS.WriteStream, 'write'>;
  private readonly colorize: boolean;

  constructor(options: StreamRendererOptions = {}) {
    this.output = options.output ?? process.stdout;
    this.colorize = options.colorize ?? true;
  }

  async render(stream: AsyncIterable<StreamChunk>): Promise<string> {
    const handler = new StreamHandler();
    let inThinking = false;
    let fullText = '';

    this.write(this.formatAI('AI: '));

    for await (const event of handler.consume(stream)) {
      if (event.type === 'thinking') {
        if (!inThinking) {
          this.write(this.formatThinking('\n[思考中...]\n'));
          inThinking = true;
        }
        this.write(this.formatThinking(event.delta));
        continue;
      }

      if (event.type === 'text') {
        if (inThinking) {
          this.write(this.formatReset('\n[回复]\n'));
          inThinking = false;
        }

        this.write(event.delta);
        fullText += event.delta;
        continue;
      }

      if (event.type === 'done') {
        fullText = event.fullText;
      }
    }

    this.write('\n\n');
    return fullText;
  }

  private write(text: string): void {
    this.output.write(text);
  }

  private formatAI(text: string): string {
    return this.colorize ? chalk.cyan(text) : text;
  }

  private formatThinking(text: string): string {
    return this.colorize ? chalk.gray(text) : text;
  }

  private formatReset(text: string): string {
    return this.colorize ? chalk.reset(text) : text;
  }
}
