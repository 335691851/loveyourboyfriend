import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatShell } from "./chat-shell";

describe("ChatShell", () => {
  it("renders the mobile conversation entry points", () => {
    render(<ChatShell />);

    expect(
      screen.getByRole("heading", { name: "今晚想聊点什么？" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("输入消息")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "发送语音" }),
    ).toBeInTheDocument();
    expect(screen.getByText("陆川")).toBeInTheDocument();
  });

  it("does not render a server-generated timestamp for the synthetic greeting", () => {
    const { container } = render(<ChatShell />);

    expect(container.querySelector("time")).not.toBeInTheDocument();
  });
});
