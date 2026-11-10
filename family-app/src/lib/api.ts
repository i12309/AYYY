import {browserRequest, BackendError} from './browserBackend';
import {downloadApi} from './browserArchive';

export class ApiError extends Error {
  constructor(message: string, public status: number) {super(message);}
}
export function appUrl(path: string): string {
  if (/^(?:blob:|data:|https?:)/.test(path)) return path;
  if (path.startsWith('/api/')) return '#gen-download=' + encodeURIComponent(path);
  return import.meta.env.BASE_URL + path.replace(/^\//, '');
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {return await browserRequest(path,options) as T;}
  catch (cause) {
    if (cause instanceof ApiError) throw cause;
    if (cause instanceof BackendError) throw new ApiError(cause.message,cause.status);
    if (cause instanceof Error && cause.message.includes('Конфликт')) {
      throw new ApiError(cause.message,409);
    }
    throw new ApiError(cause instanceof Error ? cause.message : 'Не удалось выполнить действие',422);
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Не удалось выполнить действие';
}

let installed = false;
export function installDownloads(): void {
  if (installed) return;
  installed = true;
  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest<HTMLAnchorElement>('a[href^="#gen-download="]');
    if (!anchor) return;
    event.preventDefault();
    const href = anchor.getAttribute('href') || '';
    let path: string;
    try {path = decodeURIComponent(href.slice('#gen-download='.length));}
    catch {window.alert('Некорректная ссылка для скачивания.');return;}
    void downloadApi(path).catch(err => window.alert(errorMessage(err)));
  },true);
}
