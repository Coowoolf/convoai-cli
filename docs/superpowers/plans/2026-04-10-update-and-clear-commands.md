# Update & Clear Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `convoai update` (self-update from npm) and `convoai clear` (remove all local configuration) commands.

**Architecture:** Two standalone commands registered at the top level of the program. `update` wraps `npm install -g convoai@latest` with version diff display. `clear` scans global and project config paths, shows a preview, confirms, then deletes. Both reuse existing `update-check.ts` and `config/paths.ts` utilities.

**Tech Stack:** Commander.js, Inquirer.js, Node `execSync` for npm invocation, Node `fs` for file operations, Vitest for tests.

---

### Task 1: Extract `fetchLatestVersion` in update-check.ts

**Files:**
- Modify: `src/utils/update-check.ts`
- Test: `tests/utils/update-check.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/utils/update-check.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('fetchLatestVersion', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns version string on successful fetch', async () => {
    vi.doMock('axios', () => ({
      default: {
        get: vi.fn().mockResolvedValue({ data: { version: '1.9.0' } }),
      },
    }));
    const { fetchLatestVersion } = await import('../../src/utils/update-check.js');
    const result = await fetchLatestVersion();
    expect(result).toBe('1.9.0');
  });

  it('returns null on network error', async () => {
    vi.doMock('axios', () => ({
      default: {
        get: vi.fn().mockRejectedValue(new Error('network')),
      },
    }));
    const { fetchLatestVersion } = await import('../../src/utils/update-check.js');
    const result = await fetchLatestVersion();
    expect(result).toBeNull();
  });

  it('returns null if response has no version field', async () => {
    vi.doMock('axios', () => ({
      default: {
        get: vi.fn().mockResolvedValue({ data: {} }),
      },
    }));
    const { fetchLatestVersion } = await import('../../src/utils/update-check.js');
    const result = await fetchLatestVersion();
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npx vitest run tests/utils/update-check.test.ts -v`
Expected: FAIL — `fetchLatestVersion` not exported.

- [ ] **Step 3: Refactor update-check.ts to extract `fetchLatestVersion`**

Replace the entire content of `src/utils/update-check.ts` with:

```typescript
import chalk from 'chalk';

/**
 * Fetch the latest published version of convoai from npm.
 * Returns null on network error or if version is missing from response.
 */
export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const { default: axios } = await import('axios');
    const { data } = await axios.get('https://registry.npmjs.org/convoai/latest', {
      timeout: 5000,
    });
    return data?.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if a newer version of convoai is available on npm.
 * Non-blocking — runs silently, only prints if update is found.
 */
export async function checkForUpdate(currentVersion: string): Promise<void> {
  const latest = await fetchLatestVersion();
  if (!latest) return;

  if (latest !== currentVersion && isNewer(latest, currentVersion)) {
    console.log('');
    console.log(
      chalk.yellow(`  Update available: ${currentVersion} → ${chalk.bold(latest)}`),
    );
    console.log(
      chalk.dim('  Run ') + chalk.bold('convoai update') + chalk.dim(' to update'),
    );
    console.log('');
  }
}

export function isNewer(latest: string, current: string): boolean {
  const l = latest.split('.').map(Number);
  const c = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] ?? 0) > (c[i] ?? 0)) return true;
    if ((l[i] ?? 0) < (c[i] ?? 0)) return false;
  }
  return false;
}
```

Note: the existing `isNewer` function is now exported so Task 2's update command can use it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npx vitest run tests/utils/update-check.test.ts -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Run full test suite to verify no regressions**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npx vitest run`
Expected: All existing tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/yaoguanghua/Desktop/convoai-cli
git add src/utils/update-check.ts tests/utils/update-check.test.ts
git commit -m "refactor: extract fetchLatestVersion and isNewer from update-check"
```

---

### Task 2: Implement `convoai update` command

**Files:**
- Create: `src/commands/update.ts`
- Test: `tests/commands/update.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/commands/update.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const CLI = join(process.cwd(), 'dist/bin/convoai.js');

function cli(args: string): string {
  try {
    return execSync(`node ${CLI} ${args}`, { encoding: 'utf-8', timeout: 10000 });
  } catch (err: any) {
    return err.stdout || err.stderr || '';
  }
}

describe('convoai update', () => {
  it('shows help with --help', () => {
    const output = cli('update --help');
    expect(output).toContain('--force');
    expect(output).toContain('--check');
    expect(output).toContain('--json');
  });

  it('appears in top-level help', () => {
    const output = cli('--help');
    expect(output).toContain('update');
  });
});

