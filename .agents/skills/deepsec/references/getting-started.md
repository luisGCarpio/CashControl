# Getting started

Set up deepsec and run your first scan with one command.

## Run your first scan

From the root of the repository you want to scan:

```bash
npx deepsec init
```

The command asks you two things, then does the rest on its own:

1. **Which model to use.** You'll see a short list of recommended
   model and reasoning-level combinations, each with its score on the
   DeepSecBench benchmark and its cost relative to the cheapest option.
   Pick one, or choose the last option to type in any model of your own.
2. **How to pay for model calls.** The default routes through Vercel AI
   Gateway — deepsec logs you in to Vercel if needed and sets up a small
   dedicated project to hold credentials (nothing billable is created
   during setup). If you'd rather use your own OpenAI or Anthropic API
   key, no Vercel account is needed — see
   [Using your own API key](#using-your-own-api-key).

After that, deepsec works unattended. It creates a `.deepsec/` folder next
to your code (this is the only thing it adds to your repository), studies
the codebase to understand what it does and where the risky areas are,
runs a fast pattern scan, and then starts the AI review of the flagged
files. Depending on repository size, the AI review can take from minutes
to many hours.

## If it stops partway

Just run the same command again:

```bash
npx deepsec init
```

Deepsec remembers how far it got. Finished steps are skipped and the run
continues where it left off. This is also how you resume after hitting a
cost limit, losing your connection, or pressing Ctrl-C.

If setup cannot cover an inventoried surface, it stops before paid AI
processing and prints the exact inventory, state, generated-matcher, and
resume commands. The state records matcher proposals and rejection reasons.
Re-running setup makes up to two fresh matcher-repair attempts, so a coverage
pause is recoverable after editing `generated-matchers.ts` or the underlying
repository pattern.

## Limiting time and cost

You can bound a run and pick up the rest later:

```bash
npx deepsec init --max-cost-usd 100 --max-duration 2h
```

When a limit is reached, deepsec stops at a safe point. Run the same
command again to continue. Durations need an explicit unit: `ms`, `s`,
`m`, or `h`.

If the run stops because your model provider ran out of credits, deepsec
tells you where to top up; re-run the same command afterwards.

## Reading your results

Everything deepsec produces lives in the `.deepsec/` folder. To get a
readable report:

```bash
cd .deepsec
pnpm deepsec export --format md-dir --out ./findings
```

That writes one markdown file per finding into `./findings`. For a quick
overview instead:

```bash
pnpm deepsec report
```

## Everyday commands

After the first run, work from inside `.deepsec/`:

```bash
pnpm deepsec status       # where things stand
pnpm deepsec scan         # re-run the fast pattern scan (free, no AI)
pnpm deepsec process      # AI review of new or changed candidates
pnpm deepsec revalidate   # re-check findings; cuts false positives
pnpm deepsec export --format md-dir --out ./findings
```

`scan` costs nothing (it's local pattern matching). `process` is the
expensive AI stage. All of these resume cleanly if interrupted, and
re-running them only looks at work that isn't done yet.

## Using your own API key

You don't need a Vercel account to use deepsec with your own API key.
To use your own OpenAI key:

```bash
MY_OPENAI_KEY=... npx deepsec init \
  --agent codex \
  --model-auth direct \
  --ai-provider openai \
  --ai-api-key-env MY_OPENAI_KEY
```

For Anthropic, use `--agent claude --ai-provider anthropic`. Deepsec
stores only the *name* of the environment variable, never the key itself.
Export the variable again for later commands, or put it in
`.deepsec/.env`.
