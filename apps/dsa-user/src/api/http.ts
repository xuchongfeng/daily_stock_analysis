/** 与后端同域挂载时使用相对路径 /api；开发时由 Vite 代理。 */
export async function apiFetch(
  path: string,
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  return fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  });
}
