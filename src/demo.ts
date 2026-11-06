import type { Plan, Target, Step } from "./models.js";
export const demoStory = {
  id: "DEMO-101",
  title: "Create an Account",
  description:
    "Local training fixture requirements, not a Salesforce org or standard Salesforce validation rules.",
  acceptanceCriteria: [
    {
      id: "AC1",
      text: "Saving a non-empty Account Name creates a row containing that name.",
    },
    {
      id: "AC2",
      text: "Saving a blank Account Name shows Account Name is required and keeps the form open.",
    },
    { id: "AC3", text: "Cancel closes the form without creating an account." },
    {
      id: "AC4",
      text: "The selected Industry is displayed alongside the created name.",
    },
  ],
};
export function demoPlan(): Plan {
  const t = (by: Target["by"], name: string, role?: string): Target => ({
    by,
    name,
    ...(role ? { role } : {}),
  });
  const click = (name: string): Step => ({
    action: "click",
    target: t("role", name, "button"),
  });
  const fill: Step = {
    action: "fill",
    target: t("label", "Account Name"),
    value: "QA {{UUID}}",
  };
  const c = (id: string, title: string, ac: string, steps: Step[]) => ({
    id,
    title,
    criterionIds: [ac],
    priority: "P1" as const,
    preconditions: ["Isolated local training fixture"],
    steps,
  });
  return {
    summary:
      "Verify account creation, required name, cancellation and selected Industry.",
    risks: ["Demo is not Salesforce."],
    missingInformation: [],
    testCases: [
      c("TC-001", "Create an account", "AC1", [
        click("New Account"),
        fill,
        click("Save"),
        {
          action: "expect_text",
          target: t("text", "QA {{UUID}} — Technology"),
          value: "QA {{UUID}} — Technology",
        },
      ]),
      c("TC-002", "Require an account name", "AC2", [
        click("New Account"),
        click("Save"),
        {
          action: "expect_text",
          target: t("testid", "validation-error"),
          value: "Account Name is required",
        },
        {
          action: "expect_visible",
          target: t("role", "New Account", "dialog"),
        },
      ]),
      c("TC-003", "Cancel without creating", "AC3", [
        click("New Account"),
        fill,
        click("Cancel"),
        { action: "expect_hidden", target: t("role", "New Account", "dialog") },
        {
          action: "expect_count",
          target: t("text", "QA {{UUID}} — Technology"),
          count: 0,
        },
      ]),
      c("TC-004", "Keep selected Industry", "AC4", [
        click("New Account"),
        fill,
        {
          action: "select",
          target: t("label", "Industry"),
          value: "Education",
        },
        click("Save"),
        {
          action: "expect_text",
          target: t("text", "QA {{UUID}} — Education"),
          value: "QA {{UUID}} — Education",
        },
      ]),
    ],
  };
}
