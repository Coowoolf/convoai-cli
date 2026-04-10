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
