// src/cli/command/parser.ts
import type { CommandDefinition, CommandOption, ParseResult } from './types.js';

// 命令解析器
export class CommandParser {
  // 解析命令字符串
  parse(input: string, definition: CommandDefinition): ParseResult {
    const tokens = this.tokenize(input);
    return this.parseTokens(tokens, definition);
  }

  // 分词
  private tokenize(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      if (inQuotes) {
        if (char === quoteChar) {
          inQuotes = false;
          tokens.push(current);
          current = '';
        } else {
          current += char;
        }
      } else if (char === '"' || char === "'") {
        inQuotes = true;
        quoteChar = char;
      } else if (char === ' ' || char === '\t') {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  // 解析 token 序列
  private parseTokens(
    tokens: string[],
    definition: CommandDefinition
  ): ParseResult {
    const result: ParseResult = {
      command: definition.name,
      arguments: [],
      options: {},
    };

    // 初始化选项默认值
    if (definition.options) {
      for (const opt of definition.options) {
        if (opt.default !== undefined) {
          result.options[opt.name] = opt.default;
        }
      }
    }

    let i = 1; // 跳过命令名
    let expectingOptionValue = false;
    let currentOption: CommandOption | null = null;

    // 检查子命令
    if (definition.subcommands && definition.subcommands.length > 0) {
      if (tokens[i] && !tokens[i].startsWith('-')) {
        const subCmd = definition.subcommands.find(s => s.name === tokens[i]);
        if (subCmd) {
          result.subcommand = tokens[i];
          i++;
        }
      }
    }

    while (i < tokens.length) {
      const token = tokens[i];

      // 长选项 (--option)
      if (token.startsWith('--')) {
        const optName = token.slice(2);

        // 检查 --option=value 格式
        const eqIndex = optName.indexOf('=');
        if (eqIndex >= 0) {
          const name = optName.slice(0, eqIndex);
          const value = optName.slice(eqIndex + 1);
          result.options[name] = value;
        } else {
          currentOption = this.findOption(definition, optName);
          if (currentOption) {
            if (currentOption.type === 'boolean') {
              result.options[currentOption.name] = true;
              currentOption = null;
            } else {
              expectingOptionValue = true;
            }
          }
        }
        i++;
        continue;
      }

      // 短选项 (-o)
      if (token.startsWith('-') && token.length > 1) {
        const optAlias = token.slice(1);
        currentOption = this.findOptionByAlias(definition, optAlias);
        if (currentOption) {
          if (currentOption.type === 'boolean') {
            result.options[currentOption.name] = true;
            currentOption = null;
          } else {
            expectingOptionValue = true;
          }
        }
        i++;
        continue;
      }

      // 选项值
      if (expectingOptionValue && currentOption) {
        result.options[currentOption.name] = this.parseValue(token, currentOption.type);
        expectingOptionValue = false;
        currentOption = null;
        i++;
        continue;
      }

      // 位置参数
      result.arguments.push(token);
      i++;
    }

    return result;
  }

  // 查找选项
  private findOption(
    definition: CommandDefinition,
    name: string
  ): CommandOption | null {
    return definition.options?.find(o => o.name === name) || null;
  }

  // 通过别名查找选项
  private findOptionByAlias(
    definition: CommandDefinition,
    alias: string
  ): CommandOption | null {
    return definition.options?.find(o => o.alias === alias) || null;
  }

  // 解析值
  private parseValue(value: string, type: string): any {
    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value === 'true';
      default:
        return value;
    }
  }
}
