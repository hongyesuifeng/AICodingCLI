// src/storage/factory.ts
import type { SessionStorage } from '../types/session.js';
import { MemoryStorage } from './memory-storage.js';
import { FileStorage, type FileStorageConfig } from './file-storage.js';

// 存储类型
export type StorageType = 'memory' | 'file';

// 存储配置
export interface StorageConfig {
  type: StorageType;
  storageDir?: string;
  prettyJson?: boolean;
}

// 存储工厂
export class StorageFactory {
  static create(config: StorageConfig): SessionStorage {
    switch (config.type) {
      case 'memory':
        return new MemoryStorage();

      case 'file':
        if (!config.storageDir) {
          throw new Error('storageDir is required for file storage');
        }
        return new FileStorage({
          storageDir: config.storageDir,
          prettyJson: config.prettyJson,
        });

      default:
        throw new Error(`Unknown storage type: ${config.type}`);
    }
  }

  // 创建默认存储（内存）
  static createDefault(): SessionStorage {
    return new MemoryStorage();
  }
}
