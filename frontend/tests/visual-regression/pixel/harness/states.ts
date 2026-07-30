/**
 * ============================================================================
 * Pixel VRT — render table
 * ============================================================================
 *
 * Maps every id in `state-ids.ts` to the real component + fixed props that
 * produce it. Typed as `Record<VrtStateId, VrtStateRender>`, so `vue-tsc` fails
 * the build if an id gains no renderer or a renderer has no id.
 *
 * Rules for anything added here:
 *   - Import the REAL component from `@/components/...`. Never a copy.
 *   - Every prop value must be a constant (see `mocks/data.ts`). No clock reads,
 *     no `Math.random()`, no network-derived data.
 *   - Pick props that keep the component off any code path that fetches. All
 *     covered components only fetch on user interaction or with
 *     `showHistory: true`, both of which the harness avoids.
 * ============================================================================
 */

import type { Component } from 'vue'
import type { VrtStateId } from '../state-ids'

// --- real components under test --------------------------------------------
import StatusBadge from '@/components/ui/StatusBadge.vue'
import PlatformBadge from '@/components/ui/PlatformBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'
import PrimaryActionButton from '@/components/ui/PrimaryActionButton.vue'
import TypingIndicator from '@/components/conversation/TypingIndicator.vue'
import QuickAssignActions from '@/components/conversation/QuickAssignActions.vue'
import ConversationFilters from '@/components/conversation-list/ConversationFilters.vue'
import TeamCard from '@/components/team/TeamCard.vue'
import TeamMemberCard from '@/components/team/TeamMemberCard.vue'
import PlatformStatus from '@/components/platform/PlatformStatus.vue'
import { UserPlusIcon } from '@/components/icons'

// --- harness-only fixtures --------------------------------------------------
import ButtonMatrix from './fixtures/ButtonMatrix.vue'
import CssLayerMatrix from './fixtures/CssLayerMatrix.vue'
import VariantRow from './fixtures/VariantRow.vue'

import {
  MOCK_CONVERSATION_ASSIGNED,
  MOCK_CONVERSATION_UNASSIGNED,
  MOCK_FILTERS_ACTIVE,
  MOCK_FILTERS_EMPTY,
  MOCK_MEMBER_ADMIN,
  MOCK_MEMBER_INACTIVE,
  MOCK_MEMBER_WITH_AVATAR,
  MOCK_PLATFORM_METRICS,
  MOCK_TAGS,
  MOCK_TEAM_ACTIVE,
  MOCK_TEAM_INACTIVE,
  MOCK_TEAMS,
  MOCK_WEBHOOK_FAILING,
  MOCK_WEBHOOK_OK,
} from './mocks/data'

export interface VrtStateRender {
  /** Component to mount inside the stage. */
  readonly component: Component
  /** Props passed with `v-bind`. */
  readonly props?: Readonly<Record<string, unknown>>
  /** Fixed stage width in px. Fixed so a page-level reflow cannot move pixels. */
  readonly width: number
  /** Stage backdrop: iOS system gray (default) or white. */
  readonly surface?: 'gray' | 'white'
}

