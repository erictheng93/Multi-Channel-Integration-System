// 專案名稱：Multi-Channel Support MVP
// 檔案路径：/tests/helpers/piniaStoreMocker.ts
// Created by: Test Infrastructure Developer

import { vi } from 'vitest'
import { createPinia, setActivePinia, defineStore as originalDefineStore } from 'pinia'

// Store the original defineStore function
let originalDefine: typeof originalDefineStore

// Storage for deferred store definitions
const deferredStores = new Map()

/**
 * Mock defineStore to defer store creation until Pinia is ready
 * This solves the timing issue where stores are defined before Pinia is set up
 */
export function mockDefineStoreForTiming() {
  // Create and set up Pinia immediately
  console.log('🍍 Creating Pinia in store mocker')
  const pinia = createPinia()
  setActivePinia(pinia)
  
  // Mock defineStore to handle timing issues
  vi.mock('pinia', async () => {
    const actual = await vi.importActual('pinia')
    
    return {
      ...actual,
      defineStore: vi.fn((id: string, setup: any) => {
        console.log(`🏪 Defining store: ${id}`)
        
        // If Pinia isn't ready, defer the store creation
        try {
          return originalDefineStore(id, setup)
        } catch (error) {
          console.log(`🏪 Deferring store ${id} due to timing issue`)
          // Store the definition for later
          deferredStores.set(id, { id, setup })
          
          // Return a proxy function that will create the store when called
          return () => {
            console.log(`🏪 Creating deferred store: ${id}`)
            // Ensure Pinia is active
            if (!pinia._s || !pinia._s.size) {
              setActivePinia(pinia)
            }
            return originalDefineStore(id, setup)()
          }
        }
      })
    }
  })
  
  return pinia
}

/**
 * Create all deferred stores after Pinia is properly set up
 */
export function createDeferredStores() {
  for (const [id, { setup }] of deferredStores.entries()) {
    console.log(`🏪 Creating deferred store: ${id}`)
    originalDefineStore(id, setup)
  }
  deferredStores.clear()
}

/**
 * Reset the store mocker
 */
export function resetStoreMocker() {
  deferredStores.clear()
}