# Hosted deploy: Neon + Railway + Vercel

The other way to run PRScout in production, next to the single-server
Docker stack in `deploy/prod/`. Nothing is cut down for it: the API server
keeps its job runner, the warm pass, the contributions refresh, PR watch
and every email loop, because it runs as one long-lived process.

| Part | Where | Config in this repo |
| --- | --- | --- |
| API server (`server/` + the engine in `src/prscout`) | Railway, one service | `/railway.json`, `deploy/railway/server.Dockerfile` |
| API database `prscout` | Neon | Alembic, migrated at every server start |
| Web app (`web/`) | Vercel, root directory `web` | `web/vercel.json` |
| Web database `prscout_web` (accounts, sessions, passwords, reset links, rate limits) | Neon | Drizzle, migrated by production builds |

Browsers only talk to Vercel. Vercel's server code calls the API on its
public Railway address and sends `PRSCOUT_INTERNAL_KEY`. Every endpoint
except `/health`, the badge and `/metrics` (closed on Railway, see the end)
requires that key.

Work through the steps in order: each one gives values a later step needs.
Write them into a password manager as you go, never into a file in the
repository.

## Step 0. Generate the shared secrets

On your machine:

```sh
openssl rand -hex 32      # PRSCOUT_INTERNAL_KEY  (Railway and Vercel, the same value)
openssl rand -hex 32      # PRSCOUT_SECRET_KEY    (Railway; never change it later)
openssl rand -base64 32   # AUTH_SECRET           (Vercel)
openssl rand -hex 32      # PRSCOUT_METRICS_KEY   (Railway; optional, only to read /metrics)
```

## Step 1. Neon (both databases)

1. Sign up at neon.tech and create a project. Pick the region you will use
   for Railway and Vercel too (for example AWS US East: Railway "US East",
   Vercel `iad1`). Postgres 17.
2. Databases → New database: `prscout`. Again: `prscout_web`. Both owned by
   the default role.
3. Dashboard → **Connect**. For each database copy two strings:
   - **direct**: Connection pooling off (the host has no `-pooler`)
   - **pooled**: Connection pooling on (the host contains `-pooler`)

| String | Goes to |
| --- | --- |
| `prscout`, direct | Railway `DATABASE_URL` |
| `prscout_web`, pooled | Vercel `DATABASE_URL` |
| `prscout_web`, direct | Vercel `DATABASE_URL_UNPOOLED` |

Paste them exactly as Neon shows them (`postgresql://…?sslmode=require&channel_binding=require`).
The server converts its own string to the driver's form. The server must
use the direct string: it keeps its own pool and holds session-level
advisory locks, which a pooler in transaction mode would break.

## Step 2. GitHub token (the server reads GitHub with it)

github.com → Settings → Developer settings → Personal access tokens →
**Fine-grained tokens** → Generate new token.

- Resource owner: your account. Repository access: **Public repositories (read-only)**.
- Permissions: none beyond the defaults.
- Expiration: up to a year; put a reminder in your calendar to replace it.

That token is `GITHUB_TOKENS` on Railway. Several tokens (from different
accounts), comma separated, add up their budgets. A GitHub App
(`GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY`,
see `server/README.md`) can replace the tokens later.

**Budget.** GitHub gives each token 5,000 GraphQL points an hour. A report
costs about 20 points. The warm pass, which fills the index Discover and
Find read, stops while fewer than 1,500 points are left
(`PRSCOUT_WARM_MIN_POINTS`), so people's own checks always have room. With
one token that is about 175 new reports per pass. The seed list has about
10,000 repositories:

- `PRSCOUT_WARM_INTERVAL_HOURS=1` for the first days: about 4,000 reports a
  day, so most of the list is indexed in 2 to 3 days.
- Then `PRSCOUT_WARM_INTERVAL_HOURS=6`: refreshes, with more room left for
  visitors.

