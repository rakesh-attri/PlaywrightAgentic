import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium, type Browser } from "@playwright/test";
import { root, write, json, hash } from "./files.js";
import { targetSchema, type Target } from "./models.js";
export const storageFile = path.join(root, ".auth/salesforce.json");
const receiptFile = path.join(root, ".auth/session-meta.json");
function required(name: string) {
  const value = process.env[name];
  if (!value) throw Error(`Missing required configuration: ${name}`);
  return value;
}
export function httpsUrl(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash)
    throw Error("Salesforce endpoints must be clean HTTPS URLs");
  return u;
}
export function authConfig() {
  const login = httpsUrl(required("SF_LOGIN_URL"));
  if (login.pathname !== "/")
    throw Error("SF_LOGIN_URL must be a login origin");
  const base = httpsUrl(required("SF_BASE_URL"));
  const allowed = required("SF_ALLOWED_ORIGINS")
    .split(",")
    .map((x) => x.trim());
  if (!allowed.includes(base.origin))
    throw Error("SF_BASE_URL must be included in SF_ALLOWED_ORIGINS");
  if (["login.salesforce.com", "test.salesforce.com"].includes(base.hostname))
    throw Error("UI Bridge requires My Domain or an Experience site URL");
  const targetPath = process.env.SF_START_PATH || "/lightning/page/home";
  if (
    !targetPath.startsWith("/") ||
    targetPath.startsWith("//") ||
    targetPath.includes("\\")
  )
    throw Error("SF_START_PATH must be relative");
  const marker: Target = targetSchema.parse({
    by: process.env.SF_AUTH_MARKER_BY || "role",
    name: required("SF_AUTH_MARKER_NAME"),
    role: process.env.SF_AUTH_MARKER_ROLE,
  });
  if (marker.by === "role" && !marker.role)
    throw Error("SF_AUTH_MARKER_ROLE is required for a role marker");
  return {
    login,
    base,
    allowed,
    targetPath,
    marker,
    audience: process.env.SF_JWT_AUDIENCE || login.origin,
    username: required("SF_USERNAME"),
    clientId: required("SF_CLIENT_ID"),
  };
}
export function signAssertion(
  clientId: string,
  username: string,
  audience: string,
  key: string,
  now = Math.floor(Date.now() / 1000),
) {
  const parsed = crypto.createPrivateKey(key);
  if (
    parsed.asymmetricKeyType !== "rsa" ||
    (parsed.asymmetricKeyDetails?.modulusLength || 0) < 2048
  )
    throw Error("JWT needs an RSA private key of at least 2048 bits");
  const encode = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString("base64url");
  const unsigned =
    encode({ alg: "RS256", typ: "JWT" }) +
    "." +
    encode({ iss: clientId, sub: username, aud: audience, exp: now + 120 });
  return (
    unsigned +
    "." +
    crypto
      .sign("RSA-SHA256", Buffer.from(unsigned), parsed)
      .toString("base64url")
  );
}
async function responseJson(response: Response, stage: string) {
  if (!response.ok) {
    let code = "";
    try {
      code = String(((await response.json()) as any).error || "");
    } catch {}
    throw Error(
      `${stage} failed: HTTP ${response.status}${code ? " " + code : ""}. Check app preauthorization, certificate, scopes and org policy. No interactive fallback is enabled.`,
    );
  }
  return response.json() as Promise<any>;
}
export async function getFrontdoor(fetcher: typeof fetch = fetch) {
  const cfg = authConfig();
  const key =
    process.env.SF_JWT_PRIVATE_KEY ||
    fs.readFileSync(
      path.resolve(root, required("SF_JWT_PRIVATE_KEY_PATH")),
      "utf8",
    );
  const assertion = signAssertion(
    cfg.clientId,
    cfg.username,
    cfg.audience,
    key,
  );
  const token = await responseJson(
    await fetcher(new URL("/services/oauth2/token", cfg.login), {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(30000),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    }),
    "JWT bearer grant",
  );
  if (typeof token.access_token !== "string")
    throw Error("Token endpoint returned no access token");
  const bridgeUrl =
    cfg.base.href.replace(/\/$/, "") + "/services/oauth2/singleaccess";
  const bridge = await responseJson(
    await fetcher(bridgeUrl, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(30000),
      headers: {
        authorization: `Bearer ${token.access_token}`,
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: new URLSearchParams({ redirect_uri: cfg.targetPath }),
    }),
    "Single Access UI Bridge",
  );
  if (typeof bridge.frontdoor_uri !== "string")
    throw Error("UI Bridge returned no frontdoor_uri");
  const frontdoor = new URL(bridge.frontdoor_uri);
  if (
    frontdoor.protocol !== "https:" ||
    !cfg.allowed.includes(frontdoor.origin)
  )
    throw Error("UI Bridge returned an origin outside SF_ALLOWED_ORIGINS");
  return { frontdoor: frontdoor.href, cfg };
}
export async function launchHeadless(): Promise<Browser> {
  if (process.env.PWDEBUG && process.env.PWDEBUG !== "0")
    throw Error("PWDEBUG is disabled: browsers must always run headless");
  return chromium.launch({
    headless: true,
    ...(process.env.SFQA_BROWSER_EXECUTABLE
      ? { executablePath: process.env.SFQA_BROWSER_EXECUTABLE }
      : {}),
  });
}
export async function ensureAuthentication(force = false) {
  const cfg = authConfig();
  const identity = hash(
    [
      cfg.clientId,
      cfg.username,
      cfg.base.href,
      cfg.targetPath,
      JSON.stringify(cfg.marker),
    ].join("|"),
  );
  const fresh =
    fs.existsSync(storageFile) &&
    fs.existsSync(receiptFile) &&
    json(receiptFile).identity === identity &&
    Date.now() - json(receiptFile).at <
      Number(process.env.SF_AUTH_MAX_AGE_MINUTES || 30) * 60000;
  const browser = await launchHeadless();
  try {
    const { target } = await import("./runner.js");
    if (fresh && !force) {
      const c = await browser.newContext({ storageState: storageFile });
      try {
        const p = await c.newPage();
        await p.goto(new URL(cfg.targetPath, cfg.base).href);
        await target(p, cfg.marker).waitFor({
          state: "visible",
          timeout: 10000,
        });
        return storageFile;
      } catch {
        fs.rmSync(receiptFile, { force: true });
      } finally {
        await c.close();
      }
    }
    const { frontdoor } = await getFrontdoor();
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      // No traces, screenshots, HAR, request logging or URL logging during authentication.
      await page.goto(frontdoor, { waitUntil: "domcontentloaded" });
      await page.goto(new URL(cfg.targetPath, cfg.base).href);
      if (!cfg.allowed.includes(new URL(page.url()).origin))
        throw Error("Authentication redirected outside configured origins");
      await target(page, cfg.marker).waitFor({
        state: "visible",
        timeout: 20000,
      });
      fs.mkdirSync(path.dirname(storageFile), { recursive: true });
      await context.storageState({ path: storageFile });
      fs.chmodSync(storageFile, 0o600);
      write(receiptFile, { identity, at: Date.now() });
      fs.chmodSync(receiptFile, 0o600);
      return storageFile;
    } catch {
      throw Error(
        "JWT/UI Bridge session did not reach the authenticated marker. Check Experience site membership, web scope and high-assurance policy. No password/MFA/passkey fallback.",
      );
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
