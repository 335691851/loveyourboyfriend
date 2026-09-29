import { StrictMode, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useChat } from "./use-chat";

describe("chat lifecycle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
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
});
