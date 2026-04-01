import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_DIR = join(tmpdir(), `convoai-tpl-test-${Date.now()}`);
const TEST_TEMPLATES_DIR = join(TEST_DIR, 'templates');

vi.mock('../../src/config/paths.js', () => ({
  getConfigDir: () => {
    mkdirSync(TEST_DIR, { recursive: true });
    return TEST_DIR;
  },
  getConfigPath: () => join(TEST_DIR, 'config.json'),
  getProjectConfigPath: () => join(process.cwd(), '.convoai.json'),
}));

const {
  getTemplatesDir,
  listTemplates,
  loadTemplate,
  saveTemplate,
  deleteTemplate,
  templateExists,
} = await import('../../src/templates/manager.js');

describe('Template Manager', () => {
  beforeEach(() => {
    mkdirSync(TEST_TEMPLATES_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('getTemplatesDir', () => {
    it('returns templates dir path', () => {
      const dir = getTemplatesDir();
      expect(dir).toBe(TEST_TEMPLATES_DIR);
    });

    it('creates the directory if missing', () => {
      rmSync(TEST_TEMPLATES_DIR, { recursive: true, force: true });
      const dir = getTemplatesDir();
      expect(existsSync(dir)).toBe(true);
    });
  });

  describe('saveTemplate / loadTemplate', () => {
    it('saves and loads a template', () => {
      const template = {
        name: 'test-tpl',
        description: 'A test template',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        properties: {
          llm: { model: 'gpt-4o', vendor: 'openai' },
        },
      };

      saveTemplate(template);

      const loaded = loadTemplate('test-tpl');
      expect(loaded).not.toBeNull();
      expect(loaded?.name).toBe('test-tpl');
      expect(loaded?.description).toBe('A test template');
      expect(loaded?.properties.llm?.model).toBe('gpt-4o');
    });
  });

  describe('loadTemplate', () => {
    it('returns null for non-existent template', () => {
      const loaded = loadTemplate('does-not-exist');
      expect(loaded).toBeNull();
    });
  });

  describe('listTemplates', () => {
    it('returns empty array when no templates exist', () => {
      const list = listTemplates();
      expect(list).toEqual([]);
    });

    it('returns all saved templates sorted by name', () => {
      saveTemplate({
        name: 'zeta',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        properties: {},
      });
      saveTemplate({
        name: 'alpha',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        properties: {},
      });

      const list = listTemplates();
      expect(list).toHaveLength(2);
      expect(list[0].name).toBe('alpha');
      expect(list[1].name).toBe('zeta');
    });
  });

  describe('deleteTemplate', () => {
    it('deletes an existing template and returns true', () => {
      saveTemplate({
        name: 'to-delete',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        properties: {},
      });

      expect(templateExists('to-delete')).toBe(true);
      const result = deleteTemplate('to-delete');
      expect(result).toBe(true);
      expect(templateExists('to-delete')).toBe(false);
    });

    it('returns false for non-existent template', () => {
      const result = deleteTemplate('nope');
      expect(result).toBe(false);
    });
  });

  describe('templateExists', () => {
    it('returns true for saved template', () => {
      saveTemplate({
        name: 'exists',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        properties: {},
      });
      expect(templateExists('exists')).toBe(true);
    });

    it('returns false for missing template', () => {
      expect(templateExists('missing')).toBe(false);
    });
  });
});