describe('isGloballyInstalled', () => {
  it('returns boolean', async () => {
    const { isGloballyInstalled } = await import('../../src/commands/update.js');
    const result = isGloballyInstalled();
    expect(typeof result).toBe('boolean');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npx vitest run tests/commands/update.test.ts -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement update command**

Create `src/commands/update.ts`:

```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'node:child_process';
import { fetchLatestVersion, isNewer } from '../utils/update-check.js';
import { printSuccess, printError, printHint } from '../ui/output.js';
import { handleError } from '../utils/errors.js';

/**
 * Check if convoai is installed globally via npm.
 * Uses `npm ls -g convoai --json --depth=0` as the canonical check.
 */
export function isGloballyInstalled(): boolean {
  try {
    const output = execSync('npm ls -g convoai --json --depth=0', {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const data = JSON.parse(output);
    return !!(data?.dependencies?.convoai);
  } catch {
    return false;
  }
}

/**
 * Read the current installed version from the CLI's own package.json.
 * Uses the same walk-up logic as src/index.ts getVersion().
 */
function getCurrentVersion(): string {
  const { readFileSync } = require('node:fs');
  const { dirname, join } = require('node:path');
  const { fileURLToPath } = require('node:url');

  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 5; i++) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
      if (pkg.name === 'convoai') return pkg.version ?? '0.0.0';
    } catch { /* keep searching */ }
    dir = dirname(dir);
  }
  return '0.0.0';
}

async function updateAction(opts: {
  force?: boolean;
  check?: boolean;
  json?: boolean;
}): Promise<void> {
  const current = getCurrentVersion();

  if (!opts.json) {
    console.log('');
    console.log(`  ${chalk.dim('Current:')} v${current}`);
    console.log(`  ${chalk.dim('Checking npm registry...')}`);
  }

  const latest = await fetchLatestVersion();

  if (!latest) {
    if (opts.json) {
      console.log(JSON.stringify({ error: 'Failed to check npm registry' }));
    } else {
      printError('Failed to check npm registry. Check your connection.');
    }
    process.exit(1);
  }

  if (!opts.json) {
    console.log(`  ${chalk.dim('Latest:  ')} v${latest}`);
    console.log('');
  }

  const upToDate = latest === current || !isNewer(latest, current);

  if (upToDate) {
    if (opts.json) {
      console.log(JSON.stringify({ current, latest, updated: false, upToDate: true }));
    } else {
      printSuccess(`Already at latest version (v${current})`);
    }
    return;
  }

  if (opts.check) {
    if (opts.json) {
      console.log(JSON.stringify({ current, latest, updated: false, upToDate: false }));
    } else {
      console.log(chalk.yellow(`  Update available: v${current} → v${latest}`));
      printHint('Run: convoai update');
    }
    return;
  }

  if (!isGloballyInstalled()) {
    if (opts.json) {
      console.log(JSON.stringify({ error: 'not globally installed', current, latest }));
    } else {
      printError('convoai does not appear to be installed globally.');
      printHint('Run: npm install -g convoai@latest');
    }
    process.exit(1);
  }

  // Confirmation prompt
  if (!opts.force && !opts.json) {
    if (!process.stdin.isTTY) {
      printError('Cannot prompt in non-TTY mode. Use --force to proceed.');
      process.exit(1);
    }
    const { default: inquirer } = await import('inquirer');
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Update to v${latest}?`,
      default: true,
    }]);
    if (!confirm) {
      console.log(chalk.dim('  Cancelled.'));
      return;
    }
  }

  // Run npm install
  if (!opts.json) {
    console.log('');
    console.log(chalk.dim('  Running: npm install -g convoai@latest'));
    console.log('');
  }

  try {
    execSync('npm install -g convoai@latest', {
      stdio: opts.json ? 'pipe' : 'inherit',
      timeout: 120_000,
    });
  } catch (err: any) {
    if (opts.json) {
      console.log(JSON.stringify({ error: 'npm install failed', current, latest }));
    } else {
      printError('npm install failed. See output above.');
    }
    process.exit(err.status ?? 1);
  }

  if (opts.json) {
    console.log(JSON.stringify({ current, latest, updated: true }));
  } else {
    console.log('');
    printSuccess(`Updated to v${latest}`);
  }
}

