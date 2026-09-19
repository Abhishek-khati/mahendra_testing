import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// Mock Finding Card component test
function FindingCardMock({
  title,
  severity,
  category,
  confidence,
  reviewStatus,
  filePath,
  startLine,
}: {
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  category: string;
  confidence: number;
  reviewStatus?: string;
  filePath: string;
  startLine: number;
}) {
  const severityColors = {
    critical: "bg-red-900 text-red-100",
    high: "bg-red-500 text-white",
    medium: "bg-amber-500 text-white",
    low: "bg-blue-500 text-white",
    informational: "bg-gray-500 text-white",
  };

  return (
    <div data-testid="finding-card" className="border rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-lg">{title}</h3>
        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${severityColors[severity]}`}>
          {severity}
        </span>
      </div>
      <div className="mt-2 text-sm text-gray-600 flex gap-4">
        <span>Category: {category}</span>
        <span>Confidence: {Math.round(confidence * 100)}%</span>
        <span>Location: {filePath}:{startLine}</span>
      </div>
      {reviewStatus && (
        <div className="mt-3 inline-block px-2 py-1 rounded bg-green-100 text-green-800 text-xs font-medium">
          Status: {reviewStatus}
        </div>
      )}
    </div>
  );
}

describe("Finding Review UI Flow", () => {
  it("renders finding with correct severity badge, category, and location", () => {
    render(
      <FindingCardMock
        title="Unchecked ERC20 Transfer Return Value"
        severity="high"
        category="arithmetic-and-validation"
        confidence={0.95}
        filePath="contracts/StakingPool.sol"
        startLine={142}
      />
    );

    expect(screen.getByText("Unchecked ERC20 Transfer Return Value")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText(/Category: arithmetic-and-validation/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidence: 95%/i)).toBeInTheDocument();
    expect(screen.getByText(/contracts\/StakingPool.sol:142/i)).toBeInTheDocument();
  });

  it("renders verified review status badge", () => {
    render(
      <FindingCardMock
        title="Reentrancy Vulnerability"
        severity="critical"
        category="reentrancy"
        confidence={1.0}
        reviewStatus="Confirmed (Auditor Signed)"
        filePath="contracts/Vault.sol"
        startLine={45}
      />
    );

    expect(screen.getByText("critical")).toBeInTheDocument();
    expect(screen.getByText("Status: Confirmed (Auditor Signed)")).toBeInTheDocument();
  });
});
