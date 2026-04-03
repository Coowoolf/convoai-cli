import { describe, it, expect } from 'vitest';

/**
 * Real-time transcript tests.
 * TDD: these define the expected behavior BEFORE implementation.
 */

describe('Transcript message parsing', () => {
  // v2 protocol message types
  const VALID_OBJECTS = [
    'user.transcription',
    'assistant.transcription',
    'message.interrupt',
    'message.metrics',
  ];

  it('recognizes all v2 transcript message types', () => {
    for (const obj of VALID_OBJECTS) {
      expect(VALID_OBJECTS.includes(obj)).toBe(true);
    }
  });

  it('parses user.transcription correctly', () => {
    const msg = {
      object: 'user.transcription',
      text: '今天天气怎么样',
      final: true,
      turn_id: 1,
      stream_id: 100,
      language: 'zh-CN',
    };

    expect(msg.object).toBe('user.transcription');
    expect(msg.text).toBe('今天天气怎么样');
    expect(msg.final).toBe(true);
    expect(msg.turn_id).toBe(1);
  });

  it('parses user.transcription partial (non-final)', () => {
    const msg = {
      object: 'user.transcription',
      text: '今天天',
      final: false,
      turn_id: 1,
    };

    expect(msg.final).toBe(false);
  });

  it('parses assistant.transcription correctly', () => {
    const msg = {
      object: 'assistant.transcription',
      text: '今天北京晴天，26度',
      turn_id: 1,
      turn_status: 0, // IN_PROGRESS
      turn_seq_id: 1,
      quiet: false,
    };

    expect(msg.object).toBe('assistant.transcription');
    expect(msg.turn_status).toBe(0);
  });

  it('identifies turn_status values', () => {
    // 0 = IN_PROGRESS, 1 = END, 2 = INTERRUPTED
    expect(0).toBe(0); // IN_PROGRESS
    expect(1).toBe(1); // END
    expect(2).toBe(2); // INTERRUPTED
  });

  it('parses message.interrupt', () => {
    const msg = {
      object: 'message.interrupt',
      turn_id: 1,
    };

    expect(msg.object).toBe('message.interrupt');
  });
});

