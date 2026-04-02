import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { getConfigDir } from '../config/paths.js';
import type { AgentProperties } from '../api/types.js';

// ─── Validation ─────────────────────────────────────────────────────────────

export const SAFE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

function validateTemplateName(name: string): void {
  if (!SAFE_NAME_PATTERN.test(name) || name.includes('..')) {
    throw new Error(`Invalid template name "${name}". Use only letters, numbers, hyphens, and underscores.`);
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AgentTemplate {
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  properties: Partial<AgentProperties>;
}

// ─── Directory ──────────────────────────────────────────────────────────────

const TEMPLATES_DIR_NAME = 'templates';

/**
 * Returns the templates directory path and ensures it exists.
 * Templates are stored at ~/.config/convoai/templates/
 */
export function getTemplatesDir(): string {
  const dir = join(getConfigDir(), TEMPLATES_DIR_NAME);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

/** List all saved templates, sorted by name. */
export function listTemplates(): AgentTemplate[] {
  const dir = getTemplatesDir();
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const templates: AgentTemplate[] = [];

  for (const file of files) {
    try {
      const raw = readFileSync(join(dir, file), 'utf-8');
      const template = JSON.parse(raw) as AgentTemplate;
      templates.push(template);
    } catch {
      // Skip malformed template files
    }
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

/** Load a template by name. Returns null if not found or unreadable. */
export function loadTemplate(name: string): AgentTemplate | null {
  validateTemplateName(name);
  const filePath = join(getTemplatesDir(), `${name}.json`);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as AgentTemplate;
  } catch {
    return null;
  }
}

/** Save a template to disk. Overwrites any existing file with the same name. */
export function saveTemplate(template: AgentTemplate): void {
  validateTemplateName(template.name);
  const filePath = join(getTemplatesDir(), `${template.name}.json`);
  writeFileSync(filePath, JSON.stringify(template, null, 2) + '\n', 'utf-8');
}

/** Delete a template by name. Returns true if the file was deleted, false if it did not exist. */
export function deleteTemplate(name: string): boolean {
  validateTemplateName(name);
  const filePath = join(getTemplatesDir(), `${name}.json`);

  if (!existsSync(filePath)) {
    return false;
  }

  unlinkSync(filePath);
  return true;
}

/** Check whether a template with the given name exists on disk. */
export function templateExists(name: string): boolean {
  validateTemplateName(name);
  const filePath = join(getTemplatesDir(), `${name}.json`);
  return existsSync(filePath);
}
