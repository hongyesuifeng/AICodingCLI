export interface JSONStreamResult<T = unknown> {
  json: T;
  remaining: string;
}

export class JSONStreamParser {
  private buffer = '';

  append(data: string): void {
    this.buffer += data;
  }

  getBuffer(): string {
    return this.buffer;
  }

  reset(): void {
    this.buffer = '';
  }

  tryParse<T = unknown>(): JSONStreamResult<T> | null {
    const leadingWhitespace = this.buffer.match(/^\s*/)?.[0] ?? '';
    const input = this.buffer.slice(leadingWhitespace.length);

    if (input.length === 0) {
      return null;
    }

    const endIndex = this.findJSONEnd(input);
    if (endIndex === null) {
      return null;
    }

    const jsonText = input.slice(0, endIndex);
    const remaining = input.slice(endIndex);

    try {
      const json = JSON.parse(jsonText) as T;
      this.buffer = remaining;
      return {
        json,
        remaining,
      };
    } catch {
      return null;
    }
  }

  private findJSONEnd(input: string): number | null {
    const firstChar = input[0];

    if (firstChar === '{' || firstChar === '[') {
      return this.findCompositeEnd(input, firstChar === '{' ? '{' : '[', firstChar === '{' ? '}' : ']');
    }

    if (firstChar === '"') {
      return this.findStringEnd(input);
    }

    return this.findPrimitiveEnd(input);
  }

  private findCompositeEnd(
    input: string,
    openChar: '{' | '[',
    closeChar: '}' | ']'
  ): number | null {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === openChar) {
        depth += 1;
      } else if (char === closeChar) {
        depth -= 1;
        if (depth === 0) {
          return index + 1;
        }
      }
    }

    return null;
  }

  private findStringEnd(input: string): number | null {
    let escaped = false;

    for (let index = 1; index < input.length; index += 1) {
      const char = input[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        return index + 1;
      }
    }

    return null;
  }

  private findPrimitiveEnd(input: string): number | null {
    for (let index = 1; index <= input.length; index += 1) {
      const char = input[index];
      if (char === undefined || /\s|,|]}/.test(char)) {
        const token = input.slice(0, index);
        try {
          JSON.parse(token);
          return index;
        } catch {
          return null;
        }
      }
    }

    return null;
  }
}
