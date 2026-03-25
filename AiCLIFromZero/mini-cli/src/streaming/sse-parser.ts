import { BufferManager } from './buffer-manager.js';

export interface SSEMessage {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

export class SSEParser {
  private readonly buffer = new BufferManager();

  parse(chunk: string): SSEMessage[] {
    this.buffer.append(chunk.replace(/\r\n/g, '\n'));

    const rawMessages = this.buffer.extractMessages('\n\n');
    return rawMessages
      .map((rawMessage) => this.parseMessage(rawMessage))
      .filter((message): message is SSEMessage => message !== null);
  }

  reset(): void {
    this.buffer.clear();
  }

  private parseMessage(rawMessage: string): SSEMessage | null {
    const lines = rawMessage.split('\n');
    const message: Partial<SSEMessage> = {};
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line === '' || line.startsWith(':')) {
        continue;
      }

      const colonIndex = line.indexOf(':');
      const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
      let value = colonIndex === -1 ? '' : line.slice(colonIndex + 1);

      if (value.startsWith(' ')) {
        value = value.slice(1);
      }

      switch (field) {
        case 'id':
          message.id = value;
          break;
        case 'event':
          message.event = value;
          break;
        case 'data':
          dataLines.push(value);
          break;
        case 'retry': {
          const retry = Number.parseInt(value, 10);
          if (!Number.isNaN(retry)) {
            message.retry = retry;
          }
          break;
        }
        default:
          break;
      }
    }

    if (dataLines.length === 0) {
      return null;
    }

    return {
      ...message,
      data: dataLines.join('\n'),
    };
  }
}
