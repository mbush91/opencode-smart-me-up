/** @jsxImportSource @opentui/solid */
import { Show, createSignal } from "solid-js"
import type { RGBA } from "@opentui/core"
import type { TuiPlugin, TuiPluginApi, TuiPluginModule, TuiPromptRef } from "@opencode-ai/plugin/tui"
import {
  DEFAULT_BASE_URL,
  DEFAULT_INSTRUCTIONS,
  DEFAULT_MODEL,
  DEFAULT_VARIANT,
  RewriteError,
  VARIANTS,
  rewritePrompt,
  type Variant,
} from "./rewrite"

type Options = {
  /** OpenAI model. Default: gpt-5.6-luna */
  model?: string
  /** OpenAI reasoning effort. Default: none */
  variant?: Variant
  /** Hotkey. Default: ctrl+shift+s */
  keybind?: string
  /** OpenAI-compatible base URL. Default: $OPENAI_BASE_URL or https://api.openai.com/v1 */
  baseUrl?: string
  /** Override the prompt-rewriting instructions. */
  instructions?: string
}

type PromptRefs = {
  home?: TuiPromptRef
  session?: TuiPromptRef
}

function stringOption(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function parseOptions(raw: Record<string, unknown> | undefined): Options {
  if (!raw) return {}
  const options: Options = {
    model: stringOption(raw.model),
    keybind: stringOption(raw.keybind),
    baseUrl: stringOption(raw.baseUrl),
    instructions: stringOption(raw.instructions),
  }
  const variant = stringOption(raw.variant)
  if (variant && (VARIANTS as readonly string[]).includes(variant)) options.variant = variant as Variant
  return options
}

function getApiKey(): string | undefined {
  const value = process.env.OPENAI_API_KEY?.trim()
  return value || undefined
}

function activePrompt(api: TuiPluginApi, refs: PromptRefs): TuiPromptRef | undefined {
  return api.route.current.name === "session" ? refs.session : refs.home
}

function isAbortError(error: unknown): boolean {
  return !!error && typeof error === "object" && (error as { name?: unknown }).name === "AbortError"
}

const tui: TuiPlugin = async (api, rawOptions) => {
  const options = parseOptions(rawOptions)
  const model = options.model ?? DEFAULT_MODEL
  const variant = options.variant ?? DEFAULT_VARIANT
  const keybind = options.keybind ?? "ctrl+shift+s"
  const baseUrl = options.baseUrl ?? process.env.OPENAI_BASE_URL?.trim() ?? DEFAULT_BASE_URL
  const instructions = options.instructions ?? DEFAULT_INSTRUCTIONS
  const refs: PromptRefs = {}
  const [busy, setBusy] = createSignal(false)

  const toast = (variant: "info" | "success" | "warning" | "error", message: string) =>
    api.ui.toast({ variant, title: "Smart Me Up", message, duration: 3500 })

  const smarten = async () => {
    if (busy()) return

    const ref = activePrompt(api, refs)
    if (!ref) {
      toast("warning", "The prompt editor is not available yet.")
      return
    }

    const initial = ref.current
    const originalInput = initial.input
    const originalMode = initial.mode
    if (!originalInput.trim()) {
      toast("warning", "Type a prompt first.")
      return
    }
    if (originalMode === "shell") {
      toast("warning", "Smart Me Up only rewrites normal prompts, not shell commands.")
      return
    }

    const apiKey = getApiKey()
    if (!apiKey) {
      toast("error", "OPENAI_API_KEY is not set in the environment that launched OpenCode.")
      return
    }

    setBusy(true)
    try {
      const rewritten = await rewritePrompt({
        text: originalInput,
        apiKey,
        model,
        variant,
        baseUrl,
        instructions,
        signal: api.lifecycle.signal,
      })

      const current = activePrompt(api, refs)
      if (current !== ref) {
        toast("warning", "Prompt changed screens while rewriting; nothing was replaced.")
        return
      }
      const latest = ref.current
      if (latest.input !== originalInput || latest.mode !== originalMode) {
        toast("warning", "Prompt changed while rewriting; your newer text was left untouched.")
        return
      }

      ref.set({ ...latest, input: rewritten })
      ref.focus()
      toast("success", "Prompt rewritten — press Enter when you're ready.")
    } catch (error) {
      if (isAbortError(error)) return
      toast("error", error instanceof RewriteError ? error.message : `Rewrite failed: ${String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  api.keymap.registerLayer({
    mode: "base",
    priority: 100,
    commands: [
      {
        name: "smart-me-up.rewrite",
        title: "Smart Me Up: rewrite prompt",
        desc: `Rewrite the current prompt with OpenAI without submitting it (${keybind})`,
        category: "Plugin",
        namespace: "palette",
        slashName: "smart",
        run: () => smarten(),
      },
    ],
    bindings: [{ key: keybind, cmd: "smart-me-up.rewrite", desc: "Smart Me Up" }],
  })

  api.slots.register({
    slots: {
      home_prompt(_ctx, props) {
        const Prompt = api.ui.Prompt
        const Slot = api.ui.Slot
        return (
          <Prompt
            ref={(ref) => {
              refs.home = ref
              props.ref?.(ref)
            }}
            right={<Slot name="home_prompt_right" />}
          />
        )
      },
      session_prompt(_ctx, props) {
        const Prompt = api.ui.Prompt
        const Slot = api.ui.Slot
        return (
          <Prompt
            sessionID={props.session_id}
            visible={props.visible}
            disabled={props.disabled}
            onSubmit={props.on_submit}
            ref={(ref) => {
              refs.session = ref
              props.ref?.(ref)
            }}
            right={<Slot name="session_prompt_right" session_id={props.session_id} />}
          />
        )
      },
      home_prompt_right: (ctx) => <Status busy={busy} color={ctx.theme.current.info} />,
      session_prompt_right: (ctx) => <Status busy={busy} color={ctx.theme.current.info} />,
    },
  })
}

function Status(props: { busy: () => boolean; color: RGBA }) {
  return (
    <Show when={props.busy()}>
      <text fg={props.color}>◌ smartening…</text>
    </Show>
  )
}

const plugin: TuiPluginModule & { id: string } = {
  id: "opencode-smart-me-up",
  tui,
}

export default plugin
