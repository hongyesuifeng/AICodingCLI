import type { AIProvider } from '../providers/base-provider.js';
import type { ChatOptions, Message, Tool } from '../types/message.js';
import type { ToolCallResult } from '../types/tool.js';
import { ToolExecutor } from './executor.js';
import { ToolRegistry } from './registry.js';

export interface ToolManagerOptions {
  maxIterations?: number;
}

export interface ToolConversationResult {
  content: string;
  messages: Message[];
  toolResults: ToolCallResult[];
}

export class ToolManager {
  private readonly maxIterations: number;

  constructor(
    private readonly registry: ToolRegistry,
    private readonly executor: ToolExecutor,
    options: ToolManagerOptions = {}
  ) {
    this.maxIterations = options.maxIterations ?? 5;
  }

  getToolsForAI(): Tool[] {
    return this.registry.getAll();
  }

  async runConversation(
    provider: AIProvider,
    initialMessages: Message[],
    options?: ChatOptions
  ): Promise<ToolConversationResult> {
    const messages = [...initialMessages];
    const allToolResults: ToolCallResult[] = [];

    for (let iteration = 0; iteration < this.maxIterations; iteration += 1) {
      const result = await provider.chatWithTools(
        messages,
        this.getToolsForAI(),
        options
      );

      if (!result.toolCalls || result.toolCalls.length === 0) {
        if (result.content) {
          messages.push({
            role: 'assistant',
            content: result.content,
          });
        }

        return {
          content: result.content,
          messages,
          toolResults: allToolResults,
        };
      }

      messages.push({
        role: 'assistant',
        content: result.content,
        toolCalls: result.toolCalls,
      });

      const toolResults = await this.executor.executeAll(result.toolCalls);
      allToolResults.push(...toolResults);

      for (const toolResult of toolResults) {
        messages.push({
          role: 'tool',
          content: toolResult.result,
          toolCallId: toolResult.toolCallId,
          isError: toolResult.isError,
        });
      }
    }

    throw new Error(`Tool loop exceeded max iterations: ${this.maxIterations}`);
  }
}
