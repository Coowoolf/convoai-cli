import { loadConfig } from '../config/manager.js';

/**
 * Generate an RTC token for agent authentication.
 * Accepts explicit appId/certificate or falls back to config/env.
 */
export async function generateRtcToken(
  channelName: string,
  uid: number = 0,
  expireSeconds: number = 86400,
  overrideAppId?: string,
  overrideCertificate?: string,
): Promise<string | undefined> {
  const config = loadConfig();
  const appId = overrideAppId ?? config.app_id;
  const certificate = overrideCertificate ?? process.env.AGORA_APP_CERTIFICATE ?? config.app_certificate;

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
    return undefined;
  }
}
