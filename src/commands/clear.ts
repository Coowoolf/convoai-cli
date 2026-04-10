import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

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
