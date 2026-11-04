import {
  expect,
  type Page,
  type Locator,
  type TestInfo,
} from "@playwright/test";
import crypto from "node:crypto";
import type { Scenario, Target } from "./models.js";
export function target(page: Page, t: Target): Locator {
  const scope = t.frame ? page.frameLocator(t.frame) : page;
  switch (t.by) {
    case "role":
      return scope.getByRole(t.role as Parameters<Page["getByRole"]>[0], {
        name: t.name,
        exact: true,
      });
    case "label":
      return scope.getByLabel(t.name, { exact: true });
    case "text":
      return scope.getByText(t.name, { exact: true });
    case "testid":
      return scope.getByTestId(t.name);
    case "placeholder":
      return scope.getByPlaceholder(t.name, { exact: true });
  }
}
export async function runCase(page: Page, c: Scenario, info: TestInfo) {
  const uuid = crypto.randomUUID(),
    resolve = (v: string) =>
      v
        .replaceAll("{{UUID}}", uuid)
        .replaceAll("{{RUN_ID}}", process.env.SFQA_RUN_ID || "local");
  const live = process.env.SFQA_MODE === "live",
    base = live ? process.env.SF_BASE_URL! : "http://127.0.0.1:8765";
  const allowed = live
    ? (process.env.SF_ALLOWED_ORIGINS || "").split(",").map((x) => x.trim())
    : [new URL(base).origin];
  await page.route("**/*", async (r) =>
    r.request().isNavigationRequest() &&
    !allowed.includes(new URL(r.request().url()).origin)
      ? r.abort("blockedbyclient")
      : r.continue(),
  );
  await page.goto(
    live ? new URL(process.env.SF_START_PATH || "/", base).href : base,
  );
  let assertions = 0;
  for (const [i, s] of c.steps.entries()) {
    await info.attach(`step-${i + 1}`, {
      body: JSON.stringify({ action: s.action, criterionIds: c.criterionIds }),
      contentType: "application/json",
    });
    const raw = s.valueEnv ? process.env[s.valueEnv] : s.value;
    if (s.valueEnv && raw === undefined)
      throw Error(`Missing test-data variable ${s.valueEnv}`);
    const v = resolve(raw || ""),
      loc = s.target
        ? target(page, { ...s.target, name: resolve(s.target.name) })
        : undefined;
    switch (s.action) {
      case "goto": {
        const u = new URL(v, base);
        if (!allowed.includes(u.origin))
          throw Error("Navigation outside allowed origins");
        await page.goto(u.href);
        break;
      }
      case "fill":
        await loc!.fill(v);
        break;
      case "click":
        await loc!.click();
        break;
      case "select":
        await loc!.selectOption({ label: v });
        break;
      case "check":
        await loc!.check();
        break;
      case "press":
        await loc!.press(v);
        break;
      case "expect_visible":
        await expect(loc!).toBeVisible();
        assertions++;
        break;
      case "expect_hidden":
        await expect(loc!).toBeHidden();
        assertions++;
        break;
      case "expect_text":
        await expect(loc!).toHaveText(v);
        assertions++;
        break;
      case "expect_value":
        await expect(loc!).toHaveValue(v);
        assertions++;
        break;
      case "expect_count":
        await expect(loc!).toHaveCount(s.count!);
        assertions++;
        break;
      case "expect_url":
        await expect(page).toHaveURL(new URL(v, base).href);
        assertions++;
        break;
      default:
        throw Error("Unsupported action");
    }
  }
  expect(assertions, "A case must execute an assertion").toBeGreaterThan(0);
}
