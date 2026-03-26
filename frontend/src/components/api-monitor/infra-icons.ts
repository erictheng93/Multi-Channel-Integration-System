/**
 * Simple inline SVG icon components for infrastructure card.
 * These are minimal functional components to avoid dependency on external icon libs.
 */
import { defineComponent, h } from 'vue'

function createSvgIcon(name: string, paths: string[]) {
  return defineComponent({
    name,
    props: {
      size: { type: Number, default: 24 },
    },
    setup(props) {
      return () =>
        h(
          'svg',
          {
            width: props.size,
            height: props.size,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': '2',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
          },
          paths.map((d) => h('path', { d })),
        )
    },
  })
}

export const DatabaseIcon = createSvgIcon('DatabaseIcon', [
  'M12 2C6.48 2 2 3.79 2 6v12c0 2.21 4.48 4 10 4s10-1.79 10-4V6c0-2.21-4.48-4-10-4z',
  'M2 6c0 2.21 4.48 4 10 4s10-1.79 10-4',
  'M2 12c0 2.21 4.48 4 10 4s10-1.79 10-4',
])

export const KeyIcon = createSvgIcon('KeyIcon', [
  'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
])

export const CloudIcon = createSvgIcon('CloudIcon', [
  'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z',
])

export const ZapIcon = createSvgIcon('ZapIcon', [
  'M13 2L3 14h9l-1 10 10-12h-9l1-10z',
])
