import chalk from 'chalk';

// ─── Helpers ───────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function gradientColor(t: number): string {
  // blue(80,150,255) → pink(220,72,195)
  return `#${lerp(80, 220, t).toString(16).padStart(2, '0')}${lerp(150, 72, t).toString(16).padStart(2, '0')}${lerp(255, 195, t).toString(16).padStart(2, '0')}`;
}

const GREEN = '#10b981'; // rgb(16,185,129)
const BOX_WIDTH = 44;

// ─── gradientBox ───────────────────────────────────────────────────────────

export function gradientBox(opts: {
  emoji: string;
  title: string;
  subtitle: string;
  body?: string[];
}): string[] {
  const { emoji, title, subtitle, body } = opts;
  const inner = BOX_WIDTH - 2; // chars between │ and │

  // Top border: ╭──...──╮
  const topChars = ['╭', ...Array(inner).fill('─'), '╮'];
  const top = topChars
    .map((ch, i) => chalk.hex(gradientColor(i / (topChars.length - 1)))(ch))
    .join('');

  // Bottom border: ╰──...──╯
  const bottomChars = ['╰', ...Array(inner).fill('─'), '╯'];
  const bottom = bottomChars
    .map((ch, i) => chalk.hex(gradientColor(i / (bottomChars.length - 1)))(ch))
    .join('');

  const leftBorder = chalk.hex(gradientColor(0))('│');
  const rightBorder = chalk.hex(gradientColor(1))('│');

  const blankLine = `${leftBorder}${' '.repeat(inner)}${rightBorder}`;

  // Title line: emoji + each char of title in gradient, bold
  const titleGrad = [...title]
    .map((ch, i) => chalk.hex(gradientColor(i / Math.max(title.length - 1, 1))).bold(ch))
    .join('');
  const titleContent = `  ${emoji}  ${titleGrad}`;
  // We need to pad to inner width using visible char count
  const titleVisible = 2 + 2 + 1 + title.length; // "  " + emoji(~2 display) + "  " + title chars
  const titlePad = Math.max(0, inner - titleVisible);
  const titleLine = `${leftBorder}${titleContent}${' '.repeat(titlePad)}${rightBorder}`;

  // Subtitle line
  const subContent = `     ${chalk.dim(subtitle)}`;
  const subVisible = 5 + subtitle.length;
  const subPad = Math.max(0, inner - subVisible);
  const subLine = `${leftBorder}${subContent}${' '.repeat(subPad)}${rightBorder}`;

  const lines: string[] = [top, blankLine, titleLine, subLine];

  // Optional body lines
  if (body && body.length > 0) {
    for (const line of body) {
      const bodyContent = `     ${chalk.dim(line)}`;
      const bodyVisible = 5 + line.length;
      const bodyPad = Math.max(0, inner - bodyVisible);
      lines.push(`${leftBorder}${bodyContent}${' '.repeat(bodyPad)}${rightBorder}`);
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

  const top = gc('╭' + '─'.repeat(inner) + '╮');
  const bottom = gc('╰' + '─'.repeat(inner) + '╯');
  const leftBorder = gc('│');
  const rightBorder = gc('│');

  const blankLine = `${leftBorder}${' '.repeat(inner)}${rightBorder}`;

  // Title: each char in green, bold
  const titleStyled = [...title].map((ch) => gc(chalk.bold(ch))).join('');
  const titleVisible = 2 + 2 + 1 + title.length;
  const titlePad = Math.max(0, inner - titleVisible);
  const titleLine = `${leftBorder}  ${emoji}  ${titleStyled}${' '.repeat(titlePad)}${rightBorder}`;

  const subContent = `     ${chalk.dim(subtitle)}`;
  const subVisible = 5 + subtitle.length;
  const subPad = Math.max(0, inner - subVisible);
  const subLine = `${leftBorder}${subContent}${' '.repeat(subPad)}${rightBorder}`;

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
      // blue → pink → green celebration gradient
      const t = i / Math.max(filled - 1, 1);
      if (t <= 0.5) {
        // blue → pink
        const seg = t * 2;
        color = gradientColor(seg);
      } else {
        // pink → green
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

  const bar = blocks.join('');
  const suffix = chalk.dim(` ${current}/${total}`);
  return `${bar}${suffix}`;
}
