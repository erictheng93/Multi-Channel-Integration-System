const CSRF_COOKIE_NAME = 'mcis_csrf'
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const encodedName = `${name}=`
  const cookie = document.cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(encodedName))

  return cookie ? decodeURIComponent(cookie.slice(encodedName.length)) : null
}

export function buildAuthenticatedHeaders(
  method: string = 'GET',
  headers?: ConstructorParameters<typeof globalThis.Headers>[0]
): globalThis.Headers {
  const nextHeaders = new globalThis.Headers(headers)

  if (UNSAFE_METHODS.has(method.toUpperCase()) && !nextHeaders.has('X-CSRF-Token')) {
    const csrfToken = getCookieValue(CSRF_COOKIE_NAME)
    if (csrfToken) {
      nextHeaders.set('X-CSRF-Token', csrfToken)
    }
  }

  return nextHeaders
}

export function applyAuthenticatedXhrHeaders(xhr: globalThis.XMLHttpRequest, method: string = 'POST'): void {
  xhr.withCredentials = true
  const headers = buildAuthenticatedHeaders(method)
  headers.forEach((value, key) => {
    xhr.setRequestHeader(key, value)
  })
}

export function authenticatedFetch(
  input: Parameters<typeof globalThis.fetch>[0],
  init: Parameters<typeof globalThis.fetch>[1] = {}
): Promise<globalThis.Response> {
  const method = init.method ?? 'GET'

  return globalThis.fetch(input, {
    ...init,
    credentials: 'include',
    headers: buildAuthenticatedHeaders(method, init.headers)
  })
}
