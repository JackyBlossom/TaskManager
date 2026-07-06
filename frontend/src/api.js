const TOKEN_KEY = 'taskmanager_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail)
    this.status = status
  }
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(path, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  if (res.status === 401) {
    clearToken()
    if (!path.startsWith('/api/auth/login')) window.location.href = '/login'
  }
  if (!res.ok) {
    let detail = `エラーが発生しました (${res.status})`
    try {
      const data = await res.json()
      if (data.detail) detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
    } catch { /* ignore */ }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
}

// 認証付きでファイルをダウンロードする（CSV出力用）
export async function downloadFile(path, filename) {
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) throw new ApiError(res.status, 'ダウンロードに失敗しました')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
