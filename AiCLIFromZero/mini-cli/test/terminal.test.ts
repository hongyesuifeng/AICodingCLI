import test from 'node:test';
import assert from 'node:assert/strict';
import { ProgressBar } from '../src/terminal/progress-bar.ts';
import { StreamRenderer } from '../src/terminal/stream-renderer.ts';
import type { StreamChunk } from '../src/types/message.ts';

class MemoryOutput {
  chunks: string[] = [];

  write(chunk: string): boolean {
    this.chunks.push(chunk);
    return true;
  }

  toString(): string {
    return this.chunks.join('');
  }
}

test('ProgressBar renders a single-line update and completion', () => {
  const output = new MemoryOutput();
  let now = 1000;
  const progress = new ProgressBar(10, {
    width: 10,
    now: () => now,
    output,
  });

  progress.update(5, 'Streaming');
  now = 2500;
  progress.complete('Done');

  const rendered = output.toString();
  assert.match(rendered, /\[#####-----\] 50\.0% Streaming \(0\.0s\)/);
  assert.match(rendered, /\[##########\] 100\.0% Done \(1\.5s\)\n/);
});

test('StreamRenderer renders thinking and reply sections and returns full text', async () => {
  const output = new MemoryOutput();

  async function* createStream(): AsyncGenerator<StreamChunk> {
    yield { delta: '思考', done: false, type: 'thinking' };
    yield { delta: '你', done: false, type: 'text' };
    yield { delta: '好', done: false, type: 'text' };
    yield { delta: '', done: true };
  }

  const renderer = new StreamRenderer({
    output,
    colorize: false,
  });

  const fullText = await renderer.render(createStream());

  assert.equal(fullText, '你好');
  assert.equal(output.toString(), 'AI: \n[思考中...]\n思考\n[回复]\n你好\n\n');
});
