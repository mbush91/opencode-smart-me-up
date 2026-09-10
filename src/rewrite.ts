export const DEFAULT_MODEL = "gpt-5.6-luna"
export const DEFAULT_VARIANT = "none"
export const DEFAULT_BASE_URL = "https://api.openai.com/v1"

export const VARIANTS = ["none", "low", "medium", "high", "xhigh", "max"] as const
export type Variant = (typeof VARIANTS)[number]

export const DEFAULT_INSTRUCTIONS = `You are a prompt rewriting assistant. Rewrite the user's draft prompt; do not answer it.

Goals:
- Correct spelling, grammar, punctuation, and obvious transcription mistakes.
- Preserve the user's exact intent, requirements, constraints, numbers, names, URLs, paths, code, commands, identifiers, and requested actions.
- Make the prompt clearer, more precise, and more logically structured.
- When the subject is technical or scientific, use accurate technical/scientific terminology and remove ambiguity.
- Prefer concise, natural wording. Do not make ordinary requests sound artificially academic.
- Do not invent facts, assumptions, requirements, or context that the user did not provide.
- Preserve Markdown and code blocks when practical.
- Return only the rewritten prompt, with no preamble, explanation, quotation marks, or commentary.`

type RewriteResponse = {
  output_text?: unknown
  output?: unknown
  error?: unknown
}

export class RewriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RewriteError"
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export type RewriteOptions = {
  text: string
  apiKey: string
  model?: string
  variant?: Variant
  baseUrl?: string
  instructions?: string
  signal?: AbortSignal
  fetchImpl?: FetchLike
}

function errorMessage(body: RewriteResponse): string | undefined {
  if (!body.error || typeof body.error !== "object") return undefined
  const message = (body.error as Record<string, unknown>).message
  return typeof message === "string" && message.trim() ? message.trim() : undefined
}

export function extractOutputText(body: RewriteResponse): string {
  if (typeof body.output_text === "string" && body.output_text.trim()) return body.output_text.trim()
  if (!Array.isArray(body.output)) return ""

  const chunks: string[] = []
  for (const item of body.output) {
    if (!item || typeof item !== "object") continue
    const content = (item as Record<string, unknown>).content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== "object") continue
      const record = part as Record<string, unknown>
      if (record.type !== "output_text" || typeof record.text !== "string") continue
      if (record.text.trim()) chunks.push(record.text)
    }
  }
  return chunks.join("\n").trim()
}

export async function rewritePrompt(options: RewriteOptions): Promise<string> {
  const input = options.text.trim()
  if (!input) return ""

  const apiKey = options.apiKey.trim()
  if (!apiKey) throw new RewriteError("OpenAI API key is empty")

  const model = options.model?.trim() || DEFAULT_MODEL
  const variant = options.variant ?? DEFAULT_VARIANT
  const baseUrl = (options.baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "")
  const fetchImpl: FetchLike = options.fetchImpl ?? ((url, init) => fetch(url, init))

  const request: Record<string, unknown> = {
    model,
    instructions: options.instructions?.trim() || DEFAULT_INSTRUCTIONS,
    input: options.text,
    store: false,
  }
  if (variant !== "none") request.reasoning = { effort: variant }

  let response: Response
  try {
    response = await fetchImpl(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    throw new RewriteError(`OpenAI request failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  let body: RewriteResponse
  try {
    body = (await response.json()) as RewriteResponse
  } catch {
    throw new RewriteError(`OpenAI returned HTTP ${response.status} with an invalid JSON response`)
  }

  if (!response.ok) {
    throw new RewriteError(errorMessage(body) ?? `OpenAI returned HTTP ${response.status}`)
  }

  const output = extractOutputText(body)
  if (!output) throw new RewriteError("OpenAI returned an empty rewrite")
  return output
}
