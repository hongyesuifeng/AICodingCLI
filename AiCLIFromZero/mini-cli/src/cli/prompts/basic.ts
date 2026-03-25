// src/cli/prompts/basic.ts
import * as readline from 'readline';

// 基础提示器
export class SimplePrompt {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  // 文本输入
  async input(message: string, defaultValue?: string): Promise<string> {
    return new Promise((resolve) => {
      const prompt = defaultValue
        ? `${message} [${defaultValue}]: `
        : `${message}: `;

      this.rl.question(prompt, (answer) => {
        resolve(answer.trim() || defaultValue || '');
      });
    });
  }

  // 密码输入
  async password(message: string): Promise<string> {
    return new Promise((resolve) => {
      process.stdout.write(`${message}: `);

      // 隐藏输入
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw || false;

      stdin.setRawMode(true);
      let password = '';

      const onData = (char: Buffer) => {
        const c = char.toString('utf8');

        switch (c) {
          case '\n':
          case '\r':
          case '\u0004': // Ctrl+D
            stdin.setRawMode(wasRaw);
            stdin.removeListener('data', onData);
            stdin.resume();
            process.stdout.write('\n');
            resolve(password);
            return;
          case '\u0003': // Ctrl+C
            process.exit();
            return;
          case '\u007F': // Backspace
            password = password.slice(0, -1);
            break;
          default:
            password += c;
            break;
        }
      };

      stdin.on('data', onData);
      stdin.resume();
    });
  }

  // 确认
  async confirm(message: string, defaultValue: boolean = false): Promise<boolean> {
    const hint = defaultValue ? '[Y/n]' : '[y/N]';
    const answer = await this.input(`${message} ${hint}`);

    if (!answer) return defaultValue;
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }

  // 选择列表
  async select(message: string, choices: string[]): Promise<string> {
    console.log(`\n${message}\n`);

    for (let i = 0; i < choices.length; i++) {
      console.log(`  ${i + 1}. ${choices[i]}`);
    }

    console.log();

    while (true) {
      const answer = await this.input('Select (1-' + choices.length + ')');
      const num = parseInt(answer);

      if (num >= 1 && num <= choices.length) {
        return choices[num - 1];
      }

      console.log('Invalid selection. Please try again.');
    }
  }

  // 多选
  async multiselect(message: string, choices: string[]): Promise<string[]> {
    console.log(`\n${message}\n`);

    for (let i = 0; i < choices.length; i++) {
      console.log(`  ${i + 1}. ${choices[i]}`);
    }

    console.log('\nEnter comma-separated numbers (e.g., 1,3,5):\n');

    while (true) {
      const answer = await this.input('Select');
      const nums = answer.split(',').map(s => parseInt(s.trim()));

      if (nums.every(n => n >= 1 && n <= choices.length)) {
        return nums.map(n => choices[n - 1]);
      }

      console.log('Invalid selection. Please try again.');
    }
  }

  // 关闭
  close(): void {
    this.rl.close();
  }
}
