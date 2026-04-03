import chalk from 'chalk';

// ─── Helpers ───────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function gradientColor(t: number): string {
  // blue(80,150,255) → pink(220,72,195)
  return `#${lerp(80, 220, t).toString(16).padStart(2, '0')}${lerp(150, 72, t).toString(16).padStart(2, '0')}${lerp(255, 195, t).toString(16).padStart(2, '0')}`;
}

/**
 * Calculate the display width of a string in terminal columns.
 * CJK characters and emoji take 2 columns, ASCII takes 1.
 */
function displayWidth(str: string): number {
  let w = 0;
  for (const ch of str) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
      (code >= 0x2e80 && code <= 0x303e) || // CJK Radicals
      (code >= 0x3040 && code <= 0x33bf) || // Japanese + CJK
      (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified
      (code >= 0xac00 && code <= 0xd7af) || // Hangul Syllables
      (code >= 0xf900 && code <= 0xfaff) || // CJK Compat
      (code >= 0xfe30 && code <= 0xfe4f) || // CJK Compat Forms
      (code >= 0xff01 && code <= 0xff60) || // Fullwidth Forms
      (code >= 0x1f000 && code <= 0x1ffff) || // Emoji & symbols
      (code >= 0x20000 && code <= 0x2ffff) || // CJK Extension B+
      (code >= 0x2600 && code <= 0x27bf) || // Misc symbols
      (code >= 0xfe00 && code <= 0xfe0f) || // Variation selectors
      (code >= 0x200d && code <= 0x200d)    // ZWJ
    ) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

const GREEN = '#10b981';
const BOX_WIDTH = 56; // wider to fit CJK content

// ─── Padding helper ───────────────────────────────────────────────────────

function padToWidth(content: string, plainText: string, targetWidth: number): string {
  const visWidth = displayWidth(plainText);
  const pad = Math.max(0, targetWidth - visWidth);
  return content + ' '.repeat(pad);
}

// ─── gradientBox ───────────────────────────────────────────────────────────

export function gradientBox(opts: {
  emoji: string;
  title: string;
  subtitle: string;
  body?: string[];
}): string[] {
  const { emoji, title, subtitle, body } = opts;
  const inner = BOX_WIDTH - 2;

  // Top border
  const topChars = ['╭', ...Array(inner).fill('─'), '╮'];
  const top = '  ' + topChars
    .map((ch, i) => chalk.hex(gradientColor(i / (topChars.length - 1)))(ch))
    .join('');

  // Bottom border
  const bottomChars = ['╰', ...Array(inner).fill('─'), '╯'];
  const bottom = '  ' + bottomChars
    .map((ch, i) => chalk.hex(gradientColor(i / (bottomChars.length - 1)))(ch))
    .join('');

  const leftBorder = chalk.hex(gradientColor(0))('│');
  const rightBorder = chalk.hex(gradientColor(1))('│');
  const blankLine = `  ${leftBorder}${' '.repeat(inner)}${rightBorder}`;

  // Title: emoji + gradient text
  const titleGrad = [...title]
    .map((ch, i) => chalk.hex(gradientColor(i / Math.max(title.length - 1, 1))).bold(ch))
    .join('');
  const titlePlain = `   ${emoji}  ${title}`;
  const titleContent = `   ${emoji}  ${titleGrad}`;
  const titlePadded = padToWidth(titleContent, titlePlain, inner);
  const titleLine = `  ${leftBorder}${titlePadded}${rightBorder}`;

  // Subtitle
  const lines: string[] = [top, blankLine, titleLine];

  if (subtitle) {
    const subPlain = `      ${subtitle}`;
    const subContent = `      ${chalk.dim(subtitle)}`;
    const subPadded = padToWidth(subContent, subPlain, inner);
    lines.push(`  ${leftBorder}${subPadded}${rightBorder}`);
  }

  // Body lines
  if (body && body.length > 0) {
    for (const line of body) {
      if (line === '') {
        lines.push(blankLine);
      } else {
        const bodyPlain = `      ${line}`;
        const bodyContent = `      ${chalk.dim(line)}`;
        const bodyPadded = padToWidth(bodyContent, bodyPlain, inner);
        lines.push(`  ${leftBorder}${bodyPadded}${rightBorder}`);
      }
    }
  }

  lines.push(blankLine, bottom);
  return lines;
}

// ─── gradientBoxGreen ──────────────────────────────────────────────────────

export function gradientBoxGreen(opts: {
  emoji: string;
  title: string;
  subtitle: string;
}): string[] {
  const { emoji, title, subtitle } = opts;
  const inner = BOX_WIDTH - 2;
  const gc = chalk.hex(GREEN);

  const top = '  ' + gc('╭' + '─'.repeat(inner) + '╮');
  const bottom = '  ' + gc('╰' + '─'.repeat(inner) + '╯');
  const leftBorder = gc('│');
  const rightBorder = gc('│');
  const blankLine = `  ${leftBorder}${' '.repeat(inner)}${rightBorder}`;

  const titleStyled = [...title].map((ch) => gc(chalk.bold(ch))).join('');
  const titlePlain = `   ${emoji}  ${title}`;
  const titleContent = `   ${emoji}  ${titleStyled}`;
  const titlePadded = padToWidth(titleContent, titlePlain, inner);
  const titleLine = `  ${leftBorder}${titlePadded}${rightBorder}`;

  const subPlain = `      ${subtitle}`;
  const subContent = `      ${chalk.dim(subtitle)}`;
  const subPadded = padToWidth(subContent, subPlain, inner);
  const subLine = `  ${leftBorder}${subPadded}${rightBorder}`;

  return [top, blankLine, titleLine, subLine, blankLine, bottom];
}

// ─── gradientTitle ─────────────────────────────────────────────────────────

export function gradientTitle(text: string): string {
  return [...text]
    .map((ch, i) => chalk.hex(gradientColor(i / Math.max(text.length - 1, 1))).bold(ch))
    .join('');
}

// ─── gradientProgress ──────────────────────────────────────────────────────

export function gradientProgress(current: number, total: number): string {
  const barWidth = 30;
  const filled = Math.round((current / total) * barWidth);
  const isComplete = current === total;

  const blocks: string[] = [];
  for (let i = 0; i < filled; i++) {
    let color: string;
    if (isComplete) {
      const t = i / Math.max(filled - 1, 1);
      if (t <= 0.5) {
        color = gradientColor(t * 2);
      } else {
        const seg = (t - 0.5) * 2;
        const r = lerp(220, 16, seg);
        const g = lerp(72, 185, seg);
        const b = lerp(195, 129, seg);
        color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      }
    } else {
      const t = i / Math.max(filled - 1, 1);
      color = gradientColor(t);
    }
    blocks.push(chalk.bgHex(color)(' '));
  }

  return `  ${blocks.join('')}  ${chalk.dim(`${current}/${total}`)}`;
}
