import type { StreamChunk } from '../types/message.js';
import type { StreamEvent, StreamHandlerConfig } from '../types/stream.js';

export class StreamHandler {
  private fullText = '';

  constructor(private readonly config: StreamHandlerConfig = {}) {}

  async *consume(
    stream: AsyncIterable<StreamChunk>
  ): AsyncGenerator<StreamEvent> {
    try {
      for await (const chunk of stream) {
        this.config.onChunk?.(chunk);

        if (chunk.type === 'thinking') {
          yield {
            type: 'thinking',
            delta: chunk.delta,
          };
          continue;
        }

        if (chunk.toolCall) {
          yield {
            type: 'tool_call',
            toolCall: {
              ...chunk.toolCall,
              arguments: typeof chunk.toolCall.arguments === 'string'
                ? chunk.toolCall.arguments
                : chunk.toolCall.arguments === undefined
                  ? undefined
                  : JSON.stringify(chunk.toolCall.arguments),
            },
          };
        }

        if (chunk.delta) {
          this.fullText += chunk.delta;
          yield {
            type: 'text',
            delta: chunk.delta,
          };
        }

        if (chunk.done) {
          this.config.onComplete?.(this.fullText);
          yield {
            type: 'done',
            fullText: this.fullText,
          };
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.config.onError?.(err);
      yield {
        type: 'error',
        error: err,
      };
      throw err;
    }
  }

  getFullText(): string {
    return this.fullText;
  }
}
