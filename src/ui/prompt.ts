/**
 * Safe wrapper around inquirer.prompt that yields to the event loop
 * before rendering the next prompt. Fixes an Inquirer 9.x issue where
 * terminal output between prompts gets buffered until a keypress.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safePrompt<T = any>(
  questions: Parameters<typeof import('inquirer').default.prompt>[0],
): Promise<T> {
  await new Promise(resolve => setImmediate(resolve));
  const { default: inquirer } = await import('inquirer');
  return inquirer.prompt(questions) as Promise<T>;
}
