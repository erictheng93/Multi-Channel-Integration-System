# OLD PATH PATTERNS - COMPREHENSIVE VISUAL ANALYSIS

## Executive Summary

**Total Files Affected**: 16 files
**Total Old Path Occurrences**: 50+ instances
**Impact Level**: MEDIUM (Tests only, no production code affected)
**Migration Complexity**: LOW-MEDIUM (Find & replace with validation)

---

## 1. OVERVIEW DIAGRAM - THE PROBLEM

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     MULTI-CHANNEL INTEGRATION SYSTEM                     │
│                           PATH MIGRATION STATUS                          │
└─────────────────────────────────────────────────────────────────────────┘

                              PROJECT ROOT
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                   src/         tests/       frontend/
                    │              │              │
              ┌─────┴─────┐        │              │
              │           │        │              │
          modules/      types/     │              │
              │           │        │              │
        ┌─────┴─────┐    │        │              │
        │           │    │        │              │
    session/   realtime/ │        │              │
        │           │    │        │              │
        │           │    │        │              │
        └───────────┴────┴────────┘              │
                   │                              │
                   │                              │
      ┌────────────┴──────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│                        PATH PROBLEMS                             │
│                                                                  │
│  OLD PATHS (Relative):                                          │
│  ❌ ../../../../src/modules/session/types/session-types         │
│  ❌ ../../../../src/modules/realtime/handlers/event-handler     │
│  ❌ ../../../../src/types                                       │
│  ❌ ../../../../../src/utils/auth                               │
│                                                                  │
│  NEW PATHS (Aliases):                                           │
│  ✅ @session/types/session-types                                │
│  ✅ @real-time/handlers/event-handler                           │
│  ✅ @/types                                                     │
│  ✅ @/utils/auth                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. CATEGORY BREAKDOWN

