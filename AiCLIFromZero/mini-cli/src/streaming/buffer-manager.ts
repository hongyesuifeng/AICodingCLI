export class BufferManager {
  private buffer = '';

  constructor(private readonly maxSize = 1024 * 1024) {}

  append(data: string): void {
    if (this.buffer.length + data.length > this.maxSize) {
      throw new Error('Buffer overflow: exceeds maximum size');
    }

    this.buffer += data;
  }

  getBuffer(): string {
    return this.buffer;
  }

  getLength(): number {
    return this.buffer.length;
  }

  shift(count: number): string {
    const removed = this.buffer.slice(0, count);
    this.buffer = this.buffer.slice(count);
    return removed;
  }

  clear(): void {
    this.buffer = '';
  }

  isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  extractMessage(delimiter = '\n'): string | null {
    const index = this.buffer.indexOf(delimiter);

    if (index === -1) {
      return null;
    }

    const message = this.buffer.slice(0, index);
    this.buffer = this.buffer.slice(index + delimiter.length);
    return message;
  }

  extractMessages(delimiter = '\n'): string[] {
    const messages: string[] = [];

    while (true) {
      const message = this.extractMessage(delimiter);
      if (message === null) {
        return messages;
      }
      messages.push(message);
    }
  }

  startsWith(prefix: string): boolean {
    return this.buffer.startsWith(prefix);
  }

  indexOf(pattern: string): number {
    return this.buffer.indexOf(pattern);
  }
}
