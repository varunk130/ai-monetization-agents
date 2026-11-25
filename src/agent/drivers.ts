/**
 * Drivers decide what an agent does on its next turn.
 *
 * LiveDriver: posts the turn to /api/llm, a local server route that calls
 * Claude with the Anthropic SDK (the API key never reaches the browser).
 *
 * ReplayDriver: runs a scripted policy per agent. Policies call the same real
 * tools with real inputs and write their answers from the real tool results,
 * so the trace has the same shape as a live run. Nothing in a replay is canned
 * output; only the decisions are scripted.
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { Driver, StepRequest, StepResponse } from './types';

export class LiveDriver implements Driver {
  readonly mode = 'live' as const;
  async step(req: StepRequest): Promise<StepResponse> {
    const res = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ system: req.system, messages: req.messages, tools: req.tools }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? `Model call failed (${res.status})`);
    return body as StepResponse;
  }
}

export async function liveAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) return false;
    return Boolean((await res.json()).live);
  } catch {
    return false;
  }
}

/** One scripted decision: optional narration, then tool calls or a final answer. */
export type PolicyStep =
  | { say?: string; call: { name: string; input: Record<string, unknown> }[] }
  | { final: string };

/** What a policy sees: its task and every tool result so far, keyed by tool name (in order). */
export interface PolicyView {
  task: string;
  results: Record<string, unknown[]>;
  /** Parsed result of the most recent call to a tool. */
  last: <T = unknown>(tool: string) => T | undefined;
}

export type Policy = (view: PolicyView, turn: number) => PolicyStep;

function parse(content: unknown): unknown {
  const text = typeof content === 'string' ? content : Array.isArray(content) ? content.map((c) => (c as { text?: string }).text ?? '').join('') : '';
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class ReplayDriver implements Driver {
  readonly mode = 'replay' as const;
  private counter = 0;
  constructor(private policies: Record<string, Policy>) {}

  async step(req: StepRequest): Promise<StepResponse> {
    const policy = this.policies[req.agent.id];
    if (!policy) throw new Error(`No replay policy for ${req.agent.id}`);

    const first = req.messages[0];
    const task = typeof first.content === 'string' ? first.content : '';
    const names = new Map<string, string>();
    const results: Record<string, unknown[]> = {};
    let turn = 0;
    for (const m of req.messages) {
      if (m.role === 'assistant' && Array.isArray(m.content)) {
        turn++;
        for (const b of m.content) if (b.type === 'tool_use') names.set(b.id, b.name);
      }
      if (m.role === 'user' && Array.isArray(m.content)) {
        for (const b of m.content) {
          if (b.type !== 'tool_result') continue;
          const name = names.get(b.tool_use_id) ?? 'unknown';
          (results[name] ??= []).push(parse(b.content));
        }
      }
    }
    const view: PolicyView = { task, results, last: <T,>(tool: string) => results[tool]?.[results[tool].length - 1] as T | undefined };
    const s = policy(view, turn);

    if ('final' in s) {
      return { content: [{ type: 'text', text: s.final }], stop_reason: 'end_turn' };
    }
    const content: Anthropic.ContentBlockParam[] = [];
    if (s.say) content.push({ type: 'text', text: s.say });
    for (const c of s.call) content.push({ type: 'tool_use', id: `replay_${++this.counter}`, name: c.name, input: c.input });
    return { content, stop_reason: 'tool_use' };
  }
}
