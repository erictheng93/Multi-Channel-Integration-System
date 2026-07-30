/**
 * ============================================================================
 * Pixel VRT — State Manifest (shared, dependency-free)
 * ============================================================================
 *
 * This is the single source of truth for WHICH component states the pixel
 * visual-regression suite covers. It is imported by BOTH:
 *
 *   - the browser harness  (tests/visual-regression/pixel/harness/states.ts)
 *   - the Playwright spec  (tests/visual-regression/pixel/pixel.vrt.ts)
 *
 * It therefore MUST stay free of any Vue / .vue / DOM imports: Playwright's
 * TypeScript loader has no Vue SFC transform, so importing a `.vue` file from
 * here would break test collection.
 *
 * Drift protection: `harness/states.ts` types its lookup table as
 * `Record<VrtStateId, VrtStateRender>`, so adding an id here without wiring a
 * renderer (or vice versa) is a type error. `pixel.vrt.ts` additionally
 * asserts at runtime that the rendered page exposes exactly these ids.
 * ============================================================================
 */

export interface VrtStateMeta {
  /** Stable id. Also the screenshot file name and the `data-vrt-state` value. */
  readonly id: string
  /** Grouping used only for human-readable test titles. */
  readonly group: string
  /** Short description of what this state is meant to pin down. */
  readonly label: string
}

/**
 * Ordered list of covered states.
 *
 * Ordering is cosmetic (it is the order they appear on the harness page), but
 * ids must never be renamed casually — a rename orphans its baseline PNG.
 */
export const VRT_STATES = [
  // --- Global button system (frontend/src/style.css is the only definition
  //     site for these classes, so they get first-class coverage) ----------
  { id: 'buttons-variants', group: 'global-css', label: 'btn colour variants' },
  { id: 'buttons-sizes', group: 'global-css', label: 'btn sm / default / lg' },
  { id: 'buttons-disabled', group: 'global-css', label: 'btn disabled variants' },
  { id: 'buttons-with-icon', group: 'global-css', label: 'btn icon + label gap' },

  // --- Other @layer components utilities from style.css ------------------
  { id: 'css-cards', group: 'global-css', label: 'card / header / body / footer' },
  { id: 'css-badges', group: 'global-css', label: 'badge + platform badge classes' },
  { id: 'css-alerts', group: 'global-css', label: 'alert success / warning / danger' },
  { id: 'css-forms', group: 'global-css', label: 'form label / input / textarea / select' },
  { id: 'css-typography', group: 'global-css', label: 'heading + body + caption scale' },

  // --- src/components/ui -------------------------------------------------
  { id: 'status-badge-statuses', group: 'ui', label: 'StatusBadge every mapped status' },
  { id: 'status-badge-sizes', group: 'ui', label: 'StatusBadge small / medium / large' },
  { id: 'platform-badge-platforms', group: 'ui', label: 'PlatformBadge per platform' },
  { id: 'platform-badge-icon-status', group: 'ui', label: 'PlatformBadge icon + status dot' },
  { id: 'platform-badge-sizes', group: 'ui', label: 'PlatformBadge small / medium / large' },
  { id: 'empty-state-default', group: 'ui', label: 'EmptyState title + description' },
  { id: 'empty-state-with-action', group: 'ui', label: 'EmptyState with action button' },
  { id: 'empty-state-loading', group: 'ui', label: 'EmptyState loading spinner' },
  { id: 'empty-state-small', group: 'ui', label: 'EmptyState small padding' },
  { id: 'empty-state-large', group: 'ui', label: 'EmptyState large padding' },
  { id: 'skeleton-loader-list', group: 'ui', label: 'SkeletonLoader list variant (seeded)' },
  { id: 'skeleton-loader-grid', group: 'ui', label: 'SkeletonLoader grid variant (seeded)' },
  { id: 'primary-action-button-default', group: 'ui', label: 'PrimaryActionButton idle' },
  { id: 'primary-action-button-loading', group: 'ui', label: 'PrimaryActionButton loading' },

  // --- src/components/conversation ---------------------------------------
  { id: 'typing-indicator-single', group: 'conversation', label: 'TypingIndicator one user' },
  { id: 'typing-indicator-two', group: 'conversation', label: 'TypingIndicator two users' },
  { id: 'typing-indicator-overflow', group: 'conversation', label: 'TypingIndicator overflow count' },
  { id: 'typing-indicator-compact', group: 'conversation', label: 'TypingIndicator compact variant' },
  { id: 'typing-indicator-idle', group: 'conversation', label: 'TypingIndicator hidden (no users)' },
  { id: 'quick-assign-actions-default', group: 'conversation', label: 'QuickAssignActions unassigned' },
  { id: 'quick-assign-actions-compact', group: 'conversation', label: 'QuickAssignActions compact' },
  { id: 'quick-assign-actions-assigned', group: 'conversation', label: 'QuickAssignActions assigned team pill' },

  // --- src/components/conversation-list ----------------------------------
  { id: 'conversation-filters-idle', group: 'conversation-list', label: 'ConversationFilters collapsed, no filters' },
  { id: 'conversation-filters-pills', group: 'conversation-list', label: 'ConversationFilters collapsed, active pills' },

  // --- src/components/team ------------------------------------------------
  { id: 'team-card-active', group: 'team', label: 'TeamCard active team' },
  { id: 'team-card-inactive', group: 'team', label: 'TeamCard disabled team' },
  { id: 'team-card-busy', group: 'team', label: 'TeamCard with disabled actions' },
  { id: 'team-member-card-admin', group: 'team', label: 'TeamMemberCard admin role' },
  { id: 'team-member-card-inactive', group: 'team', label: 'TeamMemberCard inactive agent' },
  { id: 'team-member-card-avatar', group: 'team', label: 'TeamMemberCard with avatar image' },
  { id: 'team-member-card-selected', group: 'team', label: 'TeamMemberCard selection mode, selected' },

  // --- src/components/platform -------------------------------------------
  { id: 'platform-status-line-connected', group: 'platform', label: 'PlatformStatus LINE connected + metrics' },
  { id: 'platform-status-facebook-error', group: 'platform', label: 'PlatformStatus Facebook error' },
  { id: 'platform-status-line-connecting', group: 'platform', label: 'PlatformStatus LINE connecting' },
] as const satisfies readonly VrtStateMeta[]

/** Union of every covered state id. */
export type VrtStateId = (typeof VRT_STATES)[number]['id']

/** Convenience list of ids only, in page order. */
export const VRT_STATE_IDS: readonly VrtStateId[] = VRT_STATES.map(state => state.id)
