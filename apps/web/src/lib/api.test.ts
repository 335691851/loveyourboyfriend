import { describe, expect, it, vi } from "vitest";

import { consumeNdjson, type StreamEvent } from "./api";

describe("consumeNdjson", () => {
  it("parses events split across transport chunks", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            '{"type":"companion_state","state":"soft","emoji":"🤍","label":"有点心软了"}\n{"type":"delta","index":0,"content":"晚',
          ),
        );
        controller.enqueue(encoder.encode('安"}\n{"type":"done"}\n'));
        controller.close();
      },
    });
    const onEvent = vi.fn<(event: StreamEvent) => void>();

    await consumeNdjson(stream, onEvent);

    expect(onEvent).toHaveBeenNthCalledWith(1, {
      type: "companion_state",
      state: "soft",
      emoji: "🤍",
      label: "有点心软了",
    });
    expect(onEvent).toHaveBeenNthCalledWith(2, {
      type: "delta",
      index: 0,
      content: "晚安",
    });
    expect(onEvent).toHaveBeenNthCalledWith(3, { type: "done" });
  });
});
