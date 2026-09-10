import { describe, expect, test } from "bun:test"
import { RewriteError, extractOutputText, rewritePrompt } from "../src/rewrite"

describe("extractOutputText", () => {
  test("uses output_text when present", () => {
    expect(extractOutputText({ output_text: "  Better prompt  " })).toBe("Better prompt")
  })

  test("extracts output_text content blocks", () => {
    expect(
      extractOutputText({
        output: [
          { type: "reasoning", content: [] },
          { type: "message", content: [{ type: "output_text", text: "Better" }, { type: "output_text", text: "prompt" }] },
        ],
      }),
    ).toBe("Better\nprompt")
  })
})

describe("rewritePrompt", () => {
  test("sends model and reasoning variant to the Responses API", async () => {
    let requestUrl = ""
    let requestBody: Record<string, unknown> = {}
    const fetchImpl: typeof fetch = async (input, init) => {
      requestUrl = String(input)
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: "Rewritten" }] }] }))
    }

    const output = await rewritePrompt({
      text: "fix me",
      apiKey: "sk-test",
      model: "gpt-5.6-sol",
      variant: "high",
      baseUrl: "https://example.test/v1/",
      fetchImpl,
    })

    expect(output).toBe("Rewritten")
    expect(requestUrl).toBe("https://example.test/v1/responses")
    expect(requestBody.model).toBe("gpt-5.6-sol")
    expect(requestBody.reasoning).toEqual({ effort: "high" })
    expect(requestBody.store).toBe(false)
  })

  test("omits reasoning when variant is none", async () => {
    let requestBody: Record<string, unknown> = {}
    const fetchImpl: typeof fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(JSON.stringify({ output_text: "Rewritten" }))
    }

    await rewritePrompt({ text: "fix me", apiKey: "sk-test", variant: "none", fetchImpl })
    expect(requestBody.reasoning).toBeUndefined()
  })

  test("surfaces OpenAI API errors", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ error: { message: "bad model" } }), { status: 400 })

    await expect(rewritePrompt({ text: "fix me", apiKey: "sk-test", fetchImpl })).rejects.toEqual(
      new RewriteError("bad model"),
    )
  })
})
