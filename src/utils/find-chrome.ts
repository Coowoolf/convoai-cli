import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * Find Chrome/Chromium executable on the system.
 * Returns the path or null if not found.
 */
export function findChrome(): string | null {
  const platform = process.platform;

  if (platform === 'darwin') {
    const paths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    ];
    for (const p of paths) {
      if (existsSync(p)) return p;
    }
  }

  if (platform === 'linux') {
    const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];
    for (const name of names) {
      try {
        const path = execSync(`which ${name}`, { encoding: 'utf-8' }).trim();
        if (path) return path;
      } catch { /* not found */ }
    }
  }

  if (platform === 'win32') {
    const paths = [
      `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ];
    for (const p of paths) {
      if (p && existsSync(p)) return p;
    }
  }

  return null;
}
