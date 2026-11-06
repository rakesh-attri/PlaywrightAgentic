import path from "node:path";
const dir = process.env.SFQA_RUN_DIR || "artifacts/manual";
export default {
  title: "PlaywrightAgentic Salesforce QA",
  open: "never" as const,
  outputFolder: path.join(dir, "reporting-labs"),
  outputFile: "index.html",
  pdf: false,
  editorLinks: false,
  history: { file: path.join(dir, "reporting-labs.history.json") },
  maskValues: [
    process.env.OPENAI_API_KEY,
    process.env.SF_JWT_PRIVATE_KEY,
  ].filter((x): x is string => !!x),
};
