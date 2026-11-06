import { z } from "zod";
export const targetSchema = z
  .object({
    by: z.enum(["role", "label", "text", "testid", "placeholder"]),
    name: z.string().min(1),
    role: z.string().optional(),
    frame: z.string().optional(),
  })
  .strict();
export const stepSchema = z
  .object({
    action: z.enum([
      "goto",
      "fill",
      "click",
      "select",
      "check",
      "press",
      "expect_visible",
      "expect_hidden",
      "expect_text",
      "expect_value",
      "expect_count",
      "expect_url",
    ]),
    target: targetSchema.optional(),
    value: z.string().optional(),
    valueEnv: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]*$/)
      .optional(),
    count: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((s, c) => {
    const fail = (message: string) => c.addIssue({ code: "custom", message });
    if (!["goto", "expect_url"].includes(s.action) && !s.target)
      fail("Target required");
    if (s.target?.by === "role" && !s.target.role) fail("Role required");
    if (
      [
        "goto",
        "fill",
        "select",
        "press",
        "expect_text",
        "expect_value",
        "expect_url",
      ].includes(s.action) &&
      s.value === undefined &&
      !s.valueEnv
    )
      fail("Value required");
    if (s.action === "expect_count" && s.count === undefined)
      fail("Count required");
    if (
      ["goto", "expect_url"].includes(s.action) &&
      (!s.value?.startsWith("/") ||
        s.value.startsWith("//") ||
        s.value.includes("\\"))
    )
      fail("Only relative application paths allowed");
  });
export const caseSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
    title: z.string(),
    criterionIds: z.array(z.string()).min(1),
    priority: z.enum(["P0", "P1", "P2"]),
    preconditions: z.array(z.string()),
    steps: z.array(stepSchema).min(1).max(80),
  })
  .strict()
  .refine(
    (c) => c.steps.some((s) => s.action.startsWith("expect_")),
    "Explicit assertion required",
  );
export const storySchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
    title: z.string(),
    description: z.string(),
    acceptanceCriteria: z
      .array(z.object({ id: z.string(), text: z.string().min(5) }).strict())
      .min(1),
  })
  .strict()
  .refine(
    (s) =>
      new Set(s.acceptanceCriteria.map((a) => a.id)).size ===
      s.acceptanceCriteria.length,
    "Duplicate criteria",
  );
export const planSchema = z
  .object({
    summary: z.string(),
    risks: z.array(z.string()),
    missingInformation: z.array(z.string()),
    testCases: z.array(caseSchema),
  })
  .strict();
export type Story = z.infer<typeof storySchema>;
export type Plan = z.infer<typeof planSchema>;
export type Scenario = z.infer<typeof caseSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Target = z.infer<typeof targetSchema>;
export type Mode = "demo" | "live";
export function coverage(story: Story, plan: Plan) {
  if (new Set(plan.testCases.map((c) => c.id)).size !== plan.testCases.length)
    throw Error("Duplicate test IDs");
  const known = new Set(story.acceptanceCriteria.map((a) => a.id));
  const used = new Set(plan.testCases.flatMap((c) => c.criterionIds));
  if ([...used].some((x) => !known.has(x)))
    throw Error("Unknown criterion reference");
  const uncovered = [...known].filter((x) => !used.has(x));
  return {
    complete: !uncovered.length && !plan.missingInformation.length,
    mapped: used.size,
    total: known.size,
    uncovered,
  };
}
export function validateRepair(original: Plan, candidate: Plan) {
  const clone = structuredClone(original);
  if (clone.testCases.length !== candidate.testCases.length)
    throw Error("Cannot remove/add tests");
  clone.testCases.forEach((c, i) => {
    const newer = candidate.testCases[i];
    if (c.steps.length !== newer.steps.length)
      throw Error("Cannot remove/add steps");
    c.steps.forEach((s, j) => {
      if (["fill", "click", "select", "check", "press"].includes(s.action))
        s.target = newer.steps[j].target;
    });
  });
  if (JSON.stringify(clone) !== JSON.stringify(candidate))
    throw Error("Healer may change only non-assertion action targets");
}
