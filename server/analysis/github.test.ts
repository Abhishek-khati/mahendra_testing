import { describe, expect, it } from "vitest";
import { parseGitHubUrl } from "./github";

describe("GitHub URL Parser", () => {
  it("parses standard https github URL", () => {
    const result = parseGitHubUrl("https://github.com/OpenZeppelin/openzeppelin-contracts");
    expect(result.owner).toBe("OpenZeppelin");
    expect(result.repo).toBe("openzeppelin-contracts");
    expect(result.branch).toBeUndefined();
  });

  it("parses shorthand owner/repo", () => {
    const result = parseGitHubUrl("Uniswap/v4-core");
    expect(result.owner).toBe("Uniswap");
    expect(result.repo).toBe("v4-core");
  });

  it("parses branch and subpath from URL", () => {
    const result = parseGitHubUrl("https://github.com/compound-finance/compound-protocol/tree/master/contracts");
    expect(result.owner).toBe("compound-finance");
    expect(result.repo).toBe("compound-protocol");
    expect(result.branch).toBe("master");
    expect(result.subpath).toBe("contracts");
  });

  it("handles .git suffix cleanly", () => {
    const result = parseGitHubUrl("https://github.com/makerdao/dss.git");
    expect(result.owner).toBe("makerdao");
    expect(result.repo).toBe("dss");
  });

  it("rejects invalid URL formats", () => {
    expect(() => parseGitHubUrl("not-a-valid-url")).toThrow();
  });
});
