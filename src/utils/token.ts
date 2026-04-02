import { loadConfig } from '../config/manager.js';

/**
 * Generate an RTC token for agent authentication.
 * Uses app_certificate from config or AGORA_APP_CERTIFICATE env var.
 * Returns undefined if no certificate is available (app may not require tokens).
 */
export async function generateRtcToken(
  channelName: string,
  uid: number = 0,
  expireSeconds: number = 86400,
): Promise<string | undefined> {
  const config = loadConfig();
  const appId = config.app_id;
  const certificate = process.env.AGORA_APP_CERTIFICATE ?? config.app_certificate;

  if (!appId || !certificate) {
    return undefined;
  }

  try {
    const pkg = await import('agora-token');
    const mod = pkg.default ?? pkg;
    const { RtcTokenBuilder, RtcRole } = mod;

    const expireTs = Math.floor(Date.now() / 1000) + expireSeconds;
    return RtcTokenBuilder.buildTokenWithUid(
      appId,
      certificate,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      expireTs,
      expireTs,
    );
  } catch {
    // agora-token not installed or token generation failed
    return undefined;
  }
}
