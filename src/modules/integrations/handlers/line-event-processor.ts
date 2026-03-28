// src/modules/integrations/handlers/line-event-processor.ts
// LINE event processing orchestrator — delegates to focused sub-modules
//
// Sub-modules:
// - line-message-handler.ts: processLineMessage (message event processing)
// - line-follow-handler.ts: processLineFollowEvent, processLineUnfollowEvent (follow/unfollow events)

export { processLineMessage } from './line-message-handler';
export { processLineFollowEvent, processLineUnfollowEvent } from './line-follow-handler';
