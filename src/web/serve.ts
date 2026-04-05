/**
 * Shared HTTP handler that serves HTML pages + the Agora RTC SDK from npm.
 * Using the npm package (agora-rtc-sdk-ng) instead of CDN ensures each
 * `npm install convoai` counts as an npm download for the SDK.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { IncomingMessage, ServerResponse } from 'node:http';

const require = createRequire(import.meta.url);

let _sdkCache: Buffer | null = null;

function getSdkContent(): Buffer {
  if (!_sdkCache) {
    // Resolve the package main entry (exports "." → AgoraRTC_N-production.js)
    // Using the subpath directly would throw ERR_PACKAGE_PATH_NOT_EXPORTED
    const sdkPath = require.resolve('agora-rtc-sdk-ng');
    _sdkCache = readFileSync(sdkPath);
  }
  return _sdkCache;
}

/**
 * Returns an HTTP request handler that serves:
 *  - `/agora-sdk.js` → Agora RTC SDK from node_modules
 *  - Everything else  → the provided HTML string
 */
export function createWebHandler(html: string): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    const pathname = (req.url || '/').split('?')[0];
    if (pathname === '/agora-sdk.js') {
      const sdk = getSdkContent();
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Content-Length': sdk.length,
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(sdk);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    }
  };
}
