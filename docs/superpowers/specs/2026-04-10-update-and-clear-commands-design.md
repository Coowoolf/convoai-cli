# Update & Clear Commands

**Date:** 2026-04-10
**Version:** v1.8.2
**Status:** Draft

## Overview

Two maintenance commands for ConvoAI CLI:

- `convoai update` — check for and install the latest version from npm
- `convoai clear` — remove all local configuration and return the CLI to first-use state

Both commands address common user friction points: staying current and starting fresh.

## Goals

1. `convoai update` — one-command self-update with version diff display
2. `convoai clear` — safe, interactive removal of global and project configuration
3. Clear user feedback before destructive or network operations
4. Consistent with existing command patterns (Commander.js, registerX pattern)

## Non-Goals

- Supporting non-npm install methods (homebrew, yarn, pnpm) — npm only for v1.8.2
- Auto-update on CLI startup — remains opt-in via explicit command
- Backup/restore of cleared config — user can re-run `quickstart` to reconfigure
- Clearing credentials from the system keychain — there are none, config.json is the single source

---

## Command: `convoai update`

### Interface

```
convoai update [options]

Options:
  --force    Skip confirmation prompt
  --check    Only check for updates, don't install
  --json     JSON output
```

### Interactive Flow

```
$ convoai update

📦 Current: v1.8.0
🔍 Checking npm registry...
✨ Latest:  v1.8.1

? Update to v1.8.1? (Y/n) › yes

  Running: npm install -g convoai@latest
  [npm output shown via stdio inherit]
  ✓ Updated to v1.8.1
```

### Behavior Matrix

| Scenario | Output |
|----------|--------|
| Already at latest | `✓ Already at latest version (v1.8.1)` and exit 0 |
| Update available + interactive confirm | Show diff, prompt, run `npm install -g convoai@latest` with inherited stdio |
| Update available + `--force` | Skip prompt, run install directly |
| `--check` flag | Show current → latest, exit without installing |
| Network error during check | `✗ Failed to check npm registry. Check your connection.` exit 1 |
| Not installed globally (npx) | `⚠ convoai does not appear to be installed globally. Run: npm install -g convoai@latest` exit 1 |
| `npm install` fails | Propagate npm's error, exit with its code |
| `--json` | `{"current": "1.8.0", "latest": "1.8.1", "updated": true}` (or `"updated": false` if check-only) |

### Global Install Detection

Run `npm ls -g convoai --json --depth=0` via `execSync`:
- If exit 0 and JSON contains `dependencies.convoai`: globally installed, safe to update
- If exit non-zero or package not in output: not globally installed, show hint

This is the canonical way to check — defers to npm itself rather than guessing paths. Works across macOS/Linux/Windows and different Node version managers (nvm, fnm, volta).

Handle `execSync` timeout (5s) and missing `npm` command gracefully — if `npm` isn't on PATH, we can't update anyway, show error.

### Version Fetching

Extract shared logic from `src/utils/update-check.ts`:

```typescript
// New export in src/utils/update-check.ts
export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const { default: axios } = await import('axios');
    const { data } = await axios.get('https://registry.npmjs.org/convoai/latest', {
      timeout: 5000,
    });
    return data.version ?? null;
  } catch {
    return null;
  }
}
```

`checkForUpdate()` in the same file is refactored to call `fetchLatestVersion()` internally.

---

## Command: `convoai clear`

### Interface

```
convoai clear [options]

Options:
  --force         Skip confirmation
  --global-only   Only clear global config, skip project
  --json          JSON output
```

### Interactive Flow

```
$ convoai clear

⚠️  This will delete the following:

  Global config:
    ~/.config/convoai/config.json        (1.3 KB)
    ~/.config/convoai/templates/         (empty)
    ~/.config/convoai/.session           (8 B)

  Project config:
    ./.convoai.json                      (not found, skipping)

? Are you sure? (y/N) › yes

  ✓ Removed ~/.config/convoai/config.json
  ✓ Removed ~/.config/convoai/templates/
  ✓ Removed ~/.config/convoai/.session

  ✓ Done. Run `convoai quickstart` to set up again.
```

### Scope of Deletion

