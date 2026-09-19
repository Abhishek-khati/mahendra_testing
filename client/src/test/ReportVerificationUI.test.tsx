import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock Report Header and Verification Component
function ReportHeaderMock({
  projectName,
  contentHash,
  isVerified,
  isAnchored,
  onAnchor,
  anchoringPending,
}: {
  projectName: string;
  contentHash: string;
  isVerified: boolean;
  isAnchored: boolean;
  onAnchor?: () => void;
  anchoringPending?: boolean;
}) {
  return (
    <div className="p-6 bg-card border rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{projectName} Security Audit</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            Hash: {contentHash}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isVerified ? (
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-xs font-semibold">
              ✓ Tamper-Evident Verified
            </span>
          ) : (
            <span className="px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-xs font-semibold">
              ⚠ Hash Mismatch
            </span>
          )}

          {isAnchored ? (
            <span className="px-3 py-1 bg-purple-500/10 text-purple-400 rounded-full text-xs font-semibold">
              🔗 Anchored on Sepolia
            </span>
          ) : (
            <button
              onClick={onAnchor}
              disabled={anchoringPending}
              className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {anchoringPending ? "Anchoring..." : "Anchor Report On-Chain"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

describe("Security Report Verification & Anchoring UI", () => {
  it("renders verified report state and content hash", () => {
    render(
      <ReportHeaderMock
        projectName="UniswapV4Pool"
        contentHash="a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0"
        isVerified={true}
        isAnchored={false}
      />
    );

    expect(screen.getByText("UniswapV4Pool Security Audit")).toBeInTheDocument();
    expect(screen.getByText(/Hash: a1b2c3d4e5f6/i)).toBeInTheDocument();
    expect(screen.getByText("✓ Tamper-Evident Verified")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Anchor Report On-Chain/i })).toBeInTheDocument();
  });

  it("handles anchor button click and updates UI", () => {
    const handleAnchor = vi.fn();
    render(
      <ReportHeaderMock
        projectName="VaultProtocol"
        contentHash="f0e1d2c3b4a596877890123456789abcdef0123456789abcdef0123456789abc"
        isVerified={true}
        isAnchored={false}
        onAnchor={handleAnchor}
      />
    );

    const anchorButton = screen.getByRole("button", { name: /Anchor Report On-Chain/i });
    fireEvent.click(anchorButton);
    expect(handleAnchor).toHaveBeenCalledTimes(1);
  });

  it("displays anchored badge when report is confirmed on Sepolia", () => {
    render(
      <ReportHeaderMock
        projectName="VaultProtocol"
        contentHash="f0e1d2c3b4a596877890123456789abcdef0123456789abcdef0123456789abc"
        isVerified={true}
        isAnchored={true}
      />
    );

    expect(screen.getByText("🔗 Anchored on Sepolia")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Anchor Report On-Chain/i })).not.toBeInTheDocument();
  });
});
