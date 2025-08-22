// 模態框 Composable
import { ref, computed } from 'vue'
import type { Component } from 'vue'

export interface ModalOptions {
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closable?: boolean
  persistent?: boolean
  backdrop?: boolean
}

export interface Modal extends ModalOptions {
  id: string
  component?: Component
  props?: Record<string, unknown>
  isOpen: boolean
}

export function useModal() {
  const modals = ref<Modal[]>([])

  const open = (component: Component, props: Record<string, unknown> = {}, options: ModalOptions = {}) => {
    const modal: Modal = {
      id: `modal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      component,
      props,
      isOpen: true,
      size: 'md',
      closable: true,
      persistent: false,
      backdrop: true,
      ...options
    }

    modals.value.push(modal)
    return modal.id
  }

  const close = (id: string) => {
    const modal = modals.value.find(m => m.id === id)
    if (modal) {
      modal.isOpen = false
      // 延遲移除以允許動畫完成
      setTimeout(() => {
        const index = modals.value.findIndex(m => m.id === id)
        if (index > -1) {
          modals.value.splice(index, 1)
        }
      }, 300)
    }
  }

  const closeAll = () => {
    modals.value.forEach(modal => {
      modal.isOpen = false
    })
    setTimeout(() => {
      modals.value = []
    }, 300)
  }

  const getModal = (id: string) => {
    return modals.value.find(m => m.id === id)
  }

  const isOpen = (id: string) => {
    const modal = getModal(id)
    return modal?.isOpen || false
  }

  const hasOpenModals = computed(() => {
    return modals.value.some(m => m.isOpen)
  })

  const topModal = computed(() => {
    const openModals = modals.value.filter(m => m.isOpen)
    return openModals[openModals.length - 1] || null
  })

  return {
    modals,
    hasOpenModals,
    topModal,
    open,
    close,
    closeAll,
    getModal,
    isOpen
  }
}