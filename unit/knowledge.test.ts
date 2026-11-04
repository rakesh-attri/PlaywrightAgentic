import { it, expect, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { Knowledge } from "../src/knowledge.js";
afterEach(() => vi.unstubAllEnvs());
function local() {
  vi.stubEnv("SFQA_VECTOR_BACKEND", "demo-json");
  const kb = new Knowledge("demo");
  kb.file = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "sfqa-kb-")),
    "vectors.json",
  );
  return kb;
}
it("stores vectors alongside text and metadata, not text alone", async () => {
  const k = local();
  await k.ingest("rule", "Account Name is required", "A", "approved");
  const rows = JSON.parse(fs.readFileSync(k.file, "utf8"));
  expect(rows[0].vector).toHaveLength(512);
  expect(rows[0].text).toContain("Name");
  expect(rows[0].metadata.hash).toHaveLength(64);
});
it("isolates project and approval status", async () => {
  const k = local();
  await k.ingest("rule", "Approved account requirement", "A", "approved");
  await k.ingest("draft", "Invented requirement", "A", "draft");
  await k.ingest("other", "Other project requirement", "B", "approved");
  const hits = await k.search("requirement", "A");
  expect(hits).toHaveLength(1);
  expect(hits[0].metadata?.source).toBe("rule");
});
it("replaces old chunks and deletes a source", async () => {
  const k = local();
  await k.ingest("rule", "Previous requirement ".repeat(500), "A", "approved");
  await k.ingest("rule", "Replacement account rule", "A", "approved");
  const hits = await k.search("account", "A");
  expect(hits).toHaveLength(1);
  expect(hits[0].text).not.toContain("Previous");
  await k.remove("rule", "A");
  expect(await k.search("account", "A")).toHaveLength(0);
});
it.runIf(process.env.SFQA_CHROMA_TEST === "1")(
  "persists and retrieves actual vectors through Chroma",
  async () => {
    vi.stubEnv("SFQA_VECTOR_BACKEND", "chroma");
    const k = new Knowledge("demo"),
      project = "check-" + crypto.randomUUID();
    try {
      await k.ingest(
        "rule",
        "Name is required before saving an account",
        "" + project,
        "approved",
      );
      await k.ingest("draft", "Draft irrelevant promise", project, "draft");
      const hits = await k.search("Name required", project);
      expect(hits).toHaveLength(1);
      expect(hits[0].text).toContain("Name");
      await k.ingest("rule", "Industry is optional", project, "approved");
      expect((await k.search("Industry", project))[0].text).toBe(
        "Industry is optional",
      );
    } finally {
      await k.remove("rule", project);
      await k.remove("draft", project);
    }
  },
);
