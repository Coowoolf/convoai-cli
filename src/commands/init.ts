import { Command } from 'commander';
import { cpSync, existsSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findStarterDir(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'src', 'starters', 'web');
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    dir = dirname(dir);
  }
  throw new Error('Could not find starter template. Reinstall the package: npm install -g convoai');
}

function loadCliConfig(): Record<string, any> {
  try {
    const homedir = process.env.HOME || process.env.USERPROFILE || '';
    const configPath = join(homedir, '.config', 'convoai', '.convoai.json');
    if (!existsSync(configPath)) return {};
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function generateEnv(config: Record<string, any>): string {
  const profile = config.profiles?.default ?? config.profiles?.[config.default_profile ?? ''] ?? {};

  const lines: string[] = [
    '# Agora Credentials',
    `AGORA_APP_ID=${config.app_id ?? ''}`,
    `AGORA_APP_CERTIFICATE=${config.app_certificate ?? ''}`,
    `AGORA_CUSTOMER_ID=${config.customer_id ?? ''}`,
    `AGORA_CUSTOMER_SECRET=${config.customer_secret ?? ''}`,
    '',
    '# Region',
    `AGORA_REGION=${config.region ?? 'global'}`,
    '',
    '# LLM Configuration',
    `LLM_VENDOR=${profile.llm?.vendor ?? ''}`,
    `LLM_MODEL=${profile.llm?.params?.model ?? profile.llm?.model ?? ''}`,
    `LLM_API_KEY=${profile.llm?.api_key ?? ''}`,
    `LLM_URL=${profile.llm?.url ?? ''}`,
    `LLM_STYLE=${profile.llm?.style ?? ''}`,
    '',
    '# TTS Configuration',
    `TTS_VENDOR=${profile.tts?.vendor ?? ''}`,
    `TTS_API_KEY=${profile.tts?.params?.key ?? ''}`,
    '',
    '# ASR Configuration',
    `ASR_VENDOR=${profile.asr?.vendor ?? 'ares'}`,
    `ASR_LANGUAGE=${profile.asr?.language ?? 'en-US'}`,
  ];

  return lines.join('\n') + '\n';
}

export function registerInit(program: Command): void {
  program
    .command('init [project-name]')
    .description('Create a new ConvoAI starter project')
    .action(async (projectName?: string) => {
      const name = projectName || 'my-convoai-app';
      const targetDir = join(process.cwd(), name);

      // 1. Check target directory
      if (existsSync(targetDir)) {
        try {
          const entries = readdirSync(targetDir);
          if (entries.length > 0) {
            console.error(chalk.red(`\n  Error: Directory "${name}" already exists and is not empty.\n`));
            process.exit(1);
          }
        } catch {
          console.error(chalk.red(`\n  Error: Cannot read directory "${name}".\n`));
          process.exit(1);
        }
      }

      // 2. Find and copy template
      try {
        const starterDir = findStarterDir();
        cpSync(starterDir, targetDir, { recursive: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(chalk.red(`\n  Error: ${msg}\n`));
        process.exit(1);
      }

      // 3. Generate .env from CLI config
      const config = loadCliConfig();
      const envContent = generateEnv(config);
      writeFileSync(join(targetDir, '.env'), envContent, 'utf-8');

      // 4. Update package name
      try {
        const pkgPath = join(targetDir, 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        pkg.name = name;
        writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      } catch { /* non-critical */ }

      // 5. Print success
      const hasCredentials = !!(config.app_id && config.customer_id);

      console.log('');
      console.log(chalk.green(`  ✓ Project created: ${name}/`));
      console.log('');

      if (!hasCredentials) {
        console.log(chalk.yellow('  ⚠ No Agora credentials found.'));
        console.log(chalk.yellow('  Run "convoai quickstart" first, or edit .env manually.'));
        console.log('');
      }

      console.log(chalk.bold('  Next steps:'));
      console.log(chalk.cyan(`    cd ${name}`));
      console.log(chalk.cyan('    npm install'));
      console.log(chalk.cyan('    convoai dev'));
      console.log('');
      console.log(chalk.dim('  Project structure:'));
      console.log(chalk.dim('    frontend/       ← customize your UI'));
      console.log(chalk.dim('    server/         ← add your business logic'));
      console.log(chalk.dim('    python-server/  ← alternative Python server'));
      console.log('');
    });
}
