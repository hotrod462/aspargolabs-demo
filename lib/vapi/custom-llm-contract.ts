export type OpenAiMessage = {
  role?: string;
  content?: string | Array<{ type?: string; text?: string }>;
};

export function latestUserText(messages: OpenAiMessage[] | undefined): string {
  if (!messages?.length) return "";
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (String(m.role ?? "").toLowerCase() !== "user") continue;
    const content = m.content;
    if (typeof content === "string" && content.trim()) return content.trim();
    if (!Array.isArray(content)) continue;
    const text = content
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text!.trim())
      .filter(Boolean)
      .join("\n")
      .trim();
    if (text) return text;
  }
  return "";
}

export function buildChatCompletionResponse(input: {
  model: string;
  say: string;
  endCall: boolean;
  state: string;
  status: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const base = {
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: "chat.completion",
    created: now,
    model: input.model,
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };

  if (input.endCall) {
    return {
      ...base,
      choices: [
        {
          index: 0,
          finish_reason: "tool_calls",
          message: {
            role: "assistant",
            content: input.say,
            tool_calls: [
              {
                id: `call_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`,
                type: "function",
                function: { name: "endCall", arguments: "{}" },
              },
            ],
          },
        },
      ],
      metadata: {
        intake_state: input.state,
        intake_status: input.status,
        end_call: true,
      },
    };
  }

  return {
    ...base,
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: { role: "assistant", content: input.say },
      },
    ],
    metadata: {
      intake_state: input.state,
      intake_status: input.status,
      end_call: false,
    },
  };
}

export function buildChatCompletionStreamChunks(input: {
  model: string;
  say: string;
  endCall: boolean;
  state: string;
  status: string;
}) {
  const id = `chatcmpl-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const chunks: unknown[] = [
    {
      id,
      object: "chat.completion.chunk",
      created,
      model: input.model,
      choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
    },
    {
      id,
      object: "chat.completion.chunk",
      created,
      model: input.model,
      choices: [{ index: 0, delta: { content: input.say }, finish_reason: null }],
    },
  ];

  if (input.endCall) {
    chunks.push({
      id,
      object: "chat.completion.chunk",
      created,
      model: input.model,
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: `call_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`,
                type: "function",
                function: { name: "endCall", arguments: "{}" },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    });
    chunks.push({
      id,
      object: "chat.completion.chunk",
      created,
      model: input.model,
      choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
      metadata: {
        intake_state: input.state,
        intake_status: input.status,
        end_call: true,
      },
    });
  } else {
    chunks.push({
      id,
      object: "chat.completion.chunk",
      created,
      model: input.model,
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      metadata: {
        intake_state: input.state,
        intake_status: input.status,
        end_call: false,
      },
    });
  }

  return chunks;
}

