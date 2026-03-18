import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODEL_ALIASES,
  MODELS,
  getModelCapabilities,
  listModels,
  resolveModel,
} from '../src/config/models.ts';
import { getApiKey, loadConfig } from '../src/config/loader.ts';

test('resolveModel resolves known aliases', () => {
  assert.equal(resolveModel('m25'), 'MiniMax-M2.5');
  assert.equal(resolveModel('4o'), 'gpt-4o');
});

test('resolveModel returns original name for non-alias values', () => {
  assert.equal(resolveModel('custom-model'), 'custom-model');
});

test('getModelCapabilities returns configured metadata', () => {
  const caps = getModelCapabilities('4.1-mini');

  assert.equal(caps.provider, 'openai');
  assert.equal(caps.supportsStreaming, true);
  assert.equal(caps.supportsTools, true);
});

test('getModelCapabilities throws for unknown models', () => {
  assert.throws(
    () => getModelCapabilities('does-not-exist'),
    /Unknown model: does-not-exist/
  );
});

test('listModels includes all configured models', () => {
  const models = listModels();

  assert.equal(models.length, Object.keys(MODELS).length);
  assert.ok(models.includes('MiniMax-M2.5'));
  assert.ok(models.includes('gpt-4o'));
});

test('MODEL_ALIASES exposes the expected shortcut names', () => {
  assert.equal(MODEL_ALIASES.minimax, 'MiniMax-M2.5');
  assert.equal(MODEL_ALIASES.openai, 'gpt-4o');
});

test('loadConfig reads environment variables', () => {
  const previous = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
    DEFAULT_MODEL: process.env.DEFAULT_MODEL,
  };

  process.env.OPENAI_API_KEY = 'openai-test-key';
  process.env.MINIMAX_API_KEY = 'minimax-test-key';
  process.env.DEFAULT_MODEL = 'gpt-4o-mini';

  try {
    const config = loadConfig();

    assert.equal(config.ai.openaiApiKey, 'openai-test-key');
    assert.equal(config.ai.minimaxApiKey, 'minimax-test-key');
    assert.equal(config.ai.defaultModel, 'gpt-4o-mini');
  } finally {
    restoreEnv(previous);
  }
});

test('getApiKey returns the provider-specific environment variable', () => {
  const previous = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
  };

  process.env.OPENAI_API_KEY = 'openai-test-key';
  process.env.MINIMAX_API_KEY = 'minimax-test-key';

  try {
    assert.equal(getApiKey('openai'), 'openai-test-key');
    assert.equal(getApiKey('minimax'), 'minimax-test-key');
  } finally {
    restoreEnv(previous);
  }
});

test('getApiKey throws when the provider key is missing', () => {
  const previous = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };

  delete process.env.OPENAI_API_KEY;

  try {
    assert.throws(
      () => getApiKey('openai'),
      /Missing API key for openai/
    );
  } finally {
    restoreEnv(previous);
  }
});

function restoreEnv(previous: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
