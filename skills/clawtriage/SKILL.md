---
name: clawtriage
description: Create GitHub issues from Telegram /triage reports, including voice-note transcripts from OpenClaw ({{Transcript}}) and typed fallback (/triage owner/repo: text). Use when handling bug triage into structured issues via localhost triage-api.
---

# ClawTriage Instructions

Follow this deterministic flow for `/triage` requests.

## Parse Input

1. Accept two user patterns:
- `/triage owner/repo` then voice note
- `/triage owner/repo: <typed bug text>`

2. Validate repository strictly with this regex:
- `^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`

3. Extract the bug narrative in this order:
- `{{Transcript}}` if present and non-empty
- Typed text after `:` in `/triage owner/repo: ...`
- Remaining command/body text (including `CommandBody` / `RawBody`)

4. Do not execute API calls until repo format is valid.

## Build Issue Content

Generate a structured issue with these sections in order:
1. `Title`
2. `Summary`
3. `Steps to Reproduce`
4. `Expected`
5. `Actual`
6. `Environment`
7. `Severity` (`sev1` / `sev2` / `sev3`)
8. `Notes`

Use this severity heuristic:
- `sev1`: outage, data loss, security, payment/auth blocker
- `sev2`: major feature broken, no reasonable workaround
- `sev3`: minor, edge case, cosmetic, partial workaround exists

## Clarification Rule

Ask at most one clarifying question, only if essential fields are missing:
- Missing repo only: ask for `owner/repo`
- Missing title only: ask for short issue title
- Missing repo and title: ask one combined question that requests both

Do not ask additional follow-ups after that one clarification.

## Tool Usage Rules

1. Use bash only for `curl` calls to `http://127.0.0.1:8787` (localhost triage-api).
2. Do not run arbitrary shell commands.
3. Never interpolate unvalidated user input directly into shell commands.
4. Pass JSON safely (for example, non-interpolating heredoc `<<'JSON'`).

## API Flow

1. Call `POST /github/create-issue` with:
- `repo`
- `title`
- `body` (the structured issue markdown)
- optional `labels`

2. If response contains `needsAuth: true`:
- Call `POST /auth/github`
- Return the auth URL and instruct user to connect GitHub
- Retry issue creation after user confirms auth

3. On success:
- Return the created issue link (`issueUrl`) and a short confirmation summary.

## Example Calls

```bash
curl -sS -X POST http://127.0.0.1:8787/github/create-issue \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON'
{"repo":"owner/repo","title":"Login fails on Safari","body":"## Summary\n...\n","labels":["bug","triage"]}
JSON
```

```bash
curl -sS -X POST http://127.0.0.1:8787/auth/github \
  -H 'Content-Type: application/json' \
  --data '{}'
```