### Category 1: Session Module Test Files (5 files)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CATEGORY 1: SESSION MODULE TEST FILES                                    │
│ Pattern: ../../../../src/modules/session/* or ../../../../../src/*       │
│ Severity: MEDIUM                                                         │
└──────────────────────────────────────────────────────────────────────────┘

📁 tests/modules/session/
   │
   ├── 📁 helpers/
   │   ├── 📄 session-test-helpers.ts
   │   │   └── Line 13: ../../../../src/modules/session/types/session-types
   │   │
   │   ├── 📄 mock-data.ts
   │   │   └── Line 9: ../../../../src/modules/session/types/session-types
   │   │
   │   └── 📄 test-database.ts
   │       ├── Line 6: ../../../../src/db/schema
   │       └── Line 11: ../../../../src/modules/session/types/session-types
   │
   └── 📁 unit/
       ├── 📁 handlers/
       │   ├── 📄 session-boundary.test.ts
       │   │   └── Line 18: ../../../../../src/modules/session/types/session-types
       │   │
       │   └── 📄 session-main.test.ts
       │       ├── Line 34: ../../../../../src/modules/session/services/session-service
       │       ├── Line 38: ../../../../../src/utils/auth
       │       └── Line 43: ../../../../../src/modules/session/middleware/index
       │
       ├── 📁 middleware/
       │   ├── 📄 session-auth.test.ts
       │   │   ├── Line 15: ../../../../../src/modules/session/middleware/session-auth
       │   │   └── Line 23: ../../../../../src/utils/auth
       │   │
       │   ├── 📄 session-validation.test.ts
       │   │   └── Line 20: ../../../../../src/modules/session/middleware/session-validation
       │   │
       │   └── 📄 middleware-integration.test.ts
       │       ├── Line 11: ../../../../../src/modules/session/middleware/session-auth
       │       ├── Line 17: ../../../../../src/modules/session/middleware/session-validation
       │       └── Line 25: ../../../../../src/utils/auth
       │
       └── 📁 services/
           ├── 📄 session-service.test.ts
           │   └── Line 32: ../../../../../src/modules/session/types/session-types
           │
           └── 📄 boundary-detection.test.ts
               └── Line 16: ../../../../../src/modules/session/types/session-types

┌──────────────────────────────────────────────────────────────────────────┐
│ STATISTICS                                                                │
├──────────────────────────────────────────────────────────────────────────┤
│ Total Files: 11                                                          │
│ Total Lines: 18 instances                                                │
│ Depth Level: 4-5 levels (../../../../ or ../../../../../)               │
│ Module Scope: session, utils                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### Category 2: Realtime Module Test Files (2 files)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CATEGORY 2: REALTIME MODULE TEST FILES                                   │
│ Pattern: ../../../../src/modules/realtime/*                              │
│ Severity: HIGH (Multiple instances per file)                             │
└──────────────────────────────────────────────────────────────────────────┘

📁 tests/unit/modules/realtime/
   │
   ├── 📄 realtime-main.test.ts
   │   ├── Line 9:   // Comment: ../../../../src/modules/realtime/handlers/sse-handler
   │   ├── Line 11:  vi.mock('../../../../src/modules/realtime/handlers/event-handler')
   │   ├── Line 20:  vi.mock('../../../../src/utils/api-response')
   │   ├── Line 35:  vi.mock('../../../../src/utils/auth')
   │   ├── Line 87:  import('../../../../src/modules/realtime/handlers/event-handler')
   │   ├── Line 92:  import('../../../../src/modules/realtime/handlers/event-handler')
   │   ├── Line 106: import('../../../../src/modules/realtime/handlers/event-handler')
   │   ├── Line 120: import('../../../../src/modules/realtime/handlers/event-handler')
   │   ├── Line 146: import('../../../../src/modules/realtime/handlers/event-handler')
   │   ├── Line 263: import('../../../../src/modules/realtime/handlers/realtime-main')
   │   ├── Line 277: import('../../../../src/modules/realtime/handlers/realtime-main')
   │   ├── Line 288: import('../../../../src/modules/realtime/handlers/realtime-main')
   │   ├── Line 299: import('../../../../src/modules/realtime/handlers/realtime-main')
   │   └── Line 319: import('../../../../src/modules/realtime/handlers/realtime-main')
   │
   │   📊 Total: 14 instances (1 file)
   │
   └── 📄 performance-monitor.test.ts
       ├── Line 8:   vi.mock('../../../../src/modules/realtime/handlers/sse-handler')
       ├── Line 20:  vi.mock('../../../../src/modules/realtime/handlers/event-handler')
       ├── Line 40:  vi.mock('../../../../src/modules/realtime/services/realtime-manager')
       ├── Line 85:  import('../../../../src/modules/realtime/handlers/sse-handler')
       ├── Line 86:  import('../../../../src/modules/realtime/handlers/event-handler')
       ├── Line 87:  import('../../../../src/modules/realtime/services/realtime-manager')
       ├── Line 163: import('../../../../src/modules/realtime/services/realtime-manager')
       ├── Line 191: import('../../../../src/modules/realtime/handlers/event-handler')
       ├── Line 213: import('../../../../src/modules/realtime/services/realtime-manager')
       └── Line 444: import('../../../../src/modules/realtime/handlers/sse-handler')

       📊 Total: 10 instances (1 file)

┌──────────────────────────────────────────────────────────────────────────┐
│ STATISTICS                                                                │
├──────────────────────────────────────────────────────────────────────────┤
│ Total Files: 2                                                           │
│ Total Lines: 24 instances                                                │
│ Depth Level: 4 levels (../../../../)                                    │
│ Module Scope: realtime, utils                                           │
│ High Concentration: Multiple imports per file due to dynamic imports    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### Category 3: File Management Test Files (1 file)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CATEGORY 3: FILE MANAGEMENT TEST FILES                                   │
│ Pattern: ../../../../src/types                                           │
│ Severity: LOW                                                            │
└──────────────────────────────────────────────────────────────────────────┘

📁 tests/integration/modules/file-management/
   │
   └── 📄 file-upload-flow.test.ts
       └── Line 10: import type { Bindings } from '../../../../src/types';

┌──────────────────────────────────────────────────────────────────────────┐
│ STATISTICS                                                                │
├──────────────────────────────────────────────────────────────────────────┤
│ Total Files: 1                                                           │
│ Total Lines: 1 instance                                                  │
│ Depth Level: 4 levels (../../../../)                                    │
│ Module Scope: types (core)                                              │
│ Note: Uses correct @modules/* alias for other imports                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### Category 4: Module Template Generator (1 file)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CATEGORY 4: MODULE TEMPLATE GENERATOR                                    │
│ Pattern: Template placeholders with old paths                            │
│ Severity: CRITICAL (Affects future module generation)                    │
└──────────────────────────────────────────────────────────────────────────┘

📁 src/core/
   │
   └── 📄 module-templates.ts
       ├── Line 373: '../../../../src/modules/{{MODULE_NAME}}'
       └── Line 374: '../../../../src/core/module-architecture'

       📋 Context: Inside testFiles template content

       Template Code:
       ┌────────────────────────────────────────────────────────────────┐
       │ content: `// {{MODULE_NAME}} 模組測試                          │
       │ import { describe, it, expect } from 'vitest';                │
       │ import { {{MODULE_NAME}}ModuleInstance }                      │
       │   from '../../../../src/modules/{{MODULE_NAME}}';             │ ❌
       │ import { globalModuleLoader }                                 │
       │   from '../../../../src/core/module-architecture';            │ ❌
       │ ...                                                           │
       └────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ STATISTICS                                                                │
├──────────────────────────────────────────────────────────────────────────┤
│ Total Files: 1                                                           │
│ Total Lines: 2 instances in template                                     │
│ Impact: CRITICAL - Will propagate old paths to all new modules           │
│ Priority: HIGHEST - Must fix before creating new modules                 │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. BEFORE/AFTER COMPARISON

### Category 1: Session Module

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ BEFORE: session-test-helpers.ts (Line 13)                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

import type {
  ConversationSession,
  CreateSessionData,
  UpdateSessionData
} from '../../../../src/modules/session/types/session-types';
      ├─────────────────────────────────────┘
      │
      │ 🔴 PROBLEMS:
      │ • Hard to read and maintain
      │ • Brittle: breaks when moving files
      │ • 4 directory levels to traverse
      │ • No IDE autocomplete support
      │ • Verbose and error-prone

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ AFTER: session-test-helpers.ts (Line 13)                                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

import type {
  ConversationSession,
  CreateSessionData,
  UpdateSessionData
} from '@session/types/session-types';
      ├─────────────────────────┘
      │
      │ 🟢 BENEFITS:
      │ • Clear module identity: @session
      │ • Refactor-safe: path mapping in tsconfig.json
      │ • Simple: 1 alias token
      │ • IDE autocomplete enabled
      │ • Matches project standards

┌──────────────────────────────────────────────────────────────────────────┐
│ PATH MAPPING (tsconfig.json)                                             │
├──────────────────────────────────────────────────────────────────────────┤
│ "@session/*": ["modules/session/*"]                                      │
│                                                                          │
│ Resolves:                                                                │
│ @session/types/session-types → src/modules/session/types/session-types  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Category 2: Realtime Module

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ BEFORE: realtime-main.test.ts (Lines 11, 87, 263)                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

// Mock
vi.mock('../../../../src/modules/realtime/handlers/event-handler', () => ({...}));

// Dynamic import (multiple times)
const { eventHandler } = await import('../../../../src/modules/realtime/handlers/event-handler');
const { RealtimeConfigManager } = await import('../../../../src/modules/realtime/handlers/realtime-main');

🔴 PROBLEMS:
• 14 instances of the same long path in ONE file
• Copy-paste errors likely
• File structure changes break all imports
• Difficult to find/replace safely

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ AFTER: realtime-main.test.ts (Lines 11, 87, 263)                        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

// Mock
vi.mock('@real-time/handlers/event-handler', () => ({...}));

// Dynamic import (multiple times)
const { eventHandler } = await import('@real-time/handlers/event-handler');
const { RealtimeConfigManager } = await import('@real-time/handlers/realtime-main');

🟢 BENEFITS:
• Consistent short paths across all 14 instances
• Clear module identification
• Easy to refactor entire module
• Reduced visual noise
• Easier code review

┌──────────────────────────────────────────────────────────────────────────┐
│ PATH MAPPING (tsconfig.json)                                             │
├──────────────────────────────────────────────────────────────────────────┤
│ "@real-time/*": ["modules/real-time/*"]                                  │
│                                                                          │
│ ⚠️ NOTE: Alias uses "real-time" (with hyphen)                           │
│          Module folder is "realtime" (no hyphen)                        │
│          This is intentional for kebab-case consistency                 │
└──────────────────────────────────────────────────────────────────────────┘
```

### Category 3: File Management + Core Types

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ BEFORE: file-upload-flow.test.ts (Line 10)                              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

import type { Bindings } from '../../../../src/types';
                              ├──────────────────┘
                              │
                              │ Mixed Style in Same File:
                              │
import { FileService } from '@modules/file-management/services/file-service';  ✅
import { ERROR_CODES } from '@modules/file-management/constants/error-codes';  ✅
import type { Bindings } from '../../../../src/types';                         ❌

🔴 PROBLEM: Inconsistent - uses alias for modules but relative for types

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ AFTER: file-upload-flow.test.ts (Line 10)                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

import type { Bindings } from '@/types';
                              ├───────┘
                              │
                              │ Consistent Style:
                              │
import { FileService } from '@modules/file-management/services/file-service';  ✅
import { ERROR_CODES } from '@modules/file-management/constants/error-codes';  ✅
import type { Bindings } from '@/types';                                       ✅

🟢 BENEFIT: All imports use path aliases consistently

┌──────────────────────────────────────────────────────────────────────────┐
│ PATH MAPPING (tsconfig.json)                                             │
├──────────────────────────────────────────────────────────────────────────┤
│ "@/*": ["./*"]                                                           │
│                                                                          │
│ Resolves:                                                                │
│ @/types → src/types                                                      │
│ @/utils → src/utils                                                      │
│ @/db → src/db                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

### Category 4: Module Template Generator

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ BEFORE: module-templates.ts (Lines 373-374)                             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

testFiles: [
  {
    path: 'tests/unit/modules/{{MODULE_NAME}}/{{MODULE_NAME}}.test.ts',
    type: 'typescript',
    content: `// {{MODULE_NAME}} 模組測試
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { {{MODULE_NAME}}ModuleInstance } from '../../../../src/modules/{{MODULE_NAME}}';
import { globalModuleLoader } from '../../../../src/core/module-architecture';
                                   └──────────────────────────────────────┘

🔴 CRITICAL PROBLEM:
• Every new module generated will have old path style
• Spreads technical debt automatically
• Developer must manually fix after generation

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ AFTER: module-templates.ts (Lines 373-374)                              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

testFiles: [
  {
    path: 'tests/unit/modules/{{MODULE_NAME}}/{{MODULE_NAME}}.test.ts',
    type: 'typescript',
    content: `// {{MODULE_NAME}} 模組測試
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { {{MODULE_NAME}}ModuleInstance } from '@modules/{{MODULE_NAME}}';
import { globalModuleLoader } from '@/core/module-architecture';
                                   └──────────────────────────┘

🟢 BENEFITS:
• All new modules automatically use correct paths
• Maintains consistency across codebase
• Reduces onboarding friction
• Prevents technical debt propagation

┌──────────────────────────────────────────────────────────────────────────┐
│ PATH MAPPING FOR TEMPLATES                                               │
├──────────────────────────────────────────────────────────────────────────┤
│ "@modules/{{MODULE_NAME}}" → "modules/{{MODULE_NAME}}"                   │
│ "@/core/*"                 → "core/*"                                    │
│                                                                          │
│ Example for "analytics" module:                                          │
│ @modules/analytics → src/modules/analytics                               │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. IMPACT ANALYSIS

### Affected File Types
```
┌──────────────────────────────────────────────────────────────────────────┐
│ FILE TYPE DISTRIBUTION                                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ Test Helpers:     ████████░░ 40%  (4 files)                            │
│ Unit Tests:       ███████░░░ 35%  (5 files)                            │
│ Integration:      ██░░░░░░░ 10%  (1 file)                              │
│ Templates:        ██░░░░░░░ 10%  (1 file)                              │
│ Middleware Tests: ███░░░░░░ 15%  (3 files)                             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Risk Assessment
```
┌──────────────────────────────────────────────────────────────────────────┐
│ RISK MATRIX                                                               │
├─────────────────────────┬────────────┬──────────────┬───────────────────┤
│ Category                │ Files      │ Risk Level   │ Priority          │
├─────────────────────────┼────────────┼──────────────┼───────────────────┤
│ Session Tests           │ 11         │ MEDIUM       │ P2 - Should Fix   │
│ Realtime Tests          │ 2          │ HIGH         │ P1 - Must Fix     │
│ File Mgmt Tests         │ 1          │ LOW          │ P3 - Nice to Have │
│ Module Templates        │ 1          │ CRITICAL     │ P0 - Fix First    │
├─────────────────────────┼────────────┼──────────────┼───────────────────┤
│ TOTAL                   │ 15         │ MEDIUM       │ P1 - High         │
└─────────────────────────┴────────────┴──────────────┴───────────────────┘

Risk Factors:
• Template generator: ⚠️ CRITICAL - Affects all future modules
• High concentration files (realtime-main.test.ts): ⚠️ HIGH - 14 instances
• Test-only scope: ✅ LOW - No production code affected
• Clear patterns: ✅ LOW - Easy to identify and replace
```

### Migration Complexity
```
┌──────────────────────────────────────────────────────────────────────────┐
│ COMPLEXITY ANALYSIS                                                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ Pattern Consistency:    ████████░░ 80% - Highly predictable            │
│ Automation Feasibility: █████████░ 90% - Easy to script                │
│ Test Coverage:          ██████████ 100% - All changes verifiable       │
│ Breaking Change Risk:   ██░░░░░░░░ 20% - Low (tests only)             │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ OVERALL COMPLEXITY: LOW-MEDIUM                                           │
└──────────────────────────────────────────────────────────────────────────┘

Complexity Factors:
✅ Low:
  • Clear search/replace patterns
  • Test-only changes (no production impact)
  • All paths follow similar structure
  • TypeScript will catch errors
  • Existing path aliases in tsconfig.json

⚠️ Medium:
  • Multiple file locations to update
  • Need to verify each import manually
  • Some files have mixed patterns (relative + alias)
  • Template file requires careful handling
```

---

## 5. MIGRATION PATH REFERENCE

### Available Path Aliases (from tsconfig.json)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ COMPLETE PATH ALIAS MAPPING                                              │
├────────────────────────────────┬─────────────────────────────────────────┤
│ Alias Pattern                  │ Resolves To                             │
├────────────────────────────────┼─────────────────────────────────────────┤
│ @/*                            │ src/*                                   │
│ @modules/*                     │ src/modules/*                           │
│ @shared/*                      │ src/shared/*                            │
│ @infrastructure/*              │ src/infrastructure/*                    │
│ @auth/*                        │ src/modules/auth/*                      │
│ @conversations/*               │ src/modules/conversations/*             │
│ @teams/*                       │ src/modules/teams/*                     │
│ @customer/*                    │ src/modules/customer/*                  │
│ @integrations/*                │ src/modules/integrations/*              │
│ @real-time/*                   │ src/modules/real-time/*                 │
│ @messaging/*                   │ src/modules/messaging/*                 │
│ @analytics/*                   │ src/modules/analytics/*                 │
│ @file-management/*             │ src/modules/file-management/*           │
│ @activities/*                  │ src/modules/activities/*                │
│ @notifications/*               │ src/modules/notifications/*             │
│ @qrcode/*                      │ src/modules/qrcode/*                    │
│ @reports/*                     │ src/modules/reports/*                   │
│ @session/*                     │ src/modules/session/*                   │
└────────────────────────────────┴─────────────────────────────────────────┘
```

### Migration Rules

```
┌──────────────────────────────────────────────────────────────────────────┐
│ PATH CONVERSION RULES                                                     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ Rule 1: Module-Specific Aliases (PREFERRED)                             │
│ ───────────────────────────────────────────────                         │
│ FROM: ../../../../src/modules/session/types/session-types               │
│ TO:   @session/types/session-types                                      │
│                                                                          │
│ FROM: ../../../../src/modules/realtime/handlers/event-handler           │
│ TO:   @real-time/handlers/event-handler                                 │
│                                                                          │
│ ─────────────────────────────────────────────────────────────────────── │
│                                                                          │
│ Rule 2: Core Utilities and Types                                        │
│ ─────────────────────────────────────                                   │
│ FROM: ../../../../src/types                                             │
│ TO:   @/types                                                           │
│                                                                          │
│ FROM: ../../../../../src/utils/auth                                     │
│ TO:   @/utils/auth                                                      │
│                                                                          │
│ FROM: ../../../../src/db/schema                                         │
│ TO:   @/db/schema                                                       │
│                                                                          │
│ FROM: ../../../../src/core/module-architecture                          │
│ TO:   @/core/module-architecture                                        │
│                                                                          │
│ ─────────────────────────────────────────────────────────────────────── │
│                                                                          │
│ Rule 3: Generic Modules Alias (ALTERNATIVE)                             │
│ ────────────────────────────────────────────                            │
│ FROM: ../../../../src/modules/session/types/session-types               │
│ TO:   @modules/session/types/session-types                              │
│                                                                          │
│ (Less preferred than module-specific, but acceptable)                   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Special Cases

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SPECIAL CASE: REALTIME MODULE NAMING MISMATCH                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ Module Folder Name:    realtime/ (no hyphen)                            │
│ Path Alias:            @real-time/* (with hyphen)                       │
│                                                                          │
│ Mapping in tsconfig.json:                                                │
│   "@real-time/*": ["modules/real-time/*"]                                │
│                                                                          │
│ Actual Folder Structure:                                                 │
│   src/modules/realtime/ (not real-time/)                                 │
│                                                                          │
│ ⚠️ RESOLUTION REQUIRED:                                                  │
│ Option A: Update tsconfig.json alias to match folder                    │
│   "@realtime/*": ["modules/realtime/*"]                                  │
│                                                                          │
│ Option B: Rename folder to match alias                                  │
│   mv src/modules/realtime src/modules/real-time                         │
│                                                                          │
│ RECOMMENDATION: Option A (less breaking)                                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 6. FILE-BY-FILE MIGRATION CHECKLIST

### Priority 0: Module Templates (FIX FIRST)

```
☐ src/core/module-templates.ts
  ├─ Line 373: '../../../../src/modules/{{MODULE_NAME}}'
  │             → '@modules/{{MODULE_NAME}}'
  │
  └─ Line 374: '../../../../src/core/module-architecture'
                → '@/core/module-architecture'
```

### Priority 1: High Concentration Files

```
☐ tests/unit/modules/realtime/realtime-main.test.ts (14 instances)
  ├─ Line 11:  vi.mock('../../../../src/modules/realtime/handlers/event-handler')
  │             → vi.mock('@real-time/handlers/event-handler')
  │
  ├─ Line 20:  vi.mock('../../../../src/utils/api-response')
  │             → vi.mock('@/utils/api-response')
  │
  ├─ Line 35:  vi.mock('../../../../src/utils/auth')
  │             → vi.mock('@/utils/auth')
  │
  ├─ Lines 87, 92, 106, 120, 146:
  │             await import('../../../../src/modules/realtime/handlers/event-handler')
  │             → await import('@real-time/handlers/event-handler')
  │
  └─ Lines 263, 277, 288, 299, 319:
                await import('../../../../src/modules/realtime/handlers/realtime-main')
                → await import('@real-time/handlers/realtime-main')

☐ tests/unit/modules/realtime/performance-monitor.test.ts (10 instances)
  ├─ Line 8:   vi.mock('../../../../src/modules/realtime/handlers/sse-handler')
  │             → vi.mock('@real-time/handlers/sse-handler')
  │
  ├─ Line 20:  vi.mock('../../../../src/modules/realtime/handlers/event-handler')
  │             → vi.mock('@real-time/handlers/event-handler')
  │
  ├─ Line 40:  vi.mock('../../../../src/modules/realtime/services/realtime-manager')
  │             → vi.mock('@real-time/services/realtime-manager')
  │
  └─ Lines 85, 86, 87, 163, 191, 213, 444: (similar pattern)
```

### Priority 2: Session Module Files

```
☐ tests/modules/session/helpers/session-test-helpers.ts
  └─ Line 13: '../../../../src/modules/session/types/session-types'
               → '@session/types/session-types'

☐ tests/modules/session/helpers/mock-data.ts
  └─ Line 9: '../../../../src/modules/session/types/session-types'
              → '@session/types/session-types'

☐ tests/modules/session/helpers/test-database.ts
  ├─ Line 6:  '../../../../src/db/schema'
  │            → '@/db/schema'
  │
  └─ Line 11: '../../../../src/modules/session/types/session-types'
               → '@session/types/session-types'

☐ tests/modules/session/unit/handlers/session-boundary.test.ts
  └─ Line 18: '../../../../../src/modules/session/types/session-types'
               → '@session/types/session-types'

☐ tests/modules/session/unit/handlers/session-main.test.ts
  ├─ Line 34: '../../../../../src/modules/session/services/session-service'
  │            → '@session/services/session-service'
  │
  ├─ Line 38: '../../../../../src/utils/auth'
  │            → '@/utils/auth'
  │
  └─ Line 43: '../../../../../src/modules/session/middleware/index'
               → '@session/middleware/index'

☐ tests/modules/session/unit/middleware/session-auth.test.ts
  ├─ Line 15: '../../../../../src/modules/session/middleware/session-auth'
  │            → '@session/middleware/session-auth'
  │
  └─ Line 23: '../../../../../src/utils/auth'
               → '@/utils/auth'

☐ tests/modules/session/unit/middleware/session-validation.test.ts
  └─ Line 20: '../../../../../src/modules/session/middleware/session-validation'
               → '@session/middleware/session-validation'

☐ tests/modules/session/unit/middleware/middleware-integration.test.ts
  ├─ Line 11: '../../../../../src/modules/session/middleware/session-auth'
  │            → '@session/middleware/session-auth'
  │
  ├─ Line 17: '../../../../../src/modules/session/middleware/session-validation'
  │            → '@session/middleware/session-validation'
  │
  └─ Line 25: '../../../../../src/utils/auth'
               → '@/utils/auth'

☐ tests/modules/session/unit/services/session-service.test.ts
  └─ Line 32: '../../../../../src/modules/session/types/session-types'
               → '@session/types/session-types'

☐ tests/modules/session/unit/services/boundary-detection.test.ts
  └─ Line 16: '../../../../../src/modules/session/types/session-types'
               → '@session/types/session-types'
```

### Priority 3: File Management

```
☐ tests/integration/modules/file-management/file-upload-flow.test.ts
  └─ Line 10: '../../../../src/types'
               → '@/types'
```

---

## 7. VERIFICATION STRATEGY

### Step 1: Static Analysis

```bash
# Search for all relative path patterns
grep -r "../../../../src" tests/ --include="*.ts"
grep -r "../../../../../src" tests/ --include="*.ts"

# Expected: 0 results after migration
```

### Step 2: TypeScript Compilation

```bash
# Verify TypeScript can resolve all imports
npm run type-check

# Expected: No import resolution errors
```

### Step 3: Test Execution

```bash
# Run all affected tests
npm run test -- tests/modules/session/
npm run test -- tests/unit/modules/realtime/
npm run test -- tests/integration/modules/file-management/

# Expected: All tests pass with same results as before
```

### Step 4: IDE Verification

```
Open each migrated file in VS Code:
✓ No red squiggly lines on imports
✓ Ctrl+Click on import path navigates to correct file
✓ Auto-complete works for path segments
✓ "Go to Definition" works correctly
```

---

## 8. AUTOMATION SCRIPT TEMPLATE

```bash
#!/bin/bash
# migrate-old-paths.sh - Automated path migration script

echo "🔧 Starting path migration..."

# Function to safely replace patterns in files
safe_replace() {
  local file="$1"
  local old_pattern="$2"
  local new_pattern="$3"

  # Create backup
  cp "$file" "$file.bak"

  # Perform replacement
  sed -i "s|$old_pattern|$new_pattern|g" "$file"

  echo "  ✓ Updated: $file"
}

# Priority 0: Module Templates
echo "📝 Priority 0: Module Templates"
safe_replace "src/core/module-templates.ts" \
  "../../../../src/modules/{{MODULE_NAME}}" \
  "@modules/{{MODULE_NAME}}"
safe_replace "src/core/module-templates.ts" \
  "../../../../src/core/module-architecture" \
  "@/core/module-architecture"

# Priority 1: Realtime Tests
echo "📝 Priority 1: Realtime Tests"
for file in tests/unit/modules/realtime/*.test.ts; do
  safe_replace "$file" \
    "../../../../src/modules/realtime/" \
    "@real-time/"
  safe_replace "$file" \
    "../../../../src/utils/" \
    "@/utils/"
done

# Priority 2: Session Tests
echo "📝 Priority 2: Session Tests"
for file in tests/modules/session/**/*.ts; do
  safe_replace "$file" \
    "../../../../src/modules/session/" \
    "@session/"
  safe_replace "$file" \
    "../../../../../src/modules/session/" \
    "@session/"
  safe_replace "$file" \
    "../../../../src/db/" \
    "@/db/"
  safe_replace "$file" \
    "../../../../../src/utils/" \
    "@/utils/"
