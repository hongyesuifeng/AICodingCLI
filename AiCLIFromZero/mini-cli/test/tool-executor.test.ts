import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ToolExecutor } from '../src/tools/executor.ts';
import { ToolRegistry } from '../src/tools/registry.ts';

function createExecutor(root: string): { executor: ToolExecutor; registry: ToolRegistry } {
  const registry = new ToolRegistry();
  const executor = new ToolExecutor(registry, {
    cwd: root,
    timeoutMs: 500,
    pathRestriction: {
      allowedPaths: [root],
      deniedPaths: [],
      allowRelative: true,
      maxPathLength: 4096,
    },
    commandRestriction: {
      allowedCommands: ['pwd'],
      deniedCommands: ['rm'],
      deniedPatterns: [],
      allowPipe: false,
      allowRedirect: false,
      allowBackground: false,
    },
  });

  registry.registerAll([
    executor.createReadFileTool(),
    executor.createListDirectoryTool(),
    executor.createExecuteCommandTool(),
  ]);

  return { executor, registry };
}

test('ToolExecutor executes read_file for allowed paths', async () => {
  const root = path.join(process.cwd(), 'tmp-tool-executor-read');
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, 'hello.txt'), 'hello world', 'utf-8');

  const { executor } = createExecutor(root);
  const result = await executor.execute({
    id: 'call-1',
    name: 'read_file',
    arguments: { path: './hello.txt' },
  });

  assert.equal(result.isError, undefined);
  assert.equal(result.result, 'hello world');
});

test('ToolExecutor blocks disallowed commands', async () => {
  const root = path.join(process.cwd(), 'tmp-tool-executor-command');
  await mkdir(root, { recursive: true });
  const { executor } = createExecutor(root);

  const result = await executor.execute({
    id: 'call-2',
    name: 'execute_command',
    arguments: { command: 'rm -rf /' },
  });

  assert.equal(result.isError, true);
  assert.match(result.result, /Command not allowed/);
});

test('ToolExecutor validates missing required parameters', async () => {
  const root = path.join(process.cwd(), 'tmp-tool-executor-args');
  await mkdir(root, { recursive: true });
  const { executor } = createExecutor(root);

  const result = await executor.execute({
    id: 'call-3',
    name: 'read_file',
    arguments: {},
  });

  assert.equal(result.isError, true);
  assert.match(result.result, /Missing required parameter: path/);
});
