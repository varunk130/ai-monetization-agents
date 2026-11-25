/**
 * The agent loop.
 *
 * For each agent: build a system prompt (instructions + skill index + org
 * boundary), expose its tools plus load_skill, then loop: ask the driver for a
 * turn, run any tool calls, feed results back, until the agent stops calling
 * tools. Handoffs and agent-to-agent messages are just tools that run another
 * agent and return its answer, so the whole network is one recursive loop.
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { AgentDef, Driver, RunContext, ToolDef, TraceEvent, TraceInput } from './types';
import { SKILLS, skillIndex } from './skills';

const MAX_TURNS = 12;
const MAX_DEPTH = 4;

export interface Network {
  agents: Record<string, AgentDef>;
  tools: Record<string, ToolDef>;
}

export interface RunOptions {
  network: Network;
  driver: Driver;
  onEvent: (e: TraceEvent) => void;
  /** Called between events so replays can be watched at human speed. */
  pace?: () => Promise<void>;
  signal?: AbortSignal;
}

const LOAD_SKILL: ToolDef = {
  name: 'load_skill',
  description: 'Read the full instructions for one of your skills. Load a skill before doing work it covers.',
  input_schema: {
    type: 'object',
    properties: { name: { type: 'string', description: 'Skill name from your skill list' } },
    required: ['name'],
    additionalProperties: false,
  },
  run: (input, ctx) => {
    const name = String(input.name);
    if (!ctx.agent.skills.includes(name) || !SKILLS[name]) throw new Error(`No skill named "${name}" is available to ${ctx.agent.name}.`);
    ctx.emit({ kind: 'skill', agent: ctx.agent.id, skill: name });
    return SKILLS[name].body;
  },
};

export function systemPrompt(agent: AgentDef, network: Network): string {
  const peers = Object.values(network.agents)
    .filter((a) => a.id !== agent.id)
    .map((a) => `- ${a.id} (${a.name}, ${a.org}): ${a.role}`)
    .join('\n');
  return [
    `You are ${agent.name}, working for ${agent.org}. ${agent.role}`,
    agent.instructions,
    `## Skills\nYou have these skills. Call load_skill to read one before you rely on it.\n${skillIndex(agent.skills) || '(none)'}`,
    `## Other agents in the network\n${peers}`,
    `## Boundaries\nYou can only use your own tools. Data from another company reaches you only through what its agent chooses to tell you. Never invent numbers: get them from a tool or say they are unknown. Keep your final answer concise and specific; it is read by the agent that called you.`,
  ].join('\n\n');
}

function toAnthropicTool(t: ToolDef): Anthropic.Tool {
  return { name: t.name, description: t.description, input_schema: t.input_schema };
}

