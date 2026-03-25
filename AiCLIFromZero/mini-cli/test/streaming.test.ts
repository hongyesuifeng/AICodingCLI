import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferManager } from '../src/streaming/buffer-manager.ts';
import { JSONStreamParser } from '../src/streaming/json-stream-parser.ts';
import { SSEParser } from '../src/streaming/sse-parser.ts';
import { StreamHandler } from '../src/streaming/stream-handler.ts';
import type { StreamChunk } from '../src/types/message.ts';

test('BufferManager extracts delimited messages and keeps remaining buffer', () => {
  const buffer = new BufferManager();

  buffer.append('first\nsecond\npartial');

  assert.equal(buffer.extractMessage(), 'first');
  assert.deepEqual(buffer.extractMessages(), ['second']);
  assert.equal(buffer.getBuffer(), 'partial');
});

test('BufferManager throws on overflow', () => {
  const buffer = new BufferManager(5);

  assert.throws(
    () => buffer.append('123456'),
    /Buffer overflow/
  );
});

test('SSEParser parses complete events across chunk boundaries', () => {
  const parser = new SSEParser();

  const first = parser.parse('id: 1\nevent: message\ndata: Hel');
  const second = parser.parse('lo\n\ndata: World\n\n');

  assert.deepEqual(first, []);
  assert.deepEqual(second, [
    { id: '1', event: 'message', data: 'Hello' },
    { data: 'World' },
  ]);
});

test('SSEParser joins multi-line data and ignores comments', () => {
  const parser = new SSEParser();

  const messages = parser.parse(': ping\ndata: line1\ndata: line2\nretry: 3000\n\n');

  assert.deepEqual(messages, [
    { data: 'line1\nline2', retry: 3000 },
  ]);
});

test('JSONStreamParser parses object and preserves remaining data', () => {
  const parser = new JSONStreamParser();

  parser.append('  {"hello":"world"}{"next":1}');
  const first = parser.tryParse<{ hello: string }>();
  const second = parser.tryParse<{ next: number }>();

  assert.deepEqual(first, {
    json: { hello: 'world' },
    remaining: '{"next":1}',
  });
  assert.deepEqual(second, {
    json: { next: 1 },
    remaining: '',
  });
});

test('JSONStreamParser waits for complete JSON strings', () => {
  const parser = new JSONStreamParser();

  parser.append('"hel');
  assert.equal(parser.tryParse(), null);

  parser.append('lo"');
  assert.deepEqual(parser.tryParse<string>(), {
    json: 'hello',
    remaining: '',
  });
});

test('StreamHandler emits text, thinking and done events while collecting full text', async () => {
  async function* createStream(): AsyncGenerator<StreamChunk> {
    yield { delta: '思考...', done: false, type: 'thinking' };
    yield { delta: '你', done: false, type: 'text' };
    yield { delta: '好', done: false, type: 'text' };
    yield { delta: '', done: true };
  }

  const events = [];
  const handler = new StreamHandler();

  for await (const event of handler.consume(createStream())) {
    events.push(event);
  }

  assert.deepEqual(events, [
    { type: 'thinking', delta: '思考...' },
    { type: 'text', delta: '你' },
    { type: 'text', delta: '好' },
    { type: 'done', fullText: '你好' },
  ]);
  assert.equal(handler.getFullText(), '你好');
});
