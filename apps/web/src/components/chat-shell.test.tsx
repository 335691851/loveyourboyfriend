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
      screen.getByRole("heading", { name: "现在的你，是什么天气？" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "委屈" }));
    fireEvent.click(screen.getByRole("button", { name: "哄哄我" }));
    fireEvent.click(screen.getByRole("button", { name: "让陆川来找我" }));

    expect(baseChat.startWithContext).toHaveBeenCalledWith("委屈", "哄哄我");
  });

  it("offers returning users a direct path back to history", () => {
    useChatMock.mockReturnValue({ ...baseChat, entryMode: "returning" });

    render(<ChatShell />);
    fireEvent.click(screen.getByRole("button", { name: "直接继续上次" }));

    expect(baseChat.continueHistory).toHaveBeenCalledOnce();
  });
});
