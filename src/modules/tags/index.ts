// src/modules/tags/index.ts
// Tags module barrel export

// Handlers
export { default as tagMainHandler } from './handlers';
export { tagMainHandler as default } from './handlers';

// Services
export { tagHandler } from './services/tag-service';

// Types
export type * from './types';
