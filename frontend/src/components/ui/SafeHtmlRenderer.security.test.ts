// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SafeHtmlRenderer from './SafeHtmlRenderer.vue'
import { convertEmojiForMessageDetail } from '@/utils/layered-emoji-processor'
import { renderForVue } from '@/utils/enhanced-message-renderer'

const render = async (customerText: string) => {
  const w = mount(SafeHtmlRenderer, { props: { html: await convertEmojiForMessageDetail(customerText) } })
  await w.vm.$nextTick()
  return w
}

describe('F21 customer text renders as text', () => {
  it.each([
    '<b style="position:fixed;inset:0">x</b>',
    '<a href="https://evil.example">click</a>',
    '<img src="https://tracker.example/p.gif">',
  ])('%s is literal text', async (input) => {
    const w = await render(input)
    expect(w.element.querySelector('b,img,[style]')).toBeNull()
    // only auto-linked bare URLs may become anchors, and the link text is the href
    w.element.querySelectorAll('a').forEach((a: Element) => expect(a.textContent).toBe(a.getAttribute('href')))
    expect(w.element.textContent).toBe(input)
  })

  it('same via enhanced renderer', async () => {
    const w = mount(SafeHtmlRenderer, { props: { html: await renderForVue('<img src=https://tracker.example/x>') } })
    await w.vm.$nextTick()
    expect(w.element.querySelector('img')).toBeNull()
  })

  it('plain URLs still linkify safely', async () => {
    const w = await render('see https://example.com/a?x=1&y=2 now')
    const a = w.element.querySelector('a')!
    expect(a.getAttribute('href')).toBe('https://example.com/a?x=1&y=2')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
    expect(a.getAttribute('target')).toBe('_blank')
  })

  it('emoji descriptions still convert', async () => {
    const out = await convertEmojiForMessageDetail('ok (smile)')
    expect(out).not.toContain('(smile)')
  })

  it('sanitizer drops style/remote img/javascript href from injected markup', async () => {
    const w = mount(SafeHtmlRenderer, {
      props: { html: '<span style="x:y">a</span><img src="https://t.example/p.gif"><a href="javascript:alert(1)">b</a>' },
    })
    await w.vm.$nextTick()
    expect(w.element.querySelector('[style]')).toBeNull()
    expect(w.element.querySelector('img')).toBeNull()
    expect(w.element.querySelector('a[href]')).toBeNull()
  })
})