export function registerUpdate(program: Command): void {
  program
    .command('update')
    .description('Check and install the latest version of convoai')
    .option('--force', 'Skip confirmation prompt')
    .option('--check', 'Only check for updates, do not install')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      try {
        await updateAction(opts);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
```

Note on the `require` calls inside `getCurrentVersion`: this file is ESM, but we use dynamic `createRequire` pattern. Actually, replace the `require` calls at the top of `getCurrentVersion()` with proper ESM imports at the top of the file. Use this corrected version:

Replace the top of the file (imports section) with:

```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchLatestVersion, isNewer } from '../utils/update-check.js';
import { printSuccess, printError, printHint } from '../ui/output.js';
import { handleError } from '../utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

And replace `getCurrentVersion()` body with:

```typescript
function getCurrentVersion(): string {
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
      if (pkg.name === 'convoai') return pkg.version ?? '0.0.0';
    } catch { /* keep searching */ }
    dir = dirname(dir);
  }
  return '0.0.0';
}
```

- [ ] **Step 4: Register update command in index.ts**

In `src/index.ts`, add the import near the other top-level imports (after `registerCompletion`):

```typescript
import { registerUpdate } from './commands/update.js';
```

Add the registration after `registerCompletion(program);` (around line 322):

```typescript
  // ── update ─────────────────────────────────────────────────────────────
  registerUpdate(program);
```

- [ ] **Step 5: Build and run tests**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npm run build && npx vitest run tests/commands/update.test.ts -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Verify TypeScript compilation**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Smoke test**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && node dist/bin/convoai.js update --check`
Expected: Shows current version, fetches latest, shows diff, doesn't install.

- [ ] **Step 8: Commit**

```bash
cd /Users/yaoguanghua/Desktop/convoai-cli
git add src/commands/update.ts src/index.ts tests/commands/update.test.ts
git commit -m "feat: convoai update command — self-update from npm"
```

---

### Task 3: Implement config scanning utilities for `clear`

**Files:**
- Create: `src/commands/clear.ts` (partial — scan functions only)
- Test: `tests/commands/clear-scan.test.ts`

This task implements the pure scan/format functions before adding the interactive command flow. Keeping these testable in isolation.

- [ ] **Step 1: Write failing test for scanConfigPaths and formatSize**

Create `tests/commands/clear-scan.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('formatSize', () => {
  it('formats bytes', async () => {
    const { formatSize } = await import('../../src/commands/clear.js');
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(500)).toBe('500 B');
    expect(formatSize(1023)).toBe('1023 B');
  });

  it('formats kilobytes', async () => {
    const { formatSize } = await import('../../src/commands/clear.js');
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(102400)).toBe('100.0 KB');
  });

  it('formats megabytes', async () => {
    const { formatSize } = await import('../../src/commands/clear.js');
    expect(formatSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatSize(1024 * 1024 * 5)).toBe('5.0 MB');
  });
});

describe('scanDirectory', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `convoai-clear-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('returns empty array for empty directory', async () => {
    const { scanDirectory } = await import('../../src/commands/clear.js');
    const entries = scanDirectory(testDir);
    expect(entries).toEqual([]);
  });

  it('returns files with size', async () => {
    writeFileSync(join(testDir, 'config.json'), '{"app_id":"test"}');
    writeFileSync(join(testDir, '.session'), 'abc');
    const { scanDirectory } = await import('../../src/commands/clear.js');
    const entries = scanDirectory(testDir);
    expect(entries).toHaveLength(2);
    const config = entries.find(e => e.path.endsWith('config.json'));
    expect(config).toBeDefined();
    expect(config!.size).toBe(17);
    expect(config!.type).toBe('file');
  });

  it('returns subdirectories as dir entries', async () => {
    mkdirSync(join(testDir, 'templates'));
    writeFileSync(join(testDir, 'templates', 'one.json'), '{}');
    writeFileSync(join(testDir, 'templates', 'two.json'), '{}');
    const { scanDirectory } = await import('../../src/commands/clear.js');
    const entries = scanDirectory(testDir);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('dir');
    expect(entries[0].path.endsWith('templates')).toBe(true);
  });

  it('returns empty dir entry with size 0', async () => {
    mkdirSync(join(testDir, 'templates'));
    const { scanDirectory } = await import('../../src/commands/clear.js');
    const entries = scanDirectory(testDir);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('dir');
    expect(entries[0].size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npx vitest run tests/commands/clear-scan.test.ts -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement scan and format functions**

Create `src/commands/clear.ts`:

```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readdirSync, statSync, rmSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { getConfigDir, getProjectConfigPath } from '../config/paths.js';
import { printSuccess, printError, printHint } from '../ui/output.js';
import { handleError } from '../utils/errors.js';

export interface ScanEntry {
  path: string;
  size: number;
  type: 'file' | 'dir';
}

/** Format a byte count as a human-readable string. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Recursively compute the total size of a directory. */
function dirSize(dir: string): number {
  let total = 0;
  try {
    const entries = readdirSync(dir);
    for (const name of entries) {
      const full = join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        total += dirSize(full);
      } else {
        total += stat.size;
      }
    }
  } catch { /* ignore */ }
  return total;
}

