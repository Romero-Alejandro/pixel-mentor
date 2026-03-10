# Bruno Collection Configuration Guide

## Overview

This guide documents the correct format for Bruno API collections in Pixel Mentor, based on Bruno 3.0+ and OpenCollection YAML specification.

## File Structure

```
bruno/
├── opencollection.yml          # Collection manifest (REQUIRED)
├── environments/
│   └── development.yml         # Global variables (auto-detected)
├── Health Check.yml            # Individual request files
├── API Info.yml
├── List Lessons.yml
├── Get Lesson.yml
├── List Sessions.yml
├── Get Session.yml
├── Start Lesson.yml
├── Interact.yml
└── README.md                   # User documentation
```

## 1. `opencollection.yml` - Manifest Format

**CRITICAL**: This file does NOT support a `variables:` section. Variables are defined separately.

```yaml
opencollection: 1.0.0

info:
  name: Pixel Mentor API
  description: Complete API testing collection for Pixel Mentor

bundled: false

extensions:
  bruno:
    ignore:
      - node_modules
      - .git

requests:
  - name: Health Check
    file: ./Health Check.yml

  - name: API Info
    file: ./API Info.yml

  # ... other requests
```

## 2. Variables - Two Approaches

### Approach A: Global Environment File (RECOMMENDED)

Create `environments/development.yml`:

```yaml
name: development
variables:
  - name: base_url
    value: http://localhost:3001
    enabled: true
    secret: false
    type: text
  - name: lesson_id
    value: 00000000-0000-0000-0000-000000000000
    enabled: true
    secret: false
    type: text
  - name: student_id
    value: 11111111-1111-1111-1111-111111111111
    enabled: true
    secret: false
    type: text
  - name: session_id
    value: ''
    enabled: true
    secret: false
    type: text
```

**User Action**: User must select "development" from the environment dropdown in Bruno UI (top-right).

### Approach B: Embedded Variables (Redundant)

Add `vars.pre-request` to each request file:

```yaml
vars:
  pre-request:
    - name: base_url
      value: http://localhost:3001
    - name: lesson_id
      value: 00000000-0000-0000-0000-000000000000
    - name: student_id
      value: 11111111-1111-1111-111111111111
    - name: session_id
      value: ''
```

**Drawback**: Values are duplicated across 8 files. Use only if environments don't work.

## 3. Individual Request Format (OpenCollection YAML)

```yaml
info:
  name: Health Check
  type: http
  seq: 1

http:
  method: GET
  url: '{{base_url}}/health'
  # For POST with JSON:
  # headers:
  #   - name: Content-Type
  #     value: application/json
  # body:
  #   type: json
  #   data: |-
  #     { "key": "value" }

settings:
  encodeUrl: true
  timeout: 0
  followRedirects: true
  maxRedirects: 5

# Only for Start Lesson to capture session_id:
vars:
  post-response:
    - name: session_id
      value: res.body.sessionId

tests: |-
  if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  bru.log('✅ Check passed');
```

## 4. Post-Response Variable Capture

Only needed for `Start Lesson.yml` to capture `session_id`:

```yaml
vars:
  post-response:
    - name: session_id
      value: res.body.sessionId
```

This stores the `sessionId` from the response body into the `session_id` variable, making it available to subsequent requests.

## 5. Common Pitfalls

| Issue                          | Cause                                         | Solution                                               |
| ------------------------------ | --------------------------------------------- | ------------------------------------------------------ |
| "Invalid URL"                  | Variables not defined                         | Use `environments/development.yml` AND select it in UI |
| Variables not interpolating    | `variables:` in `opencollection.yml`          | Remove it—Bruno ignores this section                   |
| Collection not auto-detected   | Wrong folder opened                           | Open `bruno/` directly, not parent folder              |
| `session_id` empty in Interact | Didn't run Start Lesson first                 | Execute Start Lesson before Interact                   |
| Multiple environment files     | Bruno 3.0+ requires `environments/` subfolder | Place `.yml` files inside `environments/`              |

## 6. Validation

Check YAML syntax:

```bash
python3 -c "import yaml; yaml.safe_load(open('apps/api/bruno/Health Check.yml'))"
```

If no error, YAML is valid.

## 7. Bruno Version Notes

- **Bruno 3.0+**: Supports OpenCollection YAML, global environments in `environments/` folder
- **Bruno 2.x**: Uses `.bru` files exclusively; global environments stored in app data
- This guide assumes Bruno 3.0+

## 8. Minimal Working Example

For a new collection:

1. Create `opencollection.yml` (with `requests:` pointing to `*.yml` files)
2. Create `environments/development.yml` with all variables
3. Create request files (e.g., `Health Check.yml`) using `{{var_name}}` interpolation
4. Open Bruno → Import → select the folder containing `opencollection.yml`
5. Select environment from dropdown
6. Variables are now available

## 9. Differences from `.bru` Format

| Feature               | `.bru` (Bru Language) | OpenCollection YAML                |
| --------------------- | --------------------- | ---------------------------------- | ----------------- |
| Variables in manifest | `vars { ... }` at top | NOT SUPPORTED                      |
| Global variables      | `collection.bru`      | `environments/*.yml`               |
| Metadata              | `meta { ... }`        | `info: { ... }`                    |
| Tests                 | `tests { ... }`       | `tests:                            | -` (block scalar) |
| Headers               | `headers { ... }`     | `headers: - { name, value }` array |

## Reference

- Official Docs: https://github.com/usebruno/bruno-docs
- OpenCollection Spec: https://github.com/usebruno/opencollection
