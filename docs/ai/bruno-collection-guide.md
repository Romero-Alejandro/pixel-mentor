# Bruno Collection Configuration Guide

<ai_invariants>
[BRUNO_SPECIFICATION]

- Version: Bruno 3.0+ (OpenCollection YAML).
- Manifest: `bruno/opencollection.yml` is REQUIRED.
- PROHIBITED: Do NOT use `variables:` block inside `opencollection.yml`. Bruno ignores it.

[FILE_STRUCTURE]

- Manifest: `bruno/opencollection.yml`
- Environments: `bruno/environments/development.yml` (MUST contain all globals).
- Requests: `bruno/{Request Name}.yml` (Referenced in manifest `requests` array).

[VARIABLES_HANDLING]

- Global definition: `{{variable_name}}` inside request files.
- State mutation: Use `vars.post-response` to capture data from responses.
  Example:
  ```yaml
  vars:
    post-response:
      - name: session_id
        value: res.body.sessionId
  ```

[REQUEST_FORMAT]

    Root keys: info, http, settings, vars (optional), tests (optional).

    Tests: Must use block scalar (|-) containing JavaScript logic (e.g., bru.log()).
    </ai_invariants>
