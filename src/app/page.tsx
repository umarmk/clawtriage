"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import { ToolCallDisplay } from "@/components/ToolCallDisplay";

export default function Chat() {
  const [input, setInput] = useState("");

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isLoading = status === "streaming" || status === "submitted";

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">ClawActions</h1>
      <p className="text-sm text-gray-500 mb-6">
        Chat → OAuth connect → real actions via Composio.
      </p>

      <div className="space-y-4 mb-6 min-h-[240px]">
        {messages.length === 0 && (
          <p className="text-gray-400 text-center py-12">
            Try: “Star the composio repo on GitHub” or “Create a GitHub issue titled …”
          </p>
        )}

        {messages.map((m) => (
          <div key={m.id} className="flex gap-2">
            <span className="font-semibold shrink-0">
              {m.role === "user" ? "You:" : "Agent:"}
            </span>

            <div className="flex-1 whitespace-pre-wrap">
              {m.parts.map((part, i) => {
                if (part.type === "text") return <span key={i}>{String(part.text)}</span>;

                if (isToolUIPart(part)) {
                  return (
                    <ToolCallDisplay
                      key={part.toolCallId}
                      toolName={getToolName(part)}
                      input={part.input}
                      output={part.state === "output-available" ? part.output : undefined}
                      isLoading={part.state !== "output-available"}
                    />
                  );
                }

                return null;
              })}
            </div>
          </div>
        ))}

        {isLoading && <p className="text-gray-400 text-sm">Thinking...</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          sendMessage({ text: input });
          setInput("");
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me to do something..."
          disabled={isLoading}
          className="flex-1 p-3 border border-gray-300 rounded-lg"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-3 bg-black text-white font-medium rounded-lg disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </main>
  );
}