The interval is counted from the end of one pass to the start of the next.
A pass also starts 60 seconds after every restart or redeploy. Only one runs
at a time (Postgres advisory lock). A failure is logged and retried at the
next pass, and a repository that keeps failing is backed off (6 hours,
doubling up to a week).

## Step 3. Resend (email)

1. Sign up at resend.com → **Domains** → Add domain → your domain (or a
   subdomain such as `mail.your-domain`).
2. Add the DNS records Resend shows (SPF `TXT`, DKIM `TXT`/`CNAME`,
   optionally `MX` for bounces) at your DNS provider. Wait until Resend
   says **Verified**.
3. **API Keys** → Create API key → permission **Sending access**, the domain
   above. Copy it once: it starts with `re_`.

The same key goes to Railway (alert, welcome and plan emails) and to Vercel
(password reset emails). The "from" addresses must be on the verified domain.

## Step 4. Railway (API server)

1. railway.com → New Project → **Deploy from GitHub repo** → `RauhanAli/PRScout`,
   branch you deploy from. Railway reads `/railway.json`: Dockerfile build,
   health check `/health`, one replica, restart on failure. Keep one
   replica: the server is designed to run as a single process.
2. Before the first build finishes, open the service → **Variables** →
   Raw editor, and paste (fill in the values):

   ```
   PRSCOUT_ENV=production
   DATABASE_URL=<Neon prscout direct>
   PRSCOUT_INTERNAL_KEY=<step 0>
   PRSCOUT_SECRET_KEY=<step 0>
   PRSCOUT_WEB_URL=https://<your-domain>
   GITHUB_TOKENS=<step 2>
   PRSCOUT_WARM_INTERVAL_HOURS=1
   PRSCOUT_JOB_CONCURRENCY=2
   PRSCOUT_BADGE_CONCURRENCY=3
   RESEND_API_KEY=<step 3>
   PRSCOUT_ALERT_EMAIL_FROM=PRScout <alerts@<your-domain>>
   PRSCOUT_ACCOUNT_EMAILS=1
   PRSCOUT_PR_WATCH=1
   ```

   `PORT` is set by Railway; don't set it.
3. Settings → **Resources**: at least 2 GB of memory (each running analysis
   holds one repository's history in memory; raise
   `PRSCOUT_JOB_CONCURRENCY` with memory).
4. Settings → Networking → **Generate Domain**. The `https://….up.railway.app`
   address is Vercel's `PRSCOUT_API_URL`. (Or a custom subdomain such as
   `api.your-domain`.)
5. Deploy. The log must show, in this order:
   `migrating the schema from empty to …`, `job runner started`,
   `Application startup complete`, and about a minute later
   `… seeds have no report yet and go first`. It must **not** show
   `GitHub: no credentials`.
6. Check: `curl https://<railway-domain>/health` → `{"ok":true,…}`.
   `curl https://<railway-domain>/v1/reports` → 401 (the key is required).

## Step 5. GitHub OAuth app (sign in with GitHub)

github.com → Settings → Developer settings → **OAuth Apps** → New OAuth App.

- Application name: PRScout
- Homepage URL: `https://<your-domain>`
- Authorization callback URL: `https://<your-domain>/api/auth/callback/github`

Register → copy the **Client ID** (`AUTH_GITHUB_ID`) → Generate a new client
secret (`AUTH_GITHUB_SECRET`). An OAuth App has one callback URL; for sign-in
on preview deployments create a second app.

## Step 6. Google OAuth client (sign in with Google)

console.cloud.google.com → create a project.

1. APIs & Services → **OAuth consent screen**: External; app name PRScout;
   support email; authorized domain `<your-domain>`; scopes `openid`,
   `email`, `profile`. Add yourself as a test user, then **Publish app**
   so anyone can sign in (these scopes need no Google review).
2. APIs & Services → **Credentials** → Create credentials → OAuth client ID
   → Web application.
   - Authorized JavaScript origins: `https://<your-domain>`
   - Authorized redirect URIs: `https://<your-domain>/api/auth/callback/google`
