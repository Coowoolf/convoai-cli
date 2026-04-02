import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { ConvoAIConfig, ProfileConfig } from '../api/types.js';
import { getConfigPath, getProjectConfigPath, getConfigDir } from './paths.js';
import { validateConfig } from './schema.js';

// ─── Resolved Profile ───────────────────────────────────────────────────────

export interface ResolvedProfile extends ProfileConfig {
  app_id: string;
  customer_id: string;
  customer_secret: string;
}

// ─── Load / Save ────────────────────────────────────────────────────────────

/** Load the global config file. Returns an empty config if the file is missing or unreadable. */
export function loadConfig(): ConvoAIConfig {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return validateConfig(parsed);
  } catch {
    return {};
  }
}

/** Persist the config object to disk. */
export function saveConfig(config: ConvoAIConfig): void {
  // Ensure the directory exists before writing
  getConfigDir();
  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf-8', mode: 0o600 });
}

// ─── Project Config ─────────────────────────────────────────────────────────

/** Load a project-local .convoai.json if it exists. Returns null otherwise. */
export function loadProjectConfig(): Partial<ProfileConfig> | null {
  const projectPath = getProjectConfigPath();

  if (!existsSync(projectPath)) {
    return null;
  }

  try {
    const raw = readFileSync(projectPath, 'utf-8');
    return JSON.parse(raw) as Partial<ProfileConfig>;
  } catch {
    return null;
  }
}

// ─── Deep Merge Helper ──────────────────────────────────────────────────────

function deepMerge<T extends Record<string, unknown>>(...sources: (Partial<T> | undefined | null)[]): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && !Array.isArray(value) && typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
          result[key] = deepMerge(result[key] as Record<string, unknown>, value as Record<string, unknown>);
        } else {
          result[key] = value;
        }
      }
    }
  }
  return result as Partial<T>;
}

// ─── Profile Resolution ─────────────────────────────────────────────────────

/**
 * Get the active profile, merging base config fields with the named (or default) profile.
 * Throws if required credentials (app_id, customer_id, customer_secret) are missing.
 */
export function getActiveProfile(profileName?: string): ResolvedProfile {
  const config = loadConfig();

  // Environment variables (highest priority after flags)
  const env = {
    app_id: process.env.CONVOAI_APP_ID,
    customer_id: process.env.CONVOAI_CUSTOMER_ID,
    customer_secret: process.env.CONVOAI_CUSTOMER_SECRET,
    base_url: process.env.CONVOAI_BASE_URL,
    region: process.env.CONVOAI_REGION as 'global' | 'cn' | undefined,
  };

  // Determine which profile to use
  const name = profileName ?? config.default_profile;
  const profile: ProfileConfig = (name && config.profiles?.[name]) ? config.profiles[name] : {};

  // Merge: env > profile fields > base config fields
  const merged: ProfileConfig = {
    app_id: env.app_id ?? profile.app_id ?? config.app_id,
    customer_id: env.customer_id ?? profile.customer_id ?? config.customer_id,
    customer_secret: env.customer_secret ?? profile.customer_secret ?? config.customer_secret,
    base_url: env.base_url ?? profile.base_url ?? config.base_url,
    region: env.region ?? profile.region ?? config.region,
    llm: profile.llm,
    tts: profile.tts,
    asr: profile.asr,
  };

  if (!merged.app_id || !merged.customer_id || !merged.customer_secret) {
    const missing: string[] = [];
    if (!merged.app_id) missing.push('app_id');
    if (!merged.customer_id) missing.push('customer_id');
    if (!merged.customer_secret) missing.push('customer_secret');
    throw new Error(
      `Missing required credentials: ${missing.join(', ')}. Run "convoai auth login" to configure.`,
    );
  }

  return merged as ResolvedProfile;
}

/**
 * Fully resolved config: project config > profile config > base config.
 * Returns a merged ProfileConfig (credentials may still be absent if unconfigured).
 */
export function resolveConfig(profileName?: string): ProfileConfig {
  const config = loadConfig();

  // Environment variables (highest priority after flags)
  const env = {
    app_id: process.env.CONVOAI_APP_ID,
    customer_id: process.env.CONVOAI_CUSTOMER_ID,
    customer_secret: process.env.CONVOAI_CUSTOMER_SECRET,
    base_url: process.env.CONVOAI_BASE_URL,
    region: process.env.CONVOAI_REGION as 'global' | 'cn' | undefined,
  };

  const name = profileName ?? config.default_profile;
  const profile: ProfileConfig = (name && config.profiles?.[name]) ? config.profiles[name] : {};
  const project = loadProjectConfig();

  return {
    app_id: env.app_id ?? project?.app_id ?? profile.app_id ?? config.app_id,
    customer_id: env.customer_id ?? project?.customer_id ?? profile.customer_id ?? config.customer_id,
    customer_secret: env.customer_secret ?? project?.customer_secret ?? profile.customer_secret ?? config.customer_secret,
    base_url: env.base_url ?? project?.base_url ?? profile.base_url ?? config.base_url,
    region: env.region ?? project?.region ?? profile.region ?? config.region,
    llm: deepMerge(profile.llm, project?.llm),
    tts: deepMerge(profile.tts, project?.tts),
    asr: deepMerge(profile.asr, project?.asr),
  };
}
