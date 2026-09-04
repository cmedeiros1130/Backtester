/**
 * Thin API client. Every call goes through here so error handling and the
 * "server said no" path look the same everywhere in the UI.
 */

export class ApiError extends Error {
  status: number;
  payload: any;
  constructor(status: number, message: string, payload?: any) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

/**
 * LevelForge is one server that hosts both the API and this page. If the API
 * answers with HTML, or 404s a route the server defines, then whatever is
 * serving these files is not running the backend -- a static host, or the
 * server started without the API. That is worth saying plainly, because
 * "Request failed (404)" sends you looking for a bug that is not there.
 */
function noBackend(status: number, body: string) {
  const looksLikeHtml = /^\s*<(!doctype|html)/i.test(body);
  return looksLikeHtml || status === 404 || status === 405;
}

const NO_BACKEND_MESSAGE =
  'No LevelForge server is running at this address — only the page was served. ' +
  'The API and database need a Node host; a static host cannot run them.';

async function parse(res: Response) {
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { text, data };
}

async function request<T = any>(method: string, url: string, body?: any): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${url}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the LevelForge server. Is it running?');
  }

  const { text, data } = await parse(res);

  if (!res.ok) {
    if (!data?.error && noBackend(res.status, text)) {
      throw new ApiError(res.status, NO_BACKEND_MESSAGE, data);
    }
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`, data);
  }
  return data as T;
}

export const api = {
  get: <T = any>(url: string) => request<T>('GET', url),
  post: <T = any>(url: string, body?: any) => request<T>('POST', url, body ?? {}),
  put: <T = any>(url: string, body?: any) => request<T>('PUT', url, body ?? {}),
  patch: <T = any>(url: string, body?: any) => request<T>('PATCH', url, body ?? {}),
  del: <T = any>(url: string) => request<T>('DELETE', url),

  /** Multipart upload. Used for screenshots. */
  async upload<T = any>(url: string, form: FormData): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`/api${url}`, { method: 'POST', body: form });
    } catch {
      throw new ApiError(0, 'Could not reach the LevelForge server. Is it running?');
    }
    const { text, data } = await parse(res);
    if (!res.ok) {
      if (!data?.error && noBackend(res.status, text)) {
        throw new ApiError(res.status, NO_BACKEND_MESSAGE, data);
      }
      throw new ApiError(res.status, data?.error ?? 'Upload failed', data);
    }
    return data as T;
  },
};

export const uploadUrl = (filename: string) => `/uploads/${filename}`;
