export function decodeBase64UrlUtf8(value: string): string {
  const base64 = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(value.length + (4 - value.length % 4) % 4, '=')

  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))

  return new TextDecoder().decode(bytes)
}

export function decodeJwtPayloadSegment<TPayload = Record<string, unknown>>(
  payloadSegment: string
): TPayload {
  return JSON.parse(decodeBase64UrlUtf8(payloadSegment)) as TPayload
}
