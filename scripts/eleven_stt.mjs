#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { basename } from "node:path";
import process from "node:process";

const ELEVEN_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function pickTranscript(payload) {
  if (!payload || typeof payload !== "object") return "";

  const directCandidates = [
    payload.text,
    payload.transcript,
    payload.output_text,
    payload.result,
  ];
  for (const value of directCandidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const nested = payload.data;
  if (nested && typeof nested === "object") {
    const nestedCandidates = [nested.text, nested.transcript, nested.output_text];
    for (const value of nestedCandidates) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }

  return "";
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    fail("Usage: node scripts/eleven_stt.mjs <local-audio-path>");
  }

  const audioPath = args[0];
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    fail("ELEVENLABS_API_KEY is required.");
  }

  try {
    await access(audioPath);
  } catch {
    fail(`Audio file not found or not readable: ${audioPath}`);
  }

  let fileBuffer;
  try {
    fileBuffer = await readFile(audioPath);
  } catch {
    fail(`Failed to read audio file: ${audioPath}`);
  }

  const form = new FormData();
  const blob = new Blob([fileBuffer]);
  form.append("file", blob, basename(audioPath));
  form.append("model_id", "scribe_v2");

  let response;
  try {
    response = await fetch(ELEVEN_STT_URL, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
      },
      body: form,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    fail(`ElevenLabs request failed: ${message}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    fail(`ElevenLabs returned non-JSON response (status ${response.status}).`);
  }

  if (!response.ok) {
    const detail =
      (payload && typeof payload.detail === "string" && payload.detail) ||
      (payload && typeof payload.error === "string" && payload.error) ||
      `HTTP ${response.status}`;
    fail(`ElevenLabs transcription failed: ${detail}`);
  }

  const transcript = pickTranscript(payload);
  if (!transcript) {
    fail("ElevenLabs transcription returned empty transcript.");
  }

  process.stdout.write(transcript);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  fail(`Unexpected error: ${message}`);
});
