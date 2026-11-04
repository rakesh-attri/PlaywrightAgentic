# Automated Salesforce authentication

The implemented flow is **signed OAuth 2.0 JWT bearer assertion → API access token → Single Access UI Bridge → authenticated headless browser → storageState**. An API token alone is not a complete browser session. There is no username/password entry, OTP collection, passkey interaction or interactive fallback in the framework.

Salesforce must authorize this flow for the chosen user/app. JWT does not override high-assurance session requirements, conditional access, IP restrictions or Experience Cloud membership. If your org requires a stronger authentication step for this app/user, the run fails clearly; an administrator must configure an approved automation identity/policy. Do not weaken human-user MFA to make a test run.

## Administrator setup, once per org/app

1. Choose a **QA sandbox** and dedicated UI-enabled test user. Give that user only the object/field/record access and Experience site membership needed for the scenarios. The user must not have the **API Only User** permission when using the UI Bridge.
2. Create or configure an **External Client App** in Setup → External Client Apps Manager (or an existing Connected App supported by your org). Enable OAuth and JWT Bearer Flow. An org administrator may need to create/approve the app.
3. Generate an RSA key pair and X.509 public certificate. Keep the private key local or in the CI secret store. Upload only the public certificate to the app's JWT configuration. A provider-managed key pair is also valid if the private signer can be used by this framework; the current implementation reads a PEM key.
4. Enable the scopes needed for this workflow: API access (`api`) and web UI access (`web`). UI Bridge requires `web` or `full`; prefer `web` plus the necessary API scope rather than broad `full`. JWT does not request scopes on each token call; the app's configuration and previous/admin authorization determine the granted scopes.
5. Set the app's permitted-user policy to admin-approved/preauthorized users and assign its access through the appropriate permission set/profile for the automation user. Confirm the configured user is allowed to use the JWT flow. Configure IP and session policies through your normal administrator process.
6. Copy the app's consumer/client ID into `SF_CLIENT_ID`. Put the exact sandbox username in `SF_USERNAME`. Set `SF_LOGIN_URL` and `SF_JWT_AUDIENCE` to the correct supported login origin/audience for that org. A typical sandbox example is `https://test.salesforce.com`; your My Domain/Experience identity configuration can require different settings.
7. Set the UI target and allowed origins. Use an authenticated-only semantic marker from your actual UI. The example `Navigation` marker is a placeholder and must match your org.

Example certificate generation if OpenSSL is installed:

```bash
mkdir -p .auth
openssl req -x509 -newkey rsa:2048 -sha256 -nodes -keyout .auth/server.key -out .auth/server.crt -days 365 -subj "/CN=PlaywrightAgentic-QA"
```

On Windows use Git Bash for this example, your installed OpenSSL equivalent, or your organization's certificate tooling. The project itself has no OpenSSL runtime dependency. Restrict filesystem permissions on the private key; track certificate expiry and rotate it before expiry. No generated key/certificate is included in the repository.

## Lightning configuration

```dotenv
SF_LOGIN_URL=https://test.salesforce.com
SF_JWT_AUDIENCE=https://test.salesforce.com
SF_CLIENT_ID=YOUR_APP_CONSUMER_KEY
SF_USERNAME=YOUR_SANDBOX_USERNAME
SF_JWT_PRIVATE_KEY_PATH=.auth/server.key
SF_BASE_URL=https://YOUR-DOMAIN--qa.sandbox.my.salesforce.com
SF_START_PATH=/lightning/page/home
SF_ALLOWED_ORIGINS=https://YOUR-DOMAIN--qa.sandbox.my.salesforce.com,https://YOUR-DOMAIN--qa.sandbox.lightning.force.com
SF_AUTH_MARKER_BY=role
SF_AUTH_MARKER_ROLE=navigation
SF_AUTH_MARKER_NAME=YOUR_AUTHENTICATED_NAVIGATION_NAME
SF_AUTH_MAX_AGE_MINUTES=30
```

Include only the actual origins required for that org. Do not paste example domains unchanged. Start at a relevant application/page rather than the home page when that makes controls easier to discover. If the starting page redirects to another Salesforce origin, allow that exact origin.

## Experience Cloud configuration

