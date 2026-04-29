import { describe, expect, it } from "vitest";
import {
  buildChatCompletionResponse,
  latestUserText,
} from "@/lib/vapi/custom-llm-contract";

describe("custom LLM contract", () => {
  it("extracts latest user text from mixed messages", () => {
    const text = latestUserText([
      { role: "system", content: "ignore" },
      { role: "user", content: "first" },
      { role: "assistant", content: "ok" },
      {
        role: "user",
        content: [
          { type: "text", text: "second line" },
          { type: "text", text: "final line" },
        ],
      },
    ]);
    expect(text).toBe("second line\nfinal line");
  });

  it("serializes terminal end-call as function tool call", () => {
    const payload = buildChatCompletionResponse({
      model: "custom-intake-llm",
      say: "I cannot proceed with this intake.",
      endCall: true,
      state: "ineligible_end",
      status: "ineligible",
    });

    expect(payload.choices[0]?.finish_reason).toBe("tool_calls");
    const toolCall = payload.choices[0]?.message?.tool_calls?.[0];
    expect(toolCall?.function?.name).toBe("endCall");
    expect(toolCall?.function?.arguments).toBe("{}");
    expect(payload.metadata?.end_call).toBe(true);
  });
});

