import Table from 'cli-table3';
import chalk from 'chalk';

/**
 * Print a formatted table to stdout.
 */
export function printTable(headers: string[], rows: string[][]): void {
  const table = new Table({
    head: headers.map((h) => chalk.bold(h)),
    style: {
      head: [],       // disable default color — we apply our own via chalk
      border: [],
      compact: true,
    },
    chars: {
      top: '', 'top-mid': '', 'top-left': '', 'top-right': '',
      bottom: '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
      left: '', 'left-mid': '',
      mid: '', 'mid-mid': '',
      right: '', 'right-mid': '',
      middle: '  ',
    },
  });

  for (const row of rows) {
    table.push(row);
  }

  console.log(table.toString());
}

/**
 * Print a list of key-value pairs, formatted for single-item detail views.
 */
export function printKeyValue(pairs: [string, string][]): void {
  const maxKeyLen = Math.max(...pairs.map(([k]) => k.length));

  for (const [key, value] of pairs) {
    const paddedKey = key.padEnd(maxKeyLen);
    console.log(`  ${chalk.dim(paddedKey)}  ${value}`);
  }
}
