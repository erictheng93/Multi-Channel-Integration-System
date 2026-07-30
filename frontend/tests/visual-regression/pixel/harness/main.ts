/**
 * ============================================================================
 * Pixel VRT — harness entry
 * ============================================================================
 *
 * A second, test-only Vite entry that mounts real components in isolation.
 *
 * What it deliberately DOES do:
 *   - load the same three global stylesheets `src/main.ts` loads, in the same
 *     order, so the components see the real cascade
 *   - install Pinia (several covered components read stores during setup)
 *   - install a throwaway in-memory router (`useAuth()` calls `useRouter()`)
 *   - seed a fake signed-in agent directly into store state
 *
 * What it deliberately does NOT do:
 *   - call `authStore.initializeSession()` / `login()` — no credentials, and no
 *     request ever leaves the page for the production Worker
 *   - connect the WebSocket store, register the service worker, run
 *     `initializeSecurity()` or the preload service
 *   - reuse `src/router` (importing it would pull in every view, and with it
 *     route guards that redirect to /login)
 *
 * It also does NOT replicate the inline critical CSS in `index.html`. That is
 * intentional: that block hand-rolls a `box-sizing` / margin reset which would
 * mask changes to Tailwind's own preflight — and preflight is one of the things
 * a Tailwind major upgrade rewrites. Letting preflight stand alone here is what
 * makes those changes visible.
 *
 * ---------------------------------------------------------------------------
 * WHY THE COMPONENT TREE IS LOADED WITH `await import(...)`
 * ---------------------------------------------------------------------------
 * `src/services/qrPreloadService.ts` constructs a module-scope singleton whose
 * class fields call `useQRCodeStore()`. It is reachable from `TeamCard.vue`, so
 * a static `import Harness from './Harness.vue'` would evaluate it during the
 * import phase — i.e. before any statement in this file runs — and blow up with
 * "getActivePinia() was called but there was no active Pinia".
 *
 * The real app gets away with it only because its own import graph happens to
 * reach `app.use(pinia)` first. Since we may not modify that service, the
 * harness sets the active Pinia instance up front and defers loading the
 * component graph until afterwards. Determinism shims are installed in the same
 * window, which is also exactly what `SkeletonLoader` needs.
 * ============================================================================
 */

import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

// Real global styles, same order as src/main.ts.
import '@/styles/variables.css'
import '@/style.css'
import '@/styles/conversation-background.css'

// Harness chrome + determinism overrides. Must be last in the cascade.
import './harness.css'

import { installDeterminism, resetRandom } from './determinism'

// Before anything renders: seeded PRNG + frozen clock.
installDeterminism()
resetRandom()

// Before any component module is evaluated: an active Pinia.
const pinia = createPinia()
setActivePinia(pinia)

// Minimal router so `useRouter()` resolves. No real routes, no navigation.
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:pathMatch(.*)*', name: 'vrt-noop', component: { render: () => null } }],
})

const [{ default: Harness }, { seedStores }] = await Promise.all([
  import('./Harness.vue'),
  import('./mocks/stores'),
])

seedStores(pinia)

// Rewind the PRNG so the render pass always consumes the same sequence,
// regardless of anything the imports above may have drawn from it.
resetRandom()

const app = createApp(Harness)
app.use(pinia)
app.use(router)
app.mount('#harness')

// Signal for the spec: the app finished its first mount. Cheaper and far more
// reliable than sleeping.
document.documentElement.setAttribute('data-vrt-ready', 'true')
