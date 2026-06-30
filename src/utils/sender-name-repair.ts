interface SenderNameInput {
  senderType: string | null | undefined
  senderName: string | null | undefined
  agentDisplayName?: string | null
}

export function isLikelyUtf8Mojibake(value: string | null | undefined): boolean {
  if (!value) {
    return false
  }

  return /[\u0080-\u009f\ufffd]/u.test(value) || /[\u00e0-\u00ef][\u00a0-\u00bf]/u.test(value)
}

export function resolveDisplaySenderName(input: SenderNameInput): string | null | undefined {
  if (
    input.senderType === 'agent' &&
    input.senderName &&
    input.agentDisplayName &&
    isLikelyUtf8Mojibake(input.senderName)
  ) {
    return input.agentDisplayName
  }

  return input.senderName
}
