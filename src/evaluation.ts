import path from "node:path";
import { write } from "./files.js";
import type { Story, Plan } from "./models.js";
export async function evaluatePlan(
  dir: string,
  story: Story,
  plan: Plan,
  context: any[],
  enabled: boolean,
) {
  if (!enabled) {
    const result = {
      status: "not_run",
      reason: "No judge requested; no AI score claimed.",
    };
    write(path.join(dir, "evaluation.json"), result);
    return result;
  }
  process.env.DEEPEVAL_TELEMETRY_OPT_OUT ??= "YES";
  const { FaithfulnessMetric, AnswerRelevancyMetric, GEval } =
    await import("deepeval/metrics");
  const { LLMTestCase, SingleTurnParams } = await import("deepeval/test-case");
  const judge = process.env.SFQA_JUDGE_MODEL || process.env.SFQA_MODEL;
  if (!judge || !process.env.OPENAI_API_KEY)
    throw Error("Configure judge model and credentials");
  const input =
    "Create a test plan for " + story.title + ". " + story.description;
  const actualOutput =
    plan.summary + "\n" + plan.testCases.map((c) => c.title).join("\n");
  const retrievalContext = [
    JSON.stringify(story),
    ...context.map((c) => c.text),
  ];
  const testCase = new LLMTestCase({ input, actualOutput, retrievalContext });
  const metrics = [
    new FaithfulnessMetric({
      threshold: 0.85,
      model: judge,
      penalizeAmbiguousClaims: true,
    }),
    new AnswerRelevancyMetric({ threshold: 0.8, model: judge }),
  ];
  const scores: any[] = [];
  for (const m of metrics) {
    await m.measure(testCase);
    scores.push({
      name: m.constructor.name,
      score: m.score,
      threshold: m.threshold,
      passed: (m.score ?? 0) >= (m.threshold ?? 0.8),
      reason: m.reason,
    });
  }
  const adequacy = new GEval({
    name: "Requirement assertion adequacy",
    model: judge,
    threshold: 0.8,
    criteria:
      "Check whether case assertions verify the explicit expected criteria. Penalize invented rules, circular oracles and mapping a criterion without checking its outcome. Do not treat self-claimed coverage as proof.",
    evaluationParams: [
      SingleTurnParams.ACTUAL_OUTPUT,
      SingleTurnParams.EXPECTED_OUTPUT,
    ],
  });
  await adequacy.measure(
    new LLMTestCase({
      input,
      actualOutput: JSON.stringify(plan),
      expectedOutput: JSON.stringify(story.acceptanceCriteria),
    }),
  );
  scores.push({
    name: "RequirementAssertionAdequacy",
    score: adequacy.score,
    threshold: adequacy.threshold,
    passed: (adequacy.score ?? 0) >= (adequacy.threshold ?? 0.8),
    reason: adequacy.reason,
  });
  const result = {
    status: "evaluated",
    passed: scores.every((m) => m.passed),
    judge,
    metrics: scores,
  };
  write(path.join(dir, "evaluation.json"), result);
  write(path.join(dir, "eval-input.json"), {
    input,
    actualOutput,
    retrievalContext,
  });
  return result;
}
