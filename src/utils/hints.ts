// ─── Short ID ───────────────────────────────────────────────────────────────

/** Display a truncated agent ID (first 12 characters). */
export function shortId(id: string): string {
  return id.slice(0, 12);
}

// ─── Next-Step Hints ────────────────────────────────────────────────────────

export function hintAfterStart(agentId: string, channel?: string): string {
  const lines: string[] = [];
  lines.push(`Check status: convoai agent status ${agentId}`);
  if (channel) {
    lines.push(`Voice chat:   convoai agent join --channel ${channel}`);
  }
  return lines.join('\n      ');
}

export function hintAfterStop(): string {
  return 'Run convoai agent list to see remaining agents.';
}

export function hintAfterLogin(): string {
  return 'Start a voice chat: convoai agent join --channel my-room';
}

export function hintAfterList(): string {
  return 'Inspect: convoai agent status <id>  |  Voice chat: convoai agent join -c <channel>';
}

export function hintAfterHistory(agentId: string): string {
  return `View latency: convoai agent turns ${agentId}`;
}