/**
 * Scan a directory (depth 1) and return entries for each file and subdirectory.
 * Files get their byte size; directories get their recursive total size.
 */
export function scanDirectory(dir: string): ScanEntry[] {
  if (!existsSync(dir)) return [];
  const entries: ScanEntry[] = [];
  try {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        entries.push({ path: full, size: dirSize(full), type: 'dir' });
      } else {
        entries.push({ path: full, size: stat.size, type: 'file' });
      }
    }
  } catch { /* ignore */ }
  return entries;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npx vitest run tests/commands/clear-scan.test.ts -v`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/yaoguanghua/Desktop/convoai-cli
git add src/commands/clear.ts tests/commands/clear-scan.test.ts
git commit -m "feat: scan and format utilities for convoai clear"
```

---

### Task 4: Complete `clear` command with delete and interactive flow

**Files:**
- Modify: `src/commands/clear.ts` (add clear action + register function)
- Modify: `src/index.ts` (register)
- Test: `tests/commands/clear.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/commands/clear.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CLI = join(process.cwd(), 'dist/bin/convoai.js');

function cli(args: string, env: Record<string, string> = {}): string {
  try {
    return execSync(`node ${CLI} ${args}`, {
      encoding: 'utf-8',
      timeout: 10000,
      env: { ...process.env, ...env },
    });
  } catch (err: any) {
    return err.stdout || err.stderr || '';
  }
}

describe('convoai clear', () => {
  it('shows help with --help', () => {
    const output = cli('clear --help');
    expect(output).toContain('--force');
    expect(output).toContain('--global-only');
    expect(output).toContain('--json');
  });

  it('appears in top-level help', () => {
    const output = cli('--help');
    expect(output).toContain('clear');
  });
});

describe('convoai clear --force (integration)', () => {
  let testHome: string;
  let testConfigDir: string;

  beforeEach(() => {
    testHome = join(tmpdir(), `convoai-clear-force-${Date.now()}`);
    testConfigDir = join(testHome, 'convoai');
    mkdirSync(testConfigDir, { recursive: true });
    writeFileSync(join(testConfigDir, 'config.json'), '{"app_id":"test"}');
    mkdirSync(join(testConfigDir, 'templates'));
    writeFileSync(join(testConfigDir, 'templates', 'a.json'), '{}');
  });

  afterEach(() => {
    if (existsSync(testHome)) {
      rmSync(testHome, { recursive: true, force: true });
    }
  });

  it('removes config files with --force and XDG_CONFIG_HOME set', () => {
    const output = cli('clear --force --global-only', { XDG_CONFIG_HOME: testHome });
    expect(existsSync(join(testConfigDir, 'config.json'))).toBe(false);
    expect(existsSync(join(testConfigDir, 'templates'))).toBe(false);
    // Directory itself should remain
    expect(existsSync(testConfigDir)).toBe(true);
  });

  it('outputs JSON with --json --force', () => {
    const output = cli('clear --json --force --global-only', { XDG_CONFIG_HOME: testHome });
    const parsed = JSON.parse(output);
    expect(parsed.cleared).toBeInstanceOf(Array);
    expect(parsed.cleared.length).toBeGreaterThan(0);
    expect(parsed.errors).toEqual([]);
    expect(parsed.cancelled).toBe(false);
  });

  it('shows nothing-to-clear message when config is empty', () => {
    // Remove everything first
    rmSync(join(testConfigDir, 'config.json'));
    rmSync(join(testConfigDir, 'templates'), { recursive: true });
    const output = cli('clear --force --global-only', { XDG_CONFIG_HOME: testHome });
    expect(output.toLowerCase()).toContain('nothing to clear');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npx vitest run tests/commands/clear.test.ts -v`
Expected: FAIL — command not registered, integration tests fail.

