import { describe, expect, it } from "vitest";
import { parseReply } from "./reply-style";

describe("companion reply contract", () => {
  it("preserves a short natural reply instead of forcing multiple bubbles", () => {
    expect(parseReply("[STATE:teasing]\n你一来，就有点难专心。")).toEqual({
      state: "teasing",
      bubbles: ["你一来，就有点难专心。"],
    });
  });
  it("removes emoji, stage directions and hidden thinking", () => {
    const reply = parseReply(
      "<think>private reasoning</think>[STATE:soft]\n（摸摸头）先歇一下。🥺❤️[BUBBLE]*微笑*今天辛苦了。",
    );
    expect(reply.bubbles).toEqual(["先歇一下。", "今天辛苦了。"]);
  });
  it("caps output at two bubbles, 36 characters each and 64 in total", () => {
    const reply = parseReply(
      "[STATE:attentive]\n" +
        "长".repeat(100) +
        "[BUBBLE]" +
        "话".repeat(100) +
        "[BUBBLE]多余",
    );
    expect(reply.bubbles).toHaveLength(2);
    expect(reply.bubbles.every((text) => Array.from(text).length <= 36)).toBe(
      true,
    );
    expect(Array.from(reply.bubbles.join("")).length).toBeLessThanOrEqual(64);
  });
  it("prefers a complete sentence when a provider talks too much", () => {
    expect(parseReply("今天就早点休息。后面".repeat(20)).bubbles[0]).toMatch(
      /。$/,
    );
  });
  it("does not substitute canned dialogue when provider output is empty", () => {
    expect(parseReply("[STATE:soft]\n🥺❤️").bubbles).toEqual([]);
  });
});
