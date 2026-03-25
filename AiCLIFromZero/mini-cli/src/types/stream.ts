import type { StreamChunk } from './message.js';

export interface StreamHandlerConfig {
  onChunk?: (chunk: StreamChunk) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export interface ToolCallDelta {
  id?: string;
  name?: string;
  arguments?: string | Record<string, unknown>;
}

export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'thinking'; delta: string }
  | { type: 'tool_call'; toolCall: ToolCallDelta }
  | { type: 'done'; fullText: string }
  | { type: 'error'; error: Error };
