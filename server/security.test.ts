import { describe, expect, it } from "vitest";
import { assertNoPrivateMaterial, assertSafeSourcePath } from "./security";

describe("source upload security", () => {
  it("rejects private keys and secret assignments", () => {
    expect(() => assertNoPrivateMaterial([{ path: "src/Config.sol", content: "string secret = \"x\";" }])).toThrow("SOURCE_SECRET_REJECTED");
    expect(() => assertNoPrivateMaterial([{ path: "README.md", content: "-----BEGIN PRIVATE KEY-----" }])).toThrow("SOURCE_SECRET_REJECTED");
  });

  it("accepts Solidity paths and rejects traversal", () => {
    expect(() => assertSafeSourcePath("src/Vault.sol")).not.toThrow();
    expect(() => assertSafeSourcePath("../secrets.txt")).toThrow("SOURCE_PATH_REJECTED");
    expect(() => assertSafeSourcePath("/tmp/Vault.sol")).toThrow("SOURCE_PATH_REJECTED");
  });
});
