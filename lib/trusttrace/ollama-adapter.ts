// ============================================================
// Ollama HTTP adapter — self-contained, no imports from lib/llm.ts
// Uses global fetch + AbortController (Node 18+)
// ============================================================

export class OllamaUnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OllamaUnreachableError';
  }
}

export class OllamaHttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'OllamaHttpError';
    this.status = status;
  }
}

export class OllamaModelNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OllamaModelNotFoundError';
  }
}

export class OllamaMalformedResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OllamaMalformedResponseError';
  }
}

// ============================================================
// Types
// ============================================================

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: OllamaToolCall[];
}

export interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OllamaChatResponse {
  message: {
    role: string;
    content: string;
    tool_calls?: OllamaToolCall[];
  };
}

// ============================================================
// checkHealth — MEDIUM-1: takes model as explicit param
// ============================================================

/**
 * Checks if the Ollama server is reachable and if the specified model is available.
 * Never throws — always returns { reachable, error }.
 */
export async function checkHealth(
  baseUrl: string,
  model: string,
  opts?: { timeoutMs?: number }
): Promise<{ reachable: boolean; error: string | null }> {
  const timeoutMs = opts?.timeoutMs ?? 2500;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      return { reachable: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return { reachable: false, error: 'Failed to parse tags response as JSON' };
    }

    // Check if the model is present in the registry
    const tags = (data as Record<string, unknown>)?.models;
    if (Array.isArray(tags)) {
      const found = tags.some((m: unknown) => {
        if (typeof m === 'object' && m !== null) {
          const name = (m as Record<string, unknown>).name;
          return typeof name === 'string' && (name === model || name.startsWith(model + ':'));
        }
        return false;
      });
      if (!found) {
        return { reachable: true, error: 'model not found in registry' };
      }
    }

    return { reachable: true, error: null };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'Request timed out'
          : err.message
        : String(err);
    return { reachable: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// chatWithTools — drives the agent inference loop
// ============================================================

/**
 * Calls the Ollama /api/chat endpoint with tool support.
 * Throws typed errors on failures (never generic Error for recoverable cases).
 */
export async function chatWithTools(
  baseUrl: string,
  model: string,
  messages: OllamaMessage[],
  tools: OllamaTool[],
  opts?: { timeoutMs?: number; format?: string }
): Promise<OllamaChatResponse> {
  const timeoutMs = opts?.timeoutMs ?? 120000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const body = {
    model,
    messages,
    stream: false,
    tools,
    ...(opts?.format ? { format: opts.format } : {}),
  };

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'Ollama request timed out'
          : err.message
        : String(err);
    throw new OllamaUnreachableError(msg);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 404) {
    throw new OllamaModelNotFoundError(`Model '${model}' not found (404)`);
  }

  if (!res.ok) {
    throw new OllamaHttpError(`Ollama HTTP ${res.status}: ${res.statusText}`, res.status);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new OllamaMalformedResponseError('Failed to parse Ollama response as JSON');
  }

  const msg = (data as Record<string, unknown>)?.message;
  if (!msg || typeof msg !== 'object') {
    throw new OllamaMalformedResponseError('Ollama response missing .message field');
  }

  const rawToolCalls = (msg as Record<string, unknown>).tool_calls;

  // Normalize tool_calls: parse arguments if Ollama returns them as a JSON string
  let normalizedToolCalls: OllamaToolCall[] | undefined;
  if (Array.isArray(rawToolCalls)) {
    normalizedToolCalls = rawToolCalls.map((tc: unknown) => {
      const tcObj = tc as Record<string, unknown>;
      const fn = tcObj.function as Record<string, unknown> | undefined;
      if (!fn) return tc as OllamaToolCall;
      const rawArgs = fn.arguments;
      let parsedArgs: Record<string, unknown>;
      if (typeof rawArgs === 'string') {
        try {
          parsedArgs = JSON.parse(rawArgs) as Record<string, unknown>;
        } catch {
          parsedArgs = {};
        }
      } else if (rawArgs && typeof rawArgs === 'object') {
        parsedArgs = rawArgs as Record<string, unknown>;
      } else {
        parsedArgs = {};
      }
      return {
        function: {
          name: (fn.name as string) ?? '',
          arguments: parsedArgs,
        },
      };
    });
  }

  return {
    message: {
      role: ((msg as Record<string, unknown>).role as string) ?? 'assistant',
      content: ((msg as Record<string, unknown>).content as string) ?? '',
      tool_calls: normalizedToolCalls,
    },
  };
}
