# Node.js → Bun API Migration Guide

**Project:** Multi-Channel CRM System  
**Purpose:** Migrate 50+ TypeScript scripts from `npx tsx` to `bun run`  
**Strategy:** Maintain dual compatibility (npm + Bun)

---

## Core API Comparison

### 1. Child Process (命令執行)

| Node.js API | Bun API | Usage |
|-------------|---------|-------|
| execSync | Bun.$ | Execute shell commands |
| spawnSync | Bun.spawn | Execute without shell |
| spawn (async) | Bun.spawn | Async execution |

**Example Pattern:**

```typescript
// Environment detection
const isUsingBun = typeof Bun !== 'undefined';

if (isUsingBun) {
  // Bun environment
  const result = await Bun.$`npm run build`;
  if (result.exitCode !== 0) throw new Error('Build failed');
} else {
  // Node.js environment
  const { execSync } = await import('child_process');
  execSync('npm run build', { stdio: 'inherit' });
}
```

### 2. Environment Variables

```typescript
// Recommended: Unified access pattern
const env = typeof Bun !== 'undefined' ? Bun.env : process.env;

const config = {
  backendUrl: env.BACKEND_URL,
  environment: env.ENVIRONMENT || 'development'
};
```

---

## Migration Patterns

### Pattern 1: Simple Command Execution

**Before (Node.js only):**
```typescript
import { execSync } from 'child_process';

execSync('npm run build', { stdio: 'inherit' });
```

**After (Bun compatible):**
```typescript
const isUsingBun = typeof Bun !== 'undefined';

if (isUsingBun) {
  await Bun.$`npm run build`;
} else {
  const { execSync } = await import('child_process');
  execSync('npm run build', { stdio: 'inherit' });
}
```

### Pattern 2: Capturing Output

**Before:**
```typescript
import { execSync } from 'child_process';

const output = execSync('git status', { encoding: 'utf-8' });
```

**After:**
```typescript
const isUsingBun = typeof Bun !== 'undefined';

let output: string;
if (isUsingBun) {
  const result = await Bun.$`git status`;
  output = result.stdout.toString();
} else {
  const { execSync } = await import('child_process');
  output = execSync('git status', { encoding: 'utf-8' });
}
```

### Pattern 3: Spawn Processes

**Before:**
```typescript
import { spawnSync } from 'child_process';

const result = spawnSync('npm', ['run', 'build'], {
  cwd: './frontend',
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});
```

**After:**
```typescript
const isUsingBun = typeof Bun !== 'undefined';

if (isUsingBun) {
  const proc = Bun.spawn(['npm', 'run', 'build'], {
    cwd: './frontend',
    stdout: 'inherit',
    stderr: 'inherit',
    env: { ...Bun.env, NODE_ENV: 'production' }
  });
  
  const exitCode = await proc.exited;
  if (exitCode !== 0) throw new Error('Build failed');
} else {
  const { spawnSync } = await import('child_process');
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: './frontend',
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  
  if (result.status !== 0) throw new Error('Build failed');
}
```

---

## Best Practices

### ✅ DO (Recommended)

1. **Maintain compatibility** - Use `typeof Bun !== 'undefined'`
2. **Prefer Bun APIs** - Use native APIs in Bun environment
3. **Test thoroughly** - Test both npm and Bun environments
4. **Clear comments** - Document compatibility code
5. **Error handling** - Provide same error handling for both

### ❌ DON'T (Avoid)

1. **Remove npm support** - Keep rollback capability
2. **Assume API parity** - Always detect environment
3. **Skip testing** - Both environments must be tested
4. **Hardcode paths** - Use relative paths or env vars
5. **Ignore errors** - Ensure complete error handling

---

## Migration Checklist

### Preparation
- [ ] Read this guide
- [ ] Backup original scripts (git commit)
- [ ] Verify Bun installed (`bun --version`)

### Migration Steps
- [ ] Identify Node.js APIs in script
- [ ] Add environment detection
- [ ] Convert child process calls
- [ ] Convert environment variables
- [ ] Add error handling

### Testing
- [ ] Test with Bun (`bun run script.ts`)
- [ ] Test with npm (`npx tsx script.ts`)
- [ ] Verify functionality
- [ ] Verify error handling

---

## Complete Example

```typescript
#!/usr/bin/env bun
/**
 * Example: Build Frontend
 * Compatible with: Bun + Node.js
 */

const isUsingBun = typeof Bun !== 'undefined';

async function buildFrontend() {
  console.log('Building frontend...\n');
  
  try {
    // Type check
    console.log('Running type check...');
    if (isUsingBun) {
      await Bun.$`cd frontend && bun vue-tsc --noEmit`;
    } else {
      const { execSync } = await import('child_process');
      execSync('cd frontend && npx vue-tsc --noEmit', { stdio: 'inherit' });
    }
    console.log('✓ Type check passed\n');
    
    // Build
    console.log('Building application...');
    if (isUsingBun) {
      await Bun.$`cd frontend && bun run build`;
    } else {
      const { execSync } = await import('child_process');
      execSync('cd frontend && npm run build', { stdio: 'inherit' });
    }
    console.log('✓ Build completed\n');
    
    console.log('Frontend build successful!');
    process.exit(0);
    
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

buildFrontend();
```

---

**Version:** 1.0.0  
**Date:** 2026-01-06  
**Maintainer:** Multi-Channel CRM Team
