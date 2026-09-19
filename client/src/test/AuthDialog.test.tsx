import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthDialog } from "@/components/AuthDialog";

describe("AuthDialog UI Component", () => {
  it("renders sign in modal when open", () => {
    const handleLogin = vi.fn();
    render(
      <AuthDialog
        open={true}
        title="Welcome to ChainShield AI"
        onLogin={handleLogin}
      />
    );

    expect(screen.getByText("Welcome to ChainShield AI")).toBeInTheDocument();
    expect(screen.getByText("Please sign in to continue to workspace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign In with OAuth/i })).toBeInTheDocument();
  });

  it("calls onLogin callback when user clicks Sign In", () => {
    const handleLogin = vi.fn();
    render(
      <AuthDialog
        open={true}
        title="ChainShield Security"
        onLogin={handleLogin}
      />
    );

    const button = screen.getByRole("button", { name: /Sign In with OAuth/i });
    fireEvent.click(button);
    expect(handleLogin).toHaveBeenCalledTimes(1);
  });
});