export const VRT_RENDERERS: Record<VrtStateId, VrtStateRender> = {
  // ---------------------------------------------------------- global button CSS
  // White stage for the button cases: `.btn-secondary` is `#F2F2F7`, i.e. the
  // exact colour of the default gray stage, so it would be invisible there.
  'buttons-variants': {
    component: ButtonMatrix,
    props: { mode: 'variants' },
    width: 880,
    surface: 'white',
  },
  'buttons-sizes': {
    component: ButtonMatrix,
    props: { mode: 'sizes' },
    width: 660,
    surface: 'white',
  },
  'buttons-disabled': {
    component: ButtonMatrix,
    props: { mode: 'disabled' },
    width: 880,
    surface: 'white',
  },
  'buttons-with-icon': {
    component: ButtonMatrix,
    props: { mode: 'with-icon' },
    width: 520,
    surface: 'white',
  },

  // ------------------------------------------------------------ style.css layers
  'css-cards': {
    component: CssLayerMatrix,
    props: { mode: 'cards' },
    width: 720,
  },
  'css-badges': {
    component: CssLayerMatrix,
    props: { mode: 'badges' },
    width: 620,
    surface: 'white',
  },
  'css-alerts': {
    component: CssLayerMatrix,
    props: { mode: 'alerts' },
    width: 620,
    surface: 'white',
  },
  'css-forms': {
    component: CssLayerMatrix,
    props: { mode: 'forms' },
    width: 420,
    surface: 'white',
  },
  'css-typography': {
    component: CssLayerMatrix,
    props: { mode: 'typography' },
    width: 560,
    surface: 'white',
  },

  // --------------------------------------------------------------------- ui: badges
  'status-badge-statuses': {
    component: VariantRow,
    props: {
      component: StatusBadge,
      variants: [
        { status: 'open' },
        { status: 'assigned' },
        { status: 'closed' },
        { status: 'pending' },
        { status: 'in-progress' },
        { status: 'resolved' },
        { status: 'active' },
        { status: 'inactive' },
        { status: 'online' },
        { status: 'offline' },
        { status: 'unknown' },
        { status: 'brand-new-status' },
      ],
    },
    width: 620,
    surface: 'white',
  },
  'status-badge-sizes': {
    component: VariantRow,
    props: {
      component: StatusBadge,
      variants: [
        { status: 'assigned', size: 'small' },
        { status: 'assigned', size: 'medium' },
        { status: 'assigned', size: 'large' },
        { status: 'resolved', size: 'large', clickable: true },
      ],
    },
    width: 480,
    surface: 'white',
  },
  'platform-badge-platforms': {
    component: VariantRow,
    props: {
      component: PlatformBadge,
      variants: [
        { platform: 'line' },
        { platform: 'facebook' },
        { platform: 'instagram' },
        { platform: 'whatsapp' },
        { platform: 'telegram' },
        { platform: 'unknown' },
        { platform: 'wechat' },
      ],
    },
    width: 620,
    surface: 'white',
  },
  'platform-badge-icon-status': {
    component: VariantRow,
    props: {
      component: PlatformBadge,
      variants: [
        { platform: 'line', showIcon: true, status: 'connected' },
        { platform: 'facebook', showIcon: true, status: 'disconnected' },
        { platform: 'instagram', showIcon: true, status: 'error' },
      ],
    },
    width: 560,
    surface: 'white',
  },
  'platform-badge-sizes': {
    component: VariantRow,
    props: {
      component: PlatformBadge,
      variants: [
        { platform: 'line', size: 'small' },
        { platform: 'line', size: 'medium' },
        { platform: 'line', size: 'large' },
        { platform: 'facebook', size: 'large', showIcon: true },
      ],
    },
    width: 480,
    surface: 'white',
  },

  // ------------------------------------------------------------------ ui: states
  'empty-state-default': {
    component: EmptyState,
    props: {
      title: '尚無對話',
      description: '目前沒有符合篩選條件的對話。調整條件或稍後再試。',
    },
    width: 520,
    surface: 'white',
  },
  'empty-state-with-action': {
    component: EmptyState,
    props: {
      title: '尚未建立團隊',
      description: '建立第一個團隊後才能開始指派對話。',
      actionText: '建立團隊',
    },
    width: 520,
    surface: 'white',
  },
  'empty-state-loading': {
    component: EmptyState,
    props: { loading: true, loadingText: '載入對話中...' },
    width: 520,
    surface: 'white',
  },
  'empty-state-small': {
    component: EmptyState,
    props: { title: '沒有結果', description: '換個關鍵字試試。', size: 'small' },
    width: 440,
    surface: 'white',
  },
  'empty-state-large': {
    component: EmptyState,
    props: {
      title: '沒有結果',
      description: '換個關鍵字試試。',
      size: 'large',
      actionText: '清除篩選',
    },
    width: 560,
    surface: 'white',
  },

  // -------------------------------------------------------------- ui: skeletons
  // `count` is kept small so the stage stays inside one viewport height, which
  // is what lets Playwright capture the element in a single pass.
  'skeleton-loader-list': {
    component: SkeletonLoader,
    props: { count: 4, variant: 'list' },
    width: 560,
  },
  'skeleton-loader-grid': {
    component: SkeletonLoader,
    props: { count: 2, variant: 'grid' },
    width: 560,
  },

  // ----------------------------------------------------------- ui: action button
  'primary-action-button-default': {
    component: PrimaryActionButton,
    props: { text: '新增團隊', icon: UserPlusIcon },
    width: 380,
    surface: 'white',
  },
  'primary-action-button-loading': {
    component: PrimaryActionButton,
    props: { text: '新增團隊', icon: UserPlusIcon, loading: true, loadingText: '建立中...' },
    width: 380,
    surface: 'white',
  },

  // ------------------------------------------------------- conversation: typing
  'typing-indicator-single': {
    component: TypingIndicator,
    props: { typingUsers: ['Ada Lin'] },
    width: 360,
    surface: 'white',
  },
  'typing-indicator-two': {
    component: TypingIndicator,
    props: { typingUsers: ['Ada Lin', 'Bruno Tsai'] },
    width: 360,
    surface: 'white',
  },
  'typing-indicator-overflow': {
    component: TypingIndicator,
    props: {
      typingUsers: ['Ada Lin', 'Bruno Tsai', 'Chloe Wu', 'Dylan Ho', 'Elena Kao'],
      maxUsersShown: 2,
    },
    width: 360,
    surface: 'white',
  },
  'typing-indicator-compact': {
    component: TypingIndicator,
    props: { typingUsers: ['Ada Lin', 'Bruno Tsai'], compact: true },
    width: 360,
    surface: 'white',
  },
  // Empty list => `.typing-indicator` stays at opacity 0. The screenshot is an
  // empty stage on purpose: it locks in that the indicator stays invisible.
  'typing-indicator-idle': {
    component: TypingIndicator,
    props: { typingUsers: [] },
    width: 360,
    surface: 'white',
  },

  // ------------------------------------------------------- conversation: assign
  'quick-assign-actions-default': {
    component: QuickAssignActions,
    props: { conversation: MOCK_CONVERSATION_UNASSIGNED },
    width: 560,
    surface: 'white',
  },
  'quick-assign-actions-compact': {
    component: QuickAssignActions,
    props: { conversation: MOCK_CONVERSATION_UNASSIGNED, compactMode: true },
    width: 560,
    surface: 'white',
  },
  'quick-assign-actions-assigned': {
    component: QuickAssignActions,
    props: { conversation: MOCK_CONVERSATION_ASSIGNED },
    width: 560,
    surface: 'white',
  },

  // ------------------------------------------------------------ filter command bar
  'conversation-filters-idle': {
    component: ConversationFilters,
    props: {
      filters: MOCK_FILTERS_EMPTY,
      availableTags: MOCK_TAGS,
      totalConversations: 128,
      unreadCount: 0,
    },
    width: 760,
  },
  'conversation-filters-pills': {
    component: ConversationFilters,
    props: {
      filters: MOCK_FILTERS_ACTIVE,
      availableTags: MOCK_TAGS,
      totalConversations: 128,
      unreadCount: 9,
    },
    width: 760,
  },

  // --------------------------------------------------------------------- team
  'team-card-active': {
    component: TeamCard,
    props: { team: MOCK_TEAM_ACTIVE },
    width: 940,
  },
  'team-card-inactive': {
    component: TeamCard,
    props: { team: MOCK_TEAM_INACTIVE },
    width: 940,
  },
  'team-card-busy': {
    component: TeamCard,
    props: { team: MOCK_TEAM_ACTIVE, loading: true },
    width: 940,
  },
  'team-member-card-admin': {
    component: TeamMemberCard,
    props: { member: MOCK_MEMBER_ADMIN, allTeams: MOCK_TEAMS },
    width: 940,
  },
  'team-member-card-inactive': {
    component: TeamMemberCard,
    props: { member: MOCK_MEMBER_INACTIVE, allTeams: MOCK_TEAMS },
    width: 940,
  },
  'team-member-card-avatar': {
    component: TeamMemberCard,
    props: { member: MOCK_MEMBER_WITH_AVATAR, allTeams: MOCK_TEAMS },
    width: 940,
  },
  'team-member-card-selected': {
    component: TeamMemberCard,
    props: {
      member: MOCK_MEMBER_WITH_AVATAR,
      allTeams: MOCK_TEAMS,
      isSelectionMode: true,
      isSelected: true,
    },
    width: 940,
  },

  // ----------------------------------------------------------------- platform
  // `showHistory: false` matters: `true` starts a 30s `setInterval` that calls
  // `refreshStatus()`, which is both a timer and (indirectly) a fetch path.
  'platform-status-line-connected': {
    component: PlatformStatus,
    props: {
      platform: 'line',
      status: 'connected',
      showMetrics: true,
      showHistory: false,
      showSettings: true,
      metrics: MOCK_PLATFORM_METRICS,
      webhookStatus: MOCK_WEBHOOK_OK,
    },
    width: 760,
  },
  'platform-status-facebook-error': {
    component: PlatformStatus,
    props: {
      platform: 'facebook',
      status: 'error',
      showMetrics: true,
      showHistory: false,
      showSettings: true,
      metrics: { ...MOCK_PLATFORM_METRICS, successRate: 0.412 },
      webhookStatus: MOCK_WEBHOOK_FAILING,
    },
    width: 760,
  },
  'platform-status-line-connecting': {
    component: PlatformStatus,
    props: {
      platform: 'line',
      status: 'connecting',
      showMetrics: false,
      showHistory: false,
      showSettings: false,
      metrics: MOCK_PLATFORM_METRICS,
      webhookStatus: MOCK_WEBHOOK_OK,
    },
    width: 760,
  },
}
