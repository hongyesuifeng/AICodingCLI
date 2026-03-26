// src/hooks/index.ts
// 钩子模块导出

// 类型导出
export * from './types.js';

// 钩子管理器
export { HookManager } from './hook-manager.js';

// 内置钩子
export * from './builtin/index.js';

// 配置加载
export {
  loadHooksFromConfig,
  loadHooksFromObject,
  saveHooksConfig,
  getDefaultHooksConfigPath,
} from './config-loader.js';
