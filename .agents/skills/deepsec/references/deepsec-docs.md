# Deepsec Documentation Guide & FAQ

Reference for deepsec commands, configuration, architecture, and common troubleshooting questions.

## Where the docs are

From the target repository: `.deepsec/node_modules/deepsec/dist/docs/`; from inside `.deepsec`: `node_modules/deepsec/dist/docs/`; or from a Deepsec source clone: `<deepsec-clone>/docs/`:

- `getting-started.md` — one-shot initialization and resume walkthrough
- `configuration.md` — full `deepsec.config.ts` reference
- `plugins.md` — plugin slots (matchers, notifiers, ownership, people, executor)
- `writing-matchers.md` — generated declarative vs hand-authored matchers
- `models.md` — model selection, defaults, refusals, future models
- `vercel-setup.md` — exact project link, Sandbox scope, Gateway/BYOK/custom routes
- `architecture.md` — pipeline internals
- `data-layout.md` — `data/` schemas (FileRecord, RunMeta, …)
- `faq.md` — cost, model choice, sandbox mode, FP rate

## How to answer common questions

- **"How do I install/init deepsec?"** → Default to `npx deepsec init`.
- **"Setup stopped; how do I resume?"** → Re-run `npx deepsec init` or `deepsec setup` (resumes automatically from checkpoints).
- **"How do I run another scan?"** → From inside `.deepsec/`: `npx deepsec scan` (fast regex scan, free) then `npx deepsec process`.
- **"What goes in `deepsec.config.ts`?"** → See `references/configuration.md`.
- **"Why did setup generate a matcher?"** → Deepsec studies repository patterns and generates custom regex matchers in `generated-matchers.ts` to surface security candidates.
- **"What does deepsec actually do?"** → A fast pattern scan flags candidate files, then AI agents investigate each candidate in depth, assigning severity ratings and producing actionable findings.
- **"How do project linking, Sandbox, or credentials work?"** → Runs can be linked to Vercel AI Gateway or use direct API keys (`--ai-provider openai --ai-api-key-env MY_KEY` or Anthropic).
