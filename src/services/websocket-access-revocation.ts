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
