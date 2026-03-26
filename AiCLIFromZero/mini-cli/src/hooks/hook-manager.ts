// src/hooks/hook-manager.ts
// 钩子管理器

import {
  HookEvent,
  HookDefinition,
  HookFunction,
  HookContext,
  HookResult,
} from './types.js';

/**
 * 钩子管理器
 */
export class HookManager {
  private hooks = new Map<HookEvent, HookDefinition[]>();

  /**
   * 注册钩子
   */
  register(definition: HookDefinition): void {
    const { event } = definition;

    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }

    const hooks = this.hooks.get(event)!;
    hooks.push(definition);

    // 按优先级排序（降序）
    hooks.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * 简化注册方式
   */
  on(
    event: HookEvent,
    handler: HookFunction,
    options?: Partial<Omit<HookDefinition, 'event' | 'handler'>>
  ): void {
    this.register({
      name: options?.name || `hook-${Date.now()}`,
      event,
      handler,
      ...options,
    });
  }

  /**
   * 移除钩子
   */
  remove(name: string): boolean {
    for (const [, hooks] of this.hooks) {
      const index = hooks.findIndex((h) => h.name === name);
      if (index >= 0) {
        hooks.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * 触发钩子
   */
  async trigger(
    event: HookEvent,
    context: Omit<HookContext, 'event' | 'timestamp'>
  ): Promise<HookResult> {
    const hooks = this.hooks.get(event) || [];
    const fullContext: HookContext = {
      ...context,
      event,
      timestamp: Date.now(),
    };

    let currentContext = { ...fullContext };
    const result: HookResult = { proceed: true };

    for (const hook of hooks) {
      // 跳过禁用的钩子
      if (hook.enabled === false) continue;

      try {
        if (hook.async) {
          // 异步执行，不等待
          Promise.resolve(hook.handler(currentContext)).catch((err: Error) => {
            console.error(`Async hook ${hook.name} error:`, err);
          });
        } else {
          // 同步执行
          const hookResult = await hook.handler(currentContext);

          // 检查是否中断
          if (!hookResult.proceed) {
            return hookResult;
          }

          // 更新上下文
          if (hookResult.modifiedInput !== undefined) {
            currentContext.input = hookResult.modifiedInput;
            result.modifiedInput = hookResult.modifiedInput;
          }

          if (hookResult.modifiedOutput !== undefined) {
            currentContext.output = hookResult.modifiedOutput;
            result.modifiedOutput = hookResult.modifiedOutput;
          }
        }
      } catch (error: any) {
        console.error(`Hook ${hook.name} error:`, error);

        // 高优先级钩子失败时中断
        if (hook.priority && hook.priority >= 100) {
          return {
            proceed: false,
            error: `Hook ${hook.name} failed: ${error.message}`,
          };
        }
      }
    }

    return result;
  }

  /**
   * 获取某事件的所有钩子
   */
  getHooks(event: HookEvent): HookDefinition[] {
    return this.hooks.get(event) || [];
  }

  /**
   * 获取所有钩子
   */
  getAllHooks(): HookDefinition[] {
    const allHooks: HookDefinition[] = [];
    for (const hooks of this.hooks.values()) {
      allHooks.push(...hooks);
    }
    return allHooks;
  }

  /**
   * 清除所有钩子
   */
  clear(): void {
    this.hooks.clear();
  }

  /**
   * 清除某事件的所有钩子
   */
  clearEvent(event: HookEvent): void {
    this.hooks.delete(event);
  }

  /**
   * 启用/禁用钩子
   */
  setEnabled(name: string, enabled: boolean): boolean {
    for (const [, hooks] of this.hooks) {
      const hook = hooks.find((h) => h.name === name);
      if (hook) {
        hook.enabled = enabled;
        return true;
      }
    }
    return false;
  }

  /**
   * 获取钩子数量
   */
  size(): number {
    let count = 0;
    for (const hooks of this.hooks.values()) {
      count += hooks.length;
    }
    return count;
  }
}
