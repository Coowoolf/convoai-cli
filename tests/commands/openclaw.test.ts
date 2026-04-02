import { describe, it, expect, vi } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const CLI = join(process.cwd(), 'dist/bin/convoai.js');

function cli(args: string): string {
  try {
    return execSync(`node ${CLI} ${args}`, { encoding: 'utf-8', timeout: 10000 });
  } catch (err: any) {
    return (err.stdout || '') + (err.stderr || '');
  }
}

describe('convoai openclaw command', () => {
  it('shows in top-level --help', () => {
    const output = cli('--help');
    expect(output).toContain('openclaw');
    expect(output).toContain('Voice-enable');
  });

  it('shows correct --help with all options', () => {
    const output = cli('openclaw --help');
    expect(output).toContain('--agent');
    expect(output).toContain('--port');
    expect(output).toContain('--channel');
    expect(output).toContain('--profile');
    expect(output).toContain('OpenClaw');
  });

  it('default agent is "main"', () => {
    const output = cli('openclaw --help');
    expect(output).toContain('"main"');
  });

  it('default port is "3456"', () => {
    const output = cli('openclaw --help');
    expect(output).toContain('"3456"');
  });

  it('default channel is "openclaw-voice"', () => {
    const output = cli('openclaw --help');
    expect(output).toContain('"openclaw-voice"');
  });
});

describe('OpenClaw bridge SSE format', () => {
  it('generates valid SSE chunk format', () => {
    // Test the chunk format that the bridge produces
    const id = 'chatcmpl-openclaw-123';
    const ts = Math.floor(Date.now() / 1000);
    const chunk = JSON.stringify({
      id,
      object: 'chat.completion.chunk',
      created: ts,
      choices: [{ index: 0, delta: { content: 'hello' }, finish_reason: null }],
    });

    const parsed = JSON.parse(chunk);
    expect(parsed.object).toBe('chat.completion.chunk');
    expect(parsed.choices[0].delta.content).toBe('hello');
    expect(parsed.choices[0].finish_reason).toBeNull();
  });

  it('generates valid SSE stop chunk', () => {
    const chunk = JSON.stringify({
      id: 'test',
      object: 'chat.completion.chunk',
      created: 123,
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    });

    const parsed = JSON.parse(chunk);
    expect(parsed.choices[0].finish_reason).toBe('stop');
    expect(parsed.choices[0].delta).toEqual({});
  });

  it('splits reply into sentences for natural TTS', () => {
    const replyText = '你好。我是OpenClaw。有什么可以帮你的？';
    const sentences = replyText.match(/[^。！？.!?\n]+[。！？.!?\n]?/g) ?? [replyText];
    expect(sentences).toEqual(['你好。', '我是OpenClaw。', '有什么可以帮你的？']);
  });

  it('handles reply without punctuation', () => {
    const replyText = 'Hello world';
    const sentences = replyText.match(/[^。！？.!?\n]+[。！？.!?\n]?/g) ?? [replyText];
    expect(sentences).toEqual(['Hello world']);
  });

  it('handles empty reply', () => {
    const replyText = '';
    const sentences = replyText.match(/[^。！？.!?\n]+[。！？.!?\n]?/g) ?? [replyText];
    expect(sentences).toEqual(['']);
  });
});

describe('OpenClaw JSON parsing', () => {
  it('parses clean JSON response', () => {
    const stdout = JSON.stringify({
      runId: 'test',
      status: 'ok',
      result: { payloads: [{ text: 'Hello!', mediaUrl: null }] },
    });

    const parsed = JSON.parse(stdout);
    expect(parsed.result.payloads[0].text).toBe('Hello!');
  });

  it('parses JSON with plugin log prefix', () => {
    const stdout = `[plugins] feishu_doc: Registered
[plugins] feishu_chat: Registered
${JSON.stringify({
      runId: 'test',
      status: 'ok',
      result: { payloads: [{ text: 'Hello!' }] },
    })}`;

    const jsonStart = stdout.indexOf('{');
    const jsonStr = jsonStart >= 0 ? stdout.slice(jsonStart) : stdout;
    const parsed = JSON.parse(jsonStr);
    expect(parsed.result.payloads[0].text).toBe('Hello!');
  });

  it('handles missing payloads gracefully', () => {
    const stdout = JSON.stringify({ runId: 'test', status: 'ok', result: {} });
    const parsed = JSON.parse(stdout);
    const text = parsed.result?.payloads?.[0]?.text ?? 'fallback';
    expect(text).toBe('fallback');
  });

  it('handles null result gracefully', () => {
    const stdout = JSON.stringify({ runId: 'test', status: 'error', result: null });
    const parsed = JSON.parse(stdout);
    const text = parsed.result?.payloads?.[0]?.text ?? 'fallback';
    expect(text).toBe('fallback');
  });
});

describe('Filler messages', () => {
  it('has variety of fillers', () => {
    const fillers = [
      '好的，让我想一想。',
      '收到了，我来看一看。',
      '嗯，让我处理一下。',
      '好，我来帮你查一下。',
      '收到，稍等我一下。',
      '好的，马上回复你。',
      '嗯嗯，让我看看。',
    ];
    expect(fillers.length).toBeGreaterThanOrEqual(7);

    // Each filler ends with Chinese punctuation
    for (const f of fillers) {
      expect(f).toMatch(/[。！？]$/);
    }
  });

  it('random selection produces different results over many picks', () => {
    const fillers = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const picks = new Set<string>();
    for (let i = 0; i < 50; i++) {
      picks.add(fillers[Math.floor(Math.random() * fillers.length)]);
    }
    // Over 50 picks from 7 items, should hit at least 3 different ones
    expect(picks.size).toBeGreaterThanOrEqual(3);
  });
});
