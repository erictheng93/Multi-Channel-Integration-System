import type { Page } from '@playwright/test'

/**
 * Viewports the responsive suite checks: narrow phone, phone, tablet, laptop.
 * Heights are typical device heights; the widths are the ones that matter.
 * 320 is the stress width: anything whose layout depends on its content width
 * (a select's longest option, an intrinsic textarea width) shows up there first.
 */
export const VIEWPORTS = [
  { name: 'narrow phone', width: 320, height: 640 },
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
] as const

/** Routes with no required params; /conversations/:id is covered separately. */
export const ROUTES = [
  '/dashboard',
  '/conversations',
  '/team',
  '/channels',
  '/activities',
  '/settings/general',
  '/settings/integrations/line',
  '/settings/integrations/facebook',
  '/settings/advanced',
  '/tags',
  '/broadcasts',
  '/notifications',
  '/data/export',
  '/data/backup',
  '/reports/dashboard',
  '/reports/templates',
  '/reports/generate',
  '/auto-reply',
  '/monitoring/api',
  '/monitoring/websocket',
  '/profile',
] as const

export interface LayoutAudit {
  /** documentElement.scrollWidth - innerWidth; > 0 means the page scrolls sideways. */
  documentOverflow: number
  /** Interactive controls whose box sits outside the viewport horizontally. */
  unreachable: string[]
  /** overflow:hidden boxes whose content is wider than the box (content is cut). */
  clipped: string[]
  /**
   * Page roots that shrink-wrap their content inside a flex column: they have a
   * max-width and auto margins but no width, so they are narrower than the space
   * they are allowed (and grow past it as soon as the content gets wide).
   */
  shrinkWrapped: string[]
  /** Values that leaked to the UI unformatted: 0.00014140695, NaN, undefined, [object Object]. */
  rawValues: string[]
}

/**
 * Runs in the page. Deliberately does NOT treat an `overflow: hidden` ancestor as
 * "safe": that is exactly how six header buttons sat at x=482..766 on a 375px phone,
 * invisible and untappable, without any page-level scrollbar.
 *
 * Ignored on purpose: the closed mobile drawer, horizontal scrollers (overflow-x
 * auto/scroll that actually scroll), visually-hidden inputs, and intentional
 * ellipsis truncation.
 */
export function auditLayoutInPage(): LayoutAudit {
  const vw = window.innerWidth
  const label = (el: Element): string => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''
    const title = el.getAttribute('title')
    return el.tagName.toLowerCase() + (cls ? `.${  cls}` : '') + (title ? `[${title}]` : '')
  }
  const inClosedDrawer = (el: Element): boolean =>
    !!el.closest('.sidebar') &&
    !!document.querySelector('.sidebar-mobile') &&
    !document.querySelector('.sidebar-mobile-open')
  const inScroller = (el: Element): boolean => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = window.getComputedStyle(p)
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1) {
        return true
      }
    }
    return false
  }
  const hiddenInput = /visually-hidden|sr-only/
  const unreachable: string[] = []
  const clipped: string[] = []

  for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role=button]')) {
    const cs = window.getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') { continue }
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height || inClosedDrawer(el) || hiddenInput.test(String(el.className))) { continue }
    if ((r.right > vw + 1 || r.left < -1) && !inScroller(el)) {
      unreachable.push(`${label(el)} [${Math.round(r.left)}..${Math.round(r.right)}]`)
    }
  }
  for (const el of document.querySelectorAll('body *')) {
    const cs = window.getComputedStyle(el)
    if (
      cs.overflowX === 'hidden' &&
      cs.textOverflow !== 'ellipsis' &&
      el.clientWidth > 0 &&
      el.scrollWidth > el.clientWidth + 8 &&
      !inClosedDrawer(el) &&
      !hiddenInput.test(String(el.className))
    ) {
      clipped.push(`${label(el)} ${el.scrollWidth}>${el.clientWidth}`)
    }
  }
  // Page roots: the children (and grandchildren) of the flex-column page container, or of
  // <body> when there is none. Their max-width + auto margins need an explicit width.
  const shrinkWrapped: string[] = []
  const container = document.querySelector('.page-content') ?? document.body
  for (const child of container.children) {
    for (const el of [child, ...child.children]) {
      const cs = window.getComputedStyle(el)
      const box = el.getBoundingClientRect()
      const parent = el.parentElement
      if (cs.display === 'none' || !box.width || !parent || el.closest('.sidebar')) { continue }
      const ps = window.getComputedStyle(parent)
      if (!ps.display.includes('flex') || ps.flexDirection !== 'column') { continue }
      const maxWidth = cs.maxWidth === 'none' ? Infinity : parseFloat(cs.maxWidth)
      const available = parent.clientWidth - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight)
      if (Number.isFinite(maxWidth) && box.width < Math.min(maxWidth, available) - 2) {
        shrinkWrapped.push(`${label(el)} width=${Math.round(box.width)} available=${Math.round(Math.min(maxWidth, available))}`)
      }
    }
  }

  const rawValues = [
    ...(container as HTMLElement).innerText.matchAll(/\b\d+\.\d{5,}\b|\bNaN\b|\bundefined\b|\[object Object\]|\bInfinity\b/g),
  ].map((m) => m[0].slice(0, 30))

  return {
    documentOverflow: document.documentElement.scrollWidth - vw,
    unreachable,
    clipped,
    shrinkWrapped,
    rawValues,
  }
}

export function auditLayout(page: Page): Promise<LayoutAudit> {
  return page.evaluate(auditLayoutInPage)
}

/** SPA navigation: a full reload per route would hammer /auth/refresh. */
export function spaNavigate(page: Page, path: string): Promise<void> {
  return page.evaluate(async (p) => {
    const app = (document.querySelector('#app') as unknown as {
      __vue_app__: { config: { globalProperties: { $router: { push(_to: string): Promise<unknown> } } } }
    }).__vue_app__
    await app.config.globalProperties.$router.push(p)
  }, path)
}
