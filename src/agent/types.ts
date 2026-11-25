/**
 * Core types for the agent runtime.
 *
 * Messages, tools, and content blocks use the Anthropic SDK's own types so the
 * same loop runs against a live model or the offline replay driver.
 */
import type Anthropic from '@anthropic-ai/sdk';

export interface AgentDef {
  id: string;
  name: string;
  /** The company this agent works for. Agents only see their own org's tools and data. */
  org: string;
  role: string;
  initials: string;
  color: string;
  instructions: string;
  /** Skill names (folders under /skills) this agent may load. */
  skills: string[];
  /** Tool names from the tool registry. */
  tools: string[];
}

export interface RunContext {
  agent: AgentDef;
  depth: number;
  /** Run another agent and return its final answer. Used by handoff and A2A tools. */
  runAgent: (agentId: string, task: string, from: AgentDef) => Promise<string>;
  emit: (e: TraceInput) => void;
  /** Shared scratch space for this mission run (artifacts, ids, anything tools want to remember). */
  state: Record<string, unknown>;
}

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Anthropic.Tool.InputSchema;
  run: (input: Record<string, unknown>, ctx: RunContext) => unknown | Promise<unknown>;
}

export interface Skill {
  name: string;
  description: string;
  body: string;
}

export type TraceEvent = TraceInput & { seq: number; at: number };

export type TraceInput =
  | { kind: 'agent_start'; agent: string; task: string; depth: number; from?: string }
  | { kind: 'text'; agent: string; text: string }
  | { kind: 'skill'; agent: string; skill: string }
  | { kind: 'tool_call'; agent: string; id: string; tool: string; input: unknown }
  | { kind: 'tool_result'; agent: string; id: string; tool: string; output: unknown; isError?: boolean }
  | { kind: 'a2a'; from: string; to: string; text: string; direction: 'request' | 'response' }
  | { kind: 'handoff'; from: string; to: string; task: string }
  | { kind: 'agent_end'; agent: string; output: string }
  | { kind: 'artifact'; agent: string; title: string; body: string }
  | { kind: 'usage'; agent: string; inputTokens: number; outputTokens: number }
  | { kind: 'error'; agent: string; text: string };

export interface StepRequest {
  agent: AgentDef;
  system: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
}

export interface StepResponse {
  content: Anthropic.ContentBlockParam[];
  stop_reason: string | null;
  usage?: { input_tokens: number; output_tokens: number };
}

/** Anything that can take one turn for an agent: a live model or a scripted policy. */
export interface Driver {
  readonly mode: 'replay' | 'live';
  step(req: StepRequest): Promise<StepResponse>;
}

export interface Mission {
  id: string;
  title: string;
  summary: string;
  /** Agent that receives the brief. */
  lead: string;
  brief: string;
}
