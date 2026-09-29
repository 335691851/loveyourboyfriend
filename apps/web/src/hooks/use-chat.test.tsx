import { StrictMode, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proactiveIdleDelay, useChat } from "./use-chat";

const savedConversation = {
  id: "conversation-1",
  profile: {
    current_mood: "开心",
    emotional_need: "暧昧一点",
    mood_updated_at: "2026-09-29T00:00:00.000Z",
  },
  messages: [
    {
      id: "user-1",
      conversation_id: "conversation-1",
      role: "user",
      content: "今天终于忙完了",
      companion_state: null,
      created_at: "2026-09-29T00:00:00.000Z",
    },
  ],
};

describe("chat lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("keeps the proactive idle delay inside the intended window", () => {
    expect(proactiveIdleDelay(() => 0)).toBe(45_000);
    expect(proactiveIdleDelay(() => 1)).toBe(100_000);
  });

  it("finishes restoring in React StrictMode", async () => {
    const { result } = renderHook(useChat, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <StrictMode>{children}</StrictMode>
      ),
    });
    await waitFor(() => expect(result.current.entryMode).toBe("new"));
    expect(result.current.connecting).toBe(false);
  });

  it("returns a failed send to the composer without keeping a phantom message", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ detail: "网络断开" }), { status: 502 }),
        ),
    );
    const { result } = renderHook(useChat);
    await waitFor(() => expect(result.current.entryMode).toBe("new"));
    let sent;
    await act(async () => {
      sent = await result.current.send("你好");
    });
    expect(sent).toBe(false);
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.error).toBe("网络断开");
    expect(result.current.sending).toBe(false);
  });

  it("starts a gentle proactive interaction after an idle chat window", async () => {
    localStorage.setItem(
      "loveyourboyfriend:conversation:v1",
      JSON.stringify(savedConversation),
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        [
          JSON.stringify({
            type: "start",
            conversation_id: "conversation-1",
          }),
          JSON.stringify({
            type: "companion_state",
            state: "soft",
            emoji: "🤍",
            label: "有点心软了",
          }),
          JSON.stringify({ type: "bubble_start", index: 0 }),
          JSON.stringify({
            type: "delta",
            index: 0,
            content: "忙完了就过来，让我抱一下。",
          }),
          JSON.stringify({
            type: "message",
            index: 0,
            id: "assistant-proactive",
            conversation_id: "conversation-1",
            content: "忙完了就过来，让我抱一下。",
            companion_state: "soft",
          }),
          JSON.stringify({ type: "done" }),
          "",
        ].join("\n"),
        { headers: { "Content-Type": "application/x-ndjson" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { result } = renderHook(useChat);
    await waitFor(() => expect(result.current.entryMode).toBe("returning"));
    vi.useFakeTimers();
    act(() => result.current.continueHistory());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      interaction_mode: "proactive",
      conversation_id: "conversation-1",
    });
    expect(result.current.messages.at(-1)?.content).toBe(
      "忙完了就过来，让我抱一下。",
    );
  });
});