Set `SF_BASE_URL` to the Experience site root, including its prefix, for example `https://YOUR-DOMAIN--qa.sandbox.my.site.com/portal`. The framework then requests `.../portal/services/oauth2/singleaccess`. `SF_START_PATH` must include that prefix too, for example `/portal/s/`. Set `SF_ALLOWED_ORIGINS` to the actual site origin and any required Salesforce UI origins. Pick a marker visible only after the portal user is authenticated, such as the user menu or account dashboard heading.

The JWT subject, login audience/endpoint, app permissions and site membership must be supported by your site's identity configuration. A successful internal-user JWT token does not prove access to a customer/community persona or to every site.

## What the code does

`src/auth.ts` signs an RS256 assertion with `iss` = client ID, `sub` = username, `aud` = configured audience and expiry 120 seconds in the future. It posts that assertion to `/services/oauth2/token` using `urn:ietf:params:oauth:grant-type:jwt-bearer`. It sends the returned access token as a Bearer header to `/services/oauth2/singleaccess` on the configured My Domain/site, with a relative `redirect_uri`.

The returned single-use `frontdoor_uri` is opened in an untraced headless browser. After navigation to the target, the code checks the allowed origin and authenticated marker, then writes `.auth/salesforce.json` and a session receipt with restricted permissions on supported filesystems. The framework does not persist/log the API access token, JWT assertion or frontdoor URL.

`npm run auth` validates a cached storageState while it is within the configured maximum age. If it has expired or fails the authenticated-marker check, a fresh JWT/UI Bridge session is created automatically. `npm run auth -- --force` creates a new session immediately. A certificate/client/user/URL/marker change should be accompanied by a fresh authentication run. There is no refresh-token/password fallback.

All Playwright test contexts load that storageState in live mode. Playwright isolation gives each case its own browser context; the initial authenticated state is shared across those contexts, so server-side user/record data can still interact. Use unique synthetic data and appropriate cleanup. Separate personas should use separate runs/configurations until a reviewed multi-persona fixture is added.

## Headless enforcement and diagnostics

The launcher sets `headless: true`; the test config rejects headed, debug and UI-runner switches and nonzero `PWDEBUG`. Browser MCP also uses the same headless launcher. Authentication runs without Playwright trace, screenshot, HAR or request/URL logging. Subsequent failed tests can have traces containing authenticated session activity: retain them privately and review before sharing.

Common failures:

| Symptom | Check |
|---|---|
| `invalid_grant` / user not approved | Username, JWT audience, app preauthorization and permission-set assignment |
| Invalid signature | Uploaded certificate matches private key; RSA ≥2048; certificate validity and system clock |
| UI Bridge rejects access | `web` scope; UI-enabled user; correct My Domain/site endpoint |
| Token works, UI marker absent | Site membership, app/record access, wrong start path/marker, step-up policy, actual allowed origins |
| Browser redirects to login | Cookie/session policies, target host and UI Bridge authorization; cached state is renewed automatically |

## CI secrets

Use the multiline `SF_JWT_PRIVATE_KEY` GitHub environment secret to avoid managing a key file in CI. Configure `SF_CLIENT_ID` and `SF_USERNAME` as secrets too. Configure the nonsecret URLs/marker settings as environment variables. The live workflow creates storageState during the job; it never requires a manually captured session. `.auth/`, keys, `.env` and databases are ignored and are not uploaded by the workflow.

Live traces/reports are intentionally not automatically uploaded by the live job because they may contain sandbox data/session details. Retrieve/redact them under your organization's artifact process. Local reports are still generated.

## Official references

- [Salesforce: Configure a JWT Bearer Flow](https://help.salesforce.com/s/articleView?id=xcloud.configure_oauth_jwt_flow_external_client_apps.htm&language=en_US&type=5)
- [Salesforce: OAuth 2.0 JWT Bearer Flow](https://help.salesforce.com/s/articleView?id=xcloud.remoteaccess_oauth_jwt_flow.htm&language=en_US&type=5)
- [Salesforce: Generate a Frontdoor URL to Bridge into UI Sessions](https://help.salesforce.com/s/articleView?id=sf.frontdoor_singleaccess.htm&language=en_US&type=5)

The repository's tests verify signing and mocked HTTP exchange/failure handling. Live Salesforce authentication remains unverified until run with your app/user/org configuration.
