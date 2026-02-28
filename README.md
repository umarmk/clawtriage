# ClawTriage 

ClawTriage turns Telegram bug reports into GitHub issues:

1. User sends `/triage owner/repo` (or `/triage owner/repo: typed text`).
2. User sends a voice note.
3. OpenClaw transcribes audio via ElevenLabs Scribe v2.
4. `clawtriage` skill formats a structured issue.
5. Local `triage-api` creates the GitHub issue via Composio.

## Skill Placement

Copy this skill folder to:

`~/.openclaw/workspace/skills/clawtriage`

Source in this repo:

`skills/clawtriage/SKILL.md`

## OpenClaw Audio Transcription Config

Use this `openclaw.json` snippet (replace `/ABS/PATH/...`):

```json
{
  "tools": {
    "media": {
      "audio": {
        "enabled": true,
        "models": [
          {
            "type": "cli",
            "command": "node",
            "args": ["/ABS/PATH/scripts/eleven_stt.mjs", "{{MediaPath}}"],
            "timeoutSeconds": 45
          }
        ]
      }
    }
  }
}
```

OpenClaw behavior note:

- On successful transcription, OpenClaw sets `{{Transcript}}`.
- OpenClaw also maps transcript text into `CommandBody` and `RawBody`, so slash-command flows still work with voice notes.

## Optional Snippets

TTS:

```json
{
  "messages": {
    "tts": {
      "auto": "inbound",
      "provider": "elevenlabs"
    }
  }
}
```

OpenRouter model:

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "openrouter/openai/gpt-4o-mini"
      }
    }
  }
}
```

## Triage API Setup

`services/triage-api` is a standalone Node/TypeScript service.

1. Install dependencies:

```bash
npm run triage-api:install
```

2. Create environment file:

```bash
cp services/triage-api/.env.example services/triage-api/.env
```

3. Set required env:

- `COMPOSIO_API_KEY` (required)
- `COMPOSIO_GITHUB_AUTH_CONFIG_ID` (optional; if omitted, service auto-authorizes via toolkit)
- `TRIAGE_CALLBACK_URL` (optional)

4. Run service:

```bash
npm run triage-api:dev
```

Default base URL is `http://127.0.0.1:8787`.

### API Contracts

- `POST /github/create-issue`
  - input: `{ "repo":"owner/repo", "title":"...", "body":"...", "labels":["bug"] }`
  - success: `{ "ok": true, "issueUrl": "https://github.com/..." }`
  - auth-needed: `{ "ok": false, "needsAuth": true, "authUrl": "..." }`
- `POST /auth/github`
  - output: `{ "ok": true, "authUrl": "..." }`

## ElevenLabs Environment

Set `ELEVENLABS_API_KEY` in the OpenClaw gateway/runtime environment that executes the audio CLI model.

The CLI entrypoint is:

```bash
node scripts/eleven_stt.mjs <local-audio-path>
```

It prints only transcript text to stdout and exits non-zero on failure.

## 30-Second Demo Script

1. Start `triage-api`.
2. In Telegram, send: `/triage owner/repo`
3. Send a voice note describing a bug.
4. OpenClaw transcribes with ElevenLabs and generates structured issue content.
5. Skill calls `triage-api`.
6. If GitHub auth is needed, connect once using returned auth URL.
7. Retry `/triage` and receive a GitHub issue link.
