// 專案名稱：Multi-Channel Support MVP
// 檔案路径：/tests/global-pinia-setup.ts
// Created by: Test Infrastructure Developer

// This file runs FIRST to set up Pinia before any other setup files
// This ensures Pinia is available when any store modules are imported

import { createPinia, setActivePinia } from 'pinia'

console.log('🍍 GLOBAL PINIA SETUP - Running before all other setup files')

// Create Pinia instance at the very beginning
const globalPinia = createPinia()
setActivePinia(globalPinia)

console.log('🍍 Global Pinia created and set as active')

// Export the instance for use in other setup files
export { globalPinia }