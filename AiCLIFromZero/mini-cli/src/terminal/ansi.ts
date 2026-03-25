export const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
} as const;

export const cursor = {
  lineStart: '\r',
  hide: '\x1b[?25l',
  show: '\x1b[?25h',
} as const;

export const clear = {
  line: '\x1b[2K',
} as const;
