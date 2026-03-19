import type { ToolDefinition } from '../types/tool.js';
import { ToolExecutor } from './executor.js';

export function createBuiltInTools(executor: ToolExecutor): ToolDefinition[] {
  return [
    executor.createReadFileTool(),
    executor.createListDirectoryTool(),
    executor.createExecuteCommandTool(),
  ];
}
