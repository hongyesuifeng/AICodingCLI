import { exec as execCallback } from 'node:child_process';
import { promises as fs } from 'node:fs';
import util from 'node:util';
import type { ToolCall, ToolCallResult, ToolContext, ToolDefinition } from '../types/tool.js';
import { withTimeout } from '../utils/timeout.js';
import { ToolRegistry } from './registry.js';
import { CommandFilter, type CommandRestriction } from './security/command-filter.js';
import { PathValidator, type PathRestriction } from './security/path-validator.js';

const exec = util.promisify(execCallback);

export interface ToolExecutorOptions {
  cwd?: string;
  timeoutMs?: number;
  pathRestriction?: PathRestriction;
  commandRestriction?: CommandRestriction;
}

export class ToolExecutor {
  private readonly pathValidator: PathValidator;
  private readonly commandFilter: CommandFilter;
  private readonly cwd: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly registry: ToolRegistry,
    options: ToolExecutorOptions = {}
  ) {
    this.cwd = options.cwd ?? process.cwd();
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.pathValidator = new PathValidator(options.pathRestriction);
    this.commandFilter = new CommandFilter(options.commandRestriction);
  }

  async execute(toolCall: ToolCall): Promise<ToolCallResult> {
    const tool = this.registry.get(toolCall.name);

    if (!tool) {
      return {
        toolCallId: toolCall.id,
        result: `Unknown tool: ${toolCall.name}`,
        isError: true,
      };
    }

    try {
      this.validateToolCall(tool, toolCall.arguments);
      const context: ToolContext = { cwd: this.cwd };
      const result = await withTimeout(
        tool.execute(toolCall.arguments, context),
        this.timeoutMs
      );

      return {
        toolCallId: toolCall.id,
        result,
      };
    } catch (error) {
      return {
        toolCallId: toolCall.id,
        result: error instanceof Error ? error.message : String(error),
        isError: true,
      };
    }
  }

  async executeAll(toolCalls: ToolCall[]): Promise<ToolCallResult[]> {
    const results: ToolCallResult[] = [];

    for (const toolCall of toolCalls) {
      results.push(await this.execute(toolCall));
    }

    return results;
  }

  createReadFileTool(): ToolDefinition {
    return {
      name: 'read_file',
      description: 'Read the contents of a file from the local filesystem.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path to the file to read',
          },
        },
        required: ['path'],
      },
      execute: async (params, context) => {
        const pathValue = this.expectString(params.path, 'path');
        const validated = this.pathValidator.validate(pathValue, context.cwd);

        if (!validated.valid || !validated.normalizedPath) {
          throw new Error(validated.error ?? 'Invalid path');
        }

        return fs.readFile(validated.normalizedPath, 'utf-8');
      },
    };
  }

  createListDirectoryTool(): ToolDefinition {
    return {
      name: 'list_directory',
      description: 'List files and directories in a directory.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The directory path to list',
          },
        },
        required: ['path'],
      },
      execute: async (params, context) => {
        const pathValue = this.expectString(params.path, 'path');
        const validated = this.pathValidator.validate(pathValue, context.cwd);

        if (!validated.valid || !validated.normalizedPath) {
          throw new Error(validated.error ?? 'Invalid path');
        }

        const entries = await fs.readdir(validated.normalizedPath, {
          withFileTypes: true,
        });

        return entries
          .map((entry) => `${entry.isDirectory() ? '[dir]' : '[file]'} ${entry.name}`)
          .join('\n');
      },
    };
  }

  createExecuteCommandTool(): ToolDefinition {
    return {
      name: 'execute_command',
      description: 'Execute a safe shell command and return the output.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The command to execute',
          },
          cwd: {
            type: 'string',
            description: 'Optional working directory for the command',
          },
        },
        required: ['command'],
      },
      execute: async (params, context) => {
        const command = this.expectString(params.command, 'command');
        const cwd = params.cwd === undefined
          ? context.cwd
          : this.expectString(params.cwd, 'cwd');
        const validatedCommand = this.commandFilter.validate(command);

        if (!validatedCommand.valid) {
          throw new Error(validatedCommand.error ?? 'Invalid command');
        }

        const validatedPath = this.pathValidator.validate(cwd, context.cwd);
        if (!validatedPath.valid || !validatedPath.normalizedPath) {
          throw new Error(validatedPath.error ?? 'Invalid command cwd');
        }

        const { stdout, stderr } = await exec(command, {
          cwd: validatedPath.normalizedPath,
        });

        return stdout || stderr || 'Command executed successfully';
      },
    };
  }

  private validateToolCall(
    tool: ToolDefinition,
    args: Record<string, unknown>
  ): void {
    const schema = tool.parameters;
    const properties = schema.properties ?? {};
    const required = schema.required ?? [];

    for (const field of required) {
      if (!(field in args)) {
        throw new Error(`Missing required parameter: ${field}`);
      }
    }

    for (const [key, value] of Object.entries(args)) {
      const property = properties[key];
      if (!property) {
        continue;
      }

      const expectedTypes = Array.isArray(property.type)
        ? property.type
        : [property.type];

      const actualType = this.getValueType(value);
      if (!expectedTypes.includes(actualType as any)) {
        throw new Error(`Invalid parameter type for ${key}: expected ${expectedTypes.join('|')}, got ${actualType}`);
      }
    }
  }

  private getValueType(value: unknown): string {
    if (value === null) {
      return 'null';
    }

    if (Array.isArray(value)) {
      return 'array';
    }

    if (Number.isInteger(value)) {
      return 'integer';
    }

    return typeof value;
  }

  private expectString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`Expected non-empty string for ${field}`);
    }

    return value;
  }
}