const textOf = (content: Anthropic.ContentBlockParam[]) =>
  content
    .filter((b): b is Anthropic.TextBlockParam => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

export async function runMission(leadId: string, brief: string, opts: RunOptions): Promise<{ output: string; state: Record<string, unknown> }> {
  let seq = 0;
  const state: Record<string, unknown> = {};
  const emit = (e: TraceInput) => opts.onEvent({ ...e, seq: seq++, at: Date.now() } as TraceEvent);

  const run = async (agentId: string, task: string, depth: number, from?: AgentDef): Promise<string> => {
    const agent = opts.network.agents[agentId];
    if (!agent) throw new Error(`Unknown agent "${agentId}"`);
    if (depth > MAX_DEPTH) throw new Error('Delegation is too deep');

    emit({ kind: 'agent_start', agent: agent.id, task, depth, from: from?.id });
    await opts.pace?.();

    const toolDefs = [LOAD_SKILL, ...agent.tools.map((n) => {
      const t = opts.network.tools[n];
      if (!t) throw new Error(`Agent ${agent.id} lists unknown tool ${n}`);
      return t;
    })];
    const system = systemPrompt(agent, opts.network);
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: task }];
    const ctx: RunContext = {
      agent,
      depth,
      state,
      emit,
      runAgent: (id, t, f) => run(id, t, depth + 1, f),
    };

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      if (opts.signal?.aborted) throw new DOMException('Run stopped', 'AbortError');
      const res = await opts.driver.step({ agent, system, messages, tools: toolDefs.map(toAnthropicTool) });
      if (res.usage) emit({ kind: 'usage', agent: agent.id, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens });

      // Append the assistant turn exactly as returned (thinking blocks must be passed back unchanged).
      messages.push({ role: 'assistant', content: res.content });
      const said = textOf(res.content);
      const calls = res.content.filter((b): b is Anthropic.ToolUseBlockParam => b.type === 'tool_use');

      if (res.stop_reason === 'refusal') {
        emit({ kind: 'error', agent: agent.id, text: 'The model declined this request.' });
        return said || 'Declined.';
      }
      if (calls.length === 0) {
        emit({ kind: 'agent_end', agent: agent.id, output: said });
        await opts.pace?.();
        return said;
      }
      if (said) {
        emit({ kind: 'text', agent: agent.id, text: said });
        await opts.pace?.();
      }

      // Run every call from this turn, then return all results in one user message.
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const call of calls) {
        const tool = toolDefs.find((t) => t.name === call.name);
        emit({ kind: 'tool_call', agent: agent.id, id: call.id, tool: call.name, input: call.input });
        await opts.pace?.();
        try {
          if (!tool) throw new Error(`Unknown tool ${call.name}`);
          const out = await tool.run((call.input ?? {}) as Record<string, unknown>, ctx);
          const content = typeof out === 'string' ? out : JSON.stringify(out, null, 2);
          emit({ kind: 'tool_result', agent: agent.id, id: call.id, tool: call.name, output: out });
          results.push({ type: 'tool_result', tool_use_id: call.id, content });
        } catch (err) {
          if ((err as Error).name === 'AbortError') throw err;
          const msg = (err as Error).message;
          emit({ kind: 'tool_result', agent: agent.id, id: call.id, tool: call.name, output: msg, isError: true });
          results.push({ type: 'tool_result', tool_use_id: call.id, content: msg, is_error: true });
        }
        await opts.pace?.();
      }
      messages.push({ role: 'user', content: results });
    }
    const out = 'Stopped: reached the turn limit before finishing.';
    emit({ kind: 'agent_end', agent: agent.id, output: out });
    return out;
  };

  const output = await run(leadId, brief, 0);
  return { output, state };
}

/** Tool that hands a task to a teammate in the same org and returns their answer. */
export const HANDOFF: ToolDef = {
  name: 'handoff',
  description: 'Give a focused task to a teammate agent in your own company and get their answer back.',
  input_schema: {
    type: 'object',
    properties: {
      agent_id: { type: 'string', description: 'Teammate agent id' },
      task: { type: 'string', description: 'What you need, with all context they need' },
    },
    required: ['agent_id', 'task'],
    additionalProperties: false,
  },
  run: async (input, ctx) => {
    const to = String(input.agent_id);
    const task = String(input.task);
    ctx.emit({ kind: 'handoff', from: ctx.agent.id, to, task });
    return ctx.runAgent(to, task, ctx.agent);
  },
};

/** Tool that saves a finished deliverable for the user. */
export const SAVE_ARTIFACT: ToolDef = {
  name: 'save_artifact',
  description: 'Save a finished deliverable (Markdown) for the user.',
  input_schema: {
    type: 'object',
    properties: { title: { type: 'string' }, markdown: { type: 'string' } },
    required: ['title', 'markdown'],
    additionalProperties: false,
  },
  run: (input, ctx) => {
    const title = String(input.title);
    const body = String(input.markdown);
    ctx.emit({ kind: 'artifact', agent: ctx.agent.id, title, body });
    const list = (ctx.state.artifacts as { title: string; body: string }[] | undefined) ?? [];
    list.push({ title, body });
    ctx.state.artifacts = list;
    return `Saved "${title}".`;
  },
};
