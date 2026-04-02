import chalk from 'chalk';

/**
 * Check if a newer version of convoai is available on npm.
 * Non-blocking — runs silently, only prints if update is found.
 */
export async function checkForUpdate(currentVersion: string): Promise<void> {
  try {
    const { default: axios } = await import('axios');
    const { data } = await axios.get('https://registry.npmjs.org/convoai/latest', {
      timeout: 3000,
    });
    const latest = data.version;

    if (latest && latest !== currentVersion && isNewer(latest, currentVersion)) {
      console.log('');
      console.log(
        chalk.yellow(`  Update available: ${currentVersion} → ${chalk.bold(latest)}`),
      );
      console.log(
        chalk.dim('  Run ') + chalk.bold('npm install -g convoai@latest') + chalk.dim(' to update'),
      );
      console.log('');
    }
  } catch {
    // Silently ignore — network errors, offline, etc.
  }
}

function isNewer(latest: string, current: string): boolean {
  const l = latest.split('.').map(Number);
  const c = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] ?? 0) > (c[i] ?? 0)) return true;
    if ((l[i] ?? 0) < (c[i] ?? 0)) return false;
  }
  return false;
}