3. Copy the Client ID (`AUTH_GOOGLE_ID`) and Client secret (`AUTH_GOOGLE_SECRET`).

A provider's button only appears when both of its values are set.

## Step 7. Vercel (web app)

1. vercel.com → Add New → Project → import `RauhanAli/PRScout`.
   - **Root Directory: `web`** (Edit → choose `web`).
   - Framework, build command (`npm run vercel-build`) and install command
     come from `web/vercel.json`; leave the overrides off.
2. Environment Variables, scope **Production** (see the table below for
   Preview):

   ```
   PRSCOUT_API_URL=https://<railway-domain>
   PRSCOUT_INTERNAL_KEY=<step 0, same as Railway>
   DATABASE_URL=<Neon prscout_web pooled>
   DATABASE_URL_UNPOOLED=<Neon prscout_web direct>
   AUTH_URL=https://<your-domain>
   AUTH_SECRET=<step 0>
   AUTH_GITHUB_ID=<step 5>
   AUTH_GITHUB_SECRET=<step 5>
   AUTH_GOOGLE_ID=<step 6>
   AUTH_GOOGLE_SECRET=<step 6>
   RESEND_API_KEY=<step 3>
   PRSCOUT_AUTH_EMAIL_FROM=PRScout <account@<your-domain>>
   NEXT_PUBLIC_SITE_HOST=<your-domain>
   NEXT_PUBLIC_CONTACT_EMAIL=<the address on /contact and the policy pages>
   NEXT_PUBLIC_CONTACT_CITY=<the city on the policy pages>
   ```

   Never set `MOCK_API`, `ALLOW_MOCK_IN_PROD`, `TRUST_PROXY_HEADERS` or
   `PRSCOUT_ALLOW_PLACEHOLDER_CONTACT` here.
3. Settings → Functions → **Function Region**: the region of Neon and Railway.
4. Deploy. The build log shows `drizzle-kit migrate` (creating the account
   tables the first time), then `next build`. A build without
   `NEXT_PUBLIC_CONTACT_*` fails on purpose. A deployment missing
   `PRSCOUT_API_URL`, `PRSCOUT_INTERNAL_KEY`, `DATABASE_URL` or `AUTH_SECRET`
   fails at startup and names what is missing.
5. Settings → **Domains** → add `<your-domain>` (and `www`, redirecting to
   it) and set the DNS records Vercel shows.

## Step 8. After the first deploy

On `https://<your-domain>`:

1. Sign up with email and password → you land signed in. Sign out, sign in
   again. A wrong password says so; the 11th wrong try in 15 minutes is refused.
2. "Forgot password?" → the email arrives from `PRSCOUT_AUTH_EMAIL_FROM` →
   the link sets a new password and signs every other device out.
3. Sign in with GitHub, then with Google (new browser profile each).
4. Paste a repository (`github.com/pallets/flask`) → the report finishes
   within a few minutes.
5. Railway log within the first hour: `warm pass: reports N run …` with
   N > 0. Discover then lists repositories, more after each pass.
6. Settings → Connect GitHub → your contributions appear (refreshed daily).
7. After 2 to 3 days, when the warm log shows few seeds "without a current
   report", set `PRSCOUT_WARM_INTERVAL_HOURS=6` on Railway.

## Every variable

Required for launch unless marked optional.