- [ ] **Step 3: Extend clear.ts with action and register function**

Append to `src/commands/clear.ts` (keep existing formatSize/scanDirectory from Task 3):

```typescript
/** Attempt to delete a file or directory, return success/error. */
function deleteEntry(entry: ScanEntry): { ok: true } | { ok: false; error: string } {
  try {
    if (entry.type === 'dir') {
      rmSync(entry.path, { recursive: true, force: true });
    } else {
      unlinkSync(entry.path);
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || String(err) };
  }
}

/** Render a display path relative to the user's home directory. */
function displayPath(fullPath: string): string {
  const home = homedir();
  if (fullPath.startsWith(home)) {
    return '~' + fullPath.slice(home.length);
  }
  return fullPath;
}

async function clearAction(opts: {
  force?: boolean;
  globalOnly?: boolean;
  json?: boolean;
}): Promise<void> {
  // 1. Scan global config
  const globalDir = getConfigDir();
  const globalEntries = scanDirectory(globalDir);

  // 2. Scan project config (unless --global-only)
  const projectEntries: ScanEntry[] = [];
  if (!opts.globalOnly) {
    const projectPath = getProjectConfigPath();
    if (existsSync(projectPath)) {
      try {
        const stat = statSync(projectPath);
        projectEntries.push({ path: projectPath, size: stat.size, type: 'file' });
      } catch { /* ignore */ }
    }
  }

  const allEntries = [...globalEntries, ...projectEntries];

  // 3. Nothing to clear
  if (allEntries.length === 0) {
    if (opts.json) {
      console.log(JSON.stringify({ cleared: [], errors: [], cancelled: false }));
    } else {
      console.log('');
      console.log(chalk.dim('  Nothing to clear — config directory is empty.'));
      console.log('');
    }
    return;
  }

  // 4. Show what will be deleted
  if (!opts.json) {
    console.log('');
    console.log(chalk.yellow('  ⚠  This will delete the following:'));
    console.log('');

    if (globalEntries.length > 0) {
      console.log(chalk.bold('  Global config:'));
      for (const entry of globalEntries) {
        const display = displayPath(entry.path);
        const size = entry.type === 'dir' && entry.size === 0
          ? '(empty)'
          : `(${formatSize(entry.size)})`;
        console.log(`    ${display}${entry.type === 'dir' ? '/' : ''}    ${chalk.dim(size)}`);
      }
      console.log('');
    }

    if (!opts.globalOnly) {
      console.log(chalk.bold('  Project config:'));
      if (projectEntries.length > 0) {
        for (const entry of projectEntries) {
          console.log(`    ./${entry.path.split('/').pop()}    ${chalk.dim(`(${formatSize(entry.size)})`)}`);
        }
      } else {
        console.log(chalk.dim('    ./.convoai.json    (not found, skipping)'));
      }
      console.log('');
    }
  }

  // 5. Confirmation prompt
  if (!opts.force && !opts.json) {
    if (!process.stdin.isTTY) {
      printError('Cannot prompt in non-TTY mode. Use --force to proceed.');
      process.exit(1);
    }
    const { default: inquirer } = await import('inquirer');
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure?',
      default: false,
    }]);
    if (!confirm) {
      console.log(chalk.dim('  Cancelled.'));
      return;
    }
  } else if (!opts.force && opts.json) {
    console.log(JSON.stringify({ error: '--force required in JSON mode', cleared: [], errors: [], cancelled: true }));
    process.exit(1);
  }

  // 6. Delete
  const cleared: string[] = [];
  const errors: Array<{ path: string; error: string }> = [];

  for (const entry of allEntries) {
    const result = deleteEntry(entry);
    if (result.ok) {
      cleared.push(entry.path);
      if (!opts.json) {
        printSuccess(`Removed ${displayPath(entry.path)}`);
      }
    } else {
      errors.push({ path: entry.path, error: result.error });
      if (!opts.json) {
        printError(`Failed: ${displayPath(entry.path)} — ${result.error}`);
      }
    }
  }

  // 7. Summary
  if (opts.json) {
    console.log(JSON.stringify({ cleared, errors, cancelled: false }));
  } else {
    console.log('');
    if (errors.length === 0) {
      printSuccess('Done.');
      printHint('Run `convoai quickstart` to set up again.');
    } else {
      printError(`Completed with ${errors.length} error(s).`);
    }
  }
}

export function registerClear(program: Command): void {
  program
    .command('clear')
    .description('Remove all local configuration (global and project)')
    .option('--force', 'Skip confirmation')
    .option('--global-only', 'Only clear global config, skip project')
    .option('--json', 'JSON output (requires --force for destructive ops)')
    .action(async (opts) => {
      try {
        await clearAction(opts);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}
```

