# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Strict Branch & Production Protection

**Never push directly to production (`main`). Keep production sacred.**

- **No direct commits or pushes to `main`:** The `main` branch is strictly reserved for stable production releases. Under no circumstances should an agent push code directly to `main` or merge branches into `main` without explicit, unambiguous user instruction.
- **`develop` is the active workspace:** All development, refactoring, security audits, and feature implementations must take place strictly on `develop` (or dedicated feature branches).
- **Verification before release:** Code must never be promoted to production without passing the complete test suite (`npm test`), zero TypeScript compilation errors (`npx tsc --noEmit`), and final user approval.

## 6. Strict Monochromatic Brutalist Design System

**Follow `DESIGN.md` unconditionally when touching any UI component or style.**

- **Strict B&W Palette (No grays):** Strictly pure black (`#000000`) and pure white (`#ffffff`). Never introduce `neutral-*`, `gray-*`, `zinc-*`, `#fafafa`, `#777777`, or intermediate tints in backgrounds, borders, or text. Disabled states use `opacity-35`, never gray.
- **Inversion Law for Hover:** White elements invert to black (`hover:bg-black hover:text-white`). Black elements invert to white (`hover:bg-white hover:text-black`). Table rows have no background hover shift. Table action buttons invert to black (`hover:bg-black hover:text-white`).
- **Geometry & Elevation:** 0px border-radius everywhere (`border-radius: 0 !important`). No box-shadows or glows (`box-shadow: none !important`). Clean 1px solid black borders.
- **No Decorative Noise:** Never add decorative dividing lines (`border-t-2`, `border-b-2`), ornamental icons in framed boxes, or pseudo-indicator helper text in forms or modals. Keep inputs, labels, and actions direct and functional.
