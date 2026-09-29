import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatShell } from "./chat-shell";

const useChatMock = vi.fn();

vi.mock("@/hooks/use-chat", () => ({
  useChat: () => useChatMock(),
}));

vi.mock("@/hooks/use-voice-recorder", () => ({
  useVoiceRecorder: () => ({
    recording: false,
    error: null,
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

const baseChat = {
  messages: [],
  profile: null,
  entryMode: "new",
  companionMood: { state: "approaching", emoji: "🌙", label: "正在靠近" },
  ready: false,
  connecting: false,
  sending: false,
  transcribing: false,
  error: null,
  send: vi.fn(),
  sendVoice: vi.fn(),
  speak: vi.fn(),
  startWithContext: vi.fn(),
  continueHistory: vi.fn(),
  showCheckin: vi.fn(),
  closeCheckin: vi.fn(),
};

describe("ChatShell", () => {
  beforeEach(() => {
    useChatMock.mockReturnValue({ ...baseChat });
  });

  it("shows a stable loading scene without flashing the old welcome card", () => {
    useChatMock.mockReturnValue({
      ...baseChat,
      entryMode: "loading",
      connecting: true,
    });

    render(<ChatShell />);

    expect(screen.getByText("正在找回你们的默契")).toBeInTheDocument();
    expect(screen.queryByText("今晚想聊点什么？")).not.toBeInTheDocument();
  });

  it("lets a new user choose both mood and emotional need", () => {
    render(<ChatShell />);

    expect(
      screen.getByRole("heading", { name: /先靠近一点/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "委屈" }));
    fireEvent.click(screen.getByRole("button", { name: "哄哄我" }));
    fireEvent.click(screen.getByRole("button", { name: "和陆川聊聊" }));

    expect(baseChat.startWithContext).toHaveBeenCalledWith("委屈", "哄哄我");
  });

  it("offers returning users a direct path back to history", () => {
    useChatMock.mockReturnValue({ ...baseChat, entryMode: "returning" });

    render(<ChatShell />);
    fireEvent.click(screen.getByRole("button", { name: "直接继续上次" }));

    expect(baseChat.continueHistory).toHaveBeenCalledOnce();
  });

  it("allows opening a conversation without filling in a mood form", () => {
    render(<ChatShell />);
    fireEvent.click(screen.getByRole("button", { name: "和陆川聊聊" }));
    expect(baseChat.startWithContext).toHaveBeenCalledWith("轻松", "听我说");
  });

  it("keeps drafting available while a response is pending", () => {
    useChatMock.mockReturnValue({
      ...baseChat,
      entryMode: "chat",
      ready: true,
      sending: true,
    });
    render(<ChatShell />);
    const input = screen.getByRole("textbox", { name: "输入消息" });
    expect(input).not.toBeDisabled();
    fireEvent.change(input, { target: { value: "下一句" } });
    expect(screen.getByRole("button", { name: "发送消息" })).toBeDisabled();
  });

  it("does not send Enter while the Chinese IME is composing", () => {
    useChatMock.mockReturnValue({
      ...baseChat,
      entryMode: "chat",
      ready: true,
    });
    baseChat.send.mockClear();
    render(<ChatShell />);
    const input = screen.getByRole("textbox", { name: "输入消息" });
    fireEvent.change(input, { target: { value: "你好" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true, keyCode: 229 });
    expect(baseChat.send).not.toHaveBeenCalled();
  });
});
