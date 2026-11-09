export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function appUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  const response = await fetch(appUrl(`/api${path}`), { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((item: { msg?: string }) => item.msg || 'Проверьте поля формы').join('. ')
          : `Не удалось выполнить запрос (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export function errorMessage(error: unknown): string {
  if (error instanceof TypeError)
    return 'Нет связи с сервером. Проверьте подключение и повторите действие.';
  return error instanceof Error ? error.message : 'Не удалось выполнить действие';
}
