/** 将普通对象的 snake_case 键转为 camelCase（嵌套数组/对象递归；原始类型原样返回） */
export function toCamelCase<T>(input: unknown): T {
  if (input === null || input === undefined) {
    return input as T;
  }
  if (typeof input !== 'object') {
    return input as T;
  }
  if (input instanceof Date) {
    return input as T;
  }
  if (Array.isArray(input)) {
    return input.map((item) => toCamelCase(item)) as T;
  }
  const obj = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z])/gi, (_, c: string) => c.toUpperCase());
    const val = obj[key];
    out[camelKey] = toCamelCase(val);
  }
  return out as T;
}
