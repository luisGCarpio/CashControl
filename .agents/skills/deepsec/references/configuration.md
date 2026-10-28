# Configuration reference

Configure projects, matchers, agents, ownership, and runtime environment values in `deepsec.config.ts`.

deepsec reads `deepsec.config.{ts,mjs,js,cjs}` from the current working
directory, walking up. The CLI inherits whatever the file declares.

```ts
import { defineConfig } from "deepsec/config";
import myPlugin from "@my-org/deepsec-plugin-foo";

export default defineConfig({
  ai: { mode: "gateway", provider: "vercel" },
  projects: [
    { id: "my-app", root: "../my-app" },
    { id: "service", root: "../service", githubUrl: "https://github.com/me/service/blob/main" },
  ],
  plugins: [myPlugin()],
});
```

## Top-level fields

| Field | Type | Purpose |
|---|---|---|
| `projects` | `ProjectDeclaration[]` | The codebases deepsec knows about. |
| `plugins` | `DeepsecPlugin[]` | Loaded in order; later plugins override single-slot capabilities. |
| `matchers` | `{ only?: string[]; exclude?: string[] }` | Filter the matcher set used by `scan`. |
| `defaultAgent` | `string` | Default `--agent` value (`codex`, `claude`, or `pi`). |
| `defaultModel` | `string` | Default `--model` value selected during setup. |
| `defaultThinkingLevel` | `string` | Default reasoning effort (`minimal` through `xhigh`) selected during setup. |
| `ai` | `ModelRoute` | Non-secret model credential route selected and verified by setup. |
| `dataDir` | `string` | Override the `data/` directory. Defaults to `./data`. |

## Model route

One-shot setup persists how later AI commands should find their credential,
never the credential value itself.

```ts
// Default: linked-project OIDC or AI_GATEWAY_API_KEY
ai: { mode: "gateway", provider: "vercel" }

// User-owned OpenAI key; MY_OPENAI_KEY must exist at runtime
ai: {
  mode: "direct",
  provider: "openai",
  apiKeyEnv: "MY_OPENAI_KEY",
  baseUrl: "https://api.openai.com/v1",
}

// Pi-only custom provider
ai: {
  mode: "custom",
  provider: "martian",
  apiKeyEnv: "MARTIAN_KEY",
  baseUrl: "https://api.martian.example/v1",
  credentialHeader: { name: "x-api-key", scheme: "raw" },
}
```

## ProjectDeclaration

| Field | Type | Required | Purpose |
|---|---|---|---|
| `id` | `string` | yes | Used as `--project-id` and the data directory name (`data/<id>/`). |
| `root` | `string` | yes | Absolute or relative path to the codebase. |
| `githubUrl` | `string` | no | `https://github.com/owner/repo/blob/branch` — used in exports for clickable links. Auto-detected from `git remote` when omitted. |
| `infoMarkdown` | `string` | no | Repo context injected into AI prompts. Overrides `data/<id>/INFO.md` if both are present. |
| `promptAppend` | `string` | no | Free-form text appended to the system prompt for this project. |
| `priorityPaths` | `string[]` | no | Path prefixes to process first. |