**Global (always attempted):**
- `~/.config/convoai/config.json` — main config
- `~/.config/convoai/templates/` — template directory (recursive)
- `~/.config/convoai/.session` — session file
- Any other files directly inside `~/.config/convoai/` (forward-compatible)
- **Preserve** the `~/.config/convoai/` directory itself (empty) — next `getConfigDir()` call works without race

**Project (conditional):**
- `./.convoai.json` in CWD — only if it exists
- Skipped silently if missing
- Skipped entirely if `--global-only` flag passed

### Pre-Delete Scan

Before confirmation, scan and display:
1. Walk `~/.config/convoai/` (depth 1 + recurse templates/) to get file paths and sizes
2. Check `process.cwd() + /.convoai.json`
3. Format human-readable sizes (B/KB/MB)
4. If nothing to delete: `Nothing to clear — config directory is empty.` exit 0

### Behavior Matrix

| Scenario | Output |
|----------|--------|
| Nothing to clear | Early exit with friendly message |
| Interactive confirm (default **N**) | Cancel on any non-yes answer |
| `--force` | Skip confirmation |
| `--global-only` | Skip project scan entirely |
| Delete fails for one file | Continue, collect errors, summary at end |
| All deletes succeed | Show checkmarks + "Run quickstart to set up again" hint |
| `--json` | `{"cleared": ["/path/1", "/path/2"], "errors": [], "cancelled": false}` |

### Destructive Action Safety

- Default confirmation is **N** (not Y) — user must explicitly type `y`
- `--force` is the only way to skip confirmation
- No `--dry-run` flag: the pre-delete scan already shows what would happen, and the default-N prompt serves the same purpose
- Relative paths (`./.convoai.json`) displayed exactly so user knows where CWD is

---

## Code Structure

### New Files

```
src/commands/
  ├── update.ts          — registerUpdate(program), update command
  └── clear.ts           — registerClear(program), clear command

tests/commands/
  ├── update.test.ts     — CLI integration tests (help text, --check flag)
  └── clear.test.ts      — CLI integration tests + unit tests for scan logic
```

### Modified Files

```
src/utils/update-check.ts  — export fetchLatestVersion(), refactor checkForUpdate
src/index.ts               — register both commands, add to help groups
src/commands/completion.ts — add 'update' and 'clear' to top-level completions
```

### Reuse Map

| Existing Code | Reused By |
|---------------|-----------|
| `update-check.ts` npm fetch logic | `update.ts` (via new `fetchLatestVersion`) |
| `config/paths.ts` → `getConfigDir`, `getProjectConfigPath` | `clear.ts` |
| `ui/output.ts` → `printSuccess`, `printError`, `printHint` | Both |
| `utils/errors.ts` → `handleError` | Both |
| Inquirer.js confirm prompt pattern | Both |

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| `update` network timeout (5s) | Print error, exit 1 |
| `update` registry returns invalid JSON | Print error, exit 1 |
| `update` npm install fails | Propagate exit code from execSync |
| `update` not installed globally | Print hint with exact command, exit 1 |
| `clear` permission denied on delete | Log file as failed, continue, summary at end |
| `clear` path doesn't exist | Silently skip (not an error) |
| Non-TTY + no `--force` | Error: "Cannot prompt in non-TTY; use --force to proceed" |
| `--json` mode | All output as JSON, no interactive prompts, require `--force` for destructive ops |

---

## Help Text Grouping

In `src/index.ts` custom help output:

```
Start:
  go, quickstart, init, dev, openclaw

Agent:
  ...

Phone:
  ...

Config:
  ...

Maintenance:            ← NEW GROUP
  update                Check and install the latest version
  clear                 Remove all local configuration

More:
  ...
```

---

## Testing Strategy

### `update.ts`
- Unit: `fetchLatestVersion()` — mock axios, return various responses
- Unit: Global install detection logic with fake paths
- CLI: `--help` shows all flags
- CLI: `--check` with mocked registry
- CLI: `--json` output format

### `clear.ts`
- Unit: Scan function returns correct file list + sizes given a temp directory
- Unit: Size formatter (B/KB/MB edge cases)
- Unit: Delete function with missing files, permission errors
- CLI: `--help` shows all flags
- CLI: `--force` mode with a temp config directory
- CLI: Nothing-to-clear path
