# Coverage tests (API)

Objective: raise API coverage with tests that assert real behavior, starting from the
code a mistake would hurt most, not from the files that are easiest to reach.
Branch: `test/prompt-services-coverage` off `main`. Runner: `pnpm --filter @pixel-mentor/api test`.

## Specs

S1. A test in this work must assert observable behavior through the unit's public
interface. Line-touching, snapshotting internals, or asserting that a private helper was
called is not acceptable, even when it raises the percentage.

S2. `SafePromptBuilder` is a security boundary: every placeholder value is untrusted
student input. The tests must pin, at minimum: values are wrapped in the configured
delimiters; delimiter sequences **inside** a value are escaped so they cannot close the
wrapper early; a template with a placeholder that has no value throws instead of silently
rendering; `null`/`undefined` values render as empty; a template without placeholders is
returned unchanged; `setTemplate`/`setValues` reject non-string/non-object input.

S3. `TemplatePreprocessor` must be pinned on its documented contract: `{{#if}}` and
`{{#unless}}` include or drop their block by the documented truthiness table
(`null`, `undefined`, `''`, `0`, `false`, `[]`, `{}` are falsy); nesting works up to
`MAX_NESTING_DEPTH = 5` and throws beyond it; missing variables render as empty;
arrays and objects render as JSON; unclosed tags are left as literal text.

S4. Tests for pre-existing code are characterization tests: they describe what the code
does today. When a test would have to assert behavior that looks wrong, the finding is
reported to the user instead of being pinned as expected.

S5. The suite must stay green and the coverage delta must be measured, not assumed.

## Tasks

| ID | Scope | Spec | Status |
|----|-------|------|--------|
| T1 | `SafePromptBuilder` + `TemplatePreprocessor` (prompt feature, 0% lines each) | S1-S3, S5 | done — 41 tests, 0% → 100% and 88.3% lines |
| T2 | `LessonEvaluator` 3-step flow with a mocked LLM client | S1, S4 | pending |
| T3 | `app.ts`: middleware wiring and `trust proxy` / `req.ip` (0% today, and the path `proxy-addr` sits on) | S1, S4 | pending |
| T4 | Recipe use-cases `add-step`, `update-step`, `create-recipe` | S1, S4 | pending |

Deliberately excluded: `clinical-calculator.service.ts` (0%, 55 lines). Its own docblock
says it is a placeholder simulation driven by a hash-based RNG, not a clinical
evaluation; writing tests would enshrine fabricated numbers as expected behavior.

## Log

L1: user request, verbatim: "por ahora solovamos con los tests de cobertura"
L2: measured on `main` with the CI environment against a fresh `pgvector/pgvector:pg17`
database: 266 files measured, 191 under 30% lines, 79 of them containing logic
(`domain`/`application`/`main`). Gamification files dominate that list but were skipped
because PRs #1/#2 rewrite them with tests; targeting them would be work thrown away.
L3 (finding, not pinned by a test): `SafePromptBuilder.escapeDelimiters` escapes the
delimiters by replacing `<` and `>` literally. With custom delimiters that contain no
angle brackets — the constructor accepts any strings — the escaping becomes a no-op, so
the injection protection silently disappears. Reproduced:

```
new SafePromptBuilder({ startDelimiter: '[[', endDelimiter: ']]' })
  .setValues({ answer: ']] escape attempt [[ nested' }).build()
  → [[]] escape attempt [[ nested]]    ← the wrapper is closed by the value
```

Default delimiters behave correctly (`&lt;/student_input&gt;`). No caller passes custom
delimiters today (`grep startDelimiter|endDelimiter` outside the service and its tests:
none), so this is a latent hazard in the public API, not an active vulnerability.
Reported to the user; not asserted as expected behavior, per S4.
L4: T1 evidence. Full API suite: 1108 tests passing, 0 failures (41 added). Coverage for
the two files, measured with `--collectCoverageFrom='src/features/prompt/**/*.ts'`:
`safe-prompt-builder.service.ts` 0% → **100%** on all four metrics;
`template-preprocessor.service.ts` 0% → **88.34% lines / 91.17% branches / 100%
functions**. The remaining uncovered lines are the malformed-template branches of
`findBlockEnd` (unclosed tags at depth) and the `String(value)` fallback of
`coerceToString`.
L5: one incorrect assumption of mine surfaced during T1: `isTruthy(-1)` is `false`, because
the documented rule is "Number > 0". The test was fixed to pin the documented rule, not my
expectation.