done

# Priority 3: File Management
echo "📝 Priority 3: File Management"
safe_replace "tests/integration/modules/file-management/file-upload-flow.test.ts" \
  "../../../../src/types" \
  "@/types"

# Verification
echo "🔍 Running verification..."
npm run type-check

if [ $? -eq 0 ]; then
  echo "✅ Migration completed successfully!"
  echo "🧹 Cleaning up backups..."
  find tests/ -name "*.bak" -delete
  find src/ -name "*.bak" -delete
else
  echo "❌ Migration failed! Restoring backups..."
  find tests/ -name "*.bak" -exec sh -c 'mv "$1" "${1%.bak}"' _ {} \;
  find src/ -name "*.bak" -exec sh -c 'mv "$1" "${1%.bak}"' _ {} \;
fi
```

---

## 9. SUMMARY STATISTICS

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        MIGRATION OVERVIEW                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Total Files Affected:           16 files                               │
│  Total Path Instances:           50+ occurrences                        │
│                                                                          │
│  By Category:                                                            │
│    • Session Module:             18 instances (11 files)                │
│    • Realtime Module:            24 instances (2 files)                 │
│    • File Management:            1 instance (1 file)                    │
│    • Module Templates:           2 instances (1 file)                   │
│                                                                          │
│  Estimated Effort:               2-3 hours (with automation)            │
│                                                                          │
│  Risk Level:                     LOW (tests only, no production code)   │
│                                                                          │
│  Benefits:                                                               │
│    ✓ Improved maintainability                                           │
│    ✓ Better IDE support                                                 │
│    ✓ Consistent codebase style                                          │
│    ✓ Easier refactoring                                                 │
│    ✓ Prevents future technical debt (template fix)                     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 10. NEXT STEPS RECOMMENDATION

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        RECOMMENDED ACTION PLAN                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Phase 1: Preparation (15 min)                                          │
│  ├─ [1] Review this document                                            │
│  ├─ [2] Create feature branch: fix/migrate-old-path-patterns            │
│  ├─ [3] Run baseline tests to ensure all pass                           │
│  └─ [4] Commit baseline: "chore: baseline before path migration"        │
│                                                                          │
│  Phase 2: Critical Fix (30 min)                                         │
│  ├─ [5] Fix module template generator FIRST (src/core/module-templates) │
│  ├─ [6] Test template generation with sample module                     │
│  └─ [7] Commit: "fix: update module templates to use path aliases"      │
│                                                                          │
│  Phase 3: High Priority (45 min)                                        │
│  ├─ [8] Migrate realtime-main.test.ts (14 instances)                    │
│  ├─ [9] Migrate performance-monitor.test.ts (10 instances)              │
│  └─ [10] Commit: "refactor: migrate realtime tests to path aliases"     │
│                                                                          │
│  Phase 4: Session Module (60 min)                                       │
│  ├─ [11] Migrate all 11 session test files (18 instances)               │
│  ├─ [12] Run session module tests                                       │
│  └─ [13] Commit: "refactor: migrate session tests to path aliases"      │
│                                                                          │
│  Phase 5: Cleanup (15 min)                                              │
│  ├─ [14] Migrate file-management test (1 instance)                      │
│  ├─ [15] Final verification: npm run type-check && npm run test         │
│  ├─ [16] Commit: "refactor: complete path alias migration"              │
│  └─ [17] Create PR with this document as description                    │
│                                                                          │
│  Total Estimated Time: 2-3 hours                                        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## APPENDIX A: Complete File List

```
1.  src/core/module-templates.ts
2.  tests/modules/session/helpers/session-test-helpers.ts
3.  tests/modules/session/helpers/mock-data.ts
4.  tests/modules/session/helpers/test-database.ts
5.  tests/modules/session/unit/handlers/session-boundary.test.ts
6.  tests/modules/session/unit/handlers/session-main.test.ts
7.  tests/modules/session/unit/middleware/session-auth.test.ts
8.  tests/modules/session/unit/middleware/session-validation.test.ts
9.  tests/modules/session/unit/middleware/middleware-integration.test.ts
10. tests/modules/session/unit/services/session-service.test.ts
11. tests/modules/session/unit/services/boundary-detection.test.ts
12. tests/unit/modules/realtime/realtime-main.test.ts
13. tests/unit/modules/realtime/performance-monitor.test.ts
14. tests/integration/modules/file-management/file-upload-flow.test.ts
```

---

## APPENDIX B: Path Alias Reference Card

```
╔══════════════════════════════════════════════════════════════════════════╗
║                       QUICK REFERENCE CARD                                ║
║                  Path Aliases for Import Statements                       ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  Core/Utilities:                                                         ║
║  ├─ @/types           → src/types                                        ║
║  ├─ @/utils           → src/utils                                        ║
║  ├─ @/db              → src/db                                           ║
║  ├─ @/core            → src/core                                         ║
║  └─ @/middleware      → src/middleware                                   ║
║                                                                          ║
║  Modules (Specific):                                                     ║
║  ├─ @session/*        → src/modules/session/*                            ║
║  ├─ @real-time/*      → src/modules/realtime/* (note: hyphen in alias)  ║
║  ├─ @auth/*           → src/modules/auth/*                               ║
║  ├─ @teams/*          → src/modules/teams/*                              ║
║  ├─ @messaging/*      → src/modules/messaging/*                          ║
║  └─ @file-management/* → src/modules/file-management/*                   ║
║                                                                          ║
║  Modules (Generic):                                                      ║
║  └─ @modules/*        → src/modules/* (any module)                       ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

**Document Version**: 1.0
**Created**: 2025-10-20
**Author**: Claude Code Analysis
**Status**: Final - Ready for Review
