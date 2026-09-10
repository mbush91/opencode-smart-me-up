# Smart Me Up

A small [OpenCode](https://opencode.ai) TUI plugin that rewrites the text currently sitting in your prompt with an OpenAI model.

Hit **Ctrl-Shift-S** and Smart Me Up will fix typos, tighten the wording, reduce ambiguity, and use more precise technical/scientific language when appropriate. The rewritten text replaces the current prompt, but it is **not submitted** — you still review it and press Enter yourself.

The plugin is also available as `/smart` and in the command palette as **Smart Me Up: rewrite prompt**.

## Behavior

- Reads the current OpenCode prompt through the local TUI prompt ref.
- Sends only that draft text to the OpenAI Responses API.
- Replaces the prompt in place after the rewrite succeeds.
- Never calls OpenCode's submit-prompt action.
- Keeps the prompt's existing OpenCode metadata/attached parts when replacing its text.
- Refuses to overwrite the editor if you type more text or navigate away while the request is running.
- Leaves shell-mode commands alone.
- Sends `store: false` to the OpenAI Responses API.

## Requirements

1. **OpenCode >= 1.18**.
2. **An OpenAI API key** in the environment that launches OpenCode:

```bash
export OPENAI_API_KEY="sk-..."
```

`OPENAI_BASE_URL` is also honored if you use an OpenAI-compatible endpoint.

## Install

For development, this repository includes a `tui.json` that loads `./src/index.tsx`, so you can clone the repository, install the dev dependencies, export `OPENAI_API_KEY`, and run OpenCode from the repo.

To use a checkout from your normal OpenCode config, add the plugin to your `tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    ["/absolute/path/to/opencode-smart-me-up/src/index.tsx", {}]
  ]
}
```

Restart OpenCode after changing the TUI config.

## Configuration

Plugin options go in the tuple's second element:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    ["/absolute/path/to/opencode-smart-me-up/src/index.tsx", {
      "model": "gpt-5.6-luna",
      "variant": "low",
      "keybind": "ctrl+shift+s"
    }]
  ]
}
```

| Option | Default | Description |
| --- | --- | --- |
| `model` | `gpt-5.6-luna` | OpenAI model ID used for rewriting. |
| `variant` | `none` | Reasoning effort: `none`, `low`, `medium`, `high`, `xhigh`, or `max`. `none` omits the reasoning parameter. |
| `keybind` | `ctrl+shift+s` | Hotkey that rewrites the current prompt. |
| `baseUrl` | `$OPENAI_BASE_URL` or `https://api.openai.com/v1` | OpenAI-compatible API base URL. |
| `instructions` | built-in | Completely override the rewrite instructions. |

The default instructions tell the model to correct errors and improve precision without answering the prompt, inventing requirements, or changing exact values/commands/URLs.

## Development

```bash
bun install
bun run typecheck
bun test
```

Source layout:

- `src/index.tsx` — OpenCode TUI integration, hotkey, prompt ref, status, replacement behavior.
- `src/rewrite.ts` — OpenAI Responses API client and rewrite instructions.
- `test/rewrite.test.ts` — request/response and error-handling tests.

## Privacy

The current prompt text is sent to the configured OpenAI API endpoint only when you trigger Smart Me Up. The request uses `store: false`. Do not trigger the plugin on text you do not want sent to that endpoint.

## License

MIT
