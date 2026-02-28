import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";
import {
  streamText,
  convertToModelMessages,
  generateId,
  stepCountIs,
  type UIMessage,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const composio = new Composio({ provider: new VercelProvider() });

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
});

export async function POST(req: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return new Response("Missing OPENROUTER_API_KEY", { status: 500 });
  }
  if (!process.env.COMPOSIO_API_KEY) {
    return new Response("Missing COMPOSIO_API_KEY", { status: 500 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  // MVP: single user. Later you can replace with an actual auth user id.
  const session = await composio.create("user_123");
  const tools = await session.tools();

  const result = streamText({
    model: openrouter("openai/gpt-4o-mini"),
    system:
      "You are a helpful assistant. Use Composio tools to help the user. " +
      "If a tool requires auth, provide the auth link and ask the user to confirm once they connected.",
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId: () => generateId(),
  });
}