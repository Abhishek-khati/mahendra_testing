import type { FindingCandidate, SourceFile } from "./contracts";
import { evidenceForMatch } from "./evidence";

const LIMITATION = "Pattern-based signal only; exploitability, reachability, and protocol context require validation.";

function candidate(
  file: SourceFile,
  index: number,
  ruleId: string,
  title: string,
  category: string,
  description: string,
  severity: FindingCandidate["severity"],
  limitations = [LIMITATION],
): FindingCandidate {
  const evidence = evidenceForMatch(file, index, "custom-detector", ruleId, 3, limitations);
  return {
    title,
    category,
    classification: "hypothesis",
    severity,
    confidence: "low",
    description,
    detector: { engine: "custom", ruleId, version: "custom-rules/1.0.0" },
    evidence: [evidence],
    limitations,
  };
}

export function runCustomDetectors(files: SourceFile[]): FindingCandidate[] {
  const findings: FindingCandidate[] = [];
  for (const file of files) {
    if (!file.path.endsWith(".sol")) continue;
    const source = file.content;

    for (const match of Array.from(source.matchAll(/\.call\s*(?:\{|\()/g))) {
      const index = match.index ?? 0;
      const after = source.slice(index, Math.min(source.length, index + 500));
      if (/\b(value|amount|balance|state|_balances|nonce)\b/.test(after)) {
        findings.push(candidate(
          file,
          index,
          "CS-CUSTOM-REENTRANCY-ORDER",
          "External call may precede state update",
          "Reentrancy pattern",
          "An external call appears near state mutation vocabulary. The detector cannot prove ordering, attacker control, or exploitability.",
          "high",
        ));
      }
    }

    for (const match of Array.from(source.matchAll(/\btx\.origin\b/g))) {
      findings.push(candidate(
        file,
        match.index ?? 0,
        "CS-CUSTOM-TX-ORIGIN",
        "tx.origin participates in authorization or identity flow",
        "Authorization flow",
        "tx.origin is used in the selected source. This can be risky when intermediate contracts are part of the call path; the detector does not infer the exact authorization impact.",
        "medium",
      ));
    }

    for (const match of Array.from(source.matchAll(/\bdelegatecall\s*\(/g))) {
      findings.push(candidate(
        file,
        match.index ?? 0,
        "CS-CUSTOM-DELEGATECALL",
        "Delegatecall creates implementation-context coupling",
        "Upgradeable or cross-contract behavior",
        "A delegatecall is present. Storage layout, target control, initialization, and upgrade authority must be reviewed together.",
        "medium",
      ));
    }

    for (const match of Array.from(source.matchAll(/function\s+(upgradeTo|upgrade|setImplementation|_authorizeUpgrade)\b/g))) {
      const index = match.index ?? 0;
      const functionBody = source.slice(index, Math.min(source.length, index + 700));
      if (!/onlyOwner|onlyRole|auth|require\s*\(/i.test(functionBody)) {
        findings.push(candidate(
          file,
          index,
          "CS-CUSTOM-UPGRADE-AUTH",
          "Upgradeable-looking function lacks nearby authorization evidence",
          "Upgradeable-contract configuration",
          "A function name associated with upgrades is not accompanied by a nearby authorization marker in the inspected source slice. The rule may miss modifiers declared elsewhere.",
          "high",
          ["Nearby-text rule only; inherited modifiers, access-control configuration, and proxy topology were not resolved."],
        ));
      }
    }

    for (const match of Array.from(source.matchAll(/\bblock\.timestamp\b/g))) {
      findings.push(candidate(
        file,
        match.index ?? 0,
        "CS-CUSTOM-TIMESTAMP-DEPENDENCY",
        "Block timestamp participates in contract logic",
        "Oracle or timing dependency",
        "Block timestamp is used in contract logic. This may be appropriate for coarse deadlines but is unsafe for precise randomness or adversarial timing assumptions.",
        "low",
      ));
    }

    for (const match of Array.from(source.matchAll(/\b(ecrecover|ECDSA\.recover|permit)\s*\(/g))) {
      const index = match.index ?? 0;
      const context = source.slice(Math.max(0, index - 600), Math.min(source.length, index + 700));
      if (!/nonce|chainId|deadline|domainSeparator/i.test(context)) {
        findings.push(candidate(
          file,
          index,
          "CS-CUSTOM-SIGNATURE-CONTEXT",
          "Signature recovery lacks nearby replay-context markers",
          "Replay or signature-flow issue",
          "Signature recovery is present without nearby nonce, chain, deadline, or domain-separator markers. This is a review hypothesis, not proof of replayability.",
          "medium",
          ["Context-window rule only; helper functions and inherited replay protections may exist outside the inspected slice."],
        ));
      }
    }
  }
  return findings;
}
