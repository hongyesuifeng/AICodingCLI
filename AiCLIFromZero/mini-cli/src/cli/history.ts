// src/cli/history.ts
import * as fs from 'fs';
import * as path from 'path';

// 历史记录管理
export class HistoryManager {
  private history: string[] = [];
  private historyFile: string;
  private maxSize: number;

  constructor(historyFile: string, maxSize: number = 1000) {
    this.historyFile = historyFile;
    this.maxSize = maxSize;
    this.load();
  }

  // 加载历史记录
  private load(): void {
    try {
      if (fs.existsSync(this.historyFile)) {
        const content = fs.readFileSync(this.historyFile, 'utf-8');
        this.history = content.split('\n').filter(Boolean);
      }
    } catch {
      // 忽略加载错误
    }
  }

  // 保存历史记录
  private save(): void {
    try {
      const dir = path.dirname(this.historyFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.historyFile, this.history.join('\n'), 'utf-8');
    } catch {
      // 忽略保存错误
    }
  }

  // 添加历史记录
  add(entry: string): void {
    if (!entry.trim() || this.history[this.history.length - 1] === entry) {
      return;
    }

    this.history.push(entry);

    if (this.history.length > this.maxSize) {
      this.history = this.history.slice(-this.maxSize);
    }

    this.save();
  }

  // 获取历史记录
  getHistory(): string[] {
    return [...this.history];
  }

  // 搜索历史记录
  search(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    return this.history.filter(entry =>
      entry.toLowerCase().includes(lowerQuery)
    );
  }

  // 清空历史记录
  clear(): void {
    this.history = [];
    this.save();
  }
}
