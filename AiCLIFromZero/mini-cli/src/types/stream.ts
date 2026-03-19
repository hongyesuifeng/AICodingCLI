import type { StreamChunk, ToolCall } from './message.js';

export interface StreamHandlerConfig {
  onChunk?: (chunk: StreamChunk) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export interface ToolCallDelta extends Partial<ToolCall> {
  arguments?: string;
}

export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'thinking'; delta: string }
  | { type: 'tool_call'; toolCall: ToolCallDelta }
  | { type: 'done'; fullText: string }
  | { type: 'error'; error: Error };
