# Owner-only feedback for TRACEBACK artifacts

The public guides stay at `https://traceback-team.github.io/traceback-artifacts/`.
This Worker provides a separate iPad-friendly feedback form. After checking the
signed-in GitHub account's numeric ID, it writes public JSON files under
`traceback-team/traceback-artifacts/feedback/`. Anyone can read the opinions;
only the owner can submit through this form. Saving feedback never starts
Codex or edits a guide. The saved page offers copyable prompts for the newest
opinion or every `feedback/*.json`, then opens Codex Cloud. The owner selects
the published environment and submits the prompt there. Later, the owner can
open the feedback form from Pages and follow its saved-opinions link to
`/handoff` for the same batch prompt.

GitHub Pages and the public repository can stay on GitHub Free, and the Worker
can run within [Cloudflare's free request allowance](https://developers.cloudflare.com/workers/platform/pricing/)
for personal use. Cloudflare still needs its own account. This design does not
use the OpenAI API or add API billing; Codex Cloud tasks use the existing
ChatGPT plan and its limits.

## One-time setup

1. Use the existing public `traceback-team/traceback-artifacts` repository. The
   Worker creates `feedback/<id>.json` on `main`; the Pages workflow runs only
   for `docs/artifact/**`, its own workflow, or `scripts/verify_site.py`, so a
   feedback-only commit does not deploy the site.
2. In Cloudflare's free Workers plan, run `npm ci`, sign in with
   `npx wrangler login`, then run `npx wrangler deploy` here to obtain the Worker
   HTTPS URL. The `workers.dev` URL is suitable for this small personal form.
3. Use a GitHub App that can be installed on the `traceback-team` organization:
   [transfer ownership of the existing App](https://docs.github.com/en/apps/maintaining-github-apps/transferring-ownership-of-a-github-app)
   to the organization and keep it private, register a new organization-owned
   private App, or make the existing personal App public. Set its website URL
   to the Worker origin and
   its callback to `<worker-origin>/oauth/callback`. Disable webhooks, grant
   only **Contents: Read and write** repository permission, and install it on
   **only** `traceback-artifacts`. Record the App ID, Client ID, and that
   organization's installation ID. If the App is new, generate a client secret
   and private key. GitHub's [App setup documentation](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app)
   describes these settings.
4. Convert the downloaded private key to PKCS#8 if necessary:

   ```sh
   openssl pkcs8 -topk8 -nocrypt -in github-app.pem -out github-app-pkcs8.pem
   ```

   Add these **Worker secrets**, never repository files or browser code:

   ```sh
   npx wrangler secret put GITHUB_APP_CLIENT_ID
   npx wrangler secret put GITHUB_APP_CLIENT_SECRET
   npx wrangler secret put GITHUB_APP_ID
   npx wrangler secret put GITHUB_APP_INSTALLATION_ID
   npx wrangler secret put GITHUB_APP_PRIVATE_KEY < github-app-pkcs8.pem
   npx wrangler secret put SESSION_SECRET
   ```

   Use a fresh random value of at least 32 bytes for `SESSION_SECRET`. Keep the
   PEM files outside this repository and delete local copies when no longer
   needed. The Worker requests a short-lived installation token scoped to the
   artifact repository for each save. The login token is used only to identify
   the GitHub user and is discarded after the callback.
5. Set the **repository Actions variable** `FEEDBACK_WORKER_ORIGIN` in
   `traceback-team/traceback-artifacts` to the Worker HTTPS origin, with no path or
   trailing slash. Run the Pages workflow or merge a change to `main`. The
   workflow writes `site-config.json` with the exact deployed Git revision and
   Worker origin. The shared script shows the feedback link on each guide only
   when this config exists.
6. Keep the personal Codex Cloud environment's existing three repositories,
   including `traceback-team/traceback-artifacts`. In a new Cloud task, ask Codex
   to read `feedback/<id>.json` or all `feedback/*.json` from that repository.
   The saved page prepares either prompt. The user must send it in Codex Cloud;
   saving never triggers a task. Ask Codex to assess each opinion, revise the
   relevant artifact, run site checks, and make one PR for review.

## Data and access

The form records `document_url`, `section_id` (or null), `selected_text` (null),
`location`, `comment`, `document_revision`, `author.github_id`, `author.login`,
and `created_at`. The URL must be a guide on the public Pages origin; the
revision must be a 40-character commit ID. The server checks a signed,
HTTP-only session for the fixed numeric GitHub account ID `88140361`, same-origin
form submission, and a CSRF token. Other accounts receive HTTP 403 at login;
unauthenticated saves receive HTTP 401. There is no modify or run endpoint.
The owner-only `GET /handoff` page prepares a batch prompt. Its
`GET /handoff.js` script only copies the visible prompt to the clipboard; the
Codex link opens the Cloud UI and does not submit a task.

The login and feedback form live on the Worker origin. This full-page navigation
avoids third-party cookies between `github.io` and `workers.dev` in iPad Safari.
GitHub and OpenAI credentials are never placed in Pages files. GitHub App
credentials stay in Worker secrets. The feedback files are public repository
content, so the form warns readers before submission. GitHub's repository
permissions still govern direct commits outside the Worker.

## Verification

```sh
npm ci
npm test
npx wrangler deploy --dry-run
python3 ../scripts/verify_site.py
```

After deployment, verify on an iPad-size viewport that the feedback link opens
the form, the GitHub login returns to the same document, and an `oscar2272`
save creates one public JSON file under `feedback/` without a Pages deployment.
A different GitHub account must get HTTP 403. Start a new Codex Cloud task and
confirm it can read that file. The earlier live save to the separate private
repository is not proof that this new target works; verify it separately.
