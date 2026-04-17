# Prompt System Guidelines

## Architecture

All prompts MUST reside in the unified repository: `apps/api/src/prompts/`.

```
prompts/
├── file-system-prompt-repository.ts  # Main entry point
├── unified-prompt-renderer.ts     # Template engine (Mustache + conditionals)
├── evaluation/
│   ├── extract_concepts_system.txt
│   ├── extract_concepts_user.txt
│   ├── classify_system.txt
│   ├── classify_user.txt
│   ├── generate_feedback_system.txt
│   └── generate_feedback_user.txt
└── <feature>/
    ├── <prompt_name>_system.txt
    └── <prompt_name>_user.txt
```

## Security Requirements

All external/user input MUST be wrapped:

```typescript
import { SafePromptBuilder } from '@/features/prompt/application/services/safe-prompt-builder.service.js';

const builder = new SafePromptBuilder();
const safeInput = builder
  .setTemplate('Student said: {{answer}}')
  .setValues({ answer: userInput })
  .build();
// Result: Student said: <student_input>Malicious input</student_input>
```

## Template Syntax

### Variables

```
{{variableName}}
```

### Conditionals

```
{% if variableName %}
Content when variableName is truthy
{% endif %}
```

### Loops (reserved for future)

```
{% for item in items %}
- {{item}}
{% endfor %}
```

## Loading Prompts

```typescript
import { FileSystemPromptRepository } from '@/features/prompt/infrastructure/persistence/file-system-prompt-repository.js';

const repo = new FileSystemPromptRepository();
const systemPrompt = repo.getPrompt('extract_concepts_system', {
  questionText: 'What is photosynthesis?',
  studentAnswer: 'Plants eat sun',
});
```

## Prohibited Patterns

- ❌ Hardcoding prompts in `.ts` files
- ❌ Using `String.replace()` directly on LLM input
- ❌ Loading prompts directly from `fs.readFileSync`
- ❌ Bypassing `SafePromptBuilder` for user input

## Required Patterns

- ✅ Prompts in `.txt` files under `prompts/`
- ✅ Mustache `{{var}}` syntax
- ✅ `{% if %}` conditionals
- ✅ All values wrapped via `SafePromptBuilder`
- ✅ Test coverage for prompt rendering

## Migration Checklist

When creating a new prompt:

1. Create `<name>_system.txt` and/or `<name>_user.txt`
2. Load via `FileSystemPromptRepository`
3. Wrap all user input via `SafePromptBuilder`
4. Add unit tests
