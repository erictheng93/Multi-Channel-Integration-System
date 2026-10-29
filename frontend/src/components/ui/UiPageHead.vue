<!--
  UiPageHead.vue

  The one page header. Every routed page renders exactly one, as the first child of its
  `.ui-page` root, so the title and the content start at the same x/y everywhere.

    <div class="ui-page">
      <UiPageHead title="對話" subtitle="LINE 與 Messenger 的客戶對話" >
        <template #actions>
          <button class="btn btn-primary">新增</button>
        </template>
      </UiPageHead>
      ...page body...
    </div>

  Rules the component enforces (see ROUND2 section 1):
  - Title row is 36px; the actions sit on that row's vertical centre (36px controls).
  - The subtitle is ONE line (ellipsis, full text in the `title` attribute) and its line is
    always reserved, so a late-loading or missing subtitle never shifts the content.
  - No eyebrow: the breadcrumb in the top bar already names the section.
  - Below 768px the actions drop under the subtitle as one wrapping row.

  The title row starts with a 40px icon tile: the page's nav glyph, white on the section hue
  (--section-hue, set by AppLayout from the route). Title is 34px / 700 (28px on phone).

  Props
    tile      false hides the icon tile (default true)
    title     page name; must equal the nav label / route meta.title (one name per concept)
    subtitle  one line of context. Keep it under ~60 characters; put detail in a tooltip.

  Slots
    title     replaces the title text (e.g. the dashboard greeting); still rendered in the h1
    subtitle  rich subtitle; also pass the `subtitle` prop (plain text) so the full text is
              available in the title attribute
    actions   buttons / pills / switches (right-aligned on the title row)
-->

<template>
  <header class="ui-page-head">
    <h1 class="ui-page-title">
      <span
        v-if="icon"
        class="ui-page-ico"
        aria-hidden="true"
      >
        <component :is="icon" />
      </span>
      <span class="ui-page-title-text"><slot name="title">{{ title }}</slot></span>
    </h1>
    <div
      v-if="$slots.actions"
      class="ui-page-actions"
    >
      <slot name="actions" />
    </div>
    <p
      class="ui-page-sub"
      :title="subtitle || undefined"
    >
      <slot name="subtitle">
        {{ subtitle }}
      </slot>
    </p>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { navIconForPath } from '@/config/nav-icons'

const props = withDefaults(defineProps<{
  title?: string
  subtitle?: string
  /** Show the section icon tile (default). Pass false for a page that must not wear one. */
  tile?: boolean
}>(), {
  title: '',
  subtitle: '',
  tile: true,
})

// The tile is the page's own nav glyph on the section hue (config/nav-icons.ts + nav-sections.ts)
const route = useRoute()
const icon = computed(() => (props.tile ? navIconForPath(route?.path ?? '') : undefined))
</script>
