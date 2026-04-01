import chalk from 'chalk';

/**
 * Output data as JSON (if --json flag is set) or do nothing and let
 * the calling command handle human-friendly rendering.
 */
export function output(data: unknown, opts: { json?: boolean }): void {
  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
  }
}

/** Check whether JSON output mode is active. */
export function isJsonMode(options: { json?: boolean }): boolean {
  return options.json === true;
}

/** Print a success message with a green checkmark. */
export function printSuccess(message: string): void {
  console.log(`${chalk.green('\u2714')} ${message}`);
}

/** Print an error message with a red X. */
export function printError(message: string): void {
  console.error(`${chalk.red('\u2716')} ${message}`);
}

/** Print a next-step hint with a dim prefix. */
export function printHint(message: string): void {
  console.log(`${chalk.dim('Next:')} ${message}`);
}
