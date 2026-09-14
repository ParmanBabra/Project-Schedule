/**
 * Minimal typed fetch wrapper. All API calls go through here so error handling,
 * JSON parsing and the `/api` prefix live in one place.
 */
export class ApiError extends Error {
  status: number
  body?: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    let body: unknown
    try {
      body = await res.json()
    } catch {
      body = await res.text().catch(() => undefined)
    }
    throw new ApiError(res.status, `API ${init?.method ?? 'GET'} ${path} → ${res.status}`, body)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