- [ ] **Step 4: Register clear command in index.ts**

In `src/index.ts`, add the import near other imports:

```typescript
import { registerClear } from './commands/clear.js';
```

Add the registration right after `registerUpdate(program);`:

```typescript
  // ── clear ──────────────────────────────────────────────────────────────
  registerClear(program);
```

- [ ] **Step 5: Build and run tests**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npm run build && npx vitest run tests/commands/clear.test.ts -v`
Expected: PASS (5 tests)

- [ ] **Step 6: Verify TypeScript compilation**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/yaoguanghua/Desktop/convoai-cli
git add src/commands/clear.ts src/index.ts tests/commands/clear.test.ts
git commit -m "feat: convoai clear command — remove local configuration"
```

---

### Task 5: Help text grouping and completions

**Files:**
- Modify: `src/index.ts` (help groups)
- Modify: `src/commands/completion.ts` (completions)
- Test: Update existing help tests if any

- [ ] **Step 1: Add Maintenance group to customHelp in index.ts**

In `src/index.ts`, find the section that outputs command groups (the `customHelp()` function). Between the `Config:` group and the `More:` group, insert a new `Maintenance:` group.

Find this block:

```typescript
  // Group: Config
  lines.push(chalk.bold('Config:'));
  lines.push(`  ${chalk.cyan('config show')}       ${chalk.dim('Show current config')}`);
  lines.push(`  ${chalk.cyan('config set')}        ${chalk.dim('Change a setting')}`);
  lines.push(`  ${chalk.cyan('config init')}       ${chalk.dim('Re-run setup wizard')}`);
  lines.push('');

  // Group: More
```

Replace with:

```typescript
  // Group: Config
  lines.push(chalk.bold('Config:'));
  lines.push(`  ${chalk.cyan('config show')}       ${chalk.dim('Show current config')}`);
  lines.push(`  ${chalk.cyan('config set')}        ${chalk.dim('Change a setting')}`);
  lines.push(`  ${chalk.cyan('config init')}       ${chalk.dim('Re-run setup wizard')}`);
  lines.push('');

  // Group: Maintenance
  lines.push(chalk.bold('Maintenance:'));
  lines.push(`  ${chalk.cyan('update')}            ${chalk.dim('Check and install the latest version')}`);
  lines.push(`  ${chalk.cyan('clear')}             ${chalk.dim('Remove all local configuration')}`);
  lines.push('');

  // Group: More
```

- [ ] **Step 2: Add completions in completion.ts**

In `src/commands/completion.ts`, update `TOP_LEVEL_COMMANDS` to include the new commands:

Find:
```typescript
const TOP_LEVEL_COMMANDS = ['go', 'init', 'dev', 'quickstart', 'openclaw', 'phone', 'auth', 'agent', 'call', 'config', 'preset', 'template', 'token', 'completion'];
```

Replace with:
```typescript
const TOP_LEVEL_COMMANDS = ['go', 'init', 'dev', 'quickstart', 'openclaw', 'phone', 'auth', 'agent', 'call', 'config', 'preset', 'template', 'token', 'completion', 'update', 'clear'];
```

- [ ] **Step 3: Build and smoke test**

Run:
```bash
cd /Users/yaoguanghua/Desktop/convoai-cli
npm run build
node dist/bin/convoai.js --help | grep -A 2 Maintenance
```
Expected: Shows Maintenance group with `update` and `clear`.

- [ ] **Step 4: Run full test suite**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Verify TypeScript compilation**

Run: `cd /Users/yaoguanghua/Desktop/convoai-cli && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/yaoguanghua/Desktop/convoai-cli
git add src/index.ts src/commands/completion.ts
git commit -m "feat: add Maintenance help group and completions for update/clear"
```

- [ ] **Step 7: Final integration smoke test**

Run:
```bash
cd /Users/yaoguanghua/Desktop/convoai-cli
node dist/bin/convoai.js update --check
node dist/bin/convoai.js clear --help
node dist/bin/convoai.js --help
```

Expected:
- `update --check`: shows current vs latest version
- `clear --help`: shows all flags
- `--help`: shows Maintenance group with both commands
