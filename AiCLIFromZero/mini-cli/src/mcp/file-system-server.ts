// src/mcp/file-system-server.ts
// 文件系统 MCP Server 实现

import { MCPServer, ToolHandler } from './mcp-server.js';
import { MCPToolCallResult } from './types.js';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * 文件系统 MCP Server 配置
 */
export interface FileSystemMCPServerConfig {
  allowedPaths?: string[];
  maxFileSize?: number;
}

/**
 * 文件系统 MCP Server
 */
export class FileSystemMCPServer extends MCPServer {
  private allowedPaths: string[];
  private maxFileSize: number;

  constructor(config: FileSystemMCPServerConfig = {}) {
    super({
      name: 'filesystem-server',
      version: '1.0.0',
    });

    this.allowedPaths = config.allowedPaths || ['.'];
    this.maxFileSize = config.maxFileSize || 1024 * 1024; // 1MB 默认

    this.setupTools();
    this.setupResources();
  }

  /**
   * 检查路径是否允许访问
   */
  private isPathAllowed(targetPath: string): boolean {
    const resolved = path.resolve(targetPath);
    return this.allowedPaths.some((allowed) => {
      const resolvedAllowed = path.resolve(allowed);
      return resolved.startsWith(resolvedAllowed);
    });
  }

  /**
   * 设置工具
   */
  private setupTools(): void {
    // 读取文件
    this.registerTool(
      {
        name: 'read_file',
        description: 'Read the contents of a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The path to the file to read',
            },
          },
          required: ['path'],
        },
      },
      this.createSafeHandler(async (args): Promise<MCPToolCallResult> => {
        const filePath = args.path as string;

        if (!this.isPathAllowed(filePath)) {
          return {
            content: [{ type: 'text', text: `Access denied: ${filePath}` }],
            isError: true,
          };
        }

        const content = await fs.readFile(filePath, 'utf-8');
        return {
          content: [{ type: 'text', text: content }],
        };
      })
    );

    // 写入文件
    this.registerTool(
      {
        name: 'write_file',
        description: 'Write content to a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
            content: { type: 'string', description: 'Content to write' },
          },
          required: ['path', 'content'],
        },
      },
      this.createSafeHandler(async (args): Promise<MCPToolCallResult> => {
        const filePath = args.path as string;
        const content = args.content as string;

        if (!this.isPathAllowed(filePath)) {
          return {
            content: [{ type: 'text', text: `Access denied: ${filePath}` }],
            isError: true,
          };
        }

        // 确保目录存在
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        await fs.writeFile(filePath, content, 'utf-8');
        return {
          content: [{ type: 'text', text: `File written: ${filePath}` }],
        };
      })
    );

    // 列出目录
    this.registerTool(
      {
        name: 'list_directory',
        description: 'List directory contents',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Directory path',
              default: '.',
            },
          },
          required: [],
        },
      },
      this.createSafeHandler(async (args): Promise<MCPToolCallResult> => {
        const dirPath = (args.path as string) || '.';

        if (!this.isPathAllowed(dirPath)) {
          return {
            content: [{ type: 'text', text: `Access denied: ${dirPath}` }],
            isError: true,
          };
        }

        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const listing = entries
          .sort((a, b) => {
            // 目录排在前面
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return a.name.localeCompare(b.name);
          })
          .map((e) => `${e.name}${e.isDirectory() ? '/' : ''}`)
          .join('\n');

        return {
          content: [{ type: 'text', text: listing || '(empty directory)' }],
        };
      })
    );

    // 创建目录
    this.registerTool(
      {
        name: 'create_directory',
        description: 'Create a new directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Directory path to create',
            },
          },
          required: ['path'],
        },
      },
      this.createSafeHandler(async (args): Promise<MCPToolCallResult> => {
        const dirPath = args.path as string;

        if (!this.isPathAllowed(dirPath)) {
          return {
            content: [{ type: 'text', text: `Access denied: ${dirPath}` }],
            isError: true,
          };
        }

        await fs.mkdir(dirPath, { recursive: true });
        return {
          content: [{ type: 'text', text: `Directory created: ${dirPath}` }],
        };
      })
    );

    // 删除文件
    this.registerTool(
      {
        name: 'delete_file',
        description: 'Delete a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path to delete',
            },
          },
          required: ['path'],
        },
      },
      this.createSafeHandler(async (args): Promise<MCPToolCallResult> => {
        const filePath = args.path as string;

        if (!this.isPathAllowed(filePath)) {
          return {
            content: [{ type: 'text', text: `Access denied: ${filePath}` }],
            isError: true,
          };
        }

        await fs.unlink(filePath);
        return {
          content: [{ type: 'text', text: `File deleted: ${filePath}` }],
        };
      })
    );

    // 检查文件/目录是否存在
    this.registerTool(
      {
        name: 'exists',
        description: 'Check if a file or directory exists',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to check',
            },
          },
          required: ['path'],
        },
      },
      this.createSafeHandler(async (args): Promise<MCPToolCallResult> => {
        const targetPath = args.path as string;

        try {
          const stat = await fs.stat(targetPath);
          return {
            content: [
              {
                type: 'text',
                text: `Exists: ${targetPath} (${stat.isDirectory() ? 'directory' : 'file'})`,
              },
            ],
          };
        } catch {
          return {
            content: [{ type: 'text', text: `Not found: ${targetPath}` }],
          };
        }
      })
    );

    // 搜索文件
    this.registerTool(
      {
        name: 'search_files',
        description: 'Search for files matching a pattern',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Directory to search in',
              default: '.',
            },
            pattern: {
              type: 'string',
              description: 'Glob pattern to match (e.g., *.ts)',
            },
          },
          required: ['pattern'],
        },
      },
      this.createSafeHandler(async (args): Promise<MCPToolCallResult> => {
        const { path: searchPath = '.', pattern } = args;

        if (!this.isPathAllowed(searchPath)) {
          return {
            content: [{ type: 'text', text: `Access denied: ${searchPath}` }],
            isError: true,
          };
        }

        const results: string[] = [];
        await this.searchFilesRecursive(searchPath, pattern, results);

        return {
          content: [
            {
              type: 'text',
              text: results.length > 0 ? results.join('\n') : 'No files found',
            },
          ],
        };
      })
    );
  }

  /**
   * 递归搜索文件
   */
  private async searchFilesRecursive(
    dir: string,
    pattern: string,
    results: string[]
  ): Promise<void> {
    const regex = new RegExp(
      '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await this.searchFilesRecursive(fullPath, pattern, results);
      } else if (regex.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  /**
   * 设置资源
   */
  private setupResources(): void {
    // 注册当前目录作为资源
    for (const allowedPath of this.allowedPaths) {
      const resolved = path.resolve(allowedPath);
      this.registerResource({
        uri: `file://${resolved}`,
        name: `Directory: ${resolved}`,
        description: 'The allowed directory',
        mimeType: 'text/directory',
      });
    }
  }

  /**
   * 创建安全处理器（包装错误处理）
   */
  private createSafeHandler(handler: ToolHandler): ToolHandler {
    return async (args: Record<string, any>) => {
      try {
        return await handler(args);
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    };
  }
}
