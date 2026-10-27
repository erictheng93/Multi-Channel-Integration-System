import type { Bindings } from '@/types'

/** Mutation notifications bypass broadcast feature flags and circuit breakers. */
export async function revalidateWebSocketAccess(
  env: Pick<Bindings, 'CONVERSATION_ROOM' | 'USER_CONNECTION' | 'CUSTOMER_CONVERSATION_DO'> | undefined,
  type: 'conversation' | 'user',
  id: string
): Promise<void> {
  // Customer-conversation sockets are per conversation, so only a conversation change can reach them
  // immediately; user-level changes are bounded by that DO's five-minute access alarm.
  const namespaces = type === 'conversation'
    ? [env?.CONVERSATION_ROOM, env?.CUSTOMER_CONVERSATION_DO]
    : [env?.USER_CONNECTION]
  for (const namespace of namespaces) {
    if (!namespace) continue
    try {
      const response = await namespace.get(namespace.idFromName(id)).fetch(
        new Request('https://internal/evict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(type === 'user' ? { userId: id } : {})
        })
      )
      if (!response.ok) throw new Error(`Eviction returned ${response.status}`)
    } catch (error) {
      // The five-minute access alarm bounds revocation when notification fails.
      console.error('[WebSocketAccess] Immediate revalidation failed', { type, id, error })
    }
  }
}

/**
 * Logout / password change: close every realtime socket the user holds (UserConnection and the
 * conversation rooms it tracks). Sockets are not tagged with a token jti, so this ends all of the
 * user's sessions, not only the one that logged out. Best-effort: never throws.
 * CustomerConversationDO sockets are per conversation and unreachable from a user id; they remain
 * bounded by token expiry.
 */
export async function revokeUserWebSocketSessions(
  env: Pick<Bindings, 'USER_CONNECTION'> | undefined,
  userId: string | number
): Promise<void> {
  const namespace = env?.USER_CONNECTION
  if (!namespace) return
  const id = String(userId)
  try {
    const response = await namespace.get(namespace.idFromName(id)).fetch(
      new Request('https://internal/evict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id, revokeSessions: true })
      })
    )
    if (!response.ok) throw new Error(`Eviction returned ${response.status}`)
  } catch (error) {
    console.error('[WebSocketAccess] Session revocation failed', { userId: id, error })
  }
}
