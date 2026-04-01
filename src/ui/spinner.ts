import ora from 'ora';

/**
 * Run an async function with a terminal spinner.
 * Gracefully degrades in non-TTY environments (e.g. piped output).
 */
export async function withSpinner<T>(
  message: string,
  fn: () => Promise<T>,
): Promise<T> {
  // Skip spinner entirely if stdout is not a TTY
  if (!process.stdout.isTTY) {
    return fn();
  }

  const spinner = ora(message).start();

  try {
    const result = await fn();
    spinner.succeed();
    return result;
  } catch (err) {
    const failMessage = err instanceof Error ? err.message : String(err);
    spinner.fail(failMessage);
    throw err;
  }
}