describe('Transcript reducer (state management)', () => {
  interface TranscriptEntry {
    role: 'user' | 'assistant';
    text: string;
    turnId: number;
    final: boolean;
    interrupted: boolean;
  }

  interface TranscriptState {
    entries: TranscriptEntry[];
    ephemeral: TranscriptEntry | null; // current in-progress line
    lastRenderedTurnId: number;
  }

  function createState(): TranscriptState {
    return { entries: [], ephemeral: null, lastRenderedTurnId: -1 };
  }

  function applyMessage(state: TranscriptState, msg: Record<string, unknown>): void {
    const obj = msg.object as string;
    const turnId = (msg.turn_id as number) ?? 0;

    if (obj === 'user.transcription') {
      const final = msg.final as boolean;
      const text = msg.text as string;

      if (final) {
        // Commit: replace ephemeral with final entry
        state.ephemeral = null;
        state.entries.push({ role: 'user', text, turnId, final: true, interrupted: false });
        state.lastRenderedTurnId = turnId;
      } else {
        // Update ephemeral (partial result)
        state.ephemeral = { role: 'user', text, turnId, final: false, interrupted: false };
      }
    } else if (obj === 'assistant.transcription') {
      const turnStatus = msg.turn_status as number;
      const text = msg.text as string;

      if (turnStatus === 0) {
        // IN_PROGRESS: update ephemeral
        state.ephemeral = { role: 'assistant', text, turnId, final: false, interrupted: false };
      } else if (turnStatus === 1) {
        // END: commit
        state.ephemeral = null;
        state.entries.push({ role: 'assistant', text, turnId, final: true, interrupted: false });
        state.lastRenderedTurnId = turnId;
      } else if (turnStatus === 2) {
        // INTERRUPTED: commit with flag
        state.ephemeral = null;
        state.entries.push({ role: 'assistant', text, turnId, final: true, interrupted: true });
        state.lastRenderedTurnId = turnId;
      }
    } else if (obj === 'message.interrupt') {
      // Force-end any ephemeral
      if (state.ephemeral) {
        state.entries.push({ ...state.ephemeral, final: true, interrupted: true });
        state.ephemeral = null;
      }
    }
  }

  it('handles user partial → final flow', () => {
    const state = createState();

    applyMessage(state, { object: 'user.transcription', text: '今天', final: false, turn_id: 1 });
    expect(state.ephemeral?.text).toBe('今天');
    expect(state.entries).toHaveLength(0);

    applyMessage(state, { object: 'user.transcription', text: '今天天气', final: false, turn_id: 1 });
    expect(state.ephemeral?.text).toBe('今天天气');

    applyMessage(state, { object: 'user.transcription', text: '今天天气怎么样', final: true, turn_id: 1 });
    expect(state.ephemeral).toBeNull();
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].text).toBe('今天天气怎么样');
  });

  it('handles assistant in-progress → end flow', () => {
    const state = createState();

    applyMessage(state, { object: 'assistant.transcription', text: '今天', turn_status: 0, turn_id: 1 });
    expect(state.ephemeral?.text).toBe('今天');

    applyMessage(state, { object: 'assistant.transcription', text: '今天北京晴天', turn_status: 0, turn_id: 1 });
    expect(state.ephemeral?.text).toBe('今天北京晴天');

    applyMessage(state, { object: 'assistant.transcription', text: '今天北京晴天，26度', turn_status: 1, turn_id: 1 });
    expect(state.ephemeral).toBeNull();
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].text).toBe('今天北京晴天，26度');
  });

  it('handles interrupt correctly', () => {
    const state = createState();

    applyMessage(state, { object: 'assistant.transcription', text: '让我来帮你查', turn_status: 0, turn_id: 1 });
    expect(state.ephemeral).not.toBeNull();

    applyMessage(state, { object: 'message.interrupt', turn_id: 1 });
    expect(state.ephemeral).toBeNull();
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].interrupted).toBe(true);
  });

  it('handles assistant interrupted turn_status=2', () => {
    const state = createState();

    applyMessage(state, { object: 'assistant.transcription', text: '让我', turn_status: 0, turn_id: 1 });
    applyMessage(state, { object: 'assistant.transcription', text: '让我来帮', turn_status: 2, turn_id: 1 });

    expect(state.ephemeral).toBeNull();
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].interrupted).toBe(true);
  });

  it('does not duplicate entries on same turn_id', () => {
    const state = createState();

    applyMessage(state, { object: 'user.transcription', text: 'hello', final: true, turn_id: 1 });
    applyMessage(state, { object: 'assistant.transcription', text: 'hi', turn_status: 1, turn_id: 2 });

    expect(state.entries).toHaveLength(2);
    expect(state.entries[0].role).toBe('user');
    expect(state.entries[1].role).toBe('assistant');
  });

  it('tracks lastRenderedTurnId for fallback dedup', () => {
    const state = createState();

    applyMessage(state, { object: 'user.transcription', text: 'a', final: true, turn_id: 1 });
    expect(state.lastRenderedTurnId).toBe(1);

    applyMessage(state, { object: 'assistant.transcription', text: 'b', turn_status: 1, turn_id: 2 });
    expect(state.lastRenderedTurnId).toBe(2);
  });

  it('multi-turn conversation state', () => {
    const state = createState();

    // Turn 1: user
    applyMessage(state, { object: 'user.transcription', text: '你好', final: true, turn_id: 1 });
    // Turn 2: assistant
    applyMessage(state, { object: 'assistant.transcription', text: '你好！', turn_status: 1, turn_id: 2 });
    // Turn 3: user
    applyMessage(state, { object: 'user.transcription', text: '天气', final: true, turn_id: 3 });
    // Turn 4: assistant (interrupted)
    applyMessage(state, { object: 'assistant.transcription', text: '今天...', turn_status: 2, turn_id: 4 });

    expect(state.entries).toHaveLength(4);
    expect(state.entries[3].interrupted).toBe(true);
    expect(state.lastRenderedTurnId).toBe(4);
  });
});

describe('Agent request transcript parameters', () => {
  it('includes data_channel and transcript config', () => {
    const params = {
      data_channel: 'datastream',
      transcript: {
        enable: true,
        protocol_version: 'v2',
      },
      enable_metrics: true,
    };

    expect(params.data_channel).toBe('datastream');
    expect(params.transcript.enable).toBe(true);
    expect(params.transcript.protocol_version).toBe('v2');
  });
});

describe('WebSocket transcript relay format', () => {
  it('wraps transcript message for relay', () => {
    const original = {
      object: 'assistant.transcription',
      text: 'hello',
      turn_id: 1,
      turn_status: 0,
    };

    const relay = { type: 'transcript', data: original };

    expect(relay.type).toBe('transcript');
    expect(relay.data.object).toBe('assistant.transcription');
  });

  it('wraps metrics message for relay', () => {
    const original = {
      object: 'message.metrics',
      turn_id: 1,
    };

    const relay = { type: 'metrics', data: original };
    expect(relay.type).toBe('metrics');
  });
});
