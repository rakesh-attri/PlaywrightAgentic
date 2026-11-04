import { describe, it, expect } from "vitest";
import { demoPlan, demoStory } from "../src/demo.js";
import {
  coverage,
  planSchema,
  stepSchema,
  validateRepair,
} from "../src/models.js";
import { digest, approve, documents } from "../src/documents.js";
import { json, write } from "../src/files.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
describe("requirement and execution contracts", () => {
  it("maps every explicit fixture criterion", () =>
    expect(coverage(demoStory, demoPlan()).complete).toBe(true));
  it("blocks missing information despite mapped criteria", () => {
    const p = demoPlan();
    p.missingInformation = ["Unknown reconciliation rule"];
    expect(coverage(demoStory, p).complete).toBe(false);
  });
  it("rejects invented criterion references", () => {
    const p = demoPlan();
    p.testCases[0].criterionIds = ["AC999"];
    expect(() => coverage(demoStory, p)).toThrow();
  });
  it("rejects duplicate IDs", () => {
    const p = demoPlan();
    p.testCases[1].id = p.testCases[0].id;
    expect(() => coverage(demoStory, p)).toThrow();
  });
  it("requires real assertion steps", () => {
    const p = demoPlan();
    p.testCases[0].steps = p.testCases[0].steps.filter(
      (s) => !s.action.startsWith("expect_"),
    );
    expect(() => planSchema.parse(p)).toThrow();
  });
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
  ])("rejects navigation %s", (value) =>
    expect(() => stepSchema.parse({ action: "goto", value })).toThrow(),
  );
  it("rejects arbitrary execution actions", () =>
    expect(() =>
      stepSchema.parse({ action: "shell", value: "anything" }),
    ).toThrow());
  it("does not let healer change expected values", () => {
    const a = demoPlan(),
      b = demoPlan();
    b.testCases[0].steps.at(-1)!.value = "weakened";
    expect(() => validateRepair(a, b)).toThrow();
  });
  it("does not let healer remove a scenario", () => {
    const a = demoPlan(),
      b = demoPlan();
    b.testCases.pop();
    expect(() => validateRepair(a, b)).toThrow();
  });
  it("does not let healer change input values", () => {
    const a = demoPlan(),
      b = demoPlan();
    b.testCases[0].steps[1].value = "another";
    expect(() => validateRepair(a, b)).toThrow();
  });
  it("allows only non-assertion action-locator repair", () => {
    const a = demoPlan(),
      b = demoPlan();
    b.testCases[0].steps[0].target!.name = "New";
    expect(() => validateRepair(a, b)).not.toThrow();
  });
  it("binds approval to exact story and plan", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sfqa-contract-"));
    try {
      documents(dir, demoStory, demoPlan());
      approve(dir);
      const approved = json(path.join(dir, "approval.json")).digest;
      const p = demoPlan();
      p.summary += " changed";
      write(path.join(dir, "plan.json"), p);
      expect(digest(dir)).not.toBe(approved);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
