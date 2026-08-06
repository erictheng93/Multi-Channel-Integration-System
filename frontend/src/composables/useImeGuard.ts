/**
 * IME Composition Guard Composable
 *
 * 中日韓輸入法（注音、拼音、日文等）在組字階段按下的按鍵屬於輸入法，
 * 不是給元件的快捷鍵。最常見的災情是「按 Enter 確認選字」被當成「送出」，
 * 使用者只打了半句話就被送出去。
 *
 * 兩種瀏覽器行為都要擋：
 * - Chrome / Edge / Firefox：確認選字的 keydown 帶 isComposing = true
 *   （舊版瀏覽器不填 isComposing，只留 keyCode 229）
 * - Safari：先送 compositionend、再送 isComposing = false 的 keydown，
 *   偽裝成一般按鍵；只能用「剛結束組字」的時間戳補上這個空窗
 *
 * @module composables/useImeGuard
 * @example
 * ```typescript
 * const ime = useImeGuard()
 *
 * const handleKeydown = (event: KeyboardEvent) => {
 *   if (ime.isImeKey(event)) return
 *   // ...元件自己的按鍵邏輯
 * }
 * ```
 * ```html
 * <input @keydown="handleKeydown" @compositionend="ime.onCompositionEnd">
 * ```
 */

/**
 * compositionend 之後的保護空窗（毫秒）。
 * 人類不可能在確認選字後這麼短的時間內又刻意按下送出鍵。
 * ponytail: 固定值；若有使用者反映「選完字馬上按 Enter 送不出去」再改成可調
 */
const COMPOSITION_END_GRACE_MS = 60

export interface ImeGuard {
  /** 綁到輸入元素的 @compositionend，記錄組字結束時間（Safari 用） */
  onCompositionEnd: () => void
  /** 這顆按鍵是否屬於輸入法；true 代表元件應該直接放行、不做任何事 */
  isImeKey: (_event: KeyboardEvent) => boolean
}

/**
 * 建立一組輸入法守門函式。每個輸入元素各自呼叫一次（狀態不共用）。
 */
export function useImeGuard(): ImeGuard {
  let lastCompositionEnd = 0

  return {
    onCompositionEnd: () => {
      lastCompositionEnd = Date.now()
    },
    isImeKey: (event: KeyboardEvent): boolean =>
      event.isComposing ||
      event.keyCode === 229 ||
      Date.now() - lastCompositionEnd < COMPOSITION_END_GRACE_MS,
  }
}
