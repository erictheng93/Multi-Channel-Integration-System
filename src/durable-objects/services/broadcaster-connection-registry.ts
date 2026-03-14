// Broadcaster Connection Registry
// Manages conversation room and user connection registration/unregistration

import type { BroadcasterContext } from './broadcaster-helpers';
import type { BroadcasterHelpers } from './broadcaster-helpers';
import { createContextLogger } from '../../utils/logger';

const log = createContextLogger('MessageBroadcaster');

/**
 * Manages connection registration/unregistration for MessageBroadcaster.
 * Tracks conversation rooms and user connections, persists IDs for DO restarts.
 */
export class BroadcasterConnectionRegistry {
  constructor(
    private ctx: BroadcasterContext,
    private helpers: BroadcasterHelpers
  ) {}

  async handleRegisterConnection(request: Request): Promise<Response> {
    try {
      const { type, id } = await request.json() as { type: string; id: string };

      if (type === 'conversation') {
        if (!this.ctx.conversationRooms.has(id)) {
          const doId = this.ctx.env.CONVERSATION_ROOM.idFromName(id);
          const stub = this.ctx.env.CONVERSATION_ROOM.get(doId);
          this.ctx.conversationRooms.set(id, stub);
        }
      } else if (type === 'user') {
        if (!this.ctx.userConnections.has(id)) {
          const doId = this.ctx.env.USER_CONNECTION.idFromName(id);
          const stub = this.ctx.env.USER_CONNECTION.get(doId);
          this.ctx.userConnections.set(id, stub);
        }
      }

      this.ctx.stats.activeConnections++;

      // Phase B4 Fix: Persist connection IDs after registration
      await this.helpers.persistConnectionIds();

      console.log(`[MessageBroadcaster] Registered ${type} connection: ${id}`);

      return new Response(JSON.stringify({
        success: true,
        activeConnections: this.ctx.stats.activeConnections
      }));
    } catch (error) {
      log.error(' [MessageBroadcaster] Connection registration error:', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Registration failed' }), { status: 500 });
    }
  }

  async handleUnregisterConnection(request: Request): Promise<Response> {
    try {
      const { type, id } = await request.json() as { type: string; id: string };

      if (type === 'conversation') {
        this.ctx.conversationRooms.delete(id);
      } else if (type === 'user') {
        this.ctx.userConnections.delete(id);
      }

      this.ctx.stats.activeConnections = Math.max(0, this.ctx.stats.activeConnections - 1);

      // Phase B4 Fix: Persist connection IDs after unregistration
      await this.helpers.persistConnectionIds();

      console.log(`[MessageBroadcaster] Unregistered ${type} connection: ${id}`);

      return new Response(JSON.stringify({
        success: true,
        activeConnections: this.ctx.stats.activeConnections
      }));
    } catch (error) {
      log.error(' [MessageBroadcaster] Connection unregistration error:', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Unregistration failed' }), { status: 500 });
    }
  }
}
