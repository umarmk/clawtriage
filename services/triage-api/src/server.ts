import "dotenv/config";
import express, { type Request, type Response } from "express";
import process from "node:process";
import { Composio } from "@composio/core";
import { z } from "zod";

const DEMO_USER_ID = "demo_user";
const GITHUB_TOOLKIT = "github";
const GITHUB_CREATE_ISSUE_TOOL = "GITHUB_CREATE_ISSUE";
const REPO_REGEX = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const PORT = Number(process.env.PORT ?? "8787");

const createIssueRequestSchema = z.object({
  repo: z.string().regex(REPO_REGEX, "repo must match owner/repo"),
  title: z.string().min(3, "title must be at least 3 characters").trim(),
  body: z.string().min(1, "body is required").trim(),
  labels: z.array(z.string().min(1).trim()).optional(),
});

type ApiErrorResponse = {
  ok: false;
  error: string;
  details?: unknown;
};

const composioApiKey = process.env.COMPOSIO_API_KEY;
if (!composioApiKey) {
  process.stderr.write("COMPOSIO_API_KEY is required.\n");
  process.exit(1);
}

const composio = new Composio({
  apiKey: composioApiKey,
});

const app = express();
app.use(express.json({ limit: "1mb" }));

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Unexpected error";
}

function getOptionalCallbackConfig() {
  const callbackUrl = process.env.TRIAGE_CALLBACK_URL?.trim();
  return callbackUrl ? { callbackUrl } : undefined;
}

function pickIssueUrl(data: Record<string, unknown>): string | null {
  const directCandidates = [
    data.html_url,
    data.issue_url,
    data.issueUrl,
    data.url,
  ];

  for (const value of directCandidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const nestedCandidates = [data.issue, data.data, data.result];
  for (const nested of nestedCandidates) {
    if (!nested || typeof nested !== "object") continue;
    const obj = nested as Record<string, unknown>;
    const values = [obj.html_url, obj.issue_url, obj.issueUrl, obj.url];
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }

  return null;
}

async function createGithubAuthUrl(): Promise<string> {
  const callbackConfig = getOptionalCallbackConfig();
  const authConfigId = process.env.COMPOSIO_GITHUB_AUTH_CONFIG_ID?.trim();

  const connectionRequest = authConfigId
    ? await composio.connectedAccounts.link(
        DEMO_USER_ID,
        authConfigId,
        callbackConfig
      )
    : await composio.toolkits.authorize(DEMO_USER_ID, GITHUB_TOOLKIT);

  const authUrl = connectionRequest.redirectUrl;
  if (!authUrl || typeof authUrl !== "string") {
    throw new Error("Composio did not return an auth URL.");
  }

  return authUrl;
}

async function getActiveGithubConnectedAccountId(): Promise<string | null> {
  const accounts = await composio.connectedAccounts.list({
    userIds: [DEMO_USER_ID],
    toolkitSlugs: [GITHUB_TOOLKIT],
    statuses: ["ACTIVE"],
    limit: 1,
  });

  return accounts.items?.[0]?.id ?? null;
}

app.post(
  "/github/create-issue",
  async (req: Request, res: Response<ApiErrorResponse | unknown>) => {
    const parsed = createIssueRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "Invalid request body.",
        details: parsed.error.flatten(),
      });
    }

    try {
      const { repo, title, body, labels } = parsed.data;
      const [owner, repoName] = repo.split("/");

      const connectedAccountId = await getActiveGithubConnectedAccountId();
      if (!connectedAccountId) {
        const authUrl = await createGithubAuthUrl();
        return res.status(200).json({
          ok: false,
          needsAuth: true,
          authUrl,
        });
      }

      const toolArguments: Record<string, unknown> = {
        owner,
        repo: repoName,
        title,
        body,
      };

      if (labels && labels.length > 0) {
        toolArguments.labels = labels;
      }

      const result = await composio.tools.execute(GITHUB_CREATE_ISSUE_TOOL, {
        userId: DEMO_USER_ID,
        connectedAccountId,
        dangerouslySkipVersionCheck: true,
        arguments: toolArguments,
      });

      if (result.successful !== true) {
        return res.status(500).json({
          ok: false,
          error: result.error ?? "Failed to create issue in GitHub.",
          details: result.data,
        });
      }

      const issueUrl = pickIssueUrl(result.data);
      if (!issueUrl) {
        return res.status(500).json({
          ok: false,
          error: "Issue URL was not found in Composio response.",
          details: result.data,
        });
      }

      return res.status(200).json({
        ok: true,
        issueUrl,
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: getErrorMessage(error),
      });
    }
  }
);

app.post(
  "/auth/github",
  async (_req: Request, res: Response<ApiErrorResponse | unknown>) => {
    try {
      const authUrl = await createGithubAuthUrl();
      return res.status(200).json({
        ok: true,
        authUrl,
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: getErrorMessage(error),
      });
    }
  }
);

app.listen(PORT, () => {
  // Minimal startup log for local debugging.
  process.stdout.write(`triage-api listening on http://127.0.0.1:${PORT}\n`);
});
