/**
 * Local model route for live mode, mounted on the Vite dev/preview server.
 *
 *   POST /api/llm     one agent turn: { system, messages, tools } -> { content, stop_reason, usage }
 *   GET  /api/status  { live: boolean }
 *
 * The browser runs the agent loop and the tools (they work on the app's
 * synthetic data); this route only makes the model call, so the API key stays
 * on the server. Credentials resolve the SDK's usual way (ANTHROPIC_API_KEY,
 * ANTHROPIC_AUTH_TOKEN, or an `ant auth login` profile).
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Connect, Plugin } from 'vite';

const MODEL = process.env.AGENT_MODEL ?? 'claude-opus-5-5';

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (client) return client;
  try {
    client = new Anthropic();
    return client;
  } catch {
    return null;
  }
}

async function readJson(req: Connect.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

const middleware: Connect.NextHandleFunction = async (req, res, next) => {
  const send = (status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  };

  if (req.url === '/api/status' && req.method === 'GET') {
    const hasKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
    return send(200, { live: hasKey && getClient() !== null, model: MODEL });
  }
  if (req.url !== '/api/llm' || req.method !== 'POST') return next();

  const anthropic = getClient();
  if (!anthropic) return send(503, { error: 'No Anthropic credentials. Set ANTHROPIC_API_KEY and restart the dev server.' });

  try {
    const body = await readJson(req);
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Agents do focused, tool-heavy steps; medium effort keeps them quick.
      output_config: { effort: 'medium' },
      // If a request is declined by a safety classifier, retry on a fallback model chosen by the API.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: String(body.system ?? ''),
      messages: body.messages as Anthropic.Beta.BetaMessageParam[],
      tools: body.tools as Anthropic.Beta.BetaTool[],
    });
    send(200, { content: response.content, stop_reason: response.stop_reason, usage: response.usage });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return send(401, { error: 'Invalid Anthropic API key.' });
    if (err instanceof Anthropic.RateLimitError) return send(429, { error: 'Rate limited. Wait a moment and run again.' });
    if (err instanceof Anthropic.BadRequestError) return send(400, { error: `Bad request: ${err.message}` });
    if (err instanceof Anthropic.APIError) return send(err.status ?? 502, { error: `Model API error: ${err.message}` });
    send(500, { error: (err as Error).message });
  }
};

export function llmRoute(): Plugin {
  return {
    name: 'agent-llm-route',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
