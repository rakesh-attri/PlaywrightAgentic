import { it, expect } from "vitest";
import {
  ExactMatchMetric,
  FaithfulnessMetric,
  AnswerRelevancyMetric,
  GEval,
} from "deepeval/metrics";
import { LLMTestCase, SingleTurnParams } from "deepeval/test-case";
import { DeepEvalBaseLLM, type GenerationResult } from "deepeval/models";
import type { ZodType } from "zod";

// Fixture judge responses exercise real metric templates/schema/score plumbing.
// These are regression checks, never presented as measured model quality.
class FixtureJudge extends DeepEvalBaseLLM {
  constructor(private outputs: unknown[]) {
    super("fixture-judge");
  }
  getModelName() {
    return "fixture-judge";
  }
  async generate<T = string>(
    _prompt: string,
    schema?: ZodType<T>,
  ): Promise<GenerationResult<T>> {
    if (!this.outputs.length) throw Error("Unexpected judge call");
    const output = this.outputs.shift();
    return {
      output: schema ? schema.parse(output) : (String(output) as T),
      cost: null,
    };
  }
}

it("executes the real DeepEval TypeScript metric locally without Python or a judge", async () => {
  const metric = new ExactMatchMetric({ showIndicator: false });
  expect(
    await metric.measure(
      new LLMTestCase({
        input: "Expected validation copy",
        actualOutput: "Account Name is required",
        expectedOutput: "Account Name is required",
      }),
    ),
  ).toBe(1);
  expect(
    await metric.measure(
      new LLMTestCase({
        input: "Expected validation copy",
        actualOutput: "Unrelated text",
        expectedOutput: "Account Name is required",
      }),
    ),
  ).toBe(0);
});

it.each(["yes", "no"])(
  "runs actual DeepEval faithfulness scoring for verdict %s",
  async (verdict) => {
    const judge = new FixtureJudge([
      { truths: ["Name is required"] },
      { claims: ["Name is required"] },
      { verdicts: [{ verdict, reason: "Fixture verdict" }] },
    ]);
    const metric = new FaithfulnessMetric({
      model: judge,
      includeReason: false,
      showIndicator: false,
      penalizeAmbiguousClaims: true,
    });
    expect(
      await metric.measure(
        new LLMTestCase({
          input: "Account requirement",
          actualOutput: "Name is required",
          retrievalContext: ["Name is required"],
        }),
      ),
    ).toBe(verdict === "yes" ? 1 : 0);
  },
);
it("runs actual DeepEval answer relevancy plumbing", async () => {
  const metric = new AnswerRelevancyMetric({
    model: new FixtureJudge([
      { statements: ["Name is required"] },
      { verdicts: [{ verdict: "yes" }] },
    ]),
    includeReason: false,
    showIndicator: false,
  });
  expect(
    await metric.measure(
      new LLMTestCase({
        input: "Which field is required?",
        actualOutput: "Name is required",
      }),
    ),
  ).toBe(1);
});
it("runs actual GEval with a fixture judge response", async () => {
  const metric = new GEval({
    name: "Fixture adequacy",
    model: new FixtureJudge([
      { score: 10, reason: "Fixture response, not a real quality judgment" },
    ]),
    evaluationSteps: ["Compare the expected and actual outcomes"],
    evaluationParams: [
      SingleTurnParams.ACTUAL_OUTPUT,
      SingleTurnParams.EXPECTED_OUTPUT,
    ],
    showIndicator: false,
  });
  expect(
    await metric.measure(
      new LLMTestCase({
        input: "Test requirement",
        actualOutput: "Name is required",
        expectedOutput: "Name is required",
      }),
    ),
  ).toBe(1);
});
