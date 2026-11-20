import type { InjectionKey } from 'vue'

/** Provided by Dropdown; items call it after activation. Already honours Dropdown's `closeOnClick`. */
export const DROPDOWN_CLOSE_KEY: InjectionKey<() => void> = Symbol('dropdownClose')
