import path from 'node:path';

export interface PathRestriction {
  allowedPaths: string[];
  deniedPaths: string[];
  allowRelative: boolean;
  maxPathLength: number;
}

const DEFAULT_RESTRICTION: PathRestriction = {
  allowedPaths: [],
  deniedPaths: ['/etc', '/root', '~/.ssh'],
  allowRelative: true,
  maxPathLength: 4096,
};

export class PathValidator {
  constructor(
    private readonly restriction: PathRestriction = DEFAULT_RESTRICTION
  ) {}

  validate(inputPath: string, cwd = process.cwd()): {
    valid: boolean;
    normalizedPath?: string;
    error?: string;
  } {
    if (inputPath.length === 0) {
      return { valid: false, error: 'Path is required' };
    }

    if (inputPath.length > this.restriction.maxPathLength) {
      return { valid: false, error: 'Path too long' };
    }

    const resolvedPath = path.isAbsolute(inputPath)
      ? path.resolve(inputPath)
      : this.restriction.allowRelative
        ? path.resolve(cwd, inputPath)
        : '';

    if (!resolvedPath) {
      return { valid: false, error: 'Relative paths not allowed' };
    }

    for (const deniedPath of this.restriction.deniedPaths) {
      const expanded = this.expandPath(deniedPath);
      if (resolvedPath === expanded || resolvedPath.startsWith(`${expanded}${path.sep}`)) {
        return { valid: false, error: `Access denied: ${deniedPath}` };
      }
    }

    if (this.restriction.allowedPaths.length > 0) {
      const allowed = this.restriction.allowedPaths.some((allowedPath) => {
        const expanded = this.expandPath(allowedPath);
        return resolvedPath === expanded || resolvedPath.startsWith(`${expanded}${path.sep}`);
      });

      if (!allowed) {
        return { valid: false, error: 'Path not in allowed list' };
      }
    }

    return {
      valid: true,
      normalizedPath: resolvedPath,
    };
  }

  private expandPath(value: string): string {
    if (value.startsWith('~/')) {
      return path.join(process.env.HOME || '', value.slice(2));
    }

    return path.resolve(value);
  }
}
