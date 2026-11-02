/**
 * One icon per navigation destination, shared by the sidebar and the page head tile so a page
 * wears the same glyph in both places. Sub-pages (/settings/general, /reports/templates)
 * resolve to their parent entry.
 */
import type { Component } from 'vue'
import DashboardIcon from '@/components/icons/DashboardIcon.vue'
import ChatIcon from '@/components/icons/ChatIcon.vue'
import TagIcon from '@/components/icons/TagIcon.vue'
import UsersIcon from '@/components/icons/UsersIcon.vue'
import UserIcon from '@/components/icons/UserIcon.vue'
import ActivityIcon from '@/components/icons/ActivityIcon.vue'
import SettingsIcon from '@/components/icons/SettingsIcon.vue'
import ApiIcon from '@/components/icons/ApiIcon.vue'
import RealtimeIcon from '@/components/icons/RealtimeIcon.vue'
import ReportsIcon from '@/components/icons/ReportsIcon.vue'
import DataManagementIcon from '@/components/icons/DataManagementIcon.vue'
import ChannelIcon from '@/components/icons/ChannelIcon.vue'
import AutoReplyIcon from '@/components/icons/AutoReplyIcon.vue'
import SendIcon from '@/components/icons/SendIcon.vue'
import BellIcon from '@/components/icons/BellIcon.vue'

export const NAV_ICONS: Readonly<Record<string, Component>> = {
  '/dashboard': DashboardIcon,
  '/conversations': ChatIcon,
  '/notifications': BellIcon,
  '/tags': TagIcon,
  '/broadcasts': SendIcon,
  '/reports': ReportsIcon,
  '/data': DataManagementIcon,
  '/team': UsersIcon,
  '/channels': ChannelIcon,
  '/auto-reply': AutoReplyIcon,
  '/activities': ActivityIcon,
  '/monitoring/api': ApiIcon,
  '/monitoring/websocket': RealtimeIcon,
  '/settings': SettingsIcon,
  '/profile': UserIcon,
}

/** Icon of the nav entry a path belongs to (longest matching prefix), undefined when none. */
export function navIconForPath(path: string): Component | undefined {
  const key = Object.keys(NAV_ICONS)
    .filter((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    .sort((a, b) => b.length - a.length)[0]
  return key ? NAV_ICONS[key] : undefined
}
