// src/hooks/config-loader.ts
// 钩子配置加载器

import { HookManager } from './hook-manager.js';
import { HookDefinition, HookEvent } from './types.js';
import * as fs from 'fs';
import * as path from 'path';
import {
  createLoggingHook,
  createValidationHook,
  createSensitiveFilterHook,
  createPerformanceHook,
} from './builtin/index.js';

/**
 * 钩子配置
 */
interface HookConfig {
  name: string;
  event: HookEvent;
  enabled?: boolean;
  priority?: number;
  async?: boolean;
  config?: Record<string, any>;
}

/**
 * 钩子配置文件
 */
interface HooksConfigFile {
  hooks: HookConfig[];
}

/**
 * 内置钩子工厂映射
 */
const BUILTIN_HOOKS: Record<string, (config: any) => HookDefinition | HookDefinition[]> = {
  logging: (config) => createLoggingHook(config),
  'input-validation': (config) => createValidationHook(config),
  'sensitive-filter': (config) => createSensitiveFilterHook(config),
  performance: (config) => createPerformanceHook(config),
};

/**
 * 从配置文件加载钩子
 */
export function loadHooksFromConfig(manager: HookManager, configPath: string): boolean {
  if (!fs.existsSync(configPath)) {
    return false;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config: HooksConfigFile = JSON.parse(content);

    for (const hookConfig of config.hooks) {
      if (hookConfig.enabled === false) continue;

      // 查找内置钩子
      const factory = BUILTIN_HOOKS[hookConfig.name];
      if (factory) {
        const definition = factory(hookConfig.config || {});

        // 处理返回数组的情况
        if (Array.isArray(definition)) {
          for (const def of definition) {
            def.priority = hookConfig.priority ?? def.priority;
            def.async = hookConfig.async ?? def.async;
            manager.register(def);
          }
        } else {
          definition.priority = hookConfig.priority ?? definition.priority;
          definition.async = hookConfig.async ?? definition.async;
          manager.register(definition);
        }
      } else {
        console.warn(`Unknown hook: ${hookConfig.name}`);
      }
    }

    return true;
  } catch (error: any) {
    console.error(`Failed to load hooks config: ${error.message}`);
    return false;
  }
}

/**
 * 从对象加载钩子配置
 */
export function loadHooksFromObject(
  manager: HookManager,
  config: HooksConfigFile
): void {
  for (const hookConfig of config.hooks) {
    if (hookConfig.enabled === false) continue;

    const factory = BUILTIN_HOOKS[hookConfig.name];
    if (factory) {
      const definition = factory(hookConfig.config || {});

      if (Array.isArray(definition)) {
        for (const def of definition) {
          def.priority = hookConfig.priority ?? def.priority;
          def.async = hookConfig.async ?? def.async;
          manager.register(def);
        }
      } else {
        definition.priority = hookConfig.priority ?? definition.priority;
        definition.async = hookConfig.async ?? definition.async;
        manager.register(definition);
      }
    }
  }
}

/**
 * 保存钩子配置到文件
 */
export function saveHooksConfig(manager: HookManager, configPath: string): void {
  const hooks = manager.getAllHooks();
  const config: HooksConfigFile = {
    hooks: hooks.map((h) => ({
      name: h.name,
      event: h.event,
      enabled: h.enabled,
      priority: h.priority,
      async: h.async,
    })),
  };

  // 确保目录存在
  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * 获取默认钩子配置路径
 */
export function getDefaultHooksConfigPath(): string {
  return path.join(process.cwd(), '.mini-cli', 'hooks.json');
}
