export type JsonObject = Readonly<Record<string, unknown>>;

export function parsedLines(lines: readonly string[]): JsonObject[] {
  return lines.flatMap((line) => {
    try {
      const parsed: unknown = JSON.parse(line);
      return isObject(parsed) ? [parsed] : [];
    } catch {
      return [];
    }
  });
}

export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function objectIn(holder: JsonObject, key: string): JsonObject {
  const value = holder[key];
  return isObject(value) ? value : {};
}

export function objectsIn(holder: JsonObject, key: string): JsonObject[] {
  const value = holder[key];
  return Array.isArray(value) ? value.filter(isObject) : [];
}

export function textIn(holder: JsonObject, key: string): string {
  const value = holder[key];
  return typeof value === 'string' ? value : '';
}

export function numberIn(holder: JsonObject, key: string): number {
  const value = holder[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