| Variable | Service | Where the value comes from |
| --- | --- | --- |
| `PRSCOUT_ENV` | Railway | `production` |
| `DATABASE_URL` | Railway | Neon `prscout`, direct string |
| `DATABASE_URL` | Vercel | Neon `prscout_web`, pooled string |
| `DATABASE_URL_UNPOOLED` | Vercel | Neon `prscout_web`, direct string |
| `PRSCOUT_INTERNAL_KEY` | Railway + Vercel (same) | `openssl rand -hex 32` |
| `PRSCOUT_SECRET_KEY` | Railway | `openssl rand -hex 32`; keep it stable |
| `AUTH_SECRET` | Vercel | `openssl rand -base64 32` |
| `PRSCOUT_API_URL` | Vercel | Railway's generated domain |
| `PRSCOUT_WEB_URL` | Railway | `https://<your-domain>` (links in emails and badges) |
| `AUTH_URL` | Vercel (Production only) | `https://<your-domain>` |
| `GITHUB_TOKENS` | Railway | Step 2 |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | Vercel | Step 5 |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Vercel | Step 6 |
| `RESEND_API_KEY` | Railway + Vercel | Step 3 |
| `PRSCOUT_ALERT_EMAIL_FROM` | Railway | An address on the Resend domain |
| `PRSCOUT_AUTH_EMAIL_FROM` | Vercel | An address on the Resend domain |
| `NEXT_PUBLIC_SITE_HOST` | Vercel | `<your-domain>`, no `https://` |
| `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_CONTACT_CITY` | Vercel | You; shown publicly on /contact, /terms, /privacy, /refunds |
| `PRSCOUT_WARM_INTERVAL_HOURS` | Railway | `1` at launch, `6` after |
| `PRSCOUT_JOB_CONCURRENCY` | Railway | `2` per 2 GB of memory |
| `PRSCOUT_BADGE_CONCURRENCY` | Railway | `3` (the warm pass runs 3 reports at a time in this lane) |
| `PRSCOUT_ACCOUNT_EMAILS` | Railway | `1`: welcome and plan emails |
| `PRSCOUT_PR_WATCH` | Railway | `1`: PR watch alerts |
| `PRSCOUT_METRICS_KEY` | Railway, optional | Step 0; without it `/metrics` is 404 on Railway |
| `PRSCOUT_ALERT_EMAIL_REPLY_TO` | Railway, optional | A reply-to address |
| `OPENROUTER_API_KEY`, `PRSCOUT_AI_BUDGET_USD`, `PRSCOUT_AI_BUDGET_OWNER_OK=1` | Railway, optional | openrouter.ai; turns on AI reports, with a total spending cap in USD |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `PRSCOUT_PAYMENTS_ENABLED` | Railway, optional | Razorpay dashboard; paid passes |
| `PRSCOUT_ADMIN_USERS` | Railway, optional | Your user id, for the admin views |
| `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY` | Railway, optional | Instead of `GITHUB_TOKENS` (`server/README.md`) |
| `NEXT_PUBLIC_UMAMI_SCRIPT` | Vercel, optional | An Umami script URL (then add its host to the CSP in `web/next.config.ts`) |

Not available in this setup: the pre-flight check, contribution playbook,
merge plan and personalised guidance run in a separate private service
(`PRSCOUT_PRO_URL`, `PRSCOUT_PRO_KEY`) that this repository doesn't contain.
Without it those pages say "not available yet"; everything else works.

**Preview deployments.** Previews run with `NODE_ENV=production`, so they
need the same variables (scope Preview), but leave `AUTH_URL` out: they
then sign in on their own address. They share `prscout_web` unless you
point Preview's `DATABASE_URL` at a Neon branch, and they never run
migrations: a preview whose code needs a new table fails until production
has migrated.

## What changes with Vercel in front (compared with deploy/prod/)

- Visitor IPs come from Vercel's own headers (`x-vercel-forwarded-for`,
  `x-real-ip`); a client-sent `cf-connecting-ip` is ignored.
- Sign-in, password reset, the public extension API and unsubscribe links
  are rate limited through Postgres (`rate_limit`), shared by every
  instance. If the database is down, each instance counts on its own.
- No `/stats/` proxy, so the Umami script stays off unless
  `NEXT_PUBLIC_UMAMI_SCRIPT` names one.
- `/metrics` on the server is closed unless `PRSCOUT_METRICS_KEY` is set.
