# Evaluation Engine Regression Tests - Edge Cases Documentation

This document documents the edge cases discovered and tested for the Evaluation Engine (LLM-ENH enhancement).

## Test Suite Overview

Location: `apps/api/tests/regression/evaluation-engine.spec.ts`

**Total Tests:** 64 tests across 12 test suites

## Edge Cases Covered

### 1. Exemplars Formatting

- **Empty exemplars arrays**: When all exemplars arrays (`correct`, `partial`, `incorrect`) are empty, the exemplars section is omitted from the prompt
- **Partial exemplars**: Some exemplars present, others empty - each type is handled independently
- **Multiple exemplars**: Multiple entries per category are formatted with bullet points
- **Markdown formatting**: Exemplars are wrapped in markdown headers (`###`, `####`)

### 2. Conditional Templates

- **`{{#if condition}}...{{/if}}`**: Basic conditional rendering
- **Nested conditionals**: Support for nested `{{#if}}` blocks up to depth 5
- **Depth 6 error**: Exceeding nesting depth throws `MaxConditionalDepthExceededError`
- **Falsy values**: `false`, `0`, `""`, `null`, `undefined` evaluate to false
- **Missing variables**: Undefined variables are replaced with empty string

### 3. Cohort Routing

- **Alpha cohort**: Routes to new engine
- **Beta cohort**: Routes to new engine
- **Control cohort**: Routes to old engine
- **Unknown cohort**: Falls back to global setting
- **Multiple cohorts**: Can be configured simultaneously

### 4. Feature Flags

- **Global off, cohort on**: Cohort setting takes precedence
- **Global on, cohort off**: Global setting takes precedence
- **Both off**: Uses old engine
- **Conditional templates**: Can be enabled/disabled per cohort
- **Keyword extraction**: Can be configured per cohort

### 5. Metrics Collection

- **Engine counter**: Increments correctly per engine type
- **Outcome counter**: Tracks by engine and outcome combination
- **Cohort counter**: Tracks cohort usage
- **Error counter**: Tracks error types
- **Fallback counter**: Tracks fallback events
- **Latency histogram**: Records latency distributions
- **Reset**: Metrics can be reset between tests

### 6. SafePromptBuilder Security

- **Delimiter escaping**: `</student_input>` in values is escaped to `&lt;/student_input&gt;`
- **Template injection**: `{{malicious}}` patterns in values are preserved as literal text
- **Empty input**: Handled safely without errors
- **Multi-line input**: Preserved correctly with newlines
- **Custom delimiters**: Support for custom start/end delimiters

### 7. Fallback Behavior

- **LLM failure**: Returns encouraging fallback result with `outcome: 'incorrect'`, `score: 0`
- **Validation failure**: Returns fallback result when schema validation fails
- **Feedback**: Always positive and encouraging, never empty

### 8. Backward Compatibility

- **Old engine selection**: Still works when explicitly selected
- **No FeatureFlagService**: Defaults to old engine
- **Legacy response format**: Handles responses without optional fields
- **Required fields**: Validates required fields correctly

### 9. Keyword Extraction

- **Spanish stopwords**: Common Spanish stopwords are excluded
  - Examples: `que`, `del`, `los`, `las`, `para`, `con`, `por`, etc.
- **Minimum length**: Keywords below 3 characters are excluded
- **Maximum limit**: Capped at configurable limit (default 10)
- **Empty array**: Handled gracefully without errors
- **Case insensitivity**: Matching is case-insensitive

### 10. TemplatePreprocessor Edge Cases

- **Empty template**: Returns empty string
- **No placeholders**: Returns template unchanged
- **Number values**: Numbers are coerced to strings
- **Array values**: Arrays are JSON stringified
- **Object values**: Objects are JSON stringified

### 11. LLM Response Validation (Zod v4)

- **Valid JSON**: Parses correctly and returns typed result
- **Markdown-wrapped JSON**: Extracts JSON from ` ```json ` blocks
- **Invalid outcome**: Rejects non-enum values
- **Out of range**: Rejects scores outside 0-10, confidence outside 0-1
- **Optional fields**: Missing optional fields are allowed

### 12. Full Evaluation Flow

- **Complete flow**: Exemplars, metrics, and evaluation all work together
- **Malicious input**: Safely handles malicious input through full flow
- **Multiple evaluations**: Sequential evaluations maintain correctness

## Key Zod v4 Compatibility Notes

The project uses Zod v4.3.6 with the following behavior:

1. **`safeParse` expects objects**: When validating JSON strings, use `JSON.parse()` first or use `SchemaValidator.safeValidate()` which handles string parsing
2. **SchemaValidator class**: Located at `@/validation/schema.validator`, provides `safeValidate()` method that handles JSON string parsing internally
3. **Import paths**: Module paths use dots for files with dots in names (e.g., `schema.validator`, `safe.prompt.builder`)

## Running the Tests

```bash
# Run regression tests only
cd apps/api
pnpm jest evaluation-engine

# Run with coverage
pnpm jest --coverage evaluation-engine

# Run all evaluation-related tests
pnpm jest --testPathPatterns="evaluator|prompt|validation"
```

## Test Coverage

| File                     | Lines  | Branches | Functions |
| ------------------------ | ------ | -------- | --------- |
| template.preprocessor.ts | 79.61% | 83.82%   | 87.5%     |
| safe.prompt.builder.ts   | 65.62% | 57.69%   | 71.42%    |
| eval-metrics.ts          | 68.14% | 57.14%   | 69.69%    |
| schema.validator.ts      | 67.04% | 50.84%   | 80%       |
