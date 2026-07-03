import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref, type Ref } from 'vue';
import type { Message } from '@/types';
import { MESSAGE_STATUS } from '@/constants/message-status';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderType: 'agent',
    content: 'hello',
    messageType: 'text',
    status: MESSAGE_STATUS.BUFFERED,
    deliveryStatus: MESSAGE_STATUS.BUFFERED,
    metadata: {},
    recallDeadline: '2026-01-15T12:00:30.000Z',
    createdAt: '2026-01-15T12:00:00.000Z',
    updatedAt: '2026-01-15T12:00:00.000Z',
    ...overrides,
  } as unknown as Message;
}

async function useCountdownFor(message: Ref<Message>) {
  const { useRecallCountdown } = await import('./useRecallCountdown');
  return useRecallCountdown(computed(() => message.value));
}

describe('useRecallCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('exposes recallable countdown state for buffered messages', async () => {
    const message = ref(makeMessage());
    const countdown = await useCountdownFor(message);

    expect(countdown.isRecallable.value).toBe(true);
    expect(countdown.isAwaitingDelivery.value).toBe(false);
    expect(countdown.remainingSeconds.value).toBe(30);
    expect(countdown.countdownLabel.value).toBe('0:30');
  });

  it('excludes recalled buffered messages from recall countdown state', async () => {
    const message = ref(makeMessage({
      metadata: { isRecalled: true },
    }));
    const countdown = await useCountdownFor(message);

    expect(countdown.isRecallable.value).toBe(false);
    expect(countdown.isAwaitingDelivery.value).toBe(false);
    expect(countdown.remainingSeconds.value).toBe(0);
  });

  it('switches to awaiting-delivery when a buffered countdown reaches zero', async () => {
    const message = ref(makeMessage());
    const countdown = await useCountdownFor(message);

    vi.setSystemTime(new Date('2026-01-15T12:00:30.000Z'));
    vi.advanceTimersByTime(1_000);

    expect(countdown.isRecallable.value).toBe(false);
    expect(countdown.isAwaitingDelivery.value).toBe(true);
    expect(countdown.remainingSeconds.value).toBe(0);
    expect(countdown.countdownLabel.value).toBe('0:00');
  });

  it('returns false countdown flags for non-buffered messages', async () => {
    const message = ref(makeMessage({
      status: MESSAGE_STATUS.SENT,
      deliveryStatus: MESSAGE_STATUS.SENT,
      recallDeadline: null,
    }));
    const countdown = await useCountdownFor(message);

    expect(countdown.isRecallable.value).toBe(false);
    expect(countdown.isAwaitingDelivery.value).toBe(false);
    expect(countdown.remainingSeconds.value).toBe(0);
    expect(countdown.countdownLabel.value).toBe('0:00');
  });
});
