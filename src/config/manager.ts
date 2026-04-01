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
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
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

// ─── Profile Resolution ─────────────────────────────────────────────────────

/**
 * Get the active profile, merging base config fields with the named (or default) profile.
 * Throws if required credentials (app_id, customer_id, customer_secret) are missing.
 */
export function getActiveProfile(profileName?: string): ResolvedProfile {
  const config = loadConfig();

  // Determine which profile to use
  const name = profileName ?? config.default_profile;
  const profile: ProfileConfig = (name && config.profiles?.[name]) ? config.profiles[name] : {};

  // Merge: profile fields override base config fields
  const merged: ProfileConfig = {
    app_id: profile.app_id ?? config.app_id,
    customer_id: profile.customer_id ?? config.customer_id,
    customer_secret: profile.customer_secret ?? config.customer_secret,
    base_url: profile.base_url ?? config.base_url,
    region: profile.region ?? config.region,
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

  const name = profileName ?? config.default_profile;
  const profile: ProfileConfig = (name && config.profiles?.[name]) ? config.profiles[name] : {};
  const project = loadProjectConfig();

  return {
    app_id: project?.app_id ?? profile.app_id ?? config.app_id,
    customer_id: project?.customer_id ?? profile.customer_id ?? config.customer_id,
    customer_secret: project?.customer_secret ?? profile.customer_secret ?? config.customer_secret,
    base_url: project?.base_url ?? profile.base_url ?? config.base_url,
    region: project?.region ?? profile.region ?? config.region,
    llm: project?.llm ?? profile.llm,
    tts: project?.tts ?? profile.tts,
    asr: project?.asr ?? profile.asr,
  };
}
