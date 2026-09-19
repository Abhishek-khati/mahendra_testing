import { invokeLLM, listLLMModels } from "../_core/llm";
import type { AiFindingAnalysis } from "./contracts";

const fallback = (reason: string): AiFindingAnalysis => ({
  findingExplanation: "Contextual AI analysis was not produced.",
  impactExplanation: "No impact statement is asserted without validated evidence.",
  affectedFunction: "Unknown",
  affectedLines: "Unknown",
  relevantCodeSnippet: "Unavailable",
  attackScenario: "Not assessed",
  whyItMatters: "A human reviewer must inspect the underlying finding and source revision.",
  confidence: "low",
  evidenceUsed: [],
  suggestedMitigation: "Review the detector output and validate it with tests before changing code.",
  suggestedPatch: "No patch generated.",
  limitations: [reason],
  reviewStatus: "needs_review",
});

function contentAsText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(item => typeof item === "string" ? item : JSON.stringify(item)).join("\n");
  return "";
}

function validateOutput(value: unknown, validEvidenceIds: Set<string>): AiFindingAnalysis {
  if (!value || typeof value !== "object") throw new Error("AI_OUTPUT_NOT_OBJECT");
  const record = value as Record<string, unknown>;
  const requiredStrings = ["findingExplanation", "impactExplanation", "affectedFunction", "affectedLines", "relevantCodeSnippet", "attackScenario", "whyItMatters", "suggestedMitigation", "suggestedPatch"];
  for (const key of requiredStrings) if (typeof record[key] !== "string") throw new Error(`AI_OUTPUT_INVALID_${key}`);
  const evidenceUsed = Array.isArray(record.evidenceUsed) ? record.evidenceUsed.filter((item): item is string => typeof item === "string" && validEvidenceIds.has(item)) : [];
  const limitations = Array.isArray(record.limitations) ? record.limitations.filter((item): item is string => typeof item === "string") : [];
  const confidence = record.confidence === "high" || record.confidence === "medium" || record.confidence === "low" ? record.confidence : "low";
  return {
    findingExplanation: record.findingExplanation as string,
    impactExplanation: record.impactExplanation as string,
    affectedFunction: record.affectedFunction as string,
    affectedLines: record.affectedLines as string,
    relevantCodeSnippet: record.relevantCodeSnippet as string,
    attackScenario: record.attackScenario as string,
    whyItMatters: record.whyItMatters as string,
    confidence,
    evidenceUsed,
    suggestedMitigation: record.suggestedMitigation as string,
    suggestedPatch: record.suggestedPatch as string,
    limitations: [...limitations, "AI output is advisory and must be validated by tests and a re-scan.", "The model is not permitted to create evidence or declare the contract safe."],
    reviewStatus: "needs_review",
  };
}

export async function analyzeFindingWithAi(input: {
  finding: { title: string; description: string; category: string; severity: string; confidence: string };
  occurrences: Array<{ filePath: string; startLine: number; endLine: number; codeHash: string; detectorRefsJson: unknown; evidenceIdsJson: unknown }>;
  evidence: Array<{ evidenceHash: string; payloadJson: unknown; provenanceJson: unknown }>;
}): Promise<AiFindingAnalysis> {
  const validEvidenceIds = new Set(input.evidence.map(item => item.evidenceHash));
  if (!process.env.BUILT_IN_FORGE_API_KEY) return fallback("Built-in LLM is not configured in this environment.");
  try {
    const catalog = await listLLMModels();
    const model = catalog.data?.find(item => item.id === "gpt-5-mini")?.id ?? catalog.data?.find(item => item.id.startsWith("gpt-5"))?.id;
    const response = await invokeLLM({
      model,
      messages: [
        {
          role: "system",
          content: "You are ChainShield's evidence-grounded smart-contract review assistant. You may explain only the supplied finding and evidence. Never invent vulnerabilities, code, line numbers, attack traces, or test outcomes. Distinguish observed detector facts from hypotheses. Do not declare a contract safe. Suggested patches are advisory and must be validated by tests and a re-scan. Output JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            finding: input.finding,
            occurrences: input.occurrences,
            evidence: input.evidence,
            instructions: "Reference evidenceHash values when using evidence. If evidence is incomplete, say so and set reviewStatus to needs_review.",
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "chainshield_finding_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              findingExplanation: { type: "string" },
              impactExplanation: { type: "string" },
              affectedFunction: { type: "string" },
              affectedLines: { type: "string" },
              relevantCodeSnippet: { type: "string" },
              attackScenario: { type: "string" },
              whyItMatters: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              evidenceUsed: { type: "array", items: { type: "string" } },
              suggestedMitigation: { type: "string" },
              suggestedPatch: { type: "string" },
              limitations: { type: "array", items: { type: "string" } },
              reviewStatus: { type: "string", enum: ["needs_review", "ready_for_human_review"] },
            },
            required: ["findingExplanation", "impactExplanation", "affectedFunction", "affectedLines", "relevantCodeSnippet", "attackScenario", "whyItMatters", "confidence", "evidenceUsed", "suggestedMitigation", "suggestedPatch", "limitations", "reviewStatus"],
            additionalProperties: false,
          },
        },
      },
    });
    const raw = contentAsText(response.choices[0]?.message.content);
    return validateOutput(JSON.parse(raw), validEvidenceIds);
  } catch (error) {
    return fallback(`AI analysis failed safely: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}
