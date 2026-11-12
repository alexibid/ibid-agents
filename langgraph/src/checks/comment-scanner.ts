export interface CommentLocation {
  readonly line: number;
  readonly text: string;
}

const REGEX_MAY_FOLLOW = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_KEYWORDS = /(?:return|typeof|case|in|of|void|delete|throw|new)$/;
const ALLOWED_COMMENT = /secretlint-disable|secretlint-enable/;

export function findComments(source: string): CommentLocation[] {
  return new CommentScanner(source).scan().filter((comment) => !ALLOWED_COMMENT.test(comment.text));
}

class CommentScanner {
  private position = 0;
  private line = 1;
  private lastSignificant = '';
  private readonly comments: CommentLocation[] = [];

  constructor(private readonly source: string) {}

  scan(): CommentLocation[] {
    while (this.position < this.source.length) {
      this.scanNext();
    }
    return this.comments;
  }

  private scanNext(): void {
    const char = this.source[this.position] ?? '';
    const pair = this.source.slice(this.position, this.position + 2);
    if (pair === '//') {
      this.record(this.consumeUntil('\n'));
    } else if (pair === '/*') {
      this.record(this.consumeThrough('*/'));
    } else if (char === '"' || char === "'") {
      this.skipQuoted(char);
    } else if (char === '`') {
      this.skipTemplate();
    } else if (char === '/' && this.regexMayStartHere()) {
      this.skipRegex();
    } else {
      this.advance(char);
    }
  }

  private advance(char: string): void {
    if (char === '\n') {
      this.line += 1;
    } else if (char.trim() !== '') {
      this.lastSignificant = char;
    }
    this.position += 1;
  }

  private record(text: string): void {
    this.comments.push({ line: this.line, text: text.split('\n')[0]?.trim() ?? '' });
    this.line += text.split('\n').length - 1;
  }

  private consumeUntil(terminator: string): string {
    const end = this.source.indexOf(terminator, this.position);
    return this.take(end === -1 ? this.source.length : end);
  }

  private consumeThrough(terminator: string): string {
    const end = this.source.indexOf(terminator, this.position + 2);
    return this.take(end === -1 ? this.source.length : end + terminator.length);
  }

  private take(end: number): string {
    const text = this.source.slice(this.position, end);
    this.position = end;
    return text;
  }

  private skipQuoted(quote: string): void {
    this.position += 1;
    while (this.position < this.source.length && this.source[this.position] !== quote) {
      this.skipEscapable();
    }
    this.position += 1;
    this.lastSignificant = quote;
  }

  private skipTemplate(): void {
    this.position += 1;
    while (this.position < this.source.length && this.source[this.position] !== '`') {
      if (this.source.startsWith('${', this.position)) {
        this.skipInterpolation();
      } else {
        this.skipEscapable();
      }
    }
    this.position += 1;
    this.lastSignificant = '`';
  }

  private skipInterpolation(): void {
    let depth = 0;
    this.position += 1;
    do {
      const char = this.source[this.position] ?? '';
      depth += char === '{' ? 1 : char === '}' ? -1 : 0;
      this.skipEscapable();
    } while (depth > 0 && this.position < this.source.length);
  }

  private skipRegex(): void {
    let insideClass = false;
    this.position += 1;
    while (this.position < this.source.length) {
      const char = this.source[this.position] ?? '';
      if (char === '\n' || (char === '/' && !insideClass)) {
        break;
      }
      insideClass = char === '[' ? true : char === ']' ? false : insideClass;
      this.skipEscapable();
    }
    this.position += 1;
    this.lastSignificant = '/';
  }

  private skipEscapable(): void {
    const char = this.source[this.position] ?? '';
    if (char === '\n') {
      this.line += 1;
    }
    this.position += char === '\\' ? 2 : 1;
  }

  private regexMayStartHere(): boolean {
    if (this.lastSignificant === '' || REGEX_MAY_FOLLOW.has(this.lastSignificant)) {
      return true;
    }
    return REGEX_KEYWORDS.test(this.source.slice(Math.max(0, this.position - 12), this.position).trimEnd());
  }
}
