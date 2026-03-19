import test from 'node:test';
import assert from 'node:assert/strict';
import { ToolRegistry } from '../src/tools/registry.ts';
import type { ToolDefinition } from '../src/types/tool.ts';

function createTool(name: string): ToolDefinition {
  return {
    name,
    description: `${name} description`,
    parameters: { type: 'object' },
    async execute() {
      return `${name} result`;
    },
  };
}

test('ToolRegistry registers and lists tools', () => {
  const registry = new ToolRegistry();
  registry.register(createTool('read_file'));
  registry.register(createTool('execute_command'));

  assert.deepEqual(registry.list(), ['execute_command', 'read_file']);
  assert.equal(registry.get('read_file')?.name, 'read_file');
});

test('ToolRegistry rejects duplicate registrations', () => {
  const registry = new ToolRegistry();
  registry.register(createTool('read_file'));

  assert.throws(
    () => registry.register(createTool('read_file')),
    /Tool already registered: read_file/
  );
});
