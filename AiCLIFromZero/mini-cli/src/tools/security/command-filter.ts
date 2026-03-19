export interface CommandRestriction {
  allowedCommands: string[];
  deniedCommands: string[];
  deniedPatterns: RegExp[];
  allowPipe: boolean;
  allowRedirect: boolean;
  allowBackground: boolean;
}

const DEFAULT_RESTRICTION: CommandRestriction = {
  allowedCommands: [],
  deniedCommands: [
    'rm',
    'rmdir',
    'del',
    'format',
    'mkfs',
    'dd',
    'shutdown',
    'reboot',
    'init',
    'chmod',
    'chown',
    'sudo',
    'su',
    'doas',
    'passwd',
    'crontab',
    'systemctl',
  ],
  deniedPatterns: [
    /rm\s+-rf\s+\//,
    />\s*\/dev\//,
    /\|\s*sh/,
    /\|\s*bash/,
    /;\s*rm/,
    /\$\(/,
    /`/,
  ],
  allowPipe: false,
  allowRedirect: false,
  allowBackground: false,
};

export class CommandFilter {
  constructor(
    private readonly restriction: CommandRestriction = DEFAULT_RESTRICTION
  ) {}

  validate(command: string): { valid: boolean; error?: string } {
    if (!command.trim()) {
      return { valid: false, error: 'Command is required' };
    }

    for (const pattern of this.restriction.deniedPatterns) {
      if (pattern.test(command)) {
        return { valid: false, error: `Command matches denied pattern: ${pattern}` };
      }
    }

    const mainCommand = this.extractMainCommand(command);

    if (this.restriction.deniedCommands.includes(mainCommand)) {
      return { valid: false, error: `Command not allowed: ${mainCommand}` };
    }

    if (
      this.restriction.allowedCommands.length > 0 &&
      !this.restriction.allowedCommands.includes(mainCommand)
    ) {
      return { valid: false, error: `Command not in allowed list: ${mainCommand}` };
    }

    if (!this.restriction.allowPipe && command.includes('|')) {
      return { valid: false, error: 'Pipes not allowed' };
    }

    if (!this.restriction.allowRedirect && /[<>]/.test(command)) {
      return { valid: false, error: 'Redirects not allowed' };
    }

    if (!this.restriction.allowBackground && command.includes('&')) {
      return { valid: false, error: 'Background execution not allowed' };
    }

    return { valid: true };
  }

  private extractMainCommand(command: string): string {
    const match = command.trim().match(/^(\S+)/);
    return match?.[1] ?? '';
  }
}
