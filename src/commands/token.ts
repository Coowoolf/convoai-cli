import { Command } from 'commander';
import { loadConfig } from '../config/manager.js';
import { printSuccess, printError, printHint } from '../ui/output.js';
import { printKeyValue } from '../ui/table.js';
import { handleError } from '../utils/errors.js';

// ─── Command Registration ──────────────────────────────────────────────────

export function registerToken(program: Command): void {
  program
    .command('token')
    .description('Generate an RTC token for agent authentication')
    .requiredOption('-c, --channel <name>', 'Channel name')
    .option('--uid <uid>', 'UID for the token (default: 0)', '0')
    .option('--expire <seconds>', 'Token expiry in seconds (default: 86400)', '86400')
    .option('--certificate <cert>', 'App Certificate (or set via config/env)')
    .option('--profile <name>', 'Config profile to use')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      try {
        await tokenAction(opts);
      } catch (error) {
        handleError(error, { json: opts.json });
      }
    });
}

// ─── Action ────────────────────────────────────────────────────────────────

async function tokenAction(opts: {
  channel: string;
  uid: string;
  expire: string;
  certificate?: string;
  profile?: string;
  json?: boolean;
}): Promise<void> {
  // Load agora-token dynamically
  let RtcTokenBuilder: any;
  let RtcRole: any;
  try {
    const pkg = await import('agora-token');
    const mod = pkg.default ?? pkg;
    RtcTokenBuilder = mod.RtcTokenBuilder;
    RtcRole = mod.RtcRole;
  } catch {
    printError('agora-token package not found. Run: npm install agora-token');
    process.exit(1);
  }

  const config = loadConfig();
  const appId = config.app_id;
  const certificate = opts.certificate
    ?? process.env.AGORA_APP_CERTIFICATE
    ?? config.app_certificate as string | undefined;

  if (!appId) {
    printError('App ID not configured. Run `convoai auth login` first.');
    process.exit(1);
  }

  if (!certificate) {
    printError(
      'App Certificate is required. Provide via --certificate flag, AGORA_APP_CERTIFICATE env var, or `convoai config set app_certificate <value>`.',
    );
    process.exit(1);
  }

  const uid = parseInt(opts.uid, 10);
  const expireSeconds = parseInt(opts.expire, 10);
  const expireTs = Math.floor(Date.now() / 1000) + expireSeconds;

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    certificate,
    opts.channel,
    uid,
    RtcRole.PUBLISHER,
    expireTs,
    expireTs,
  );

  if (opts.json) {
    console.log(JSON.stringify({
      token,
      channel: opts.channel,
      uid,
      expires_at: new Date(expireTs * 1000).toISOString(),
    }, null, 2));
    return;
  }

  printSuccess('Token generated.');
  printKeyValue([
    ['Token', token],
    ['Channel', opts.channel],
    ['UID', String(uid)],
    ['Expires', new Date(expireTs * 1000).toLocaleString()],
  ]);
  printHint(`Use it: convoai agent start --channel ${opts.channel} --token "${token}"`);
}
