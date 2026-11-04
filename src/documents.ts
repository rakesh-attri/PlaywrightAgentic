import fs from "node:fs";
import path from "node:path";
import { stringify } from "yaml";
import { root, write, hash, json } from "./files.js";
import { coverage, type Story, type Plan } from "./models.js";
export const digest = (dir: string) =>
  hash(
    Buffer.concat([
      fs.readFileSync(path.join(dir, "story.json")),
      fs.readFileSync(path.join(dir, "plan.json")),
    ]),
  );
export function documents(dir: string, story: Story, plan: Plan) {
  write(path.join(dir, "story.json"), story);
  write(path.join(dir, "plan.json"), plan);
  write(path.join(dir, "cases.json"), plan.testCases);
  write(path.join(dir, "coverage.json"), coverage(story, plan));
  const concept = (type: string, status: string, title: string, body: string) =>
    `---\n${stringify({ type, status, title, story_id: story.id, sources: [{ resource: "story.json", id: "source-story" }], generated: { by: "process:PlaywrightAgentic-documenter", at: new Date().toISOString() } })}---\n\n${body}\n`;
  const requirements = story.acceptanceCriteria
    .map((a) => `- ${a.id}: ${a.text}`)
    .join("\n");
  fs.writeFileSync(
    path.join(dir, "story.okf.md"),
    concept(
      "User Story",
      "stable",
      story.title,
      story.description + "\n\n# Acceptance criteria\n" + requirements,
    ),
  );
  fs.writeFileSync(
    path.join(dir, "test-plan.md"),
    `# ${story.id}: ${story.title}\n\n${plan.summary}\n\n## Risks\n${plan.risks.map((x) => "- " + x).join("\n")}\n\n## Missing information\n${plan.missingInformation.join("\n") || "None recorded; review the evidence."}\n`,
  );
  const cases = plan.testCases
    .map(
      (c) =>
        `## ${c.id}: ${c.title}\n\nCriteria: ${c.criterionIds.join(", ")}\n\nPreconditions: ${c.preconditions.join("; ")}\n\n${c.steps.map((s, i) => `${i + 1}. ${s.action}: ${JSON.stringify(s)}`).join("\n")}`,
    )
    .join("\n\n");
  fs.writeFileSync(
    path.join(dir, "test-cases.md"),
    concept("Test Cases", "draft", story.title, cases),
  );
  fs.writeFileSync(
    path.join(dir, "knowledge.okf.md"),
    concept(
      "Test Plan",
      "draft",
      story.title,
      plan.summary +
        "\n\n[Source story](story.okf.md)\n\n[Cases](test-cases.md)",
    ),
  );
  fs.writeFileSync(
    path.join(dir, "test-data.md"),
    "# Test data and prerequisites\n\n" +
      plan.testCases
        .map((c) => `- ${c.id}: ${c.preconditions.join("; ")}`)
        .join("\n") +
      "\n\nUse synthetic values and valueEnv references; no credentials in cases.",
  );
  const csv = (v: string) => '"' + v.replaceAll('"', '""') + '"';
  fs.writeFileSync(
    path.join(dir, "traceability.csv"),
    [
      "Story,Criterion,Requirement,Test cases",
      ...story.acceptanceCriteria.map((a) =>
        [
          story.id,
          a.id,
          a.text,
          plan.testCases
            .filter((c) => c.criterionIds.includes(a.id))
            .map((c) => c.id)
            .join("; "),
        ]
          .map(csv)
          .join(","),
      ),
    ].join("\n"),
  );
}
export function generate(dir: string) {
  const story = json<Story>(path.join(dir, "story.json"));
  const id = path.basename(dir);
  fs.mkdirSync(path.join(root, "generated"), { recursive: true });
  const source = `import { test } from '@playwright/test';\nimport { meta } from 'reporting-labs';\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport { runCase } from '../src/runner.js';\nimport type { Scenario } from '../src/models.js';\nconst dir=process.env.SFQA_RUN_DIR;if(!dir)throw Error('Run through npm run sfqa -- run RUN_ID');\nconst cases:Scenario[]=JSON.parse(fs.readFileSync(path.join(dir,'cases.json'),'utf8'));\nfor(const c of cases)test(c.id+': '+c.title,async({page},info)=>{meta({story:${JSON.stringify(story.id)},priority:c.priority,feature:'Salesforce',owner:'QA'});info.annotations.push(...c.criterionIds.map(id=>({type:'criterion',description:id})));await runCase(page,c,info);});\n`;
  fs.writeFileSync(path.join(root, "generated", id + ".spec.ts"), source);
}
export function approve(dir: string) {
  if (
    !coverage(
      json(path.join(dir, "story.json")),
      json(path.join(dir, "plan.json")),
    ).complete
  )
    throw Error("Incomplete plans cannot be approved");
  write(path.join(dir, "approval.json"), {
    digest: digest(dir),
    at: new Date().toISOString(),
  });
}
export function report(dir: string, state: Record<string, unknown>) {
  const safe = { ...state };
  delete safe.context;
  delete safe.observation;
  write(path.join(dir, "summary.json"), safe);
  const esc = (x: string) =>
    x
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const links = [
    "test-plan.md",
    "test-cases.md",
    "traceability.csv",
    "knowledge.okf.md",
    "playwright-html/index.html",
    "reporting-labs/index.html",
    "evaluation.json",
    "healing.json",
    "events.json",
  ]
    .filter((f) => fs.existsSync(path.join(dir, f)))
    .map((f) => `<a href="${f}">${f}</a>`)
    .join(" ");
  fs.writeFileSync(
    path.join(dir, "index.html"),
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>PlaywrightAgentic</title><style>body{font:15px system-ui;margin:40px;max-width:1200px;background:#f4f7fc;color:#18314b}a{display:inline-block;margin:8px;color:#075dcc}pre{white-space:pre-wrap;background:white;padding:24px;border-radius:12px}</style><h1>PlaywrightAgentic — Salesforce QA</h1><p>Design coverage, execution results and AI scores are separate. All browser execution is headless.</p>${links}<pre>${esc(JSON.stringify(safe, null, 2))}</pre></html>`,
  );
}
