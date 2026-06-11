type TrustedHtmlPolicy = {
  createHTML: (_html: string) => unknown
}

type TrustedTypesGlobal = {
  createPolicy: (_name: string, _rules: { createHTML: (_html: string) => string }) => TrustedHtmlPolicy
}

let defaultPolicy: TrustedHtmlPolicy | null = null

function getTrustedTypes(): TrustedTypesGlobal | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }
  return (window as typeof globalThis & { trustedTypes?: TrustedTypesGlobal }).trustedTypes
}

function getDefaultPolicy(): TrustedHtmlPolicy | null {
  const trustedTypes = getTrustedTypes()
  if (!trustedTypes) {
    return null
  }

  if (!defaultPolicy) {
    defaultPolicy = trustedTypes.createPolicy('default', {
      createHTML: html => html
    })
  }

  return defaultPolicy
}

export function setTrustedInnerHTML(element: Element, html: string): void {
  const trustedHtml = getDefaultPolicy()?.createHTML(html) ?? html
  element.innerHTML = trustedHtml as string
}
