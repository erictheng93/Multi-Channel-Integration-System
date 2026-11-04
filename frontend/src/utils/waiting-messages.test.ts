import { describe, expect, it } from 'vitest'
import { withoutSignOffs } from './waiting-messages'

describe('withoutSignOffs', () => {
  it('drops thanks and stickers after an agent reply', () => {
    const list = [
      { senderType: 'customer', messageType: 'text', content: '請問運費' },
      { senderType: 'agent', messageType: 'text', content: '免運' },
      { senderType: 'customer', messageType: 'text', content: '謝謝!' },
      { senderType: 'customer', messageType: 'sticker' }
    ]
    expect(withoutSignOffs(list)).toEqual(list.slice(0, 2))
  })

  it('keeps a sign-off on first contact and real questions after a reply', () => {
    const list = [
      { senderType: 'customer', messageType: 'sticker' },
      { senderType: 'agent', messageType: 'text', content: 'hi' },
      { senderType: 'customer', messageType: 'text', content: '謝謝，那可以退貨嗎' }
    ]
    expect(withoutSignOffs(list)).toEqual(list)
  })

  it('does not treat an auto-reply as a human reply', () => {
    const list = [
      { senderType: 'customer', messageType: 'text', content: '在嗎' },
      { senderType: 'agent', senderId: 'auto-reply', messageType: 'text', content: '非營業時間' },
      { senderType: 'customer', messageType: 'sticker' }
    ]
    expect(withoutSignOffs(list)).toEqual(list)
  })
})
