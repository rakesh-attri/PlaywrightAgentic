import { it, expect, vi, afterEach } from "vitest";
import crypto from "node:crypto";
import {
  authConfig,
  signAssertion,
  getFrontdoor,
  httpsUrl,
  launchHeadless,
} from "../src/auth.js";
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const key = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
function configure() {
  for (const [name, value] of Object.entries({
    SF_LOGIN_URL: "https://test.salesforce.com",
    SF_BASE_URL: "https://example--qa.sandbox.my.salesforce.com",
    SF_ALLOWED_ORIGINS: "https://example--qa.sandbox.my.salesforce.com",
    SF_USERNAME: "synthetic@example.test",
    SF_CLIENT_ID: "test-client",
    SF_JWT_PRIVATE_KEY: key,
    SF_AUTH_MARKER_NAME: "Account navigation",
    SF_AUTH_MARKER_ROLE: "navigation",
    SF_START_PATH: "/lightning/page/home",
  }))
    vi.stubEnv(name, value);
}
afterEach(() => vi.unstubAllEnvs());
it("signs short-lived RS256 claims without a password", () => {
  const token = signAssertion(
    "client",
    "user",
    "https://test.salesforce.com",
    key,
    1000,
  );
  const [h, p, s] = token.split(".");
  expect(JSON.parse(Buffer.from(p, "base64url").toString())).toEqual({
    iss: "client",
    sub: "user",
    aud: "https://test.salesforce.com",
    exp: 1120,
  });
  expect(JSON.parse(Buffer.from(h, "base64url").toString()).alg).toBe("RS256");
  expect(
    crypto.verify(
      "RSA-SHA256",
      Buffer.from(h + "." + p),
      publicKey,
      Buffer.from(s, "base64url"),
    ),
  ).toBe(true);
});
it("exchanges JWT then requests UI Bridge with the bearer token", async () => {
  configure();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "synthetic-token" })),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          frontdoor_uri:
            "https://example--qa.sandbox.my.salesforce.com/secur/frontdoor.jsp?otp=synthetic",
        }),
      ),
    );
  const r = await getFrontdoor(fetcher as any);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const body = fetcher.mock.calls[0][1].body as URLSearchParams;
  expect(body.get("grant_type")).toBe(
    "urn:ietf:params:oauth:grant-type:jwt-bearer",
  );
  expect(body.has("password")).toBe(false);
  expect(fetcher.mock.calls[1][1].headers.authorization).toBe(
    "Bearer synthetic-token",
  );
  expect(
    String(fetcher.mock.calls[1][0]).endsWith("/services/oauth2/singleaccess"),
  ).toBe(true);
  expect(r.frontdoor).toContain("otp=synthetic");
});
it("does not accept a bridge URL on another origin", async () => {
  configure();
  const f = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "synthetic" })),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ frontdoor_uri: "https://evil.example/" })),
    );
  await expect(getFrontdoor(f as any)).rejects.toThrow("outside");
});
it("fails explicitly when the JWT user/app is not preauthorized", async () => {
  configure();
  const f = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        error: "invalid_grant",
        error_description: "not logged",
      }),
      { status: 400 },
    ),
  );
  await expect(getFrontdoor(f as any)).rejects.toThrow(
    "No interactive fallback",
  );
  expect(f).toHaveBeenCalledTimes(1);
});
it("rejects insecure endpoint configuration", () =>
  expect(() => httpsUrl("http://example.test")).toThrow());
it("requires a UI-enabled endpoint rather than generic login domain", () => {
  configure();
  vi.stubEnv("SF_BASE_URL", "https://test.salesforce.com");
  vi.stubEnv("SF_ALLOWED_ORIGINS", "https://test.salesforce.com");
  expect(() => authConfig()).toThrow("UI Bridge requires");
});

it("rejects PWDEBUG before launching a browser", async () => {
  vi.stubEnv("PWDEBUG", "1");
  await expect(launchHeadless()).rejects.toThrow("always run headless");
});
