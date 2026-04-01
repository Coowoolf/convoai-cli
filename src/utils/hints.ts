// ─── Short ID ───────────────────────────────────────────────────────────────

/** Display a truncated agent ID (first 12 characters). */
export function shortId(id: string): string {
  return id.slice(0, 12);
}

// ─── Next-Step Hints ────────────────────────────────────────────────────────

export function hintAfterStart(agentId: string): string {
  return `Run \`convoai agent status ${shortId(agentId)}\` to check status.`;
}

export function hintAfterStop(): string {
  return 'Run `convoai agent list` to see remaining agents.';
}

export function hintAfterLogin(): string {
  return 'Run `convoai agent start --channel <name>` to start your first agent.';
}

export function hintAfterList(): string {
  return 'Run `convoai agent status <id>` to inspect an agent.';
}

export function hintAfterHistory(agentId: string): string {
  return `Run \`convoai agent turns ${shortId(agentId)}\` to view turn-level latency.`;
}
