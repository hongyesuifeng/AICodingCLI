/**
 * 内置工具
 */

import { ToolRegistry } from './registry.js';
import { readFile, writeFile } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export function registerBuiltInTools(registry: ToolRegistry): void {
  // 文件读取工具
  registry.register({
    name: 'read_file',
    description: 'Read the contents of a file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to read' },
      },
      required: ['path'],
    },
    execute: async ({ path }) => {
      try {
        return await readFile(path, 'utf-8');
      } catch (error: any) {
        return `Error reading file: ${error.message}`;
      }
    },
  });

  // 文件写入工具
  registry.register({
    name: 'write_file',
    description: 'Write content to a file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to write' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
    execute: async ({ path, content }) => {
      try {
        await writeFile(path, content, 'utf-8');
        return `File written successfully: ${path}`;
      } catch (error: any) {
        return `Error writing file: ${error.message}`;
      }
    },
  });

  // 命令执行工具
  registry.register({
    name: 'execute_command',
    description: 'Execute a shell command',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute' },
      },
      required: ['command'],
    },
    execute: async ({ command }) => {
      try {
        const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
        return stdout || stderr || 'Command executed successfully';
      } catch (error: any) {
        return `Error executing command: ${error.message}`;
      }
    },
  });
}
